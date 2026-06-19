# test-data-crawler

공개 게시판의 **청약공고 한글 PDF**를 사이트별 추상화로 크롤링해
프로젝트 루트 `sample-datas/<source_id>/` 아래에 출처별로 적재하는 테스트 데이터 크롤러.

- 설계: [`research/02-test-data-crawler/00-design.md`](../research/02-test-data-crawler/00-design.md)
- 구현 계획: [`plan/active/02-test-data-crawler/01-crawler-mvp.md`](../plan/active/02-test-data-crawler/01-crawler-mvp.md)

## 셋업

```bash
cd crawler
uv sync                              # venv + 의존성 설치 (Python 3.12)
uv run playwright install chromium   # LH(브라우저 전략) 1회 셋업
```

## 실행

```bash
# SH 서울주택도시공사: 키워드로 1페이지 수집 (httpx 전략)
uv run crawler sh --keyword 청약 --max-pages 1

# LH 한국토지주택공사: 임대 카테고리, 지역·상태 필터 (Playwright 전략)
uv run crawler lh --category 임대 --region 서울 --status 공고중 --max-pages 2
```

공통 옵션: `--out`(기본 `../sample-datas`), `--concurrency`, `--delay`.

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
