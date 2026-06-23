"""arq 워커 설정 (infrastructure §5, ingestion-backend §1).

기동: `arq src.pipeline.worker.WorkerSettings` (docker-compose worker 서비스).
일반 예외는 자동 재시도하지 않고 즉시 failed로 종결한다. 실패 문서의 재처리는 명시적
재시도 기능이 담당한다(research 08 §4.3).
"""

import src.db_models  # noqa: F401  # 워커 프로세스에서도 전 모델 등록

from src.pipeline import tasks
from src.pipeline.queue import redis_settings


class WorkerSettings:
    functions = [tasks.ingest_document, tasks.run_generation]
    redis_settings = redis_settings()
    max_tries = 5  # 명시 Retry/취소 경로 상한. 일반 예외에는 적용되지 않는다(research 08 §4.3).
    # 취소·타임아웃으로 종결한 작업을 자동 재실행하지 않는다. failed로 종결 후 재처리는 명시적 재시도가 맡는다.
    retry_jobs = False
    allow_abort_jobs = True  # 문서 삭제 시 진행 중 인제스트 선제 취소 (04-frontend D13)
    # 동시 잡 수를 채팅 슬롯 수(--parallel 4)에 맞춰 KV 캐시 경합·500을 막는다. docs/lessons/01 §0·Fix-A.
    max_jobs = 4
    # 잡 타임아웃을 올린다. 기본 300초가 과부하·대형 PDF에서 초과돼 좀비 processing을 냈다.
    job_timeout = 900
