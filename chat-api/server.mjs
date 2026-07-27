import http from "node:http";

const PORT = Number(process.env.PORT || 7070);
const RAGFLOW_BASE_URL = (process.env.RAGFLOW_BASE_URL || "").replace(/\/$/, "");
const RAGFLOW_CHAT_ID = process.env.RAGFLOW_CHAT_ID || "";
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY || "";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 180000);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 1);
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_REQUESTS = Number(process.env.RATE_LIMIT_REQUESTS || 12);

let activeRequests = 0;
const rateLimits = new Map();

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

    if (!['user', 'assistant'].includes(role) || !content || content.length > 2000) {
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

function configurationReady() {
  return Boolean(RAGFLOW_BASE_URL && RAGFLOW_CHAT_ID && RAGFLOW_API_KEY);
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    return jsonResponse(response, configurationReady() ? 200 : 503, {
      ok: configurationReady(),
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch(
        `${RAGFLOW_BASE_URL}/api/v1/openai/${encodeURIComponent(RAGFLOW_CHAT_ID)}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RAGFLOW_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "model",
            messages,
            stream: false,
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }

    if (!upstream.ok) {
      console.error("RAGFlow request failed", upstream.status, rawText.slice(0, 500));
      return jsonResponse(response, 502, {
        error: "The knowledge assistant returned an error.",
      });
    }

    const answer = payload?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      console.error("Unexpected RAGFlow response", rawText.slice(0, 500));
      return jsonResponse(response, 502, {
        error: "The knowledge assistant returned an empty response.",
      });
    }

    return jsonResponse(response, 200, { answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.includes("too large") || message.includes("message") ? 400 : 502;
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
