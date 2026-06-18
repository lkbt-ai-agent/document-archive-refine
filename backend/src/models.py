"""SQLAlchemy 선언적 Base + 명명 규약 (data-overview §2).

모든 테이블은 `archive` 스키마에 생성된다(확장은 `archive_ext`, infrastructure §3).
naming_convention으로 인덱스·제약 이름을 결정적으로 만들어 Alembic 마이그레이션을 안정화한다.
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# ix/uq/ck/fk/pk 접두사 일관 부여 (data-overview §2)
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION, schema="archive")
