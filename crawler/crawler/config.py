"""공통 실행 설정 (design §7.1, §8).

동시성, 요청 지연, User-Agent, 기본 출력 경로를 한곳에 모은다.
사이트 구현과 러너는 이 값을 공유한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


def _project_root() -> Path:
    """프로젝트 루트(=sample-datas의 부모)를 찾는다.

    crawler/crawler/config.py 기준 두 단계 위가 ``crawler/``,
    세 단계 위가 프로젝트 루트이다.
    """
    return Path(__file__).resolve().parents[2]


# 식별 가능한 User-Agent. 수집 대상에 출처를 밝힌다 (design §7.1).
USER_AGENT = "doc-archive-testdata-crawler/0.1 (+docs/research/02-test-data-crawler)"


@dataclass(slots=True)
class RunConfig:
    """1회 실행 동안 공유하는 동작 설정."""

    out_dir: Path = _project_root() / "sample-datas"
    concurrency: int = 1          # 사이트별 동시 요청 수 (기본 1, 권장 1~3)
    delay: float = 0.7            # 요청 간 지연(초) (design §7.1)
    timeout: float = 20.0         # 요청 타임아웃(초) (design §5.1)
    connect_timeout: float = 10.0
    retries: int = 2              # 연결 실패 자동 재시도 (design §5.1)
    user_agent: str = USER_AGENT

    def source_dir(self, source_id: str) -> Path:
        """``sample-datas/<source_id>/`` 경로를 만들어 돌려준다."""
        path = self.out_dir / source_id
        path.mkdir(parents=True, exist_ok=True)
        return path
