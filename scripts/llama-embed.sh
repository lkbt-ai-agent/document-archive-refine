#!/usr/bin/env bash
# 임베딩 llama-server (KURE-v1, native Metal, infrastructure §6). Mac mini 호스트에서 직접 실행.
# 차원 1024 고정(data-overview §1). 모델 경로는 환경변수로 주입.
set -euo pipefail
MODEL="${LLAMA_EMBED_MODEL:-kure-v1-q8_0.gguf}"
PORT="${LLAMA_EMBED_PORT:-8081}"
exec llama-server -m "$MODEL" --embeddings --pooling cls -ngl 99 \
  --ctx-size 8192 --batch-size 8192 --port "$PORT"
