---
created: 2026-06-22
updated: —
overview: 업로드부터 인제스트까지 실패한 문서의 어떤 상태가 재시도 가능한지, 재시도 기능을 어디까지 구현할 수 있는지, 유사 사례는 어떤지 분석한다.
---

# 실패 문서 재시도 (Retry)

물리 업로드부터 인제스트 전 과정에서 실패한 문서를 대상으로, 논리 상태와 물리 상태 중 재시도 가능한 상태를 파악하고 재시도 기능의 구현 범위와 타사 사례를 정리한다.

---

## 1. 결론

- 인제스트 단계 실패는 원본 객체가 MinIO에 남아 있으면 전체 파이프라인 재실행으로 안전하게 복구된다. 재실행이 멱등이기 때문이다(근거 §4.1).
- 물리 업로드 실패(객체 없음 또는 잘림)는 재인제스트로 복구할 수 없다. 새 presigned PUT으로 재업로드해야 한다(근거 §3).
- 현재 자동 재시도는 사실상 없다. arq는 일반 예외를 재시도하지 않고 즉시 실패로 종결한다(근거 §4.3). 아키텍처 `ingestion-backend §1`의 지수 백오프 재시도 서술은 구현과 불일치한다.
- 재시도를 켜려면 arq의 `_job_id` 차단을 먼저 풀어야 한다. 실패 후 약 1시간 동안 같은 `_job_id` 재투입이 무시되기 때문이다(근거 §4.2).
- MVP 재시도는 레벨 1(실패 상태이며 객체가 있는 문서를 전체 재실행하는 엔드포인트)로 충분하다. 단 영구 오류(NUL, 미지원 형식)와 일시 오류(LLM 5xx, 타임아웃)를 구분해야 한다(권장안 §7).
- 더 나아가려면 레벨 3 단계 체크포인트로 추출과 OCR 재계산을 건너뛴다. 타사 워크플로 엔진이 쓰는 방식이다(근거 §5.3, 범위 §6.3).

---

## 2. 현재 상태 모델

### 2.1 논리 상태 (DB)

- `documents.status`는 네 값을 가진다. `uploaded`(레코드 생성, 객체 대기), `processing`(인제스트 중), `ready`(완료), `failed`(오류). 근거 `backend/src/documents/enums.py`.
- `documents.stage`는 인제스트 진행 지점을 기록한다. `extracting`, `generating_meta`, `chunking`, `embedding`. 터미널 상태에서는 null이다.
- `documents.error`는 실패 사유 문자열을 담는다(최대 2000자).
- 인제스트는 `status=processing` 동안에만 동작한다. 근거 [ingestion.md §2].

### 2.2 물리 상태

- MinIO 객체. 키는 `docs/{document_id}`로 고정한다. 근거 `documents/service.py upload_init`.
- DB 행. `archive.documents` 1행과 `archive.document_chunks` N행(완료 시).
- Redis 키. arq가 `arq:job:ingest:{id}`(대기 또는 진행), `arq:result:ingest:{id}`(결과), `arq:abort`(취소 신호)를 쓴다.

### 2.3 실패 지점 타임라인

1. `upload_init`. api가 행을 만들고(`status=uploaded`) presigned PUT URL을 발급한다. 이 시점에 객체는 없다.
2. 브라우저 PUT. 브라우저가 MinIO에 파일을 직접 올린다. 실패하거나 중단되면 객체가 없거나 잘린다. `/complete`는 호출되지 않는다.
3. `upload_confirm`(`/complete`). api가 `stat_object`로 객체 존재를 확인한다. 없으면 `UploadNotCompleted`(409)다. 있으면 `status=processing`으로 바꾸고 인제스트를 enqueue한다. 근거 `documents/service.py upload_confirm`.
4. 워커 `run_ingest`. extracting부터 ready까지 진행한다. 일반 예외는 `failed`와 `error`로 종결한다. `CancelledError`(타임아웃이나 취소)는 `_mark_failed`로 종결한다. 근거 `ingestion/pipeline.py`.

---

## 3. 재시도 가능성 매트릭스 (논리 상태 × 물리 상태)

| 논리 상태 | 물리 객체 | 전형적 원인 | 재시도 동작 |
| --- | --- | --- | --- |
| failed | 존재 | 인제스트 단계 오류(LLM 5xx, OCR, NUL 등) | 전체 인제스트 재실행(멱등). 단 영구 오류는 코드 수정이 선행돼야 한다 |
| failed | 없음 또는 잘림 | 물리 업로드 실패 | 재인제스트 불가. 재업로드 필요 |
| uploaded(멈춤) | 존재 | PUT은 끝났으나 `/complete` 미호출 | `confirm` 재호출로 enqueue |
| uploaded(멈춤) | 없음 | PUT 미완료 | 재업로드 필요 |
| processing(좀비) | 존재 | 워커 크래시나 유실로 종결 누락 | 인제스트 재투입 |
| ready | 존재 | 해당 없음 | 모델이나 차원 변경 시에만 전량 재구축 |

- 핵심 분기는 물리 객체의 존재 여부다. 객체가 있으면 저장된 객체로 재처리하고, 없으면 재업로드한다. 타사도 같은 분기를 쓴다(근거 §5).
- `processing` 좀비는 docs/lessons/01 수정(CancelledError 종결)으로 신규 발생이 차단됐다. 과거 잔존분만 해당한다.

---

## 4. 멱등성과 재시도 차단 요인 (코드 근거)

### 4.1 전체 재실행은 멱등이다

- `run_ingest`는 항상 extracting부터 다시 시작한다. 단계 체크포인트 재개는 없다. 근거 `ingestion/pipeline.py`.
- 객체 키가 고정이라 원본을 다시 받는다. sha256은 결정적이라 같은 값을 낸다.
- 메타(`llm_title`, `llm_summary`, `keywords`)는 재실행 시 덮어쓴다.
- 청크는 `ON CONFLICT (document_id, chunk_index) DO UPDATE` 후 `chunk_index >= 새 개수` 행을 삭제한다. 재실행이 청크를 더 적게 내도 꼬리가 삭제돼 고아가 없다. 근거 `ingestion/repository.py upsert_chunks`.
- 따라서 객체가 있는 `failed` 문서를 전체 재실행하는 것은 안전하다. docs/lessons/02 복구가 이를 실증했다(3개 재인제스트로 ready).
- 이 패턴은 타사와 일치한다. LangChain 인덱싱은 해시 기준 업서트로 변경 없는 문서를 건너뛰고, LlamaIndex는 `(doc_id, hash)` 맵으로 업서트한다(근거 §5.2).

### 4.2 arq `_job_id` 차단

- 인제스트는 `_job_id=ingest:{document_id}`로 enqueue한다. 근거 `documents/service.py:86`.
- arq는 `arq:job:` 또는 `arq:result:` 키가 있으면 같은 `_job_id`의 재투입을 거부하고 `None`을 반환한다. 중복을 큐에 넣지 않는다. 출처 https://github.com/python-arq/arq/blob/main/arq/connections.py , https://github.com/python-arq/arq/issues/221
- 결과 키 보존 기간은 워커 기본 `keep_result=3600`초(1시간)다. 출처 arq `worker.py` 기본값.
- 결론. 실패 직후 약 1시간 동안 같은 `_job_id` 재시도는 조용히 무시된다. 재시도 기능은 결과 키를 삭제하거나 시도별 새 `_job_id`(예 `ingest:{id}:{attempt}`)를 써야 한다.
- docs/lessons/02 수동 복구가 성공한 이유는 결과 키가 이미 만료됐기 때문이다.

### 4.3 현재 자동 재시도 동작 (arq 예외 의미론)

- arq는 일반 예외를 자동 재시도하지 않는다. 일반 예외는 실패로 종결되고 끝난다. 재시도는 `arq.worker.Retry`를 직접 raise하거나 `CancelledError`(타임아웃이나 종료)일 때만 일어난다(`retry_jobs=True` 기본). 출처 https://github.com/python-arq/arq/blob/main/arq/worker.py , https://arq-docs.helpmanual.io/
- `max_tries`(기본 5)는 시도 횟수 상한이다. 그러나 일반 예외에는 적용되지 않는다. 재시도 경로(Retry, CancelledError)에서만 의미가 있다. 출처 동일.
- arq는 자동 백오프를 하지 않는다. 백오프는 `raise Retry(defer=...)`로 직접 지정한다. 출처 동일.
- 현재 `run_ingest`는 단계 실패 시 일반 예외를 다시 raise한다. 따라서 대부분의 실패(LLM 500, NUL, OCR 오류)는 재시도 없이 한 번에 `failed`가 된다. 근거 `ingestion/pipeline.py` except 블록.
- 단 타임아웃 경로는 `_mark_failed`로 종결한 뒤 `CancelledError`를 다시 raise하므로 arq가 최대 `max_tries`까지 재시도한다. 즉 같은 문서가 failed로 표시되면서도 재실행되는 불일치가 있다. 향후 정리가 필요하다.
- 종합. 아키텍처 `ingestion-backend §1`의 지수 백오프 재시도 서술은 현재 구현과 맞지 않는다. 실효 자동 재시도는 사실상 없다.

---

## 5. 유사 애플리케이션 사례

### 5.1 클라우드 문서 처리

- 공통점. 세 서비스 모두 제출 후 폴링 방식이고 재개를 지원하지 않는다. 재시도는 새 작업 재제출이다.
- AWS Textract 비동기. `JobStatus`는 `IN_PROGRESS`, `SUCCEEDED`, `FAILED`, `PARTIAL_SUCCESS`다. 페이지 단위 부분 실패는 `Warnings[]`로 노출한다. 재시도는 `StartDocumentAnalysis` 재호출이며 새 `JobId`를 받는다. `ClientRequestToken`으로 멱등 제어를 한다(같은 토큰은 같은 작업으로 합쳐짐). 출처 https://docs.aws.amazon.com/textract/latest/dg/API_GetDocumentAnalysis.html , https://docs.aws.amazon.com/textract/latest/dg/API_StartDocumentAnalysis.html
- Google Document AI 배치. 배치 상태와 별개로 문서 단위 `individualProcessStatuses[]`로 부분 실패를 노출한다. 실패분만 모아 재제출한다. 출처 https://docs.cloud.google.com/document-ai/docs/reference/rest/Shared.Types/BatchProcessMetadata
- Azure AI Document Intelligence. 제출은 202와 `Operation-Location` 폴링 URL을 준다. 상태는 `notStarted`, `running`, `succeeded`, `failed`다. 재시도는 분석 POST 재호출이다. 결과는 24시간만 보존한다. 출처 https://learn.microsoft.com/en-us/rest/api/aiservices/document-models/analyze-document
- 시사점. 부분 실패 입도는 서비스마다 다르다(Textract 페이지, Google 문서, Azure 문서 단위). 멱등 토큰은 Textract만 제공한다.

### 5.2 RAG와 인제스트 프레임워크

- LlamaIndex IngestionPipeline. `node + transformation` 조합을 해시해 캐시한다. docstore가 `doc_id -> hash` 맵을 유지해 같은 id에 해시가 같으면 건너뛰고 다르면 이전 데이터를 지우고 재처리한다. 기본 전략은 `UPSERTS`다. 출처 https://developers.llamaindex.ai/python/framework/module_guides/loading/ingestion_pipeline/
- LangChain 인덱싱 API. RecordManager가 콘텐츠 해시를 추적해 재실행 시 변경 없는 문서를 건너뛴다(재임베딩이나 재기록 안 함). 정리 모드는 `none`, `incremental`, `full`이다. 출처 https://js.langchain.com/v0.2/docs/how_to/indexing/
- unstructured.io. 미지원 형식은 `UnsupportedFileFormatError`를 던진다. 이는 영구 오류로 재시도 대상이 아니다. 출처 https://github.com/Unstructured-IO/unstructured/issues/2584
- 시사점. 본 시스템의 `(document_id, chunk_index)` 업서트와 꼬리 삭제(§4.1)는 이들 프레임워크의 해시 업서트와 정리 모드와 같은 계열이다.

### 5.3 워크플로 체크포인트

- Temporal. 이벤트 히스토리를 재생해 이미 끝난 액티비티는 다시 실행하지 않고 결과를 읽어온다. 출처 https://docs.temporal.io/encyclopedia/event-history
- AWS Step Functions. 상태별 `Retry`(기본 3회, BackoffRate 2.0)와 `Catch`를 둔다. Redrive는 실패한 실행을 마지막 비성공 상태부터 재시작한다. 성공 상태는 재실행하지 않는다. 출처 https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html , https://aws.amazon.com/blogs/compute/introducing-aws-step-functions-redrive-a-new-way-to-restart-workflows/
- Airflow. 태스크별 `retries`로 실패 태스크만 재실행한다. 완료 상류 태스크는 재실행하지 않는다. 태스크는 멱등이어야 한다. 출처 https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/tasks.html
- 시사점. 중간 산출물(추출 텍스트)을 저장하면 재시도가 비싼 단계를 건너뛴다. 본 시스템의 레벨 3에 해당한다(§6.3).

### 5.4 작업 큐 재시도와 DLQ

- Celery. `autoretry_for`로 재시도 대상 예외를 화이트리스트한다. `retry_backoff`로 지수 백오프와 지터를 켠다. 기본 `max_retries=3`. 출처 https://docs.celeryq.dev/en/stable/userguide/tasks.html
- Sidekiq. 미처리 예외를 기본 25회 재시도한 뒤 Dead set(DLQ)으로 보낸다. 웹 UI에서 수동 재시도한다. 출처 https://github.com/sidekiq/sidekiq/wiki/Error-Handling
- BullMQ. `attempts`와 지수 백오프를 설정한다. `UnrecoverableError`로 남은 시도를 건너뛰고 즉시 실패시킨다(영구 오류 탈출구). 실패 작업은 failed set에 남고 UI에서 재시도한다. 출처 https://docs.bullmq.io/guide/retrying-failing-jobs , https://docs.bullmq.io/patterns/stop-retrying-jobs
- AWS SQS DLQ. `ReceiveCount`가 `maxReceiveCount`(기본 10)를 넘으면 DLQ로 보내 독성 메시지를 격리한다. 출처 https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- 일시 오류와 영구 오류 구분. AWS SDK는 타임아웃과 5xx와 스로틀링을 재시도하고, 검증 오류와 권한 오류 같은 4xx는 즉시 반환한다. 출처 https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html
- 백오프와 지터. 백오프만으로는 재시도가 몰리므로 지터를 더한다. 출처 https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- 시사점. arq에는 네이티브 DLQ가 없다. 실패는 `arq:result:` 키로만 `keep_result`(1시간) 동안 남는다. DLQ 역할은 본 시스템이 직접 만들어야 한다. 실은 `status=failed`와 `error` 컬럼이 이미 영구 DLQ 테이블 역할을 한다.

---

## 6. 재시도 기능 구현 범위 (레벨)

### 6.1 레벨 1. 수동과 버튼 전체 재실행

- 대상. `status=failed`이고 객체가 존재하는 문서.
- 동작. 재시도 엔드포인트가 `status=processing`으로 되돌리고 인제스트를 다시 enqueue한다.
- 차단 해제. 결과 키를 삭제하거나 시도별 `_job_id`를 쓴다(§4.2).
- 안전성. 전체 재실행이 멱등이라 안전하다(§4.1).
- 비용. 추출과 OCR과 메타와 임베딩을 전부 다시 계산한다. 대형 스캔 PDF는 비싸다.
- 가드레일. 시도 횟수 컬럼을 두어 상한을 건다. SQS `maxReceiveCount`와 같은 독성 메시지 방지다.

### 6.2 레벨 2. 실패 분류

- 영구 오류와 일시 오류를 구분한다.
- 영구 오류. NUL, 미지원 형식, 객체 없음. 무한 재시도하지 않는다. 객체 없음은 재인제스트가 아니라 재업로드로 안내한다.
- 일시 오류. LLM 5xx, 타임아웃, 네트워크. 재시도가 안전하다.
- 구현. `error`와 `stage`와 객체 존재 여부로 분류한다. Celery `autoretry_for`나 BullMQ `UnrecoverableError`와 같은 화이트리스트와 탈출구 모델이다(§5.4).

### 6.3 레벨 3. 단계 체크포인트 재개

- 완료 단계와 중간 산출물(추출 텍스트)을 저장해 재시도가 비싼 단계를 건너뛴다.
- 예. 임베딩에서 실패하면 추출과 OCR을 다시 하지 않고 저장된 텍스트로 청킹부터 재개한다.
- 변경 규모. 추출 텍스트 저장 위치(컬럼 또는 객체)와 `run_ingest`의 단계 재개 로직이 필요하다.
- 참고. 아키텍처 `ingestion.md §2`는 이미 단계 재개를 명시하나 구현은 항상 extracting부터 시작한다. 레벨 3이 이 격차를 메운다.
- 사례. Temporal, Step Functions Redrive, Airflow가 같은 원리다(§5.3).

### 6.4 레벨 4. 자동 재시도와 백오프와 DLQ

- 일시 오류를 지수 백오프와 지터로 자동 재시도한다. arq에서는 `raise Retry(defer=...)`로 직접 구현한다(§4.3).
- 시도 상한 도달분은 DLQ 역할(실패 테이블이나 뷰)로 보내 수동 재실행을 받는다. `status=failed`가 이미 그 역할을 한다.
- 영구 오류는 자동 재시도하지 않고 즉시 실패시킨다(§5.4).

---

## 7. 권장안

- MVP는 레벨 1에 레벨 2 일부를 더한다. 실패이며 객체가 있는 문서에 재시도 버튼과 엔드포인트를 두고, 객체 존재 여부로 재인제스트와 재업로드를 분기한다. arq 결과 키 차단을 처리하고 시도 횟수 상한을 둔다.
- 후속은 레벨 3(추출 텍스트 보존으로 OCR 재계산 회피)과 레벨 4(일시 오류 자동 재시도와 백오프)다.
- 선행 정리. 아키텍처의 백오프 재시도 서술을 실제 동작에 맞게 수정한다(§4.3). 타임아웃 경로의 종결과 재시도 불일치를 정리한다.

---

## 8. 출처

- arq worker 소스 https://github.com/python-arq/arq/blob/main/arq/worker.py
- arq connections 소스(enqueue 중복 거부) https://github.com/python-arq/arq/blob/main/arq/connections.py
- arq 문서 https://arq-docs.helpmanual.io/
- arq `_job_id` 중복 이슈 https://github.com/python-arq/arq/issues/221
- AWS Textract GetDocumentAnalysis https://docs.aws.amazon.com/textract/latest/dg/API_GetDocumentAnalysis.html
- AWS Textract StartDocumentAnalysis https://docs.aws.amazon.com/textract/latest/dg/API_StartDocumentAnalysis.html
- Google Document AI BatchProcessMetadata https://docs.cloud.google.com/document-ai/docs/reference/rest/Shared.Types/BatchProcessMetadata
- Azure AI Document Intelligence analyze https://learn.microsoft.com/en-us/rest/api/aiservices/document-models/analyze-document
- LlamaIndex IngestionPipeline https://developers.llamaindex.ai/python/framework/module_guides/loading/ingestion_pipeline/
- LangChain 인덱싱 API https://js.langchain.com/v0.2/docs/how_to/indexing/
- unstructured 미지원 형식 이슈 https://github.com/Unstructured-IO/unstructured/issues/2584
- Temporal Event History https://docs.temporal.io/encyclopedia/event-history
- AWS Step Functions 오류 처리 https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
- AWS Step Functions Redrive https://aws.amazon.com/blogs/compute/introducing-aws-step-functions-redrive-a-new-way-to-restart-workflows/
- Airflow Tasks https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/tasks.html
- Celery Tasks https://docs.celeryq.dev/en/stable/userguide/tasks.html
- Sidekiq Error Handling https://github.com/sidekiq/sidekiq/wiki/Error-Handling
- BullMQ 재시도 https://docs.bullmq.io/guide/retrying-failing-jobs
- BullMQ 재시도 중단 https://docs.bullmq.io/patterns/stop-retrying-jobs
- AWS SQS DLQ https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- AWS SDK 재시도 동작 https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html
- AWS 백오프와 지터 https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
