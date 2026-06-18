"""폴더 도메인 예외 (folders-backend §1: 409/422/404)."""

from src.common.exceptions import ConflictError, NotFoundError, UnprocessableError


class FolderNotFound(NotFoundError):
    def __init__(self) -> None:
        super().__init__("폴더를 찾을 수 없습니다.", code="folder_not_found")


class DuplicateSiblingName(ConflictError):
    def __init__(self) -> None:
        super().__init__("같은 폴더에 동일한 이름이 이미 있습니다.", code="duplicate_sibling_name")


class CyclicMove(UnprocessableError):
    def __init__(self) -> None:
        super().__init__("폴더를 자신의 하위로 이동할 수 없습니다.", code="cyclic_move")
