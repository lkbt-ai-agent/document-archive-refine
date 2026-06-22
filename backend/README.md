# backend — Mechive

> 모든 명령은 `backend/`에서 실행. 의존성은 uv로 관리.

## API 서버 (:8000)

```bash
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

- `--host 0.0.0.0`: LAN·Tailscale 호스트네임 접근 허용(원격 접속 필수).

## arq 워커 (인제스트·생성 파이프라인)

```bash
uv run arq src.pipeline.worker.WorkerSettings
```

## 부트스트랩 (최초 1회·스키마 변경 시)

```bash
uv sync                            # 의존성 설치
uv run alembic upgrade head        # 스키마 최신화(멱등)
uv run python -m src.seed          # 시드 유저+모델(멱등)
```

## 테스트

```bash
uv run pytest
```

## 의존 모듈 (리포 루트에서 실행)

> PostgreSQL·MinIO는 **원격**이라 여기서 띄우지 않는다(연결만 확인). 아래는 로컬에서 올리는 의존 모듈.

```bash
# Redis (작업 큐)
docker compose up -d redis

# llama-server — 생성(:8080) · 임베딩(:8081)  *호스트 네이티브*
LLAMA_CHAT_MODEL="$HOME/Desktop/models/a.x-4.0-light-q4_k_m.gguf" ./scripts/llama-chat.sh
LLAMA_EMBED_MODEL="$HOME/Desktop/models/kure-v1-q8_0.gguf"        ./scripts/llama-embed.sh

# 헬스체크 (PG·MinIO·Redis·llama 일괄 점검)
./scripts/healthcheck.sh

# MinIO CORS (원격 MinIO에 최초 1회 — presigned PUT/GET 허용)
WEB_ORIGINS="http://localhost:3000" ./scripts/minio-cors.sh
```

### 종료

```bash
kill $(lsof -ti tcp:8000) 2>/dev/null            # API
kill $(lsof -ti tcp:8080) 2>/dev/null            # llama 생성
kill $(lsof -ti tcp:8081) 2>/dev/null            # llama 임베딩
pkill -f "arq src.pipeline.worker" 2>/dev/null   # 워커
docker compose down                              # Redis
```
