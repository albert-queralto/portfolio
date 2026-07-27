# Fully local portfolio chatbot: RAGFlow + Ollama + Docker

This project runs the complete chatbot stack on the same Docker host:

- Astro portfolio
- Public chat proxy
- RAGFlow v0.25.6
- Infinity document/vector engine
- MySQL
- MinIO
- Valkey/Redis
- Ollama
- Nginx and Certbot

RAGFlow reaches Ollama through the internal Docker address `http://ollama:11434`. Ollama is not exposed publicly.

## 1. Replace the project on the server

Back up the current deployment and extract this project into `~/portfolio`.

```bash
cd ~
mv portfolio portfolio.backup.$(date +%Y%m%d-%H%M%S)
unzip portfolio-ragflow-local.zip
mv portfolio-ragflow-local portfolio
cd portfolio
```

## 2. Add the RAGFlow DNS record

Create an `A` record with your DNS provider:

```text
ragflow.albertqueralto.dev -> your server IPv4 address
```

Check it:

```bash
dig +short ragflow.albertqueralto.dev
```

## 3. Generate local passwords

```bash
cd ~/portfolio
./scripts/generate-local-env.sh
```

This creates `.env` with random MySQL, MinIO, and Redis passwords. Keep `.env` out of Git.

## 4. Start the complete stack

```bash
./scripts/start-local-ragflow.sh
```

The `ollama-init` container automatically downloads:

```text
gemma3:1b
embeddinggemma:300m-qat-q4_0
```

Monitor startup:

```bash
docker compose ps
docker compose logs -f ragflow
```

Check the model download:

```bash
docker compose logs ollama-init
docker compose exec ollama ollama list
```

RAGFlow is also bound locally on the server at `127.0.0.1:9380` for bootstrap scripts. It is not exposed to the internet on that port.

## 5. Expand the TLS certificate

The existing certificate named `albertqueralto.dev` must include the RAGFlow subdomain:

```bash
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --cert-name albertqueralto.dev \
  --expand \
  -d albertqueralto.dev \
  -d www.albertqueralto.dev \
  -d ragflow.albertqueralto.dev
```

Reload Nginx:

```bash
docker compose exec reverse-proxy nginx -t
docker compose exec reverse-proxy nginx -s reload
```

Open:

```text
https://ragflow.albertqueralto.dev
```

Create the first local account.

## 6. Register the Ollama models in RAGFlow

In RAGFlow, open your avatar and then **Model providers**. Add or configure the **Ollama** provider.

Use:

```text
Base URL: http://ollama:11434
API key: local-ollama
```

Do not use `localhost`: inside the RAGFlow container, `localhost` points back to RAGFlow itself.

Register these exact model names:

```text
Chat model: gemma3:1b
Embedding model: embeddinggemma:300m-qat-q4_0
```

Test both models in the RAGFlow UI. Their identifiers should appear as:

```text
gemma3:1b@Ollama
embeddinggemma:300m-qat-q4_0@Ollama
```

## 7. Create a local API key

In the self-hosted RAGFlow UI:

1. Click your avatar.
2. Open **API**.
3. Create an API key.
4. Copy it into `.env`:

```bash
nano ~/portfolio/.env
```

Set:

```dotenv
RAGFLOW_API_KEY=ragflow-your-local-api-key
```

Leave `RAGFLOW_CHAT_ID` empty for now.

## 8. Edit the biography

Before bootstrapping, edit:

```bash
nano ~/portfolio/ragflow-documents/about-albert.md
```

The other knowledge files are generated from:

- `public/CV.pdf`
- `src/content/projects/*.md`
- `src/content/blog/*.md`

Regenerate them after changing portfolio content:

```bash
./scripts/prepare-ragflow-documents.sh
```

## 9. Create the dataset and assistant automatically

After the models and API key are configured:

```bash
./scripts/bootstrap-ragflow-portfolio.sh
```

The script:

1. Creates `Albert Portfolio Knowledge Base`.
2. Uploads the CV, biography, project Markdown, and article Markdown.
3. Starts document parsing.
4. Creates `Albert Portfolio Assistant`.
5. Writes the assistant ID to `RAGFLOW_CHAT_ID` in `.env`.
6. Restarts `chat-api`.

The generated IDs are recorded locally in:

```text
ragflow/bootstrap-state.json
```

Parsing can continue after the script returns. Check the Dataset page in RAGFlow and wait for the documents to reach 100%.

## 10. Test each layer

Test RAGFlow directly from the host:

```bash
set -a
source .env
set +a

curl -sS \
  "http://127.0.0.1:9380/api/v1/openai/$RAGFLOW_CHAT_ID/chat/completions" \
  -H "Authorization: Bearer $RAGFLOW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "model",
    "stream": false,
    "messages": [
      {"role": "user", "content": "What projects has Albert built?"}
    ]
  }' | jq .
```

Test the public portfolio proxy:

```bash
curl -sS https://albertqueralto.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What machine-learning experience does Albert have?"}
    ]
  }' | jq .
```

## Operations

Show status:

```bash
docker compose ps
```

Follow important logs:

```bash
docker compose logs -f ragflow
docker compose logs -f ragflow-infinity
docker compose logs -f ollama
docker compose logs -f chat-api
```

Restart the chatbot services:

```bash
docker compose restart ragflow ollama chat-api reverse-proxy
```

Update containers while retaining volumes:

```bash
docker compose pull
docker compose up -d --build
```

Back up persistent data:

```bash
docker run --rm \
  -v portfolio_ragflow-mysql-data:/source:ro \
  -v "$PWD/backups:/backup" \
  alpine tar czf /backup/ragflow-mysql-data.tgz -C /source .
```

Do not run `docker compose down -v` unless you intend to delete the RAGFlow database, uploaded files, vector index, and Ollama models.

## Resetting the bootstrap

The bootstrap script intentionally refuses to create duplicate resources when `ragflow/bootstrap-state.json` exists. To rebuild:

1. Delete the old assistant and dataset in the RAGFlow UI.
2. Delete `ragflow/bootstrap-state.json`.
3. Run the bootstrap script again.

## Included local tuning

The Compose file uses one RAGFlow worker, one document per bulk batch, one embedding per batch, Infinity instead of Elasticsearch, and one Ollama model loaded at a time. These are deployment settings, not changes to RAGFlow's application behavior.
