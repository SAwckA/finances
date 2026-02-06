from datetime import datetime, timezone

from sqlalchemy import update

from app.models.auth_exchange_code import AuthExchangeCode
from app.repositories.base_repository import BaseRepository


class AuthExchangeCodeRepository(BaseRepository[AuthExchangeCode]):
    """Репозиторий одноразовых кодов обмена auth_code -> JWT."""

    async def consume_valid_code(self, code_hash: str) -> AuthExchangeCode | None:
        """Помечает код использованным и возвращает запись только если код валиден."""
        query = (
            update(self.model)
            .where(self.model.code_hash == code_hash)
            .where(self.model.used_at.is_(None))
            .where(self.model.expires_at > datetime.now(timezone.utc))
            .values(used_at=datetime.now(timezone.utc))
            .returning(self.model)
        )
        result = await self.session.execute(query)
        await self.session.flush()
        return result.scalar_one_or_none()
