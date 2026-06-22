---
name: test-data-crawler
description: 이 앱의 테스트 데이터를 공개 게시판에서 크롤링한다 — SH(서울주택도시공사)·LH(한국토지주택공사)의 청약 모집공고 PDF를 sample-datas/에 다운로드. "테스트 데이터 수집/크롤링", "샘플 문서 다운로드", "청약공고 PDF 받아줘", "SH/LH 공고 크롤링" 같은 요청에 사용.
---

# test-data-crawler — 청약공고 PDF 수집

공개 게시판에서 **청약 모집공고 한글 PDF**를 내려받아
프로젝트 루트 `sample-datas/<source_id>/`에 출처별로 적재한다.
앱 인제스트(업로드·추출·임베딩)를 시험할 실데이터를 만드는 용도다.

- 소스: `crawler/` (uv 프로젝트, Python 3.12)
- 설계: `docs/research/02-test-data-crawler/00-design.md`
- 출력: `sample-datas/<sh|lh>/` + `manifest.jsonl` (gitignore — 코퍼스는 커밋 안 함)
- 대상: SH 임대게시판, LH 분양·임대 공고. **둘 다 httpx로 동작**(브라우저 불필요).

## 실행 방식
- 모든 명령은 `crawler/`에서 `uv run`으로 돈다. 절대경로로 `cd`를 붙인다(쉘 상태 미유지).
- 네트워크 다운로드라 수십 초~분 걸릴 수 있다 → 길어지면 **Bash `run_in_background: true`**.
- 재실행은 멱등이다(`manifest.jsonl`로 중복 건너뜀). 안심하고 다시 돌려도 된다.

## 사전 조건 (최초 1회)
```bash
cd /Users/xxx/Desktop/git-2026-document-archive-refine/crawler && uv sync
```

---

## 1. SH 서울주택도시공사
```bash
cd /Users/xxx/Desktop/git-2026-document-archive-refine/crawler && \
  uv run crawler sh --keyword 모집공고 --max-pages 1
```
- 검색: `--keyword`(제목/내용), `--search-type title|content`(기본 title).
- 흐름: `list.do` 목록 → `view.do` 상세 → `innoFD.do` 다운로드. 파일명에 "공고" 있는 `.pdf`만 수집.

## 2. LH 한국토지주택공사
```bash
cd /Users/xxx/Desktop/git-2026-document-archive-refine/crawler && \
  uv run crawler lh --category 임대 --status 공고중 --max-pages 1
```
- 카테고리: `--category 임대|분양|토지|상가`(기본 임대).
- 필터: `--status`(공고중·접수중·접수마감·정정공고중, 서버 필터), `--region 서울`·`--keyword 행복주택`(클라이언트 측 대조).
- 흐름: `selectWrtancList.do` 목록 → `wrtFileDownl.do` 첨부목록 → `lhFile.do` 다운로드.

## 공통 옵션
| 옵션 | 설명 |
| ---- | ---- |
| `--max-pages N` | 목록 탐색 페이지 수(기본 1, 1페이지≈SH 10건·LH 50건) |
| `--out DIR` | 출력 루트(기본 프로젝트 `sample-datas/`) |
| `--delay SEC` | 요청 간 지연 초(기본 0.7, 예의상 유지) |

---

## 결과 확인
```bash
ls -la /Users/xxx/Desktop/git-2026-document-archive-refine/sample-datas/sh/   # 또는 /lh/
wc -l  /Users/xxx/Desktop/git-2026-document-archive-refine/sample-datas/sh/manifest.jsonl
```
- 파일명은 `<YYYYMMDD>_<제목>.pdf`. `manifest.jsonl` 1행=1파일(post_id·title·url·sha256·bytes·시각).
- 완료 로그: `완료 source=.. 목록=.. 다운로드=.. 중복=.. 필터=.. 실패=..`.

## 새 출처 추가
- `crawler/sources/`에 `BaseSource` 하위 클래스 하나를 만들고 `registry.py`에 등록한다(설계 §3·§4).
- 후보(공정위 표준계약서·전자관보 등)는 `docs/research/02-test-data-crawler/01-source-candidates.md` 참고.

## 트러블슈팅
- `command not found: uv run crawler` → `crawler/`에서 `uv sync`를 먼저. 다른 디렉토리면 `cd`가 루트로 리셋된 것.
- 다운로드 0건·필터만 큼 → 해당 게시글에 "공고" 이름의 PDF가 없을 수 있다. `--keyword`/`--category`를 바꿔 본다.
- 한 건 실패해도 전체는 계속된다(게시글·첨부 단위 실패 격리). 실패 수는 완료 로그에서 확인.
- 사이트 개편으로 깨지면 엔드포인트가 바뀐 것 → `sources/{sh,lh}.py` 상단 주석의 캡처 기준을 재확인.
