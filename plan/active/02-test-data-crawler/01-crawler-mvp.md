---
created: 2026-06-19
completed: 2026-06-19
overview: 테스트 데이터 크롤러 MVP 스캐폴딩·구현 — 사이트별 추상화로 청약공고 PDF를 sample-datas/에 적재 (design research/02-test-data-crawler/00 전반).
---

> 라이브러리·툴 버전·API 상세는 context7 MCP로 확인 (§5).
> 참조 `(§n)`은 `research/02-test-data-crawler/00-design.md` 섹션이다.
> 결과: 양 사이트(SH·LH) 모두 httpx로 검증 완료. SH 6건·LH 46건 모집공고 PDF 다운로드 성공.

## 스캐폴딩 (crawler/)
- [x] S1 루트에 독립 디렉토리 `crawler/` 생성 — `web/`·`backend/`와 분리 (§2.1).
- [x] S2 `uv` 프로젝트 초기화 — `pyproject.toml`, Python 3.12 핀(`.python-version`) (§5).
- [x] S3 패키지 레이아웃 생성 — `crawler/{__main__,config,models,runner,storage,http,browser}.py` + `sources/` (§2.1).
- [x] S4 의존성 추가 — httpx·playwright·selectolax·pydantic·filetype (§5).
- [x] S5 `playwright install chromium` 절차를 README에 기록 (§5.2).
- [x] S6 `.gitignore`에 `sample-datas/`·`.venv`·`__pycache__` 제외 추가 (§2.2).

## 공통 모델·기반 (models·base·registry)
- [x] M1 `models.py` — `SearchParams`·`Listing`·`FileRef`(+`ManifestEntry`) pydantic 기반형 (§4).
- [x] M2 `sources/base.py` — `BaseSource` ABC(`search`/`fetch_files`/`download`/`is_target_file`+`close`) (§4).
- [x] M3 `BaseSource` 클래스 속성 — `source_id`·`allowed_suffixes`·`params_model` (§4, §1.1).
- [x] M4 `is_target_file` 기본 구현 — 확장자 화이트리스트 판정 (§4, §1.1).
- [x] M5 `sources/registry.py` — `source_id` → Source 등록표 (§3.2).
- [x] M6 `config.py` — 동시성·요청지연·User-Agent·기본 출력 경로 (§7.1, §8).
- 비고: `Listing.extra`를 추가해 사이트별 첨부 조회 파라미터(LH panId 등)를 운반한다.

## 페치 인프라 (http·browser·storage)
- [x] P1 `http.py` — httpx.Client 팩토리(헤더·쿠키·Timeout·`HTTPTransport(retries)`) (§5.1).
- [x] P2 `http.py` — `stream` 기반 디스크 다운로드 헬퍼 (§5.1).
- [x] P3 `browser.py` — Playwright 세션 헬퍼(`accept_downloads`) (§5.2). MVP 미사용(향후 JS 사이트용).
- [x] P4 `browser.py` — `expect_response`·`expect_download` 캡처 래퍼 (§5.2). MVP 미사용.
- [x] P5 `storage.py` — `sample-datas/<source_id>/` 적재·디렉토리 보장 (§2.2).
- [x] P6 `storage.py` — 안전 파일명(한글 보존·금지문자 치환·등록일 접두·충돌 접미사) (§7.4).
- [x] P7 `storage.py` — `manifest.jsonl` 1파일=1행(post_id·title·url·sha256·bytes·시각) (§2.2).
- [x] P8 `storage.py` — 다운로드 전 `file_url`·다운로드 후 `sha256` 중복 조회·건너뛰기 (§7.2).

## 러너·파이프라인 (runner)
- [x] R1 `runner.py` — registry에서 Source 해석 + 검색조건을 `params_model`로 검증 (§3.2).
- [x] R2 `runner.py` — search→fetch_files→필터→download→manifest 흐름 (§3.2).
- [x] R3 `runner.py` — `is_target_file`+`allowed_suffixes`로 "청약공고 PDF"만 통과 (§3.2, §1.1).
- [x] R4 `runner.py` — 게시글·첨부 단위 실패 격리(로그 후 계속) (§7.3).
- [x] R5 `runner.py` — 요청 지연 적용(`config.delay`). 동시성은 config 노브로 예약(MVP 순차) (§7.1).

## SH 구현 (sources/sh.py — HTTP 전략)
- [x] SH1 `ShSearchParams` — `keyword`·`search_type`(제목/내용)·`max_pages` (§6.1.2).
- [x] SH2 `search` — POST `list.do`{page,srchWord,srchTp}·`getDetailView('seq')` 파싱 (§6.1.3).
- [x] SH3 `fetch_files` — POST `view.do`{seq}·인라인 `initParam.downList` JSON 파싱 (§6.1.3).
- [x] SH4 `fetch_files` — 다운로드 URL `/com/file/innoFD.do?brdId=&seq=&fileSeq=&fileTp=` 조립 (§6.1.3).
- [x] SH5 `is_target_file` — 파일명 "공고" + `.pdf` (§6.1.3).
- [x] SH6 `download` — httpx 스트리밍, `allowed_suffixes={".pdf"}` (§6.1.1).

## LH 구현 (sources/lh.py — HTTP 전략으로 확정, U3)
- [x] LH1 `LhSearchParams` — `category`(mi 매핑)·`region`·`status`·`keyword` (§6.2.2).
- [x] LH2 `search` — page1 GET `selectWrtancList.do?mi=`, 2페이지+는 `pagingForm` POST (§6.2.3).
- [x] LH3 `search` — `status`=panSs 서버필터, `region`·`keyword`는 클라이언트 측 대조 (§6.2.3).
- [x] LH4 `search` — 행 `a.wrtancInfoBtn`/`a.listFileDown` data-id에서 panId·유형코드 추출 (§6.2.3).
- [x] LH5 `fetch_files` — POST `wrtFileDownl.do`(+csrfToken)·JSON `{cmnAhflSn,cmnAhflNm}` (§6.2.3).
- [x] LH6 `is_target_file` — 파일명 "공고" + `.pdf` (§6.2.3).
- [x] LH7 `download` — GET `lhFile.do?fileid=` 스트리밍, `allowed_suffixes={".pdf"}` (§6.2.3).
- 비고: 캡처 결과 LH도 서버 렌더+직링이라 Playwright 없이 httpx로 충분(=역설계 POST, §6.2.1).

## CLI·실행 (__main__)
- [x] C1 `python -m crawler <source>` / `uv run crawler <source>` 진입점 (§8).
- [x] C2 사이트별 CLI 인자를 각 `params_model` 필드로 매핑(서브파서) (§8).
- [x] C3 공통 옵션 — `--out`·`--concurrency`·`--delay`·`--max-pages` (§8).

## 검증 (수동·MVP)
- [x] V1 SH 실행으로 모집공고 PDF 6건이 `sample-datas/sh/`에 저장됨 (§9.1-2).
- [x] V2 LH 실행으로 모집공고 PDF 46건이 `sample-datas/lh/`에 저장됨 (§9.1-3).
- [x] V3 재실행 시 manifest 중복 회피로 다운로드=0·파일 수 불변 확인 (§7.2).
- [x] V4 try/except로 게시글·첨부 단위 실패 격리(코드 수준 보장) (§7.3).

## 구현 시 확정 (미해결·design §9.2 해소)
- [x] U1 SH 파라미터 확정 — list.do{page,srchWord,srchTp}·view.do{seq}·innoFD.do{brdId,seq,fileSeq,fileTp} (§9.2).
- [x] U2 LH 엔드포인트 확정 — selectWrtancList.do·wrtFileDownl.do(+csrfToken)·lhFile.do{fileid} (§9.2).
- [x] U3 LH 전략 결정 — httpx 역설계 POST(서버 렌더 확인, Playwright 불필요) (§6.2.1, §9.2).
- [x] U4 LH 필터 — status=panSs 서버, region/keyword 클라이언트 측. 유형(aisTp) 필터는 미사용(추후) (§9.2).

## 설계 반영 (구현 중 확정·변경)
- [x] D1 확정한 SH/LH 엔드포인트·LH 전략(httpx)을 design §6·§9.2에 반영.
- [x] D2 `crawler/` 디렉토리명 확정값을 design §2.1에 반영.

## 확장(후속, 비-MVP)
> 영수증·계약서·공적 문서 출처 추가는 [01-source-candidates](../../../research/02-test-data-crawler/01-source-candidates.md) 참조.
- [ ] E1 공정거래위원회 표준계약서 Source 추가(SH HTTP 전략 재사용) ([01] §4).
- [ ] E2 대한민국 전자관보 Source 추가(디지털 텍스트 PDF) ([01] §4).
