"""임베딩 모델(KURE-v1) 토크나이저로 토큰 수를 센다 (ingestion-backend §2-4).

청킹은 문자 수 근사가 아니라 임베딩 모델의 실제 토크나이저로 토큰 수를 재야 정확하다.
예전에는 llama 임베딩 서버(:8081)의 `/tokenize`를 라인마다 HTTP로 호출했는데, 대형 문서에서
왕복이 수천 번이라 인제스트가 타임아웃·연결 실패로 무너졌다(lesson 03). 이제 같은 토크나이저
파일을 워커 프로세스에 직접 로드해 HTTP 없이 센다.

토큰 수만 필요하므로 특수 토큰은 붙이지 않는다(`add_special_tokens=False`). 청크 목표(512)는
임베딩 컨텍스트(8192)의 1/16이라 서버 토큰화와 미세하게 달라도 안전하다.
"""

from functools import lru_cache

from tokenizers import Tokenizer

from src.config import settings


@lru_cache(maxsize=1)
def _tokenizer() -> Tokenizer:
    """동봉 토크나이저를 한 번만 로드해 재사용한다.

    토크나이저 파일에는 패딩·트렁케이션 설정이 들어 있어 `encode_batch`가 길이를 최댓값으로
    패딩한다. 토큰 수만 셀 것이므로 둘 다 끈다(끄지 않으면 배치 토큰 수가 부풀려진다).
    """
    tok = Tokenizer.from_file(str(settings.kure_tokenizer_path))
    tok.no_padding()
    tok.no_truncation()
    return tok


def count_tokens(text: str) -> int:
    if not text:
        return 0
    return len(_tokenizer().encode(text, add_special_tokens=False).ids)


def count_tokens_batch(texts: list[str]) -> list[int]:
    """여러 텍스트의 토큰 수를 한 번에 센다(라인 단위 청킹용)."""
    if not texts:
        return []
    encodings = _tokenizer().encode_batch(texts, add_special_tokens=False)
    return [len(e.ids) for e in encodings]
