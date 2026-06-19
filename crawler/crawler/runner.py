"""크롤링 파이프라인 오케스트레이션 (design §3.2, §7).

흐름: registry에서 Source 해석 → 검색조건 검증 → search → fetch_files
→ 타깃 필터 → 중복 회피 → download → manifest 적재.

게시글·첨부 단위로 실패를 격리한다. 한 건의 실패가 전체 실행을 멈추지 않는다.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

from crawler.config import RunConfig
from crawler.models import ManifestEntry, SearchParams
from crawler.sources.registry import get_source_cls
from crawler.storage import Manifest, now_iso, safe_filename, sha256_of, unique_path

log = logging.getLogger("crawler")


@dataclass
class RunResult:
    """1회 실행 요약."""

    source_id: str
    listings: int = 0
    downloaded: int = 0
    skipped_dup: int = 0
    skipped_filtered: int = 0
    failures: int = 0
    files: list[Path] = field(default_factory=list)


def run(source_id: str, raw_params: dict, config: RunConfig) -> RunResult:
    """한 출처를 1회 크롤링한다.

    raw_params는 CLI/호출자가 준 검색 조건 dict이며, 사이트의
    ``params_model``로 검증된다 (design §3.2).
    """
    source_cls = get_source_cls(source_id)
    params: SearchParams = source_cls.params_model.model_validate(raw_params)

    dest_dir = config.source_dir(source_id)
    manifest = Manifest(dest_dir)
    result = RunResult(source_id=source_id)

    with source_cls(config) as source:
        for listing in source.search(params):
            result.listings += 1
            try:
                refs = source.fetch_files(listing)
            except Exception:  # 게시글 단위 실패 격리 (design §7.3)
                log.exception("fetch_files 실패: post_id=%s", listing.post_id)
                result.failures += 1
                continue

            for ref in refs:
                # 타깃 필터: "청약공고 PDF"만 통과 (design §3.2)
                if not source.is_target_file(ref):
                    result.skipped_filtered += 1
                    continue
                # 다운로드 전 중복 회피: 이미 받은 file_url 이면 건너뜀 (design §7.2)
                if manifest.has_url(ref.file_url):
                    result.skipped_dup += 1
                    continue

                time.sleep(config.delay)  # 요청 지연 (design §7.1)
                try:
                    saved = _download_one(source, listing, ref, dest_dir, manifest)
                except Exception:  # 첨부 단위 실패 격리 (design §7.3)
                    log.exception("download 실패: post_id=%s file=%s", listing.post_id, ref.filename)
                    result.failures += 1
                    continue

                if saved is None:
                    result.skipped_dup += 1
                else:
                    result.downloaded += 1
                    result.files.append(saved)

    return result


def _download_one(source, listing, ref, dest_dir: Path, manifest: Manifest) -> Path | None:
    """첨부 하나를 받아 manifest에 기록한다. 본문 해시 중복이면 None을 반환한다."""
    suffix = Path(ref.filename).suffix
    filename = safe_filename(ref.filename, posted_at=listing.posted_at, suffix_hint=suffix)
    dest_path = unique_path(dest_dir, filename, discriminator=listing.post_id)

    source.download(ref, dest_path)

    digest = sha256_of(dest_path)
    if manifest.has_hash(digest):  # 같은 본문을 이미 받았으면 파일을 지우고 건너뜀
        dest_path.unlink(missing_ok=True)
        return None

    manifest.append(
        ManifestEntry(
            post_id=listing.post_id,
            title=listing.title,
            filename=dest_path.name,
            source_url=listing.detail_ref,
            file_url=ref.file_url,
            sha256=digest,
            size_bytes=dest_path.stat().st_size,
            downloaded_at=now_iso(),
        )
    )
    return dest_path
