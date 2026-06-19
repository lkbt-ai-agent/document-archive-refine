"""산출물 적재·중복 회피 (design §2.2, §7.2, §7.4).

다운로드 파일을 ``sample-datas/<source_id>/`` 아래에 저장하고,
출처·해시 메타를 ``manifest.jsonl``에 1건=1행으로 남긴다.
manifest는 중복 회피(같은 file_url/sha256 재다운로드 금지)의 근거가 된다.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from crawler.models import ManifestEntry

_MANIFEST_NAME = "manifest.jsonl"

# OS 금지문자 및 제어문자. 안전한 파일명으로 치환한다 (design §7.4).
_UNSAFE = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def safe_filename(name: str, *, posted_at: str | None = None, suffix_hint: str | None = None) -> str:
    """한글을 보존하되 금지문자를 치환한 안전 파일명을 만든다.

    등록일(YYYYMMDD)을 접두로 붙여 정렬·추적을 돕는다.
    """
    cleaned = _UNSAFE.sub("_", name).strip().strip(".")
    cleaned = re.sub(r"\s+", " ", cleaned) or "untitled"
    if suffix_hint and not cleaned.lower().endswith(suffix_hint.lower()):
        cleaned = f"{cleaned}{suffix_hint}"
    prefix = ""
    if posted_at:
        digits = re.sub(r"\D", "", posted_at)[:8]
        if len(digits) == 8:
            prefix = f"{digits}_"
    return f"{prefix}{cleaned}"


def unique_path(dest_dir: Path, filename: str, *, discriminator: str | None = None) -> Path:
    """이름 충돌 시 discriminator(예: post_id) 또는 일련번호를 접미사로 붙인다."""
    candidate = dest_dir / filename
    if not candidate.exists():
        return candidate
    stem, suffix = candidate.stem, candidate.suffix
    if discriminator:
        candidate = dest_dir / f"{stem}__{discriminator}{suffix}"
        if not candidate.exists():
            return candidate
    i = 2
    while True:
        candidate = dest_dir / f"{stem}__{i}{suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def sha256_of(path: Path) -> str:
    """파일 본문의 SHA-256을 계산한다 (무결성·중복 식별)."""
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


class Manifest:
    """출처별 manifest.jsonl 읽기·쓰기 및 중복 판정."""

    def __init__(self, source_dir: Path) -> None:
        self.path = source_dir / _MANIFEST_NAME
        self._urls: set[str] = set()
        self._hashes: set[str] = set()
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        for line in self.path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("file_url"):
                self._urls.add(row["file_url"])
            if row.get("sha256"):
                self._hashes.add(row["sha256"])

    def has_url(self, file_url: str | None) -> bool:
        """이미 받은 file_url인지 본다 (다운로드 전 조회, design §7.2)."""
        return bool(file_url) and file_url in self._urls

    def has_hash(self, sha256: str) -> bool:
        """이미 받은 본문 해시인지 본다 (다운로드 후 조회)."""
        return sha256 in self._hashes

    def append(self, entry: ManifestEntry) -> None:
        """manifest에 1행을 추가하고 인메모리 인덱스를 갱신한다."""
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(entry.model_dump_json() + "\n")
        if entry.file_url:
            self._urls.add(entry.file_url)
        self._hashes.add(entry.sha256)


def now_iso() -> str:
    """현재 시각 ISO-8601(UTC)."""
    return datetime.now(timezone.utc).isoformat()
