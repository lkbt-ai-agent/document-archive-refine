---
created: 2026-06-19
completed: —
overview: 테스트 데이터 크롤러 MVP 스캐폴딩·구현 — 사이트별 추상화로 청약공고 PDF를 sample-datas/에 적재 (design research/02-test-data-crawler/00 전반).
---

> 라이브러리·툴 버전·API 상세는 context7 MCP로 확인 (§5).
> 참조 `(§n)`은 `research/02-test-data-crawler/00-design.md` 섹션이다.

## 스캐폴딩 (crawler/)
- [ ] S1 루트에 독립 디렉토리 `crawler/` 생성 — `web/`·`backend/`와 분리 (§2.1).
- [ ] S2 `uv` 프로젝트 초기화 — `pyproject.toml`, Python 3.12 (§5).
- [ ] S3 패키지 레이아웃 생성 — `crawler/{__main__,config,models,runner,storage,http,browser}.py` + `sources/` (§2.1).
- [ ] S4 의존성 추가 — httpx·playwright·selectolax(or bs4)·pydantic·filetype (§5).
- [ ] S5 `playwright install chromium` 1회 셋업 절차를 README에 기록 (§5.2).
- [ ] S6 `.gitignore`에 `sample-datas/` 산출물 제외 정책 확인 (§2.2).

## 공통 모델·기반 (models·base·registry)
- [ ] M1 `models.py` — `SearchParams`·`Listing`·`FileRef` pydantic 기반형 (§4).
- [ ] M2 `sources/base.py` — `BaseSource` ABC(`search`/`fetch_files`/`download`/`is_target_file`) (§4).
- [ ] M3 `BaseSource` 클래스 속성 — `source_id`·`allowed_suffixes`·`params_model` (§4, §1.1).
- [ ] M4 `is_target_file` 기본 구현 — 확장자 화이트리스트 판정 (§4, §1.1).
- [ ] M5 `sources/registry.py` — `source_id` → Source 등록표 (§3.2).
- [ ] M6 `config.py` — 동시성·요청지연·User-Agent·기본 출력 경로 (§7.1, §8).

## 페치 인프라 (http·browser·storage)
- [ ] P1 `http.py` — httpx.Client 팩토리(헤더·쿠키·Timeout·`HTTPTransport(retries)`) (§5.1).
- [ ] P2 `http.py` — `stream` 기반 디스크 다운로드 헬퍼 (§5.1).
- [ ] P3 `browser.py` — Playwright 세션 헬퍼(`accept_downloads`, 컨텍스트 수명) (§5.2).
- [ ] P4 `browser.py` — `expect_response`·`expect_download` 캡처 래퍼 (§5.2).
- [ ] P5 `storage.py` — `sample-datas/<source_id>/` 적재·디렉토리 보장 (§2.2).
- [ ] P6 `storage.py` — 안전 파일명(한글 보존·금지문자 치환·등록일 접두·충돌 접미사) (§7.4).
- [ ] P7 `storage.py` — `manifest.jsonl` 1파일=1행 기록(post_id·title·url·sha256·bytes·시각) (§2.2).
- [ ] P8 `storage.py` — 다운로드 전 manifest로 `file_url`/`sha256` 중복 조회·건너뛰기 (§7.2).

## 러너·파이프라인 (runner)
- [ ] R1 `runner.py` — registry에서 Source 해석 + 검색조건을 `params_model`로 검증 (§3.2).
- [ ] R2 `runner.py` — search→fetch_files→필터→download→manifest 흐름 (§3.2).
- [ ] R3 `runner.py` — `is_target_file`+`allowed_suffixes`로 "청약공고 PDF"만 통과 (§3.2, §1.1).
- [ ] R4 `runner.py` — 게시글·첨부 단위 실패 격리(로그 후 계속) (§7.3).
- [ ] R5 `runner.py` — 동시성·요청지연 적용(사이트별 1~3, 지연 0.5~1.0s) (§7.1).

## SH 구현 (sources/sh.py — HTTP 전략)
- [ ] SH1 `ShSearchParams` — `keyword`(제목/내용)·`max_pages` (§6.1.2).
- [ ] SH2 `search` — `list.do`를 `pageIndex` 증가로 GET·목록 표 파싱(nttId·제목) (§6.1.3).
- [ ] SH3 `fetch_files` — 상세 `view.do` GET·첨부 영역 파싱 (§6.1.3).
- [ ] SH4 `fetch_files` — `/cmm/fms/FileDown.do?atchFileId=...&fileSn=...` 다운로드 URL 추출 (§6.1.3).
- [ ] SH5 `is_target_file` 오버라이드 — 라벨/파일명 "공고" + `.pdf` (§6.1.3).
- [ ] SH6 `download` — httpx 스트리밍 저장, `allowed_suffixes={".pdf"}` (§6.1.1, §6.1.3).

## LH 구현 (sources/lh.py — 브라우저 전략)
- [ ] LH1 `LhSearchParams` — `category`(mi 매핑)·`region`·`status`·`keyword` (§6.2.2).
- [ ] LH2 `search` — Playwright로 `selectWrtancList.do?mi=<category>` 진입 (§6.2.3).
- [ ] LH3 `search` — 지역·공고상태·검색어 필터 입력 후 검색 클릭 (§6.2.3).
- [ ] LH4 `search` — 목록 AJAX 응답(`expect_response`) 캡처·게시글·panId 추출 (§6.2.3).
- [ ] LH5 `fetch_files` — 상세(`selectWrtancView.do` 류) 열어 공고문 첨부 추출 (§6.2.3).
- [ ] LH6 `is_target_file` 오버라이드 — 라벨 "공고" + `.pdf` (§6.2.3).
- [ ] LH7 `download` — `expect_download`·`save_as` 저장, `allowed_suffixes={".pdf"}` (§6.2.3).

## CLI·실행 (__main__)
- [ ] C1 `python -m crawler <source>` 진입점 (§8).
- [ ] C2 사이트별 CLI 인자를 각 `params_model` 필드로 매핑 (§8).
- [ ] C3 공통 옵션 — `--out`(기본 `sample-datas/`)·`--concurrency`·`--delay` (§8).

## 검증 (수동·MVP)
- [ ] V1 SH 실행으로 첫 PDF가 `sample-datas/sh/`에 저장됨을 확인 (§9.1-2).
- [ ] V2 LH 실행으로 첫 PDF가 `sample-datas/lh/`에 저장됨을 확인 (§9.1-3).
- [ ] V3 재실행 시 manifest 중복 회피로 동일 파일이 늘지 않음을 확인 (§7.2).
- [ ] V4 한 게시글 실패가 전체 실행을 멈추지 않음을 확인 (§7.3).

## 구현 시 확정 (미해결·design §9.2 해소)
- [ ] U1 SH 상세·첨부 파라미터명(nttId·bbsId·atchFileId·fileSn) 개발자도구 캡처 확정 (§9.2).
- [ ] U2 LH 목록 AJAX 엔드포인트·POST 바디·CSRF/세션 토큰 캡처 확정 (§9.2).
- [ ] U3 LH 전략 결정 — Playwright vs 역설계 POST(캡처 난이도 기준) (§6.2.1, §9.2).
- [ ] U4 LH 지역·공고상태 필터의 실제 코드값 매핑표 작성 (§9.2).

## 설계 반영 (구현 중 확정·변경)
> 구현 중 확정·변경 사항은 `research/02-test-data-crawler/00-design.md`에 반영한다(research/CLAUDE.md 준수, `## n.` 재번호 금지·append).
- [ ] D1 확정한 SH/LH 엔드포인트·파라미터를 §6의 흐름에 반영한다.
- [ ] D2 `crawler/` 디렉토리명 확정값을 §2.1에 반영한다(제안값에서 변경 시).

## 확장(후속, 비-MVP)
> 영수증·계약서·공적 문서 출처 추가는 [01-source-candidates](../../../research/02-test-data-crawler/01-source-candidates.md) 참조.
- [ ] E1 공정거래위원회 표준계약서 Source 추가(SH HTTP 전략 재사용) ([01] §4).
- [ ] E2 대한민국 전자관보 Source 추가(디지털 텍스트 PDF) ([01] §4).
