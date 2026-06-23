---
created: 2026-06-23
updated: 2026-06-23
status: draft
overview: 중소벤처기업부 사업공고 게시판을 크롤링 관점에서 실측 분석하고, 기존 crawler/에 새 소스(mss)로 통합하는 설계를 정한다.
refs: docs/research/02-test-data-crawler/00-design.md, docs/research/02-test-data-crawler/01-source-candidates.md
---

# 02. 중소벤처기업부 사업공고 크롤링 분석과 통합 설계

중소벤처기업부 사업공고 PDF를 어떻게 수집할지 분석하고, 기존 크롤러에 합칠지 별도 디렉토리로 뺄지 결정한다.

---

## 1. 결론

- 본 사이트는 기존 `crawler/`에 새 소스 `mss` 하나로 통합한다. 별도 디렉토리로 분리하지 않는다(근거 §4).
- 페치 전략은 HTTP이다. httpx와 selectolax로 수집하며 Playwright는 필요 없다(근거 §3).
- 대상 게시판은 사업공고 보드 `cbIdx=310`이다(`훈령/예규/고시/공고`가 아니라 `사업공고`이다, §2).
- 이 게시판은 SH보다 단순하다. 목록과 상세가 모두 GET이고 첨부는 상세 HTML의 일반 앵커이다(§3.5).
- `robots.txt`는 `User-agent: *`에 `Allow: /`로 전체 허용이다(2026-06-23 확인).
- 첨부는 HWPX와 PDF가 함께 달린다. `allowed_suffixes = {".pdf"}`로 PDF만 통과시킨다(§3.3).
- 연/월(기간) 검색은 GET `searchPublicDate=YYYY-MM`으로 구현 가능하다(실측 확인, §3.4). 키워드 검색만 GET이 막혀 클라이언트 측 대조가 필요하다.

---

## 2. 대상 사이트 개요

- 사이트는 중소벤처기업부 공식 누리집(`https://www.mss.go.kr`)이다.
- 게시판 진입 URL은 `https://www.mss.go.kr/site/smba/ex/bbs/List.do`이다(요구사항).
- 이 URL은 게시판 식별자 `cbIdx`로 보드를 가른다. `cbIdx` 없이 진입하면 안내용 집계 페이지가 온다(관찰됨).
- 정부지원사업 공고가 모이는 보드는 `cbIdx=310`(`사업공고`)이다(좌측 내비 라벨로 확정, 2026-06-23).
- 따라서 수집 대상 목록 URL은 `https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310`이다.
- 이 게시판은 eGovFrame 표준 게시판(`ex/bbs`) 구조이다. SH의 게시판과 계열은 같지만 파일 다운로드 방식이 다르다(§3.5).

---

## 3. 크롤링 관점 분석(실측, 2026-06-23 캡처)

### 3.1 목록

- 목록은 서버 렌더 HTML로 한 페이지 10행이 그대로 온다(`recordCountPerPage=10`).
- 행의 제목 링크는 `href`가 아니라 `onclick="doBbsFView('310','<bcIdx>','<Gbn>','<parentSeq>')"` 핸들러이다.
- `doBbsFView`는 내부에서 `location.href="View.do?cbIdx=&bcIdx=&parentSeq="`로 이동한다(JS 본문 확인). 즉 상세 진입은 GET이다.
- 제목 텍스트는 같은 앵커의 `title` 속성에 전체가 들어 있다(예: `2026년 창업도시 조성 프로젝트 창업기업 모집 통합공고`).
- 페이지 이동(`doBbsFPag`)은 `bbsFVo` 폼을 POST 하지만, GET 쿼리 `?cbIdx=310&pageIndex=<N>`로도 페이지가 바뀐다(실측 확인). 따라서 페이징은 GET으로 처리한다.

### 3.2 상세

- 상세 URL은 `https://www.mss.go.kr/site/smba/ex/bbs/View.do?cbIdx=310&bcIdx=<bcIdx>&parentSeq=<parentSeq>`이다.
- 목록의 `doBbsFView('310', bcIdx, Gbn, parentSeq)` 인자에서 `bcIdx`와 `parentSeq`를 그대로 쓴다. 관찰값에서 둘은 같았다.
- 상세 페이지에 첨부 목록이 일반 HTML로 들어 있다. 별도 AJAX 호출이 없다.

### 3.3 첨부 다운로드

- 첨부 1건은 `<li>` 한 묶음이다. 묶음 안에 원본 파일명, 파일 종류 아이콘, 다운로드 앵커가 함께 있다.
- 원본 파일명은 `li .name` 텍스트에 있다(뒤에 `<em>[1.29 MB]</em>` 크기가 붙으므로 분리한다).
- 다운로드 앵커는 `a.btn.type_down[href]`이며, href가 완성된 GET URL이다.
- 다운로드 URL 형식은 `/common/board/Download.do?bcIdx=<bcIdx>&cbIdx=310&streFileNm=<uuid>.<ext>`이다.
- `streFileNm`은 서버 저장명(UUID + 실제 확장자)이다. 확장자가 여기에 그대로 노출되므로 PDF 판정에 쓸 수 있다.
- 실제 다운로드는 `200 OK`, `Content-Type: application/octet-stream`, `Content-Disposition: attachment; filename=<RFC 5987 인코딩 원본명>`으로 응답한다(실측 확인).
- 한 게시글에 같은 문서의 HWPX와 PDF가 동시에 달리는 경우가 흔하다. PDF만 받는다.

### 3.4 검색과 기간 필터

- 검색 폼은 `form#bbsFVo`(`action=/site/smba/ex/bbs/List.do`, `method=post`)이다.
- 키워드 입력 필드는 `searchKey`이다. 기간 필터의 화면 입력은 `selectYearValue`와 `selectMonthValue`이고, 서버로 가는 실제 값은 `searchPublicDate`(형식 `YYYY-MM`)이다. 분류 필터는 `tgtTypeCd`이다.
- 페이징 JS(`doBbsFPag`)는 폼을 POST 하기 전에 연/월을 `searchPublicDate` 한 필드로 합친다(JS 본문 확인).
- 기간 필터는 GET으로 동작한다. `?cbIdx=310&searchPublicDate=YYYY-MM`을 붙이면 목록이 그 달 기준으로 바뀐다(실측 확인). 월을 `00`으로 주면 해당 연도 전체이다(예: `2025-00`).
- 화면 입력값인 `year`와 `month`를 GET으로 단독 전송하면 무시된다. 작동하는 파라미터는 `searchPublicDate` 하나이다(실측 확인).
- 관찰된 의미는 "선택 시점부터 이후를 오래된 순으로 보여 준다"이다. 기본 목록은 최신순이지만 `searchPublicDate=2025-01`은 2025년 1월부터 오름차로, `2024-07`은 2024년 7월부터 오름차로 채워졌다. 정확한 경계(시작월 포함 여부, 종료 경계)는 구현 시 확정한다(§6).
- 키워드 검색은 GET이 막혀 있다. `?cbIdx=310&searchKey=<키워드>`를 붙이면 필터가 적용되지 않고 전체 목록이 온다(실측 확인).
- 따라서 키워드만 LH와 같은 절충을 택한다. 키워드는 목록 행의 제목(`title` 속성)에서 클라이언트 측으로 대조해 거른다. 연/월은 서버 GET 필터를 그대로 쓴다.

### 3.5 SH·LH 대비 차이

- SH는 목록과 상세가 모두 POST이고, 첨부 목록이 상세 HTML 안 인라인 JSON(`initParam.downList`)이며, 다운로드가 innorix(`innoFD.do`)이다([00 §6.1]).
- LH는 목록이 GET 또는 `pagingForm` POST이고, 첨부 목록이 별도 AJAX(`wrtFileDownl.do`, `csrfToken` 필요)이며, 다운로드가 `lhFile.do?fileid=`이다([00 §6.2]).
- MSS는 목록과 상세가 모두 GET이고, 첨부가 상세 HTML의 일반 앵커이며, 다운로드 URL이 앵커 href에 완성되어 있다.
- 즉 MSS는 두 기존 소스보다 단순하다. AJAX, CSRF 토큰, 인라인 JSON 파싱이 모두 없다.
- 공통점은 셋 다 서버 렌더 HTML 기반 HTTP 전략이라는 점이다([00 §3.3]).

---

## 4. 통합 대 별도 디렉토리 결정

- 결정은 기존 `crawler/`에 새 소스 `mss`로 통합하는 것이다.
- 이유는 크롤러 설계가 바로 이 확장을 전제로 만들어졌기 때문이다. 새 출처는 `BaseSource` 하위 클래스 하나와 레지스트리 한 줄로 추가한다([00 §3.1], [01 §7]).
- MSS가 자극하는 인제스트 경로(공고 PDF, OCR 또는 디지털 텍스트)는 기존 코퍼스와 같은 종류라 별도 파이프라인이 필요 없다([01 §5]).
- 별도 디렉토리는 러너, 저장, manifest, 중복 회피, 재시도, 동시성 제어를 중복 구현하게 만든다([00 §3.2], [00 §7]).
- 별도 디렉토리는 단일 CLI(`python -m crawler <source>`)의 일관성도 깬다([00 §8]).
- 따라서 별도 디렉토리는 채택하지 않는다. 공통 파이프라인을 건드리지 않고 사이트별 클래스만 더한다.

---

## 5. 구현 스케치(MssSource)

- 아래는 의도를 보여주는 스케치이다. 필드와 셀렉터는 구현 시 보강한다([00 §4]).
- 파일 위치는 `crawler/crawler/sources/mss.py`이며 `registry.py`에 한 줄 등록한다.

```python
class MssSearchParams(SearchParams):
    cb_idx: int = 310            # 보드 식별자(기본: 사업공고)
    keyword: str | None = None   # 제목 클라이언트 측 대조(§3.4)
    year: int | None = None      # 기간 필터 연도 → searchPublicDate(§3.4)
    month: int | None = None     # 기간 필터 월(없으면 00=연도 전체)
    # max_pages 는 기반형에서 상속

class MssSource(BaseSource):
    source_id = "mss"
    allowed_suffixes = {".pdf"}
    params_model = MssSearchParams

    def search(self, params):
        # GET List.do?cbIdx=<cb_idx>&pageIndex=<n> 으로 페이지를 늘린다(§3.1).
        # year 가 있으면 searchPublicDate=YYYY-MM(month 없으면 00)을 GET 으로 붙인다(§3.4).
        # a[onclick^=doBbsFView] 에서 bcIdx·parentSeq·제목(title)을 파싱한다.
        # keyword 가 있으면 제목으로 클라이언트 측 대조한다.
        ...

    def fetch_files(self, listing):
        # GET View.do?cbIdx=&bcIdx=&parentSeq= 로 상세를 받는다(§3.2).
        # li 안 .name(원본명)과 a.btn.type_down[href](다운로드 URL)를 짝지어 FileRef 로 만든다(§3.3).
        ...

    def is_target_file(self, ref):
        # 확장자 .pdf + 파일명에 "공고" (기존 소스와 동일 규칙, [00 §4]).
        return ref.filename.lower().endswith(".pdf") and "공고" in ref.filename

    def download(self, ref, dest_path):
        # a.btn.type_down 의 href(GET)를 httpx 스트리밍으로 저장한다(§3.3).
        ...
```

- CLI는 `__main__.py`에 서브파서 한 개를 더한다(예: `mss --cb-idx 310 --year 2026 --month 6 --keyword 창업 --max-pages 2`).
- 출력은 `sample-datas/mss/`에 적재하고 manifest와 중복 회피를 공통 `storage`로 처리한다([00 §2.2], [00 §7.2]).

---

## 6. 미해결, 구현 시 확정

- 기간 필터 `searchPublicDate=YYYY-MM`의 정확한 경계 의미(시작월 포함 여부, 종료 경계, 정렬 방향)를 구현 시 확정한다(§3.4).
- 키워드 서버 검색을 GET 대신 폼 POST로 살릴지, 클라이언트 측 제목 대조로 둘지 구현 시 정한다. MVP 권장은 클라이언트 측 대조이다(§3.4).
- `doBbsFView`의 세 번째 인자(`Gbn`, 관찰값 `16010100`)가 상세 진입에 필요한지 확인한다. 관찰상 `bcIdx`와 `parentSeq`만으로 충분했다(§3.1).
- 한 게시글에 PDF가 여러 개일 때 모두 받을지 대표 1개만 받을지 정책을 정한다. 기존 소스는 모두 받는다.
- 원본 파일명의 `[크기]` 꼬리(`<em>`)와 공백 정리 규칙을 `storage`의 안전 파일명 처리와 맞춘다([00 §7.4]).

---

## 7. 참고 출처

- 대상 게시판(사업공고): `https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310`
- 기간 필터 예시(2025년 1월 기준): `https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310&searchPublicDate=2025-01`
- 상세 진입 형식: `https://www.mss.go.kr/site/smba/ex/bbs/View.do?cbIdx=310&bcIdx=<bcIdx>&parentSeq=<parentSeq>`
- 첨부 다운로드 형식: `https://www.mss.go.kr/common/board/Download.do?bcIdx=<bcIdx>&cbIdx=310&streFileNm=<uuid>.<ext>`
- robots: `https://www.mss.go.kr/robots.txt` (`Allow: /`, 2026-06-23 확인)
- 크롤러 설계 본문과 추상화: [00-design.md](./00-design.md)
- 출처 확장 방법과 SH HTTP 전략 재사용: [01-source-candidates.md](./01-source-candidates.md) §7
