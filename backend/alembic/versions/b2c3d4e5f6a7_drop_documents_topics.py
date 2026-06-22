"""drop documents.topics

토픽 메타데이터를 제거한다(plan 03-backend T4). 토픽은 키워드와 중복되고 표시 전용이라
검색 이득이 없으므로 키워드로 단일화한다(research 01-mvp-research/06 §5). 인덱스·FK·제약이
없는 독립 컬럼이라 DROP은 값만 제거하고 다른 데이터에 영향이 없다. 값은 LLM 파생이라
재인제스트로 재생성 가능하다.

Revision ID: b2c3d4e5f6a7
Revises: 9fb1da4d9520
Create Date: 2026-06-22
"""

from collections.abc import Sequence

from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | Sequence[str] | None = "9fb1da4d9520"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE archive.documents DROP COLUMN IF EXISTS topics")


def downgrade() -> None:
    # 컬럼만 복원한다. 값은 복원되지 않으며 재인제스트로 재생성한다.
    op.execute("ALTER TABLE archive.documents ADD COLUMN IF NOT EXISTS topics TEXT[]")
