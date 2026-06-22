"""arq 워커 설정 (infrastructure §5, ingestion-backend §1).

기동: `arq src.pipeline.worker.WorkerSettings` (docker-compose worker 서비스).
지수 백오프 재시도로 단계·페이지 단위 부분 실패를 격리한다.
"""

import src.db_models  # noqa: F401  # 워커 프로세스에서도 전 모델 등록

from src.pipeline import tasks
from src.pipeline.queue import redis_settings


class WorkerSettings:
    functions = [tasks.ingest_document, tasks.run_generation]
    redis_settings = redis_settings()
    max_tries = 5  # 단계 재시도(지수 백오프), ingestion-backend §1
    allow_abort_jobs = True  # 문서 삭제 시 진행 중 인제스트 선제 취소 (04-frontend D13)
    # 동시 잡 수를 채팅 슬롯 수(--parallel 4)에 맞춰 KV 캐시 경합·500을 막는다. lessons/01 §0·Fix-A.
    max_jobs = 4
    # 잡 타임아웃을 올린다. 기본 300초가 과부하·대형 PDF에서 초과돼 좀비 processing을 냈다.
    job_timeout = 900
