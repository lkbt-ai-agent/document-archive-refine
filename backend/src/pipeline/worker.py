"""arq 워커 설정 (infrastructure §5, ingestion-backend §1).

기동: `arq src.pipeline.worker.WorkerSettings` (docker-compose worker 서비스).
지수 백오프 재시도로 단계·페이지 단위 부분 실패를 격리한다.
"""

import src.db_models  # noqa: F401  # 워커 프로세스에서도 전 모델 등록
from arq import cron

from src.pipeline import tasks
from src.pipeline.queue import redis_settings


class WorkerSettings:
    functions = [tasks.ingest_document, tasks.run_generation]
    cron_jobs = [cron(tasks.cleanup_orphans, minute=0)]  # 매시 정각 (document-backend §4)
    redis_settings = redis_settings()
    max_tries = 5  # 단계 재시도(지수 백오프), ingestion-backend §1
