#!/usr/bin/env bash
# [무엇]  개발에 필요한 외부 서비스 4종에 연결되는지 한 번에 점검한다.
#         PostgreSQL(DB) · MinIO(파일 저장소) · Redis(작업 큐) · llama-server(AI 모델).
# [결과]  PG/MinIO 실패 = 핵심 의존이라 즉시 중단(exit 1, "fail-fast").
#         Redis/llama 실패 = 경고만 출력(개발 중엔 꺼져 있을 수 있어서).
# [특징]  psql·mc 같은 CLI를 따로 설치하지 않아도 되도록, 점검 때만 일회성 Docker 컨테이너로 접속.
# [실행]  ./scripts/healthcheck.sh        (infrastructure §7, backend §11)
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

fail=0
ok(){   printf "  [OK]   %s\n" "$1"; }
warn(){ printf "  [WARN] %s\n" "$1"; }
crit(){ printf "  [FAIL] %s\n" "$1"; fail=1; }

echo "== PostgreSQL =="
PGURL=$(printf '%s' "$DATABASE_URL" | sed 's/postgresql+psycopg/postgresql/')
if docker run --rm -e U="$PGURL" postgres:18-alpine \
     sh -c 'psql "$U" -tAc "select 1" >/dev/null 2>&1'; then
  ok "connect"
else
  crit "connect failed"
fi

echo "== MinIO =="
if docker run --rm --entrypoint /bin/sh \
     -e EP="$MINIO_ENDPOINT" -e AK="$MINIO_ACCESS_KEY" -e SK="$MINIO_SECRET_KEY" -e BK="$MINIO_BUCKET" \
     minio/mc -c 'mc alias set t "$EP" "$AK" "$SK" >/dev/null 2>&1 && mc ls t/"$BK" >/dev/null 2>&1'; then
  ok "bucket $MINIO_BUCKET"
else
  crit "bucket $MINIO_BUCKET unreachable ($MINIO_ENDPOINT)"
fi

echo "== Redis =="
if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "$REDIS_URL"
else
  warn "ping failed ($REDIS_URL) — 'docker compose up -d redis'?"
fi

echo "== llama-server =="
for pair in "chat:$LLAMA_CHAT_URL" "embed:$LLAMA_EMBED_URL"; do
  name=${pair%%:*}; url=${pair#*:}
  if curl -fsS "$url/health" >/dev/null 2>&1; then ok "$name $url"; else warn "$name unreachable ($url)"; fi
done

echo
if [ "$fail" -ne 0 ]; then echo "FAIL-FAST: 핵심 의존(PG/MinIO) 연결 실패"; exit 1; fi
echo "core deps (PG/MinIO) OK"
