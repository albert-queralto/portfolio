import http from "node:http";
import { Readable } from "node:stream";

const PORT = Number(process.env.PORT || 7071);
const TOKEN = process.env.OLLAMA_GATEWAY_TOKEN || "";
const UPSTREAM = (process.env.OLLAMA_UPSTREAM || "http://ollama:11434").replace(/\/$/, "");
const MAX_BODY_BYTES = 12 * 1024 * 1024;

function reject(response, status, message) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify({ error: message }));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }

  return chunks.length ? Buffer.concat(chunks) : undefined;
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    return reject(response, TOKEN ? 200 : 503, TOKEN ? "ok" : "not configured");
  }

  if (!TOKEN) return reject(response, 503, "Gateway token is not configured.");

  const authorization = request.headers.authorization || "";
  if (authorization !== `Bearer ${TOKEN}`) {
    return reject(response, 401, "Unauthorized.");
  }

  if (!['GET', 'POST', 'HEAD'].includes(request.method || "")) {
    return reject(response, 405, "Method not allowed.");
  }

  try {
    const body = await readBody(request);
    const upstream = await fetch(`${UPSTREAM}${request.url}`, {
      method: request.method,
      headers: {
        "Content-Type": request.headers["content-type"] || "application/json",
        Accept: request.headers.accept || "application/json",
      },
      body,
      signal: AbortSignal.timeout(180000),
    });

    const headers = {};
    for (const name of ["content-type", "content-length"]) {
      const value = upstream.headers.get(name);
      if (value) headers[name] = value;
    }
    headers["cache-control"] = "no-store";
    response.writeHead(upstream.status, headers);

    if (!upstream.body) return response.end();
    Readable.fromWeb(upstream.body).pipe(response);
  } catch (error) {
    console.error("Ollama gateway error", error instanceof Error ? error.message : error);
    return reject(response, 502, "Ollama is unavailable.");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Ollama auth gateway listening on port ${PORT}`);
});
