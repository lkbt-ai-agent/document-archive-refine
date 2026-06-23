---
created: 2026-06-23
completed: 2026-06-23
overview: 중소벤처기업부 사업공고 게시판을 기존 크롤러의 새 소스(mss)로 추가해 PDF를 수집한다 (research 02).
---

> 이 plan은 중소벤처기업부 사업공고 게시판에서 공고 PDF를 자동으로 내려받는 크롤러를 만드는 작업이다.
> 우리는 새 프로그램을 처음부터 만들지 않는다. 우리는 이미 있는 `crawler/`에 사이트 하나(`mss`)를 더한다 (research 02 §4).
> 크롤러는 사이트마다 클래스 하나로 표현한다. 클래스는 목록을 읽고, 상세에서 첨부를 찾고, PDF를 저장한다 (design 00 §3.1).
> 이 사이트는 SH보다 단순하다. 목록과 상세가 모두 GET이고, 첨부는 상세 페이지의 일반 링크이다 (research 02 §3.5).
> 두 가지를 미리 알아야 한다. 연/월 검색은 `searchPublicDate=YYYY-MM`로 서버가 걸러 준다. 키워드 검색은 서버가 막아서 우리가 제목으로 직접 거른다 (research 02 §3.4).

## 준비 (이해)
- [x] A1 작업자는 research 02를 읽고 대상이 사업공고 보드(`cbIdx=310`)임을 확인한다 (research 02 §2).
- [x] A2 작업자는 기존 SH 소스(`crawler/crawler/sources/sh.py`)를 읽고 소스 클래스의 형태를 파악한다 (design 00 §4).

## 소스 구현 (`crawler/crawler/sources/mss.py`)
- [x] B1 작업자는 `MssSearchParams`를 정의한다 (필드: `cb_idx=310`, `keyword`, `year`, `month`) (research 02 §5).
- [x] B2 작업자는 `MssSource`를 만들고 `source_id="mss"`, `allowed_suffixes={".pdf"}`, `params_model`을 지정한다.
- [x] B3 `search`는 `List.do?cbIdx=<cb_idx>&pageIndex=<n>`을 GET으로 호출해 페이지를 순회한다 (research 02 §3.1).
- [x] B4 `search`는 `year`가 있으면 `searchPublicDate=YYYY-MM`(month 없으면 `00`)을 GET에 붙여 기간을 거른다 (research 02 §3.4).
- [x] B5 `search`는 `a[onclick^=doBbsFView]`에서 `bcIdx`, `parentSeq`, 제목(`title` 속성)을 뽑아 `Listing`을 만든다 (research 02 §3.1).
- [x] B6 `search`는 `keyword`가 있으면 제목으로 클라이언트 측 대조해 행을 거른다 (research 02 §3.4).
- [x] B7 `fetch_files`는 `View.do?cbIdx=&bcIdx=&parentSeq=`를 GET으로 받아 상세를 연다 (research 02 §3.2).
- [x] B8 `fetch_files`는 첨부 `li`에서 원본명(`.name`)과 다운로드 링크(`a.btn.type_down[href]`)를 짝지어 `FileRef`를 만든다 (research 02 §3.3).
- [x] B9 `is_target_file`은 확장자가 `.pdf`이고 파일명에 "공고"가 있는 첨부만 통과시킨다 (research 02 §3.3).
- [x] B10 `download`는 다운로드 링크를 httpx 스트리밍으로 `sample-datas/mss/`에 저장한다 (research 02 §3.3).
- [x] B11 작업자는 `crawler/crawler/sources/registry.py`에 `MssSource`를 한 줄 등록한다 (design 00 §3.2).

## CLI 배선 (`crawler/crawler/__main__.py`)
- [x] C1 작업자는 `mss` 서브파서를 추가한다 (옵션: `--cb-idx`, `--year`, `--month`, `--keyword`, `--max-pages`) (research 02 §5).

## 검증
- [x] D1 작업자는 `uv run crawler mss --year 2026 --month 6 --max-pages 1`로 PDF가 `sample-datas/mss/`에 저장되는지 확인한다.
- [x] D2 작업자는 같은 게시글의 HWPX가 걸러지고 PDF만 받아지는지 확인한다 (research 02 §3.3).
- [x] D3 작업자는 기간 필터를 바꿔(예: `--year 2025 --month 1`) 결과 목록이 그 시점 기준으로 바뀌는지 확인한다 (research 02 §3.4).
- [x] D4 작업자는 다시 실행해 manifest 중복 회피로 같은 파일이 또 받아지지 않는지 확인한다 (design 00 §7.2).

## 문서 반영 (구현 후)
- [x] E1 작업자는 구현으로 확정한 셀렉터와 엔드포인트와 기간 필터 경계를 research 02 §3·§6에 반영하고 `status`를 갱신한다.
