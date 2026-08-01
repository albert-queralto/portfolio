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
- Dify console: bound to `127.0.0.1:18081` on the VM and accessed through an SSH tunnel to `albertqueralto.dev`.

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

The helper uses VM port `18081` by default because `8081` is already occupied on this server. If `18081` is also busy, choose another free VM-local port:

```bash
cd ~/portfolio
DIFY_CONSOLE_PORT=28081 DIFY_CONSOLE_SSL_PORT=28444 ./scripts/configure-dify-env.sh ~/dify/docker/.env
```

That script backs up `~/dify/docker/.env` and sets the Dify URL/bind variables for local, private access:

```dotenv
CONSOLE_API_URL=http://127.0.0.1:18081
CONSOLE_WEB_URL=http://127.0.0.1:18081
SERVICE_API_URL=http://127.0.0.1:18081
APP_API_URL=http://127.0.0.1:18081
APP_WEB_URL=http://127.0.0.1:18081
FILES_URL=http://127.0.0.1:18081
TRIGGER_URL=http://127.0.0.1:18081
ENDPOINT_URL_TEMPLATE=http://127.0.0.1:18081/e/{hook_id}
NEXT_PUBLIC_SOCKET_URL=ws://127.0.0.1:18081
EXPOSE_NGINX_PORT=127.0.0.1:18081
EXPOSE_NGINX_SSL_PORT=127.0.0.1:18444
NGINX_HTTPS_ENABLED=false
SERVER_WORKER_AMOUNT=1
API_WEBSOCKET_WORKER_AMOUNT=1
CELERY_WORKER_AMOUNT=1
CELERY_AUTO_SCALE=false
ENABLE_COLLABORATION_MODE=false
COMPOSE_PROFILES=weaviate,postgresql
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

Before starting Dify, make sure Compose is not still seeing the old `8081` value:

```bash
cd ~/dify/docker
env | grep '^EXPOSE_NGINX_PORT=' || true
grep -n '^EXPOSE_NGINX_PORT=' .env
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml config | grep -A4 'published: "18081"'
```

If `env` prints `EXPOSE_NGINX_PORT=8081`, clear the exported shell variable and run the env helper again:

```bash
unset EXPOSE_NGINX_PORT EXPOSE_NGINX_SSL_PORT
cd ~/portfolio
./scripts/configure-dify-env.sh ~/dify/docker/.env
```

Start Dify from inside `~/dify/docker`:

```bash
cd ~/dify/docker
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml up -d
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml ps
```

This uses two Compose files at the same time:

- `docker-compose.yaml`: Dify's official services.
- `docker-compose.ollama-access.yaml`: this repo's small override that lets Dify reach Ollama on the private `local-ai` network.

Docker Compose merges those files before starting the containers. Use the same `-f docker-compose.yaml -f docker-compose.ollama-access.yaml` pair whenever you run Dify commands such as `up`, `ps`, `logs`, or `down`.

Dify's default Compose setup starts the Dify app services plus PostgreSQL, Redis, Weaviate, sandboxing, plugin services, and its internal Nginx. The override only adds the private `local-ai` network to the services that need to reach Ollama.

If Dify says the external `local-ai` network does not exist, start the portfolio stack first or create it manually:

```bash
docker network create local-ai
```

If Docker still says `Bind for 0.0.0.0:8081 failed: port is already allocated`, Compose is still reading the old port. Run this exact reset:

```bash
cd ~/dify/docker
unset EXPOSE_NGINX_PORT EXPOSE_NGINX_SSL_PORT
grep -n '^EXPOSE_NGINX_PORT=' .env

cd ~/portfolio
./scripts/configure-dify-env.sh ~/dify/docker/.env

cd ~/dify/docker
grep -n '^EXPOSE_NGINX_PORT=' .env
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml down
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml up -d --force-recreate nginx
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml up -d
```

If Dify's `nginx` container restarts with `host not found in upstream "api"`, the Ollama override has replaced one of Dify's internal networks instead of adding to it. Copy the current override from this repo again, then recreate Dify:

```bash
cp ~/portfolio/dify/docker-compose.ollama-access.yaml ~/dify/docker/

cd ~/dify/docker
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml down
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml up -d
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml ps
```

After the fix, `nginx` should be `Up`, not `Restarting`.

## 4. Open Dify privately

Dify is bound to `127.0.0.1:18081` on the Ubuntu VM, so it is not directly visible on the public internet. First, confirm it responds on the VM:

```bash
curl -I http://127.0.0.1:18081/install
```

The response should look like HTML or an HTTP redirect. If you see JSON such as `{"detail":"Not Found"}`, port `18081` is not reaching Dify's web UI. Check what is listening on the VM:

```bash
sudo ss -ltnp | grep ':18081'
cd ~/dify/docker
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml ps
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml logs --tail=80 nginx web api
```

Most often this means Dify was started before `.env` was patched, so Docker is still using the old port mapping. Restart Dify after running the env helper:

```bash
cd ~/portfolio
./scripts/configure-dify-env.sh ~/dify/docker/.env

cd ~/dify/docker
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml down
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml up -d
```

If the Dify `api` logs show `Worker ... was sent SIGKILL! Perhaps out of memory?`, the 4 GB VM is running out of memory. Dify plus Weaviate plus Ollama is tight on 4 GB. Add swap, reduce Ollama's memory/model size, or move to a larger VM before indexing documents.

Then leave the VM terminal alone and open a new terminal on your own computer. From your computer, create an SSH tunnel to the VM:

```bash
ssh -L 18081:127.0.0.1:18081 your-user@albertqueralto.dev
```

If SSH says local port `18081` is already in use on your own computer, choose a different local port:

```bash
ssh -L 28081:127.0.0.1:18081 your-user@albertqueralto.dev
```

Keep that SSH session open. Then open this URL in the browser on your own computer, not on the Ubuntu server:

```text
http://127.0.0.1:18081/install
```

If you used the alternate tunnel, open:

```text
http://127.0.0.1:28081/install
```

In this URL, `127.0.0.1` means your computer. The SSH tunnel forwards it to `127.0.0.1:18081` on the VM.

Use `127.0.0.1`, not `localhost`, because Dify's frontend is configured with `CONSOLE_API_URL=http://127.0.0.1:18081`. Mixing `localhost` and `127.0.0.1` makes the browser treat the page and API as different origins and can trigger CORS errors.

If the page still hangs and the browser console shows status `502`, check whether Dify's API is healthy on the VM:

```bash
cd ~/dify/docker
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml ps
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml logs --tail=120 nginx api worker
```

If the API logs show `Worker ... was sent SIGKILL! Perhaps out of memory?`, the VM is out of memory. Stop Ollama temporarily during Dify setup, apply the low-memory env patch, and recreate Dify:

```bash
cd ~/portfolio
docker compose stop ollama ollama-init
./scripts/configure-dify-env.sh ~/dify/docker/.env

cd ~/dify/docker
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml down
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml up -d
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml ps
```

Then retry:

```text
http://127.0.0.1:18081/install
```

If it still returns `502`, check for kernel OOM events:

```bash
sudo dmesg -T | grep -Ei 'killed process|out of memory|oom'
free -h
```

On a 4 GB VM, Dify plus Weaviate plus Ollama can still be too tight while Dify is initializing or indexing documents. Add swap or move to a larger VM if the API keeps getting killed.

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

Follow Dify logs:

```bash
cd ~/dify/docker
docker compose -f docker-compose.yaml -f docker-compose.ollama-access.yaml logs -f api worker
```

Upgrade Dify by following the release notes for the target version. Keep `docker-compose.ollama-access.yaml` in place and include it whenever you run Dify Compose commands.

## Rollback

The previous RAGFlow implementation has been archived in:

```text
backups/ragflow-implementation-20260801-portfolio.tgz
```
