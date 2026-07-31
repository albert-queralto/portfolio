# Self-hosted portfolio chatbot: Dify + Docker

This setup replaces the custom RAGFlow stack with self-hosted Dify Community Edition. The portfolio stays small: it runs the Astro site, a public chat proxy, Nginx, and Certbot. Dify runs from its official Docker Compose deployment and owns the assistant, knowledge base, model provider, and conversation state.

The cost reduction comes from avoiding a custom RAG bootstrap layer and keeping Dify upgrades aligned with the upstream project.

## Architecture

- `~/dify/docker`: official self-hosted Dify deployment.
- `~/portfolio`: this portfolio, including `chat-api`.
- `chat-api`: calls Dify at `DIFY_API_BASE_URL/chat-messages`.
- Public Nginx: exposes only `https://albertqueralto.dev/api/chat`.
- Dify console/API: bound to `127.0.0.1:8081` on the server by default.

## 1. Prepare the knowledge documents

```bash
cd ~/portfolio
./scripts/prepare-chatbot-documents.sh
```

Upload the files from `chatbot-documents/` into Dify's knowledge base:

- `CV.pdf`
- `about-albert.md`
- `projects/*.md`
- `articles/*.md`

Edit `chatbot-documents/about-albert.md` before upload if the assistant needs a more accurate biography.

## 2. Install self-hosted Dify

Install Dify outside this repo so it can be upgraded with the official release flow.

```bash
cd ~
git clone --branch "$(curl -s https://api.github.com/repos/langgenius/dify/releases/latest | jq -r .tag_name)" https://github.com/langgenius/dify.git
cd dify/docker
cp .env.example .env
```

Edit `~/dify/docker/.env` and bind Dify to localhost so it does not publish an admin console directly to the internet:

```dotenv
EXPOSE_NGINX_PORT=127.0.0.1:8081
EXPOSE_NGINX_SSL_PORT=127.0.0.1:8444
SERVICE_API_URL=http://127.0.0.1:8081/v1
CONSOLE_WEB_URL=http://127.0.0.1:8081
APP_WEB_URL=http://127.0.0.1:8081
FILES_URL=http://127.0.0.1:8081
TRIGGER_URL=http://127.0.0.1:8081
NEXT_PUBLIC_SOCKET_URL=ws://127.0.0.1:8081
INIT_PASSWORD=replace-with-a-temporary-install-password
```

Then start Dify:

```bash
docker compose up -d
docker compose ps
```

Dify's default Compose setup starts the Dify app services plus PostgreSQL, Redis, Weaviate, sandboxing, plugin services, and its internal Nginx.

## 3. Open Dify privately

From your local machine, tunnel the server's localhost port:

```bash
ssh -L 8081:127.0.0.1:8081 your-user@your-server
```

Open:

```text
http://localhost:8081/install
```

Create the admin account, configure the model provider, create `Albert Portfolio Assistant`, attach the uploaded knowledge base, and publish the app.

For fully local inference, configure Dify's Ollama provider to point at an Ollama endpoint reachable from the Dify `api` and `worker` containers. For lower operations cost, use any provider you are comfortable paying for and managing.

## 4. Create the app API key

In Dify:

1. Open `Albert Portfolio Assistant`.
2. Open the API access page for that app.
3. Create an app API key.
4. Copy it into the portfolio `.env`.

Generate the portfolio `.env` if it does not exist:

```bash
cd ~/portfolio
./scripts/generate-local-env.sh
```

Set:

```dotenv
DIFY_API_BASE_URL=http://host.docker.internal:8081/v1
DIFY_API_KEY=app-your-dify-app-api-key
DIFY_RESPONSE_MODE=streaming
DIFY_INPUTS_JSON={}
```

Use `DIFY_INPUTS_JSON` only if the Dify app defines required input variables.

## 5. Start the portfolio chatbot

```bash
cd ~/portfolio
./scripts/start-portfolio-chatbot.sh
```

The portfolio reverse proxy exposes `/api/chat`, and the browser never sees the Dify API key.

## 6. Test each layer

Test Dify directly from the server:

```bash
set -a
source ~/portfolio/.env
set +a

curl -sS "$DIFY_API_BASE_URL/chat-messages" \
  -H "Authorization: Bearer $DIFY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {},
    "query": "What projects has Albert built?",
    "response_mode": "blocking",
    "user": "server-test"
  }' | jq .
```

Test the public portfolio proxy:

```bash
curl -sS https://albertqueralto.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What machine-learning experience does Albert have?"}
    ],
    "clientId": "server-test"
  }' | jq .
```

## Operations

Show portfolio status:

```bash
cd ~/portfolio
docker compose ps
```

Follow logs:

```bash
docker compose logs -f chat-api
docker compose logs -f reverse-proxy
```

Restart after changing `.env`:

```bash
docker compose up -d --build chat-api reverse-proxy
```

Show Dify status:

```bash
cd ~/dify/docker
docker compose ps
```

Upgrade Dify by following the release notes for the target version, then rerun:

```bash
cd ~/dify/docker
docker compose up -d
```

## Rollback

The previous RAGFlow implementation has been archived in:

```text
backups/ragflow-implementation-20260801-portfolio.tgz
```
