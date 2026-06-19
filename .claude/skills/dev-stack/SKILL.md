---
name: dev-stack
description: 이 앱(Mechive)의 로컬 개발 스택을 띄우거나 내린다 — Redis·llama(생성/임베딩)·백엔드 API·arq 워커·Next.js 프론트. "백엔드/프론트/llama 실행", "개발 서버 켜/꺼", "스택 기동", "전체 종료", "헬스체크" 같은 요청에 사용.
---

# dev-stack — 로컬 개발 스택 기동/종료

이 앱을 로컬에서 돌리는 데 필요한 모듈과 정확한 실행 명령을 정리한다.
구성: **Redis**(Docker) · **llama 생성/임베딩**(호스트 네이티브, Metal) · **백엔드 API**(FastAPI) · **arq 워커** · **프론트**(Next.js).
PostgreSQL·MinIO는 **원격**이라 여기서 띄우지 않는다(연결만 확인).

## 사전 조건
- 루트 `.env` 존재(원격 PG/MinIO 자격증명). `web/.env.local`에 `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- 모델 파일: `~/Desktop/models/a.x-4.0-light-q4_k_m.gguf`(생성), `~/Desktop/models/kure-v1-q8_0.gguf`(임베딩).
- 도구: `docker`, `uv`, `node`/`npm`, `llama-server`(homebrew).
- 모든 명령은 **리포 루트**(`/Users/xxx/Desktop/git-2026-document-archive-refine`) 기준. 백엔드 명령은 `backend/`에서, 프론트는 `web/`에서 실행.

## 실행 방식(Claude가 직접 띄울 때)
- 상주 프로세스(llama·api·worker·web)는 **Bash `run_in_background: true`** 로 띄운다.
- 의존 순서대로 올린다: **Redis → llama → (부트스트랩) → API → worker → web**.
- 다 올린 뒤 `./scripts/healthcheck.sh`로 검증한다.
- `cd`는 쉘 상태가 유지되지 않으니, 백그라운드 명령마다 절대경로로 `cd ... &&` 를 붙인다.

---

## 1. Redis (작업 큐)
```bash
docker compose up -d redis
```

## 2. llama-server — 생성(:8080) · 임베딩(:8081)  *호스트 네이티브, 백그라운드*
```bash
LLAMA_CHAT_MODEL="$HOME/Desktop/models/a.x-4.0-light-q4_k_m.gguf" ./scripts/llama-chat.sh
LLAMA_EMBED_MODEL="$HOME/Desktop/models/kure-v1-q8_0.gguf"        ./scripts/llama-embed.sh
```
- 스크립트 기본 파일명은 점 없는 이름(`ax-...`)이라 실제 파일(`a.x-...`)과 다르다 → **모델 경로를 반드시 명시**.
- 준비 확인: `curl -fsS localhost:8080/health && curl -fsS localhost:8081/health`.

## 3. 백엔드 부트스트랩 (스키마 변경/최초 1회)  *backend/ 에서*
```bash
cd backend && uv sync                                 # 의존성(최초 1회)
cd backend && uv run alembic upgrade head             # 스키마 최신화(멱등)
cd backend && uv run python -m src.seed               # 시드 유저+모델(멱등, SEED_USER_ID)
```
> 부트스트랩의 MinIO 버킷 생성·`vector`/`pgroonga` 확장 활성은 infrastructure §7 참조. 평소 기동에선 1·2 생략 가능.

## 4. 백엔드 API (:8000)  *backend/, 백그라운드*
```bash
cd backend && uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```
- `--host 0.0.0.0`: localhost뿐 아니라 LAN·Tailscale 호스트네임으로도 `:8000` 접근 가능(원격 접속 필수).
- 기동 시 PG/MinIO 도달 실패면 fail-fast로 죽는다(정상 동작). 인증 없음(고정 `SEED_USER_ID`).

## 5. arq 워커 (인제스트·생성 파이프라인)  *backend/, 백그라운드*
```bash
cd backend && uv run arq src.pipeline.worker.WorkerSettings
```

## 6. 프론트엔드 (Next.js :3000)  *web/, 백그라운드*
```bash
cd web && npm install        # 최초 1회
cd web && npm run dev        # http://localhost:3000
```

## 7. 헬스체크 (4종 의존 일괄 점검)
```bash
./scripts/healthcheck.sh
```
PG/MinIO 실패=중단(exit 1), Redis/llama 실패=경고. llama health(`:8080`/`:8081`)도 확인.

## 8. MinIO CORS (라이브 MinIO에 최초 1회)
```bash
WEB_ORIGINS="http://localhost:3000" ./scripts/minio-cors.sh
```
브라우저의 presigned PUT/GET이 MinIO로 직접 가므로 web 오리진 허용 필요. preflight로 검증한다.

---

## 종료
```bash
# 상주 프로세스
kill $(lsof -ti tcp:8000) 2>/dev/null   # API
kill $(lsof -ti tcp:3000) 2>/dev/null   # web
kill $(lsof -ti tcp:8080) 2>/dev/null   # llama 생성
kill $(lsof -ti tcp:8081) 2>/dev/null   # llama 임베딩
pkill -f "arq src.pipeline.worker" 2>/dev/null   # 워커
# Redis
docker compose down
```
확인: `lsof -ti tcp:8000,3000,8080,8081`(빈 출력), `pgrep -fl llama-server`, `docker compose ps`.
> Claude가 `run_in_background`로 띄운 경우 해당 background task를 stop하는 것이 우선이고, 위 kill은 보강.

## 대안: 앱 프로세스를 Docker로 (compose profile)
`api`·`worker`·`web`를 컨테이너로 함께 띄운다(llama는 항상 호스트):
```bash
docker compose --profile app up --build
```

## 원격 접속(Tailscale/LAN 호스트네임)
`localhost`가 아닌 호스트네임(예: `http://<host>.ts.net:3000`)으로 접속할 때 필요한 3가지:
1. **클라이언트 API 주소**: `web/lib/config.ts`가 env가 localhost면 *브라우저가 연 호스트명:8000* 으로 호출하도록 처리됨 → `.env.local` 수정 불필요.
2. **API 바인딩**: uvicorn `--host 0.0.0.0`(§4) — 안 하면 외부에서 `:8000` 도달 불가.
3. **백엔드 CORS**: `config.py` `cors_origin_regex`가 `localhost`·`127.0.0.1`·`*.ts.net` 허용. 다른 도메인이면 정규식에 추가.
- 업로드/다운로드(presigned)는 MinIO 원격 공인 IP(`MINIO_ENDPOINT`)로 직접 가고 전역 CORS가 오리진을 echo 하므로 추가 설정 불필요.
- 코드 변경 후 브라우저 **하드 리로드**로 새 클라이언트 번들 적용.

## 트러블슈팅
- `npm error ENOENT package.json` / 엉뚱한 `tsc`,`alembic` → CWD가 루트로 리셋된 것. 명령 앞에 절대경로 `cd .../web` 또는 `cd .../backend`.
- llama health 무응답 → 모델 경로 오타(`a.x-` 점 포함) 또는 모델 로딩 중. 잠시 후 `/health` 재확인.
- API가 바로 죽음 → `.env`의 원격 PG/MinIO 연결 실패. `./scripts/healthcheck.sh`로 원인 격리.
- 검색/RAG 결과 빈약 → 임베딩(:8081) 미기동 또는 코퍼스가 단일 청크. 워커 로그 확인.
