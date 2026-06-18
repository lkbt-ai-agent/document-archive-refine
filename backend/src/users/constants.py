"""MVP 시드 사용자 (users-schema §2).

MVP는 인증 범위 밖이라 고정 UUID의 단일 시드 사용자를 쓴다. 모든 도메인의 `owner_id`는
이 값을 가리킨다. B4 시드와 owner 스코프 의존성(common/deps.py)이 같은 상수를 공유한다.
"""

from uuid import UUID

SEED_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
