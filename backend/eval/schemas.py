"""평가 케이스·코퍼스 픽스처 스키마와 리더 (research 03-search-eval-testset/00 §4).

케이스는 JSONL 1행 1건이고, 리더가 이 스키마로 각 행을 검증한다(fail-fast).
"""

import json
import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Persona = Literal["개인", "사내"]
Mode = Literal["keyword", "semantic", "rag"]
Difficulty = Literal["easy", "medium", "hard"]
FailureMode = Literal["F1", "F2", "F3", "F4", "F5", "F6", "F7"]
Source = Literal["sh", "lh", "mss"]

# 안정 식별자 형식: "<source>:sha256:<64 hex>" (00 §2)
_DOC_ID_RE = re.compile(r"^(sh|lh|mss):sha256:[0-9a-f]{64}$")

FIXTURES_DIR = Path(__file__).parent / "fixtures"
CASES_PATH = FIXTURES_DIR / "cases.jsonl"
CORPUS_PATH = FIXTURES_DIR / "corpus.jsonl"


class Case(BaseModel):
    """검색 정확도 테스트 케이스 한 건."""

    id: str
    persona: Persona
    mode: Mode
    failure_modes: list[FailureMode] = Field(min_length=1)
    question: str
    answer_doc_ids: list[str]  # 부정 케이스(F6)는 빈 목록을 쓴다
    expected: str
    difficulty: Difficulty = "medium"
    notes: str = ""

    @field_validator("answer_doc_ids")
    @classmethod
    def _check_ids(cls, v: list[str]) -> list[str]:
        for did in v:
            if not _DOC_ID_RE.match(did):
                raise ValueError(f"invalid answer_doc_id: {did}")
        return v


class CorpusEntry(BaseModel):
    """핀된 코퍼스 문서 한 건. 정답 해소와 프로비저닝의 기준이다."""

    source: Source
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    filename: str
    title: str

    @property
    def doc_id(self) -> str:
        """이 문서의 안정 식별자."""
        return f"{self.source}:sha256:{self.sha256}"


def _read_jsonl(path: Path) -> list[str]:
    with path.open(encoding="utf-8") as f:
        return [line for line in (raw.strip() for raw in f) if line]


def read_cases(path: Path = CASES_PATH) -> list[Case]:
    """cases.jsonl을 읽어 각 행을 검증한다."""
    return [Case.model_validate(json.loads(line)) for line in _read_jsonl(path)]


def read_corpus(path: Path = CORPUS_PATH) -> list[CorpusEntry]:
    """corpus.jsonl을 읽어 각 행을 검증한다."""
    return [CorpusEntry.model_validate(json.loads(line)) for line in _read_jsonl(path)]
