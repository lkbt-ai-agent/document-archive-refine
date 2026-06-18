"""폴더 모델 — 인접 리스트 트리 (folders-schema §1).

`parent_id` self-FK로 트리를 표현하고, 형제 폴더명 유일 제약을 둔다(루트=parent_id NULL).
"""

import uuid
from datetime import datetime

from sqlalchemy import TIMESTAMP, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class Folder(Base):
    __tablename__ = "folders"
    __table_args__ = (
        # 같은 부모·같은 소유자 아래 형제 폴더명 중복 금지 (folders-schema §3)
        UniqueConstraint("parent_id", "owner_id", "name", name="uq_folder_sibling_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    # 루트=NULL, 부모 삭제 시 하위 연쇄 삭제
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,  # ix_folders_parent_id (재귀 CTE 가속)
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
