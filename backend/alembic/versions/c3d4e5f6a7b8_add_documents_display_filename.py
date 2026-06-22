"""add documents.display_filename

사용자가 변경하는 "현재 파일명"을 담는다(plan 04-frontend D29·D30). 업로드 당시
`original_filename`(불변)·AI `llm_title`과 별개로 보관해 3중 이름을 분리한다. 최초값은
`original_filename`과 같고 이름 변경 시 갱신된다. ADD(nullable) → 기존 행 backfill →
SET NOT NULL 순으로 적용해 항상 현재 파일명을 보유하게 한다.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-23
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE archive.documents ADD COLUMN IF NOT EXISTS display_filename TEXT")
    # 기존 행은 현재 파일명을 원본 파일명으로 초기화한다.
    op.execute(
        "UPDATE archive.documents SET display_filename = original_filename "
        "WHERE display_filename IS NULL"
    )
    op.execute("ALTER TABLE archive.documents ALTER COLUMN display_filename SET NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE archive.documents DROP COLUMN IF EXISTS display_filename")
