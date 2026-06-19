---
created: 2026-06-19
updated: 2026-06-19
status: draft
overview: 공개 웹사이트의 청약공고 한글 문서(PDF)를 사이트별 추상화 구조로 크롤링·다운로드해 sample-datas/에 출처별로 적재하는 파이썬 MVP를 설계한다.
refs: research/01-mvp-research/01 §1, architecture/04-data/documents-schema.md §1
---

# 02. 테스트 데이터 크롤러 MVP 설계

공개 게시판의 청약공고 PDF를 사이트마다 다른 검색 조건으로 수집해 `sample-datas/<출처>/`에 분류 저장하는 파이썬 크롤러를 어떻게 만들지 정의한다.

---

## 1. 목표와 범위

- 본 크롤러는 이 앱의 인제스트 파이프라인을 시험할 한글 문서 코퍼스를 자동 수집한다.
- 본 크롤러는 사이트별 게시판에서 "청약공고" 관련 PDF만 내려받는다.
- 본 크롤러는 출처(사이트)를 서브디렉토리로 삼아 `sample-datas/` 아래에 파일을 분류한다.
- 본 크롤러는 사이트마다 검색 조건과 페이지 구조가 다르다는 사실을 추상화 인터페이스로 흡수한다.

### 1.1 대상 데이터

- 대상 문서 형식은 한글 PDF이다(두 MVP 사이트 모두 PDF 첨부가 공고문 본체이다).
- 추출 확장자는 사이트별로 다르게 설정한다. 사이트마다 `allowed_suffixes` 화이트리스트를 선언한다.
- 앱의 인제스트는 PDF, TXT, MD, PNG, JPG, JPEG, WEBP를 지원한다([architecture/04-data/documents-schema.md] §1, [01 §1]). 화이트리스트는 이 집합을 벗어나지 않는다.

### 1.2 비목표(Non-goals)

- 본 MVP는 로그인이 필요한 비공개 게시판을 다루지 않는다.
- 본 MVP는 첨부 PDF의 텍스트 추출, OCR, 임베딩을 하지 않는다(그 책임은 앱 인제스트에 있다, [01 §2]).
- 본 MVP는 증분 스케줄링(크론)과 분산 수집을 다루지 않는다. 단발 실행을 기준으로 한다.

---

## 2. 산출물 배치

### 2.1 소스 디렉토리(제안: `crawler/`)

- 소스 코드는 프로젝트 루트의 독립 디렉토리 `crawler/`에 둔다.
- 기존 `web/`, `backend/` 디렉토리에는 크롤러 코드를 두지 않는다(요구사항 3).
- 디렉토리 이름 `crawler/`는 제안값이다. 확정 전 변경할 수 있다.

```
crawler/                    # 루트의 별도 소스 디렉토리(web/, backend/ 와 분리)
  pyproject.toml            # uv 로 의존성/실행 관리
  crawler/
    __main__.py             # CLI 진입점(python -m crawler)
    config.py               # 공통 설정(동시성, 타임아웃, UA)
    models.py               # SearchParams, Listing, FileRef 기반형
    runner.py               # 검색→상세→필터→다운로드 파이프라인
    storage.py              # sample-datas 적재, 안전 파일명, manifest
    http.py                 # httpx.Client 팩토리(헤더/쿠키/타임아웃/재시도)
    browser.py              # Playwright 세션 헬퍼(JS 사이트용)
    sources/
      base.py               # BaseSource 추상 클래스
      sh.py                 # SH 구현(httpx 전략)
      lh.py                 # LH 구현(Playwright 전략)
      registry.py           # source_id → Source 등록표
  README.md
```

### 2.2 출력 디렉토리(`sample-datas/`)

- 다운로드 파일은 `sample-datas/<source_id>/` 아래에 저장한다.
- `source_id`는 사이트 식별자이다(예: `sh`, `lh`).
- 각 출처 디렉토리는 수집 이력을 담은 `manifest.jsonl`을 함께 둔다.

```
sample-datas/
  sh/
    20260619_미리내집-2-1차-공고문.pdf
    manifest.jsonl
  lh/
    20260619_행복주택-OO지구-입주자모집공고.pdf
    manifest.jsonl
```

- `manifest.jsonl`은 파일 1건당 1행(JSON)을 기록한다.
- 1행에는 `post_id`, `title`, `filename`, `source_url`, `file_url`, `sha256`, `size_bytes`, `downloaded_at`를 담는다.
- manifest는 중복 회피(§7.2)와 출처 추적의 근거가 된다.

---

## 3. 아키텍처

### 3.1 추상화 경계

- 크롤러는 사이트마다 달라지는 부분과 공통인 부분을 분리한다.
- 사이트마다 달라지는 부분은 검색 조건, 목록 파싱, 상세 진입, 첨부 추출, 다운로드 방식이다.
- 공통인 부분은 파이프라인 흐름, 저장, manifest, 재시도, 동시성 제어이다.
- 사이트별 구현은 `BaseSource` 하위 클래스 하나로 캡슐화한다.

### 3.2 파이프라인 흐름(공통)

1. `runner`는 `registry`에서 `source_id`에 해당하는 `Source`를 꺼낸다.
2. `runner`는 사용자가 준 검색 조건을 그 사이트의 `params_model`로 검증한다.
3. `Source.search(params)`는 게시글 목록(`Listing`)을 순회 반환한다.
4. `Source.fetch_files(listing)`는 상세 페이지에서 첨부(`FileRef`) 목록을 추출한다.
5. `runner`는 `Source.is_target_file`로 "청약공고 PDF" 조건과 확장자 화이트리스트를 적용한다.
6. `Source.download(ref, dest)`는 통과한 파일만 `sample-datas/<source_id>/`에 저장한다.
7. `storage`는 sha256과 메타를 manifest에 추가한다(이미 있으면 건너뛴다).

### 3.3 두 가지 페치 전략

- 사이트의 렌더링 방식에 따라 페치 전략을 둘로 나눈다.

| 전략 | 적용 조건 | 도구 | 적용 사이트 |
| ---- | --------- | ---- | ----------- |
| HTTP | 서버 렌더 HTML, 목록·상세가 URL 파라미터로 결정 | httpx + HTML 파서 | SH(§6.1) |
| 브라우저 | JS/AJAX로 목록·필터를 그리고 POST 세션이 필요 | Playwright | LH(§6.2) |

- 전략은 사이트 구현의 내부 선택이다. `runner`는 전략을 모른다.
- 브라우저 전략은 무겁다. HTTP로 가능한 사이트에는 쓰지 않는다.

---

## 4. 핵심 추상 인터페이스

- 아래 코드는 의도를 보여주는 스케치이다. 필드는 구현 시 보강한다.

```python
# crawler/models.py
from pydantic import BaseModel

class SearchParams(BaseModel):
    """사이트마다 하위 클래스로 필드를 다르게 정의한다."""
    max_pages: int = 1

class Listing(BaseModel):
    source_id: str
    post_id: str            # 사이트 고유 게시글 식별자
    title: str
    posted_at: str | None = None
    detail_ref: str         # 상세 진입에 필요한 URL 또는 파라미터(JSON 문자열)

class FileRef(BaseModel):
    filename: str           # 사이트가 제공한 원본 파일명
    label: str | None = None  # 첨부 라벨(예: "입주자모집공고")
    file_url: str | None = None  # 직접 다운로드 URL(있으면)
    download_hint: dict = {}     # 간접 다운로드 정보(클릭 대상 등)
```

```python
# crawler/sources/base.py
from abc import ABC, abstractmethod
from collections.abc import Iterator
from pathlib import Path
from crawler.models import SearchParams, Listing, FileRef

class BaseSource(ABC):
    source_id: str                  # sample-datas/<source_id>
    allowed_suffixes: set[str]      # 사이트별 추출 확장자 화이트리스트
    params_model: type[SearchParams]

    @abstractmethod
    def search(self, params: SearchParams) -> Iterator[Listing]:
        """검색 조건으로 게시글 목록을 순회 반환한다."""

    @abstractmethod
    def fetch_files(self, listing: Listing) -> list[FileRef]:
        """상세 페이지에서 첨부 목록을 추출한다."""

    @abstractmethod
    def download(self, ref: FileRef, dest_dir: Path) -> Path:
        """첨부를 dest_dir 에 저장하고 경로를 반환한다."""

    def is_target_file(self, ref: FileRef) -> bool:
        """기본은 확장자 화이트리스트로 판정한다. 사이트가 라벨 조건을 더한다."""
        return Path(ref.filename).suffix.lower() in self.allowed_suffixes
```

- "청약공고만" 조건은 `is_target_file` 오버라이드로 표현한다.
- 두 사이트는 라벨이나 파일명에 "공고"가 포함된 PDF만 통과시킨다(§6.1.3, §6.2.3).

---

## 5. 기술 스택

- 아래 선택은 context7로 현행 API를 확인했다(출처는 §10).

| 관심사 | 선택 | 근거 |
| ------ | ---- | ---- |
| 런타임 | Python 3.12, `uv` | 앱 백엔드와 동일 언어, uv로 격리 실행 |
| HTTP 클라이언트 | `httpx` | 동기·비동기 동시 지원, 영속 `Client`로 쿠키·헤더 유지, 스트리밍 다운로드 |
| 헤드리스 브라우저 | `playwright`(Python) | JS 렌더링 사이트의 폼 조작·다운로드 이벤트·네트워크 응답 캡처 |
| HTML 파싱 | `selectolax`(기본) 또는 `beautifulsoup4` | eGovFrame 정적 HTML에서 표·링크 추출 |
| 데이터 모델 | `pydantic` v2 | 사이트별 검색 조건을 타입으로 검증, 앱과 동일 스택 |
| 타입 감지 | `filetype`(magic bytes) | 확장자 위조 방지, 앱 인제스트와 일관([01 §1]) |
| 재시도 | `httpx.HTTPTransport(retries=...)` + 앱 레벨 백오프 | 연결 실패 자동 재시도, 게시글 단위 격리 |

### 5.1 httpx 사용 패턴(HTTP 전략)

- 영속 `Client`에 헤더·쿠키·타임아웃을 묶어 모든 요청에 적용한다.
- 큰 PDF는 `stream`으로 메모리에 다 올리지 않고 디스크로 흘려보낸다.

```python
import httpx

transport = httpx.HTTPTransport(retries=2)   # ConnectError/Timeout 자동 재시도
timeout = httpx.Timeout(20.0, connect=10.0)
client = httpx.Client(
    headers={"user-agent": "doc-archive-testdata-crawler/0.1"},
    timeout=timeout, transport=transport, follow_redirects=True,
)

with client.stream("GET", file_url) as r:    # 스트리밍 다운로드
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_bytes():
            f.write(chunk)
```

### 5.2 Playwright 사용 패턴(브라우저 전략)

- 폼 필터를 채우고 클릭한 뒤, 목록을 싣는 AJAX 응답을 가로채 파싱한다.
- 첨부 다운로드는 다운로드 이벤트를 받아 원하는 경로로 저장한다.

```python
# 목록 AJAX 응답 캡처
with page.expect_response("**/selectWrtancList*") as resp_info:
    page.click("button#search")          # 검색 버튼
data = resp_info.value.json()            # 목록 JSON

# 첨부 PDF 다운로드 캡처
with page.expect_download() as dl_info:
    page.click("a.file-download")        # 첨부 링크
dl_info.value.save_as(dest)              # 원하는 경로로 저장
```

---

## 6. 사이트별 크롤링 흐름

- 아래 흐름은 공개 페이지 관찰에 기반한다.
- 정확한 파라미터 이름과 토큰은 구현 시 브라우저 개발자도구(Network)로 캡처해 확정한다(§9 미해결).

### 6.1 SH 서울주택도시공사 (i-sh.co.kr)

- 대상 게시판 URL은 `https://www.i-sh.co.kr/app/lay2/program/S48T561C563/www/brd/m_247/list.do`이다(요구사항 4).
- 이 게시판은 eGovFrame 표준 구조이다. 목록 표의 헤더는 번호, 제목, 담당부서, 등록일, 조회수이다(관찰됨).
- 제목 링크는 `href`가 아니라 `onclick` 자바스크립트 핸들러이다(관찰됨). 핸들러는 폼을 채워 상세(`view.do`)로 제출하는 eGovFrame 관례를 따른다.

#### 6.1.1 페치 전략

- SH는 서버 렌더 HTML이다. 따라서 HTTP 전략(httpx + 파서)을 쓴다.
- 상세 진입은 onclick이 만드는 요청을 재현한다. eGovFrame은 보통 `nttId`, `bbsId`, `pageIndex` 파라미터로 `view.do`를 호출한다(구현 시 실제 파라미터명 확정).

#### 6.1.2 검색 조건(`ShSearchParams`)

- SH 게시판의 검색은 제목·내용 키워드 위주로 단순하다.

```python
class ShSearchParams(SearchParams):
    keyword: str | None = None   # 제목/내용 검색어
    # max_pages 는 기반형에서 상속
```

#### 6.1.3 흐름

1. `search`는 `list.do`를 `pageIndex`를 늘려가며 GET 한다.
2. `search`는 응답 HTML의 목록 표에서 행마다 `post_id`(=nttId)와 제목을 파싱한다.
3. `fetch_files`는 상세 `view.do`를 GET 해 첨부 영역을 파싱한다.
4. `fetch_files`는 첨부 다운로드 URL(eGovFrame 관례 `/cmm/fms/FileDown.do?atchFileId=...&fileSn=...`)을 추출한다.
5. `is_target_file`은 라벨/파일명에 "공고"가 있고 확장자가 `.pdf`인 첨부만 통과시킨다.
6. `download`는 httpx 스트리밍으로 파일을 저장한다.

- `allowed_suffixes = {".pdf"}`.

### 6.2 LH 한국토지주택공사 (apply.lh.or.kr)

- 대상 목록 URL은 `https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do`이다(요구사항 4).
- 이 목록은 `mi` 메뉴 파라미터로 카테고리를 가른다(관찰됨): `mi=1026` 임대, `mi=1027` 분양, `mi=1062` 토지, `mi=1069` 상가.
- 파라미터 없이 직접 GET 하면 에러 페이지를 돌려준다(관찰됨). 목록 데이터는 필터를 담은 POST/AJAX로 적재된다.
- 검색 필터는 지역, 공고상태, 공고유형, 검색어로 SH보다 복잡하다.

#### 6.2.1 페치 전략

- LH는 JS/세션 의존이 크다. 따라서 브라우저 전략(Playwright)을 기본으로 쓴다.
- 대안은 AJAX 엔드포인트를 역설계해 httpx POST로 직접 호출하는 것이다. 토큰·세션이 단순하면 이 대안이 더 빠르다. 구현 단계에서 캡처 결과로 결정한다(§9).

#### 6.2.2 검색 조건(`LhSearchParams`)

- LH의 검색은 다중 필터를 가진다. 이 차이가 검색 조건 추상화의 동기이다.

```python
from typing import Literal

class LhSearchParams(SearchParams):
    category: Literal["임대", "분양", "토지", "상가"] = "임대"  # mi 매핑
    region: str | None = None                # 지역 필터
    status: Literal["공고중", "접수중", "마감"] | None = None  # 공고상태
    keyword: str | None = None               # 공고명 검색어
```

#### 6.2.3 흐름

1. `search`는 Playwright로 `selectWrtancList.do?mi=<category>` 페이지를 연다.
2. `search`는 지역·공고상태·검색어 필터를 채우고 검색을 클릭한다.
3. `search`는 목록 AJAX 응답(`expect_response`)을 가로채 게시글과 `panId`(공고일련번호)를 얻는다.
4. `fetch_files`는 상세(`selectWrtancView.do` 류)를 열어 "공고문" 첨부 목록을 읽는다.
5. `is_target_file`은 라벨에 "공고"가 있고 확장자가 `.pdf`인 첨부만 통과시킨다.
6. `download`는 다운로드 이벤트(`expect_download`)를 받아 파일을 저장한다.

- `allowed_suffixes = {".pdf"}`.

---

## 7. 공통 동작 정책

### 7.1 예의(politeness)와 안전

- 크롤러는 사이트별 동시 요청 수를 제한한다(기본 1, 최대 2~3).
- 크롤러는 요청 간 지연을 둔다(기본 0.5~1.0초).
- 크롤러는 식별 가능한 User-Agent를 보낸다.
- 크롤러는 `robots.txt`와 각 사이트 이용약관을 사전에 확인한다. 수집물은 공개 청약공고로 한정한다.

### 7.2 멱등성과 중복 회피

- `storage`는 다운로드 전에 manifest에서 같은 `file_url` 또는 `sha256`을 조회한다.
- 이미 있으면 다운로드를 건너뛴다. 재실행해도 파일이 중복되지 않는다.
- 이 정책은 앱 인제스트의 멱등 적재 원칙과 맥을 같이한다([01 §6]).

### 7.3 실패 격리

- 한 게시글이나 한 첨부의 실패가 전체 실행을 멈추지 않는다.
- `runner`는 실패를 로그에 남기고 다음 항목으로 진행한다.
- 연결 오류는 httpx 재시도와 앱 레벨 백오프로 흡수한다(§5).

### 7.4 파일명과 인코딩

- `storage`는 한글 파일명을 보존하되 OS 금지문자를 안전하게 치환한다.
- `storage`는 파일명 앞에 등록일(`YYYYMMDD`)을 붙여 정렬과 추적을 돕는다.
- `storage`는 같은 이름 충돌 시 `post_id` 또는 짧은 해시를 접미사로 붙인다.

---

## 8. 실행 인터페이스(CLI)

- 크롤러는 `python -m crawler`로 실행한다.

```bash
# SH: 키워드로 1페이지 수집
python -m crawler sh --keyword "청약" --max-pages 1

# LH: 임대 카테고리, 지역·상태 필터로 수집
python -m crawler lh --category 임대 --region 서울 --status 공고중 --max-pages 2
```

- CLI 인자는 각 사이트의 `params_model` 필드로 매핑한다.
- 공통 옵션은 `--out`(기본 `sample-datas/`), `--concurrency`, `--delay`이다.

---

## 9. 마일스톤과 미해결

### 9.1 마일스톤

1. 골격: `models`, `base`, `runner`, `storage`, `registry`, CLI를 만든다.
2. SH 구현(HTTP 전략)으로 첫 PDF를 `sample-datas/sh/`에 저장한다.
3. LH 구현(Playwright 전략)으로 첫 PDF를 `sample-datas/lh/`에 저장한다.
4. manifest, 중복 회피, 실패 격리를 마감한다.

### 9.2 미해결(구현 시 확정)

- SH 상세 진입과 첨부 다운로드의 정확한 파라미터명(`nttId`, `bbsId`, `atchFileId`, `fileSn` 등)은 개발자도구로 캡처해 확정한다.
- LH 목록 AJAX의 정확한 엔드포인트, POST 바디, CSRF/세션 토큰은 캡처로 확정한다.
- LH를 Playwright로 갈지 역설계 POST로 갈지는 캡처 난이도를 보고 §6.2.1에서 결정한다.
- 지역·공고상태 필터의 실제 코드값(예: 지역 코드) 매핑표를 구현 시 작성한다.

---

## 10. 참고 출처(references)

- SH 대상 게시판: `https://www.i-sh.co.kr/app/lay2/program/S48T561C563/www/brd/m_247/list.do`
- LH 대상 목록: `https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do`
- httpx 공식 문서(스트리밍 다운로드, Client 쿠키·헤더, 타임아웃, 전송 재시도): `https://www.python-httpx.org/` (context7 `/websites/python-httpx`)
- Playwright Python(다운로드 `expect_download`/`save_as`, 응답 캡처 `expect_response`): `https://playwright.dev/python/` (context7 `/microsoft/playwright-python`)
- 앱 인제스트 지원 포맷·타입 감지: [01-mvp-research/01 §1], [architecture/04-data/documents-schema.md] §1
- 테스트 데이터 소스 확장 후보(영수증·계약서·공적 문서): [01-source-candidates.md](./01-source-candidates.md)
