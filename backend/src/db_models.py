"""전 모델 집합 import (data-overview §4: autogenerate가 빠짐없이 인식하도록).

Alembic env.py와 메타데이터 생성은 이 모듈만 import하면 모든 테이블을 본다.
"""

from src.documents.models import Document, DocumentChunk
from src.folders.models import Folder
from src.generations.models import (
    Generation,
    GenerationChart,
    GenerationPrompt,
    GenerationSourceChunk,
    GenerationSourceDocument,
    Model,
    PromptTemplate,
)
from src.models import Base
from src.users.models import User

__all__ = [
    "Base",
    "User",
    "Folder",
    "Document",
    "DocumentChunk",
    "Model",
    "PromptTemplate",
    "Generation",
    "GenerationPrompt",
    "GenerationSourceDocument",
    "GenerationSourceChunk",
    "GenerationChart",
]
