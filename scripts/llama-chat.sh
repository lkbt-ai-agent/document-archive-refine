#!/usr/bin/env bash
# [무엇]  텍스트 "생성" AI 모델(A.X 4.0 Light)을 로컬 HTTP 서버로 띄운다.
# [용도]  문서 요약·초안·보고서 생성, 자연어 질의 파싱. 백엔드가 :8080으로 호출한다.
# [왜 호스트?] Mac의 GPU 가속(Metal)을 쓰려면 Docker가 아니라 호스트에서 직접 실행해야 빠르다
#              (macOS Docker는 Metal을 못 써 CPU-only로 느려짐). infrastructure §6.
# [실행]  LLAMA_CHAT_MODEL=<gguf 모델 파일 경로> ./scripts/llama-chat.sh
#         (모델 선정/출처/양자화는 docs/architecture/02-infrastructure/models.md)
# [종료]  kill $(lsof -ti tcp:8080)   또는   pkill -f a.x-4.0-light
#         (확인: pgrep -fl llama-server)
set -euo pipefail
MODEL="${LLAMA_CHAT_MODEL:-ax-4.0-light-q4_k_m.gguf}"
PORT="${LLAMA_CHAT_PORT:-8080}"
# --parallel 4 -c 16384: 슬롯 4개에 슬롯당 약 4096토큰을 준다(8192÷4=2048은 메타 프롬프트
# 초과로 KV 캐시 고갈·500을 냈다). 워커 max_jobs(4)와 슬롯 수를 맞춘다. docs/lessons/01 §0·Fix-A.
exec llama-server -m "$MODEL" -ngl 99 --parallel 4 -c 16384 --port "$PORT"
