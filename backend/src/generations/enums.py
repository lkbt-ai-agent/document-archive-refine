"""생성 계보 ENUM (generations-schema §1).

값은 DDL의 `archive.artifact_kind` / `gen_method` / `job_status`와 정확히 일치한다.
타입은 수동 마이그레이션(B3)에서 생성하므로 `create_type=False`.
"""

from enum import Enum

from sqlalchemy import Enum as SaEnum


class ArtifactKind(str, Enum):
    summary = "summary"
    draft = "draft"
    report = "report"


class GenMethod(str, Enum):
    stuff = "stuff"
    map_reduce = "map_reduce"
    hierarchical = "hierarchical"
    outline_expand = "outline_expand"
    report_pipeline = "report_pipeline"


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


def _values(enum_cls: type[Enum]) -> list[str]:
    return [m.value for m in enum_cls]


artifact_kind_type = SaEnum(
    ArtifactKind, name="artifact_kind", schema="archive", create_type=False,
    values_callable=lambda e: _values(e),
)
gen_method_type = SaEnum(
    GenMethod, name="gen_method", schema="archive", create_type=False,
    values_callable=lambda e: _values(e),
)
job_status_type = SaEnum(
    JobStatus, name="job_status", schema="archive", create_type=False,
    values_callable=lambda e: _values(e),
)
