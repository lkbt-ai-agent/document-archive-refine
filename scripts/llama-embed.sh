#!/usr/bin/env bash
# [무엇]  "임베딩" AI 모델(KURE-v1)을 로컬 HTTP 서버로 띄운다.
#         임베딩 = 문장을 의미가 담긴 숫자 벡터(여기선 1024차원)로 바꾸는 것.
# [용도]  의미 검색·RAG에서 문장 간 유사도 비교에 사용. 백엔드가 :8081로 호출한다.
# [왜 호스트?] Mac GPU 가속(Metal) 때문에 Docker 대신 호스트에서 직접 실행. infrastructure §6.
# [실행]  LLAMA_EMBED_MODEL=<gguf 모델 파일 경로> ./scripts/llama-embed.sh
#         (차원 1024는 전 시스템 고정값 data-overview §1. 모델 정의는 models.md)
# [종료]  kill $(lsof -ti tcp:8081)   또는   pkill -f kure-v1
#         (확인: pgrep -fl llama-server)
set -euo pipefail
MODEL="${LLAMA_EMBED_MODEL:-kure-v1-q8_0.gguf}"
PORT="${LLAMA_EMBED_PORT:-8081}"
exec llama-server -m "$MODEL" --embeddings --pooling cls -ngl 99 \
  --ctx-size 8192 --batch-size 8192 --port "$PORT"
