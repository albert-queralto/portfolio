#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ragflow/bootstrap-state.json && "${1:-}" != "--force" ]]; then
  echo "ragflow/bootstrap-state.json already exists." >&2
  echo "Delete the previous assistant and dataset in RAGFlow, remove that file, or rerun with --force after changing the names." >&2
  exit 1
fi

for command_name in curl jq; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required." >&2
    exit 1
  }
done

[[ -f .env ]] || {
  echo "Missing .env. Run ./scripts/generate-local-env.sh first." >&2
  exit 1
}

set -a
# shellcheck disable=SC1091
source .env
set +a

RAGFLOW_BOOTSTRAP_URL="${RAGFLOW_BOOTSTRAP_URL:-http://127.0.0.1:9380}"
RAGFLOW_DATASET_NAME="${RAGFLOW_DATASET_NAME:-Albert Portfolio Knowledge Base}"
RAGFLOW_ASSISTANT_NAME="${RAGFLOW_ASSISTANT_NAME:-Albert Portfolio Assistant}"
RAGFLOW_LLM_ID="${RAGFLOW_LLM_ID:-gemma3:1b@Ollama}"
RAGFLOW_EMBEDDING_ID="${RAGFLOW_EMBEDDING_ID:-embeddinggemma:300m-qat-q4_0@Ollama}"

[[ -n "${RAGFLOW_API_KEY:-}" ]] || {
  echo "RAGFLOW_API_KEY is empty in .env." >&2
  echo "Create it in RAGFlow: avatar -> API, then paste it into .env." >&2
  exit 1
}

./scripts/prepare-ragflow-documents.sh >/dev/null

api() {
  local method="$1"
  local path="$2"
  shift 2
  curl --fail-with-body --silent --show-error \
    --request "$method" \
    --url "${RAGFLOW_BOOTSTRAP_URL}${path}" \
    --header "Authorization: Bearer ${RAGFLOW_API_KEY}" \
    "$@"
}

if ! curl --fail --silent --show-error "${RAGFLOW_BOOTSTRAP_URL}/api/v1/system/healthz" >/dev/null 2>&1 \
  && ! curl --fail --silent --show-error "${RAGFLOW_BOOTSTRAP_URL}/v1/system/healthz" >/dev/null 2>&1 \
  && ! curl --fail --silent --show-error "${RAGFLOW_BOOTSTRAP_URL}/" >/dev/null 2>&1; then
  echo "RAGFlow is not reachable at $RAGFLOW_BOOTSTRAP_URL" >&2
  exit 1
fi

echo "Creating dataset: $RAGFLOW_DATASET_NAME"
dataset_payload="$(jq -n \
  --arg name "$RAGFLOW_DATASET_NAME" \
  --arg description "CV, portfolio projects, selected articles, and biography for Albert Queralto." \
  --arg embedding_model "$RAGFLOW_EMBEDDING_ID" \
  '{
    name: $name,
    description: $description,
    embedding_model: $embedding_model,
    chunk_method: "naive",
    parser_config: {
      chunk_token_num: 384,
      delimiter: "\\n",
      auto_keywords: 0,
      auto_questions: 0,
      layout_recognize: "DeepDOC",
      raptor: {use_raptor: false},
      graphrag: {use_graphrag: false}
    }
  }')"

dataset_response="$(api POST /api/v1/datasets \
  --header 'Content-Type: application/json' \
  --data "$dataset_payload")"

dataset_id="$(jq -r '.data.id // empty' <<<"$dataset_response")"
if [[ -z "$dataset_id" ]]; then
  echo "Dataset creation failed:" >&2
  jq . <<<"$dataset_response" >&2 || echo "$dataset_response" >&2
  exit 1
fi

echo "Dataset ID: $dataset_id"

document_ids=()
while IFS= read -r -d '' file; do
  relative_path="${file#$ROOT_DIR/ragflow-documents/}"
  echo "Uploading: $relative_path"
  upload_response="$(api POST "/api/v1/datasets/${dataset_id}/documents" \
    --form "file=@${file}")"
  document_id="$(jq -r '.data[0].id // empty' <<<"$upload_response")"
  if [[ -z "$document_id" ]]; then
    echo "Upload failed for $relative_path:" >&2
    jq . <<<"$upload_response" >&2 || echo "$upload_response" >&2
    exit 1
  fi
  document_ids+=("$document_id")
done < <(find "$ROOT_DIR/ragflow-documents" -type f \( -name '*.md' -o -name '*.pdf' \) -print0 | sort -z)

if [[ ${#document_ids[@]} -eq 0 ]]; then
  echo "No documents found to upload." >&2
  exit 1
fi

document_ids_json="$(printf '%s\n' "${document_ids[@]}" | jq -R . | jq -s .)"
parse_payload="$(jq -n --argjson document_ids "$document_ids_json" '{document_ids: $document_ids}')"

echo "Starting parsing for ${#document_ids[@]} documents."
api POST "/api/v1/datasets/${dataset_id}/chunks" \
  --header 'Content-Type: application/json' \
  --data "$parse_payload" | jq .

system_prompt=$(cat <<'PROMPT'
You are Albert Queralto's portfolio assistant.

Answer questions about Albert's professional experience, skills, projects, articles, education, and portfolio. Base factual answers only on the supplied knowledge base below. Do not invent qualifications, employment history, project outcomes, dates, contact information, or personal details. When the knowledge base does not contain the answer, say: "I don't have that information in Albert's portfolio." Keep answers concise and professional, mention the supporting project or document when useful, and respond in the visitor's language.

Knowledge base:
{knowledge}
PROMPT
)

assistant_payload="$(jq -n \
  --arg name "$RAGFLOW_ASSISTANT_NAME" \
  --arg llm_id "$RAGFLOW_LLM_ID" \
  --arg dataset_id "$dataset_id" \
  --arg system "$system_prompt" \
  '{
    name: $name,
    dataset_ids: [$dataset_id],
    llm_id: $llm_id,
    similarity_threshold: 0.2,
    vector_similarity_weight: 0.3,
    top_n: 5,
    llm_setting: {
      temperature: 0.1,
      top_p: 0.3,
      max_token: 512
    },
    prompt_config: {
      system: $system,
      empty_response: "I do not have that information in Albert’s portfolio.",
      quote: true
    }
  }')"

echo "Creating assistant: $RAGFLOW_ASSISTANT_NAME"
assistant_response="$(api POST /api/v1/chats \
  --header 'Content-Type: application/json' \
  --data "$assistant_payload")"
assistant_id="$(jq -r '.data.id // empty' <<<"$assistant_response")"
if [[ -z "$assistant_id" ]]; then
  echo "Assistant creation failed:" >&2
  jq . <<<"$assistant_response" >&2 || echo "$assistant_response" >&2
  echo "Confirm that both Ollama models are registered in RAGFlow with these exact IDs:" >&2
  echo "  $RAGFLOW_LLM_ID" >&2
  echo "  $RAGFLOW_EMBEDDING_ID" >&2
  exit 1
fi

python - "$assistant_id" <<'PY'
from pathlib import Path
import sys

assistant_id = sys.argv[1]
path = Path('.env')
lines = path.read_text().splitlines()
updated = []
found = False
for line in lines:
    if line.startswith('RAGFLOW_CHAT_ID='):
        updated.append(f'RAGFLOW_CHAT_ID={assistant_id}')
        found = True
    else:
        updated.append(line)
if not found:
    updated.append(f'RAGFLOW_CHAT_ID={assistant_id}')
path.write_text('\n'.join(updated) + '\n')
PY

jq -n \
  --arg dataset_id "$dataset_id" \
  --arg assistant_id "$assistant_id" \
  --arg llm_id "$RAGFLOW_LLM_ID" \
  --arg embedding_id "$RAGFLOW_EMBEDDING_ID" \
  '{dataset_id: $dataset_id, assistant_id: $assistant_id, llm_id: $llm_id, embedding_id: $embedding_id}' \
  > ragflow/bootstrap-state.json

echo
echo "Assistant ID: $assistant_id"
echo "Updated RAGFLOW_CHAT_ID in .env."
echo "Restarting the public chat proxy..."
docker compose up -d --build chat-api

echo "Bootstrap complete. Parsing continues inside RAGFlow; monitor it in the Dataset UI."
