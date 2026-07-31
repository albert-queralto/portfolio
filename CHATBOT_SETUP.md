# Self-hosted portfolio chatbot: Dify + Ollama

This setup replaces the custom RAGFlow stack with self-hosted Dify Community Edition while keeping Ollama for local inference. Dify owns the assistant, knowledge base, retrieval workflow, and conversation state. Ollama serves the chat and embedding models on a private Docker network.

The lower technical cost comes from removing the custom RAGFlow bootstrap/database/vector stack while keeping model runtime local.

## Architecture

- VM public DNS: `albertqueralto.dev`.
- `~/portfolio` on the VM: Astro site, public chat proxy, Nginx, Certbot, and Ollama.
- `~/dify/docker` on the VM: official self-hosted Dify deployment.
- `local-ai`: private Docker network shared by Dify, Ollama, and `chat-api`.
- Dify model provider URL: `http://ollama:11434`.
- Portfolio chat proxy URL: `http://api:5001/v1`.
- Public Nginx: exposes only `https://albertqueralto.dev/api/chat`.
- Dify console: bound to `127.0.0.1:8081` on the VM and accessed through an SSH tunnel to `albertqueralto.dev`.

Do not point public DNS directly at Dify. Visitors only reach the portfolio domain; the browser calls `https://albertqueralto.dev/api/chat`, and the VM-local `chat-api` container calls Dify privately through Docker networking.

## 1. Generate portfolio env

```bash
cd ~/portfolio
./scripts/generate-local-env.sh
```

Then edit `.env` and keep these defaults unless you deliberately change models:

```dotenv
DIFY_API_BASE_URL=http://api:5001/v1
DIFY_API_KEY=
DIFY_RESPONSE_MODE=streaming
DIFY_INPUTS_JSON={}

OLLAMA_CHAT_MODEL=gemma3:1b
OLLAMA_EMBEDDING_MODEL=embeddinggemma:300m-qat-q4_0
```

Leave `DIFY_API_KEY` empty until you create the Dify app API key.

## 2. Start portfolio + Ollama

```bash
cd ~/portfolio
./scripts/start-portfolio-chatbot.sh
```

This starts:

- `portfolio`
- `chat-api`
- `reverse-proxy`
- `certbot`
- `ollama`
- `ollama-init`

`ollama-init` pulls the chat and embedding models defined in `.env`.

Check the pull:

```bash
docker compose logs ollama-init
docker compose exec ollama ollama list
```

Ollama is not published on a public host port. Dify reaches it through the shared `local-ai` Docker network at:

```text
http://ollama:11434
```

## 3. Install self-hosted Dify

Install Dify outside this repo so it can be upgraded with the official release flow.

```bash
cd ~
git clone https://github.com/langgenius/dify.git
cd dify
git fetch --tags
DIFY_VERSION="$(git tag --sort=-version:refname | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1)"
test -n "$DIFY_VERSION"
echo "Installing Dify $DIFY_VERSION"
git checkout "$DIFY_VERSION"
cd docker
cp .env.example .env
```

This avoids the `fatal: Remote branch  not found in upstream origin` error, which happens when the GitHub API release lookup returns an empty value.

The file you pasted is Dify's `.env.example` style configuration, not the service Compose YAML. Use it as `~/dify/docker/.env` only after you have the matching Dify release checked out. The safer default is to copy the release's own `.env.example`, then patch the values needed for this portfolio:

```bash
cd ~/portfolio
./scripts/configure-dify-env.sh ~/dify/docker/.env
```

That script backs up `~/dify/docker/.env` and sets the Dify URL/bind variables for local, private access:

```dotenv
CONSOLE_API_URL=http://127.0.0.1:8081
CONSOLE_WEB_URL=http://127.0.0.1:8081
SERVICE_API_URL=http://127.0.0.1:8081
APP_API_URL=http://127.0.0.1:8081
APP_WEB_URL=http://127.0.0.1:8081
FILES_URL=http://127.0.0.1:8081
TRIGGER_URL=http://127.0.0.1:8081
ENDPOINT_URL_TEMPLATE=http://127.0.0.1:8081/e/{hook_id}
NEXT_PUBLIC_SOCKET_URL=ws://127.0.0.1:8081
EXPOSE_NGINX_PORT=127.0.0.1:8081
EXPOSE_NGINX_SSL_PORT=127.0.0.1:8444
NGINX_HTTPS_ENABLED=false
```

Before first start, edit `~/dify/docker/.env` and set:

```dotenv
INIT_PASSWORD=replace-with-a-temporary-install-password
```

The pasted defaults also include development passwords and tokens such as `DB_PASSWORD`, `REDIS_PASSWORD`, `WEAVIATE_API_KEY`, `PLUGIN_DAEMON_KEY`, `PLUGIN_DIFY_INNER_API_KEY`, and `DIFY_AGENT_API_TOKEN`. For a real server, replace those before exposing the portfolio assistant publicly.

Copy the Dify override from this repo into the Dify Docker directory:

```bash
cp ~/portfolio/dify/docker-compose.ollama-access.yaml ~/dify/docker/
```

Start Dify with the official Compose file plus the local-network override:

```bash
docker compose \
  -f docker-compose.yaml \
  -f docker-compose.ollama-access.yaml \
  up -d

docker compose \
  -f docker-compose.yaml \
  -f docker-compose.ollama-access.yaml \
  ps
```

Dify's default Compose setup starts the Dify app services plus PostgreSQL, Redis, Weaviate, sandboxing, plugin services, and its internal Nginx. The override only adds the private `local-ai` network to the services that need to reach Ollama.

If Dify says the external `local-ai` network does not exist, start the portfolio stack first or create it manually:

```bash
docker network create local-ai
```

## 4. Open Dify privately

From your local machine, tunnel the server's localhost port:

```bash
ssh -L 8081:127.0.0.1:8081 your-user@albertqueralto.dev
```

Open:

```text
http://localhost:8081/install
```

Create the admin account.

## 5. Configure Ollama in Dify

In Dify:

1. Install or enable the Ollama model provider if it is not already available.
2. Set the Ollama base URL to:

```text
http://ollama:11434
```

3. Add the chat model from `.env`, for example:

```text
gemma3:1b
```

4. Add the embedding model from `.env`, for example:

```text
embeddinggemma:300m-qat-q4_0
```

5. Test both models in the Dify provider UI.

Do not use `localhost` for Ollama inside Dify. From a Dify container, `localhost` points back to that Dify container, not the Ollama container.

## 6. Prepare and upload knowledge

```bash
cd ~/portfolio
./scripts/prepare-chatbot-documents.sh
```

Upload the files from `chatbot-documents/` into a Dify knowledge base:

- `CV.pdf`
- `about-albert.md`
- `projects/*.md`
- `articles/*.md`

Edit `chatbot-documents/about-albert.md` before upload if the assistant needs a more accurate biography.

Then create `Albert Portfolio Assistant`, attach the knowledge base, choose the Ollama chat and embedding models, and publish the app.

## 7. Create the app API key

In Dify:

1. Open `Albert Portfolio Assistant`.
2. Open the API access page for that app.
3. Create an app API key.
4. Copy it into `~/portfolio/.env`.

Set:

```dotenv
DIFY_API_KEY=app-your-dify-app-api-key
```

Restart the portfolio chat proxy:

```bash
cd ~/portfolio
docker compose up -d --build chat-api reverse-proxy
```

## 8. Test each layer

Test Dify from the `chat-api` container:

```bash
docker compose exec chat-api wget -qO- http://api:5001/v1/info \
  --header "Authorization: Bearer $(grep '^DIFY_API_KEY=' .env | cut -d= -f2-)"
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

Show portfolio and Ollama status:

```bash
cd ~/portfolio
docker compose ps
```

Follow logs:

```bash
docker compose logs -f chat-api
docker compose logs -f ollama
```

Restart after changing portfolio `.env`:

```bash
docker compose up -d --build chat-api reverse-proxy ollama ollama-init
```

Show Dify status:

```bash
cd ~/dify/docker
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml ps
```

Upgrade Dify by following the release notes for the target version. Keep `docker-compose.ollama-access.yaml` in place and include it whenever you run Dify Compose commands.

## Rollback

The previous RAGFlow implementation has been archived in:

```text
backups/ragflow-implementation-20260801-portfolio.tgz
```
