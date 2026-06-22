# test-data-crawler

공개 게시판의 **청약공고 한글 PDF**를 사이트별 추상화로 크롤링해
프로젝트 루트 `sample-datas/<source_id>/` 아래에 출처별로 적재하는 테스트 데이터 크롤러.

- 설계: [`docs/research/02-test-data-crawler/00-design.md`](../docs/research/02-test-data-crawler/00-design.md)
- 구현 계획: [`docs/plan/done/02-test-data-crawler/01-crawler-mvp.md`](../docs/plan/done/02-test-data-crawler/01-crawler-mvp.md)

## 셋업 (최초 1회)

```bash
cd crawler && uv sync
```

SH·LH 모두 httpx로 동작하므로 브라우저 설치는 필요 없다.
(향후 JS 의존 사이트용 `browser.py`를 쓸 때만 `uv run playwright install chromium`.)

## 실행

```bash
# SH 서울주택도시공사 — 제목 키워드로 수집
uv run crawler sh --keyword 모집공고 --max-pages 1

# LH 한국토지주택공사 — 임대 카테고리, 공고상태 필터
uv run crawler lh --category 임대 --status 공고중 --max-pages 1

# LH — 지역·키워드 좁히기 (지역·키워드는 클라이언트 측 대조)
uv run crawler lh --category 임대 --region 서울 --keyword 행복주택
```

### 옵션

| 옵션 | 대상 | 설명 |
| ---- | ---- | ---- |
| `--max-pages N` | 공통 | 목록 탐색 페이지 수(기본 1) |
| `--out DIR` | 공통 | 출력 루트(기본 `../sample-datas`) |
| `--delay SEC` | 공통 | 요청 간 지연 초(기본 0.7) |
| `--keyword` | sh·lh | sh=제목/내용, lh=공고명 검색어 |
| `--search-type` | sh | `title`(기본) / `content` |
| `--category` | lh | `임대`(기본)·`분양`·`토지`·`상가` |
| `--region` | lh | 지역명(예: `서울`) |
| `--status` | lh | `공고중`·`접수중`·`접수마감`·`정정공고중` |

재실행은 안전하다. `manifest.jsonl`로 이미 받은 파일을 건너뛴다(멱등).

## 구조

| 모듈 | 책임 |
| ---- | ---- |
| `models.py` | `SearchParams`/`Listing`/`FileRef`/`ManifestEntry` |
| `sources/base.py` | `BaseSource` 추상 인터페이스 |
| `sources/{sh,lh}.py` | 사이트별 구현(검색·상세·다운로드) |
| `sources/registry.py` | `source_id` → Source 등록표 |
| `http.py` | httpx Client 팩토리·스트리밍 다운로드 |
| `browser.py` | Playwright 세션·응답/다운로드 캡처 |
| `storage.py` | 적재·안전 파일명·manifest·중복 회피 |
| `runner.py` | 파이프라인·실패 격리·동시성/지연 |

## 산출물

```
sample-datas/<source_id>/
  <YYYYMMDD>_<제목>.pdf
  manifest.jsonl        # 1파일=1행: post_id·title·url·sha256·bytes·시각
```

`manifest.jsonl`은 재실행 시 중복 다운로드를 막고 출처를 추적하는 근거다.

## 주의

- 수집 대상은 공개 청약공고로 한정한다. 각 사이트 `robots.txt`와 이용약관을 준수한다.
- 실제 엔드포인트 파라미터·셀렉터는 사이트 개편 시 바뀔 수 있다(`sources/{sh,lh}.py`의 `# CAPTURE:` 주석 참고).
