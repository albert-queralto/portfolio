import { createHash } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.PORT || 7070);
const DIFY_API_BASE_URL = (process.env.DIFY_API_BASE_URL || "http://api:5001/v1").replace(
  /\/$/,
  "",
);
const DIFY_API_KEY = process.env.DIFY_API_KEY || "";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 180000);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 1);
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_REQUESTS = Number(process.env.RATE_LIMIT_REQUESTS || 12);
const DIFY_RESPONSE_MODE =
  process.env.DIFY_RESPONSE_MODE === "blocking" ? "blocking" : "streaming";
const DIFY_INPUTS_RESULT = parseJsonObjectEnv("DIFY_INPUTS_JSON", process.env.DIFY_INPUTS_JSON);

let activeRequests = 0;
const rateLimits = new Map();

function parseJsonObjectEnv(name, rawValue) {
  if (!rawValue) return { value: {}, error: "" };

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return { value: {}, error: `${name} must be a JSON object.` };
    }

    return { value: parsed, error: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    return { value: {}, error: `${name} could not be parsed: ${message}` };
  }
}

function jsonResponse(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request, maxBytes = 32768) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isRateLimited(ip) {
  const now = Date.now();
  const current = rateLimits.get(ip);

  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_REQUESTS;
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) {
    throw new Error("Send between 1 and 12 messages.");
  }

  let totalCharacters = 0;
  const messages = value.map((message) => {
    const role = message?.role;
    const content = typeof message?.content === "string" ? message.content.trim() : "";

    if (!["user", "assistant"].includes(role) || !content || content.length > 2000) {
      throw new Error("Each message must have a valid role and content.");
    }

    totalCharacters += content.length;
    return { role, content };
  });

  if (messages.at(-1)?.role !== "user") {
    throw new Error("The final message must be from the user.");
  }

  if (totalCharacters > 12000) {
    throw new Error("Conversation history is too long.");
  }

  return messages;
}

function validateOptionalToken(value, name) {
  if (value === undefined || value === null || value === "") return "";

  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(trimmed)) {
    throw new Error(`${name} is invalid.`);
  }

  return trimmed;
}

function configurationReady() {
  return Boolean(DIFY_API_BASE_URL && DIFY_API_KEY && !DIFY_INPUTS_RESULT.error);
}

function buildDifyUserId(clientId, request, clientIp) {
  const userAgent = request.headers["user-agent"] || "";
  const source = clientId || `${clientIp}:${userAgent}`;
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 32);

  return `portfolio-${hash}`;
}

function parseJson(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function parseDifyError(rawText) {
  const payload = parseJson(rawText);
  const message =
    payload?.message ||
    payload?.error?.message ||
    payload?.code ||
    rawText.trim().slice(0, 240);

  return message || "The knowledge assistant returned an error.";
}

function parseDifyStream(rawText) {
  let chunkedAnswer = "";
  let finalAnswer = "";
  let conversationId = "";
  let messageId = "";
  let streamError = "";

  for (const line of rawText.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;

    const data = line.slice("data:".length).trim();
    if (!data || data === "[DONE]") continue;

    const event = parseJson(data);
    if (!event) continue;

    if (typeof event.conversation_id === "string") {
      conversationId = event.conversation_id;
    }

    if (typeof event.message_id === "string") {
      messageId = event.message_id;
    }

    if (event.event === "error") {
      streamError = event.message || event.code || "Dify returned a stream error.";
      break;
    }

    if (event.event === "workflow_finished" && event.data?.status === "failed") {
      streamError = event.data?.error || "Dify workflow execution failed.";
      break;
    }

    const answer = typeof event.answer === "string" ? event.answer : "";
    if (answer && event.event === "agent_message") {
      chunkedAnswer += answer;
    }

    if (answer && event.event === "message") {
      if (chunkedAnswer && answer.startsWith(chunkedAnswer)) {
        finalAnswer = answer;
      } else {
        chunkedAnswer += answer;
      }
    }

    if (event.event === "workflow_finished") {
      const outputs = event.data?.outputs || {};
      if (typeof outputs.answer === "string") {
        finalAnswer = outputs.answer;
      } else if (typeof outputs.text === "string") {
        finalAnswer = outputs.text;
      }
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }

  return {
    answer: (finalAnswer || chunkedAnswer).trim(),
    conversationId,
    messageId,
  };
}

function parseDifyResponse(rawText, contentType) {
  if (contentType.includes("text/event-stream") || rawText.startsWith("data:")) {
    return parseDifyStream(rawText);
  }

  const payload = parseJson(rawText);
  return {
    answer: payload?.answer?.trim() || "",
    conversationId: payload?.conversation_id || "",
    messageId: payload?.message_id || payload?.id || "",
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    return jsonResponse(response, configurationReady() ? 200 : 503, {
      ok: configurationReady(),
      provider: "dify",
      responseMode: DIFY_RESPONSE_MODE,
      inputsError: DIFY_INPUTS_RESULT.error || undefined,
    });
  }

  if (request.method !== "POST" || request.url !== "/api/chat") {
    return jsonResponse(response, 404, { error: "Not found." });
  }

  const clientIp = String(
    request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown",
  )
    .split(",")[0]
    .trim();

  if (isRateLimited(clientIp)) {
    return jsonResponse(response, 429, {
      error: "Too many requests. Please try again in a few minutes.",
    });
  }

  if (!configurationReady()) {
    return jsonResponse(response, 503, {
      error: "The assistant has not been configured yet.",
    });
  }

  if (activeRequests >= MAX_CONCURRENT) {
    return jsonResponse(response, 503, {
      error: "The assistant is busy. Please try again shortly.",
    });
  }

  activeRequests += 1;

  try {
    const body = await readJson(request);
    const messages = validateMessages(body.messages);
    const conversationId = validateOptionalToken(body.conversationId, "conversationId");
    const clientId = validateOptionalToken(body.clientId, "clientId");
    const query = messages.at(-1).content;
    const user = buildDifyUserId(clientId, request, clientIp);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch(`${DIFY_API_BASE_URL}/chat-messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DIFY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: DIFY_INPUTS_RESULT.value,
          query,
          response_mode: DIFY_RESPONSE_MODE,
          conversation_id: conversationId,
          user,
          files: [],
          auto_generate_name: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await upstream.text();
    if (!upstream.ok) {
      console.error("Dify request failed", upstream.status, rawText.slice(0, 500));
      return jsonResponse(response, 502, {
        error: parseDifyError(rawText),
      });
    }

    const payload = parseDifyResponse(rawText, upstream.headers.get("content-type") || "");
    if (!payload.answer) {
      console.error("Unexpected Dify response", rawText.slice(0, 500));
      return jsonResponse(response, 502, {
        error: "The knowledge assistant returned an empty response.",
      });
    }

    return jsonResponse(response, 200, {
      answer: payload.answer,
      conversationId: payload.conversationId || conversationId,
      messageId: payload.messageId || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status =
      message.includes("too large") ||
      message.includes("message") ||
      message.includes("conversationId") ||
      message.includes("clientId")
        ? 400
        : 502;
    console.error("Chat proxy error", message);
    return jsonResponse(response, status, {
      error: status === 400 ? message : "The assistant is unavailable right now.",
    });
  } finally {
    activeRequests -= 1;
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Chat API listening on port ${PORT}`);
});
