#!/usr/bin/env bash
# [무엇]  업로드 버킷의 CORS를 점검(+가능하면 설정)한다. 브라우저가 presigned PUT(업로드)·
#         GET(다운로드/원본보기)을 MinIO로 직접 호출하므로 web 오리진 교차 출처 허용이 필요하다.
#         (frontend.md §9, infrastructure §4, 04-frontend C5)
# [방식]  1) preflight(OPTIONS) 프로브로 실제 CORS 응답을 검증한다(핵심).
#         2) 버킷별 `mc cors set`을 best-effort 로 시도한다(미구현 릴리스면 건너뜀).
#         MinIO 기본값 MINIO_API_CORS_ALLOW_ORIGIN=* 이면 모든 오리진을 echo 해 그대로 통과한다.
#         더 좁히려면 서버에서 MINIO_API_CORS_ALLOW_ORIGIN="<origins>" 설정 후 재기동.
# [실행]  WEB_ORIGINS="http://localhost:3000,https://<host>" ./scripts/minio-cors.sh
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

WEB_ORIGINS="${WEB_ORIGINS:-http://localhost:3000}"
echo "== MinIO CORS =="
echo "  endpoint=$MINIO_ENDPOINT bucket=$MINIO_BUCKET"

# best-effort: 버킷별 CORS 설정(미구현 릴리스면 무시).
ORIGINS_XML=$(printf '%s' "$WEB_ORIGINS" | awk -F, '{
  for (i=1;i<=NF;i++){ gsub(/^ +| +$/,"",$i); printf "<AllowedOrigin>%s</AllowedOrigin>", $i }
}')
docker run --rm --entrypoint /bin/sh \
  -e EP="$MINIO_ENDPOINT" -e AK="$MINIO_ACCESS_KEY" -e SK="$MINIO_SECRET_KEY" \
  -e BK="$MINIO_BUCKET" -e OX="$ORIGINS_XML" minio/mc -c '
    mc alias set t "$EP" "$AK" "$SK" >/dev/null 2>&1 || exit 0
    cat > /tmp/cors.xml <<XML
<CORSConfiguration><CORSRule>$OX<AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><ExposeHeader>Content-Disposition</ExposeHeader><MaxAgeSeconds>3000</MaxAgeSeconds></CORSRule></CORSConfiguration>
XML
    mc cors set t/"$BK" /tmp/cors.xml >/dev/null 2>&1 \
      && echo "  [OK]   버킷별 CORS 적용" \
      || echo "  [..]   버킷별 CORS API 미구현 — 전역 설정에 의존"
  ' 2>/dev/null

# 핵심 검증: preflight 로 web 오리진별 Access-Control-Allow-Origin 확인.
fail=0
IFS=',' read -ra ORIGINS <<< "$WEB_ORIGINS"
for raw in "${ORIGINS[@]}"; do
  origin=$(printf '%s' "$raw" | tr -d ' ')
  acao=$(curl -s -i -X OPTIONS \
    -H "Origin: $origin" -H "Access-Control-Request-Method: PUT" \
    -H "Access-Control-Request-Headers: content-type" \
    "$MINIO_ENDPOINT/$MINIO_BUCKET/cors-probe" 2>/dev/null \
    | grep -i "access-control-allow-origin" | tr -d '\r')
  if printf '%s' "$acao" | grep -qiE "(\*|$origin)"; then
    echo "  [OK]   preflight 허용: $origin ($acao)"
  else
    echo "  [FAIL] preflight 미허용: $origin"
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "  → 서버에서 MINIO_API_CORS_ALLOW_ORIGIN=\"$WEB_ORIGINS\" 설정 후 재기동 필요"
  exit 1
fi
echo "  CORS OK (브라우저 presigned PUT/GET 가능)"
