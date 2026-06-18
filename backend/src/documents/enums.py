"""문서 상태/단계 ENUM (documents-schema §1, document.md §4, ingestion.md §2).

값은 DDL의 `archive.doc_status` / `archive.doc_stage`와 정확히 일치한다.
ENUM 타입 자체는 수동 마이그레이션(B3)에서 생성하므로 `create_type=False`를 쓴다.
"""

from enum import Enum

from sqlalchemy import Enum as SaEnum


class DocStatus(str, Enum):
    uploaded = "uploaded"  # 레코드 생성, 오브젝트 업로드 대기
    processing = "processing"  # 인제스트 진행 중
    ready = "ready"  # 인제스트 완료, 검색·RAG 대상
    failed = "failed"  # 복구 불가 오류


class DocStage(str, Enum):
    extracting = "extracting"
    generating_meta = "generating_meta"
    chunking = "chunking"
    embedding = "embedding"


def _values(enum_cls: type[Enum]) -> list[str]:
    return [m.value for m in enum_cls]


doc_status_type = SaEnum(
    DocStatus, name="doc_status", schema="archive", create_type=False,
    values_callable=lambda e: _values(e),
)
doc_stage_type = SaEnum(
    DocStage, name="doc_stage", schema="archive", create_type=False,
    values_callable=lambda e: _values(e),
)
