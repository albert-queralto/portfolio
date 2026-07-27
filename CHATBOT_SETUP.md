# Portfolio chatbot: RAGFlow Cloud + Ollama on the 4 GB VPS

This stack deliberately does **not** run RAGFlow on the portfolio server. The VPS only runs:

- the existing Astro/Nginx portfolio;
- Ollama with one small model loaded at a time;
- a protected Ollama gateway for RAGFlow;
- a small server-side proxy so the RAGFlow API key never reaches the browser.

## 1. Create the Ollama DNS record

In Namecheap, add an `A` record:

- Host: `ollama`
- Value: the same VPS IPv4 address used by `albertqueralto.dev`
- TTL: Automatic

Wait until this resolves:

```bash
dig +short ollama.albertqueralto.dev
```

## 2. Configure secrets

```bash
cd ~/portfolio
cp .env.example .env
openssl rand -hex 32
nano .env
```

Put the generated token in `OLLAMA_GATEWAY_TOKEN`. Leave the RAGFlow values as placeholders until the assistant is created.

Never commit `.env`.

## 3. Build and start the Docker services

```bash
docker compose up -d --build
```

Check the containers:

```bash
docker compose ps
docker stats --no-stream
```

## 4. Expand the TLS certificate to the Ollama subdomain

The current certificate must also include `ollama.albertqueralto.dev`:

```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --cert-name albertqueralto.dev \
  --expand \
  -d albertqueralto.dev \
  -d www.albertqueralto.dev \
  -d ollama.albertqueralto.dev \
  --email albert@albertqueralto.dev \
  --agree-tos \
  --no-eff-email

docker compose exec reverse-proxy nginx -s reload
```

## 5. Pull the small Ollama models

Recommended starting point:

```bash
docker compose exec ollama ollama pull gemma3:1b
docker compose exec ollama ollama pull embeddinggemma:300m-qat-q4_0
docker compose exec ollama ollama list
```

The Compose limits keep only one model loaded and allow only one request at a time. This saves RAM, but switching between the embedding and chat models adds latency.

## 6. Connect RAGFlow to Ollama

Use RAGFlow Cloud, or a RAGFlow installation on another server with at least its documented minimum resources.

In **Settings → Model providers → Ollama**, add:

### Chat model

- Model name: `gemma3:1b`
- Model type: Chat
- Base URL: `https://ollama.albertqueralto.dev`
- API key: the exact value of `OLLAMA_GATEWAY_TOKEN`

### Embedding model

- Model name: `embeddinggemma:300m-qat-q4_0`
- Model type: Embedding
- Base URL: `https://ollama.albertqueralto.dev`
- API key: the exact value of `OLLAMA_GATEWAY_TOKEN`

Model names must match `ollama list` exactly. Do not add a trailing slash to the base URL.

## 7. Build the portfolio knowledge base

Create a RAGFlow dataset and upload a small, curated set of files. Good sources from this portfolio are:

- `public/CV.pdf`
- project Markdown files in `src/content/projects/`
- selected blog posts in `src/content/blog/`
- a short plain-text biography and contact/availability FAQ

Parse the documents, inspect chunks, and remove duplicated navigation or boilerplate.

Create a Chat Assistant using this dataset. Select:

- Chat model: `gemma3:1b@Ollama`
- Embedding model: `embeddinggemma:300m-qat-q4_0@Ollama`
- Temperature: about `0.2`
- A concise prompt instructing it to answer only from the portfolio knowledge base and admit when information is absent

## 8. Add the RAGFlow API credentials

In RAGFlow, create an API key and copy the Chat Assistant ID. Update `.env`:

```dotenv
RAGFLOW_BASE_URL=https://cloud.ragflow.io
RAGFLOW_CHAT_ID=your-chat-assistant-id
RAGFLOW_API_KEY=ragflow-your-api-key
OLLAMA_GATEWAY_TOKEN=your-existing-random-token
```

Restart only the affected services:

```bash
docker compose up -d --build chat-api portfolio reverse-proxy
```

## 9. Test

Test the protected Ollama endpoint:

```bash
set -a; source .env; set +a
curl -sS https://ollama.albertqueralto.dev/api/tags \
  -H "Authorization: Bearer $OLLAMA_GATEWAY_TOKEN"
```

Test the website proxy:

```bash
curl -sS https://albertqueralto.dev/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What machine-learning projects has Albert built?"}]}'
```

Then open the portfolio and use the **Ask me** button.

## 10. Add swap as an emergency buffer

A small swap file can prevent an abrupt OOM kill. It will not make inference fast.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-portfolio-ai.conf
sudo sysctl --system
```

Monitor real use after deployment:

```bash
free -h
df -h
docker stats
```

If responses regularly take too long or the server swaps heavily, move Ollama to a larger machine too. The clean upgrade path is a separate 4-core/16-GB-or-larger VPS for both RAGFlow and Ollama, while leaving this portfolio VPS unchanged.
