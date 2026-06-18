"""레지스트리 시드 (B4, users-schema §2 / generations-schema §1 / models.md).

멱등하게 실행된다: 시드 사용자 1명, 모델 레지스트리(A.X 4.0 Light·KURE-v1),
프롬프트 템플릿 레지스트리(인제스트·검색·산출물 워크플로우용 핵심 키).

실행: `uv run python -m src.seed`
"""

import asyncio

from sqlalchemy import text

from src.database import engine
from src.users.constants import SEED_USER_ID

# 모델 레지스트리 (models.md). file_path는 개발 Mac mini 기준.
MODELS = [
    {
        "name": "A.X-4.0-Light",
        "file_path": "~/Desktop/models/a.x-4.0-light-q4_k_m.gguf",
        "quantization": "Q4_K_M",
        "context_window": 8192,
        "provider": "llama.cpp",
    },
    {
        "name": "KURE-v1",
        "file_path": "~/Desktop/models/kure-v1-q8_0.gguf",
        "quantization": "Q8_0",
        "context_window": 8192,
        "provider": "llama.cpp",
    },
]

# 프롬프트 템플릿 레지스트리(v1). 본문은 각 워크플로우 구현(F/G/H)에서 정교화하며,
# 변경 시 버전을 올린다(prompt_templates는 (key, version) 유일).
PROMPT_TEMPLATES = [
    ("meta_extract", "문서 본문에서 제목·요약·토픽·키워드를 한국어로 추출해 JSON으로 출력한다."),
    ("query_parse", "사용자 한국어 질의에서 재작성 질의·키워드·기간·폴더를 구조화해 추출한다."),
    ("rag_answer", "제공된 문서에만 근거해 한국어로 답하고 문장마다 인용 번호를 단다. 근거가 없으면 '찾을 수 없습니다'."),
    ("summary_stuff", "주어진 문서를 한국어로 간결히 요약하고 인용 번호를 표기한다."),
    ("summary_map", "각 청크를 한국어 미니요약으로 압축한다."),
    ("summary_reduce", "청크 미니요약들을 하나의 문서 요약으로 통합한다."),
    ("draft_outline", "요약들을 바탕으로 초안 개요를 제안한다."),
    ("draft_section", "개요의 한 섹션을 관련 청크에 근거해 작성하고 인용한다."),
    ("report_chart_spec", "주어진 통계로 Vega-Lite 차트 스펙을 JSON으로 생성한다."),
    ("report_narrative", "계산된 통계·차트를 설명하는 서사를 작성하고 수치마다 인용한다."),
]


async def seed() -> None:
    async with engine.begin() as conn:
        # 시드 사용자 (고정 UUID)
        await conn.execute(
            text("INSERT INTO archive.users (id) VALUES (:id) ON CONFLICT (id) DO NOTHING"),
            {"id": SEED_USER_ID},
        )

        # 모델 레지스트리 (name 중복 방지)
        for m in MODELS:
            await conn.execute(
                text(
                    """
                    INSERT INTO archive.models
                        (name, file_path, quantization, context_window, provider)
                    SELECT :name, :file_path, :quantization, :context_window, :provider
                    WHERE NOT EXISTS (SELECT 1 FROM archive.models WHERE name = :name)
                    """
                ),
                m,
            )

        # 프롬프트 템플릿 레지스트리 (key, version 유일)
        for key, body in PROMPT_TEMPLATES:
            await conn.execute(
                text(
                    """
                    INSERT INTO archive.prompt_templates (key, version, language, body)
                    VALUES (:key, 1, 'ko', :body)
                    ON CONFLICT (key, version) DO NOTHING
                    """
                ),
                {"key": key, "body": body},
            )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
    print("seed 완료: users(1) + models + prompt_templates")
