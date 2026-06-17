#!/usr/bin/env bash
# 생성 LLM llama-server (native Metal, infrastructure §6). Mac mini 호스트에서 직접 실행.
# Docker 금지(macOS Docker는 Metal 불가 → CPU-only). 모델 경로는 환경변수로 주입.
set -euo pipefail
MODEL="${LLAMA_CHAT_MODEL:-ax-4.0-light-q4_k_m.gguf}"
PORT="${LLAMA_CHAT_PORT:-8080}"
exec llama-server -m "$MODEL" -ngl 99 -c 8192 --port "$PORT"
