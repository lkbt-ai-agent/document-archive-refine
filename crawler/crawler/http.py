"""HTTP 전략 인프라 (design §5.1).

영속 ``httpx.Client``에 헤더·타임아웃·전송 재시도를 묶어 둔다.
큰 PDF는 메모리에 다 올리지 않고 스트리밍으로 디스크에 흘려보낸다.
"""

from __future__ import annotations

from pathlib import Path

import httpx

from crawler.config import RunConfig


def make_client(config: RunConfig, *, base_url: str = "") -> httpx.Client:
    """공통 설정을 적용한 httpx.Client를 만든다.

    - 식별 User-Agent를 모든 요청에 붙인다.
    - connect/read 타임아웃을 분리해 둔다.
    - ``HTTPTransport(retries=...)``로 연결 실패(ConnectError/Timeout)를 자동 재시도한다.
    """
    timeout = httpx.Timeout(config.timeout, connect=config.connect_timeout)
    transport = httpx.HTTPTransport(retries=config.retries)
    return httpx.Client(
        base_url=base_url,
        headers={"user-agent": config.user_agent},
        timeout=timeout,
        transport=transport,
        follow_redirects=True,
    )


def stream_to_file(client: httpx.Client, method: str, url: str, dest: Path, **kwargs) -> int:
    """응답 본문을 스트리밍으로 dest에 저장하고 바이트 수를 반환한다 (design §5.1).

    호출 측에서 임시 경로를 주고, 성공 후 최종 경로로 옮기는 패턴을 권장한다.
    """
    total = 0
    with client.stream(method, url, **kwargs) as response:
        response.raise_for_status()
        with dest.open("wb") as fh:
            for chunk in response.iter_bytes():
                fh.write(chunk)
                total += len(chunk)
    return total
