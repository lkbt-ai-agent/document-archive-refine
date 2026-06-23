"""add documents.retry_count

실패한 문서를 다시 처리하는 재시도 기능의 상한 가드용 컬럼이다(retry plan B1, research 08 §6.1).
재시도할 때마다 1 증가하고, 상한을 넘으면 재시도를 거부해 독성 문서의 무한 재시도를 막는다.
기존 행은 0으로 채운다.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-23
"""

from collections.abc import Sequence

from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: str | Sequence[str] | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE archive.documents "
        "ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE archive.documents DROP COLUMN IF EXISTS retry_count")
