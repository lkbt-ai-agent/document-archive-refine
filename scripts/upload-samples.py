#!/usr/bin/env python3
"""크롤링 샘플(PDF)을 프론트 업로드와 동일한 경로로 앱에 적재한다.

프론트의 useUpload 흐름을 그대로 복제한다:
  1) POST /documents            (init)     → document_id + presigned upload_url
  2) PUT  {upload_url}          (MinIO)    → 파일 바이트 직접 전송
  3) POST /documents/{id}/complete         → 인제스트 enqueue(워커가 추출·임베딩)
인증은 고정 SEED_USER_ID라 토큰이 필요 없다(dev-stack 기준).

대상 폴더(예: 청약/lh)는 없으면 만든다. 가상 루트 "내 아카이브"는 백엔드 행이 아니므로
경로의 첫 조각이 최상위 폴더(parent_id=None)가 된다.

"신규건" 식별은 파라미터로 조절한다(재사용 목적):
  --since ISO        manifest.downloaded_at >= ISO 인 항목만
  --sha256 HEX ...   해당 sha256 항목만(반복 지정 가능)
  --post-id ID ...   해당 post_id 항목만(반복 지정 가능)
  --limit N          앞에서 N건만
조건을 안 주면 manifest 전체가 후보다. 기본적으로 대상 폴더에 같은
original_filename 이 이미 있으면 건너뛴다(--no-skip-existing 으로 해제).

사용 예:
  # 마지막 크롤링(예: 그 시점 이후) 신규건만 청약/lh 로, 미리보기
  python scripts/upload-samples.py lh --since 2026-06-23T00:00:00+00:00 --dry-run
  # 실제 업로드
  python scripts/upload-samples.py lh --since 2026-06-23T00:00:00+00:00
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_ROOT = REPO_ROOT / "sample-datas"
DEFAULT_API = "http://localhost:8000"
DEFAULT_MIME = "application/pdf"


# --- HTTP helpers (stdlib only, 의존성 없음) -------------------------------


def _api_json(method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise SystemExit(f"API {method} {url} 실패: {e.code} {detail}") from e


def _put_file(url: str, path: Path, mime: str) -> None:
    payload = path.read_bytes()
    req = urllib.request.Request(url, data=payload, method="PUT")
    req.add_header("Content-Type", mime)  # init 에서 보낸 mime_type 과 일치
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status not in (200, 204):
                raise SystemExit(f"presigned PUT 실패: {resp.status}")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"presigned PUT 실패: {e.code} {e.read().decode(errors='replace')}") from e


# --- 폴더 경로 확보 --------------------------------------------------------


def ensure_folder_path(api: str, segments: list[str]) -> str | None:
    """`청약/lh` 같은 경로를 끝 폴더의 id 로 해석한다. 없으면 만든다.

    반환: 끝 폴더 id. segments 가 비면 None(=루트)."""
    folders = _api_json("GET", f"{api}/folders")  # 평면 트리(parent_id 포함)
    by_parent: dict[str | None, dict[str, dict]] = {}
    for f in folders:
        by_parent.setdefault(f["parent_id"], {})[f["name"]] = f

    parent_id: str | None = None
    for name in segments:
        existing = by_parent.get(parent_id, {}).get(name)
        if existing is None:
            created = _api_json(
                "POST", f"{api}/folders", {"parent_id": parent_id, "name": name}
            )
            print(f"  폴더 생성: {'/'.join(segments[:segments.index(name)+1])}")
            by_parent.setdefault(parent_id, {})[name] = created
            existing = created
        parent_id = existing["id"]
    return parent_id


def existing_filenames(api: str, folder_id: str | None) -> set[str]:
    """대상 폴더에 이미 있는 original_filename 집합(재실행 시 중복 업로드 방지)."""
    names: set[str] = set()
    cursor: str | None = None
    while True:
        q = ["limit=50"]
        if folder_id:
            q.append(f"folder_id={folder_id}")
        if cursor:
            q.append(f"cursor={cursor}")
        page = _api_json("GET", f"{api}/documents?{'&'.join(q)}")
        for d in page.get("items", []):
            names.add(d["original_filename"])
        cursor = page.get("next_cursor")
        if not cursor:
            break
    return names


# --- manifest 후보 선별 ----------------------------------------------------


def select_entries(manifest_path: Path, args: argparse.Namespace) -> list[dict]:
    if not manifest_path.exists():
        raise SystemExit(f"manifest 없음: {manifest_path}")
    entries: list[dict] = []
    since = datetime.fromisoformat(args.since) if args.since else None
    sha_filter = set(args.sha256 or [])
    pid_filter = set(args.post_id or [])
    for line in manifest_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        if since is not None:
            if datetime.fromisoformat(row["downloaded_at"]) < since:
                continue
        if sha_filter and row.get("sha256") not in sha_filter:
            continue
        if pid_filter and row.get("post_id") not in pid_filter:
            continue
        entries.append(row)
    if args.limit is not None:
        entries = entries[: args.limit]
    return entries


# --- 업로드 1건(프론트 useUpload 복제) --------------------------------------


def upload_one(api: str, folder_id: str | None, path: Path, mime: str) -> str:
    init = _api_json(
        "POST",
        f"{api}/documents",
        {
            "folder_id": folder_id,
            "original_filename": path.name,
            "mime_type": mime,
            "size_bytes": path.stat().st_size,
        },
    )
    _put_file(init["upload_url"], path, mime)
    _api_json("POST", f"{api}/documents/{init['document_id']}/complete")
    return init["document_id"]


def main() -> int:
    p = argparse.ArgumentParser(description="크롤링 샘플을 프론트 업로드 경로로 적재")
    p.add_argument("source", help="출처 id(=sample-datas 하위 디렉토리, 예: lh, sh)")
    p.add_argument("--folder", default="청약/lh", help="대상 폴더 경로(기본: 청약/lh)")
    p.add_argument("--api", default=DEFAULT_API, help=f"API base(기본: {DEFAULT_API})")
    p.add_argument("--data-root", default=str(DEFAULT_DATA_ROOT), help="sample-datas 루트")
    p.add_argument("--mime", default=DEFAULT_MIME, help=f"MIME(기본: {DEFAULT_MIME})")
    # 신규건 식별 조건(재사용용) — 조합 가능
    p.add_argument("--since", help="manifest.downloaded_at >= 이 ISO 시각인 항목만")
    p.add_argument("--sha256", nargs="*", help="해당 sha256 항목만(여러 개)")
    p.add_argument("--post-id", nargs="*", help="해당 post_id 항목만(여러 개)")
    p.add_argument("--limit", type=int, help="앞에서 N건만")
    p.add_argument(
        "--no-skip-existing",
        action="store_true",
        help="대상 폴더에 같은 original_filename 이 있어도 다시 업로드",
    )
    p.add_argument("--dry-run", action="store_true", help="업로드 없이 대상만 출력")
    args = p.parse_args()

    data_root = Path(args.data_root)
    manifest_path = data_root / args.source / "manifest.jsonl"
    dest_dir = data_root / args.source

    entries = select_entries(manifest_path, args)
    print(f"manifest 후보: {len(entries)}건 ({manifest_path})")

    # 파일 존재 확인 + 경로 매핑(manifest.filename = 저장된 basename)
    candidates: list[Path] = []
    for row in entries:
        fp = dest_dir / row["filename"]
        if fp.exists():
            candidates.append(fp)
        else:
            print(f"  [경고] 파일 없음, 건너뜀: {row['filename']}")

    segments = [s for s in args.folder.split("/") if s]

    if args.dry_run:
        print(f"대상 폴더(예정): {args.folder}")
        print(f"업로드 예정: {len(candidates)}건 (중복 검사 생략 — dry-run)")
        for fp in candidates:
            print(f"  - {fp.name}")
        return 0

    folder_id = ensure_folder_path(args.api, segments)
    skip = set() if args.no_skip_existing else existing_filenames(args.api, folder_id)

    uploaded = skipped = failed = 0
    for fp in candidates:
        if fp.name in skip:
            skipped += 1
            continue
        try:
            doc_id = upload_one(args.api, folder_id, fp, args.mime)
            uploaded += 1
            print(f"  업로드: {fp.name} -> {doc_id}")
        except SystemExit as e:
            failed += 1
            print(f"  [실패] {fp.name}: {e}")

    print(
        f"완료 폴더={args.folder} 업로드={uploaded} 중복건너뜀={skipped} "
        f"실패={failed} 후보={len(candidates)}"
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
