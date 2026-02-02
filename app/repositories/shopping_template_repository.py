from typing import Sequence

from sqlalchemy.orm import selectinload

from app.models.shopping_template import ShoppingTemplate, ShoppingTemplateItem
from app.repositories.base_repository import BaseRepository


class ShoppingTemplateRepository(BaseRepository[ShoppingTemplate]):
    """Репозиторий для работы с шаблонами списков покупок."""

    async def get_by_id_with_items(self, template_id: int) -> ShoppingTemplate | None:
        """Получить шаблон с товарами."""
        query = (
            self._base_query()
            .where(ShoppingTemplate.id == template_id)
            .options(selectinload(ShoppingTemplate.items))
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_user_id(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[ShoppingTemplate]:
        """Получить шаблоны пользователя."""
        query = (
            self._base_query()
            .where(ShoppingTemplate.user_id == user_id)
            .options(selectinload(ShoppingTemplate.items))
            .order_by(ShoppingTemplate.name)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_user_template(
        self, user_id: int, template_id: int
    ) -> ShoppingTemplate | None:
        """Получить конкретный шаблон пользователя."""
        query = (
            self._base_query()
            .where(ShoppingTemplate.user_id == user_id)
            .where(ShoppingTemplate.id == template_id)
            .options(selectinload(ShoppingTemplate.items))
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()


class ShoppingTemplateItemRepository(BaseRepository[ShoppingTemplateItem]):
    """Репозиторий для работы с товарами в шаблонах."""

    async def get_by_template_id(self, template_id: int) -> Sequence[ShoppingTemplateItem]:
        """Получить все товары шаблона."""
        return await self.get_many_by(template_id=template_id)

    async def get_template_item(
        self, template_id: int, item_id: int
    ) -> ShoppingTemplateItem | None:
        """Получить конкретный товар из шаблона."""
        return await self.get_by(template_id=template_id, id=item_id)

    async def bulk_create(
        self, template_id: int, items: list[dict]
    ) -> Sequence[ShoppingTemplateItem]:
        """Создать несколько товаров сразу."""
        created_items = []
        for item_data in items:
            item_data["template_id"] = template_id
            item = await self.create(item_data)
            created_items.append(item)
        return created_items

