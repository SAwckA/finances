from typing import Sequence

from sqlalchemy.orm import selectinload, with_loader_criteria

from app.models.shopping_list import ShoppingItem, ShoppingList, ShoppingListStatus
from app.repositories.base_repository import BaseRepository


class ShoppingListRepository(BaseRepository[ShoppingList]):
    """Репозиторий для работы со списками покупок."""

    async def get_by_id_with_items(self, list_id: int) -> ShoppingList | None:
        """Получить список покупок с товарами."""
        query = (
            self._base_query()
            .where(ShoppingList.id == list_id)
            .options(
                selectinload(ShoppingList.items),
                selectinload(ShoppingList.transaction),
                with_loader_criteria(
                    ShoppingItem,
                    ShoppingItem.deleted_at.is_(None),
                    include_aliases=True,
                ),
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_workspace_id(
        self,
        workspace_id: int,
        status: ShoppingListStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[ShoppingList]:
        """Получить списки покупок рабочего пространства."""
        query = (
            self._base_query()
            .where(ShoppingList.workspace_id == workspace_id)
            .options(
                selectinload(ShoppingList.items),
                selectinload(ShoppingList.transaction),
                with_loader_criteria(
                    ShoppingItem,
                    ShoppingItem.deleted_at.is_(None),
                    include_aliases=True,
                ),
            )
        )
        if status:
            query = query.where(ShoppingList.status == status)
        query = query.order_by(ShoppingList.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_workspace_list(
        self,
        workspace_id: int,
        list_id: int,
    ) -> ShoppingList | None:
        """Получить конкретный список рабочего пространства."""
        query = (
            self._base_query()
            .where(ShoppingList.workspace_id == workspace_id)
            .where(ShoppingList.id == list_id)
            .options(
                selectinload(ShoppingList.items),
                selectinload(ShoppingList.transaction),
                with_loader_criteria(
                    ShoppingItem,
                    ShoppingItem.deleted_at.is_(None),
                    include_aliases=True,
                ),
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()


class ShoppingItemRepository(BaseRepository[ShoppingItem]):
    """Репозиторий для работы с товарами в списках покупок."""

    async def get_by_list_id(self, list_id: int) -> Sequence[ShoppingItem]:
        """Получить все товары списка."""
        return await self.get_many_by(shopping_list_id=list_id)

    async def get_list_item(self, list_id: int, item_id: int) -> ShoppingItem | None:
        """Получить конкретный товар из списка."""
        return await self.get_by(shopping_list_id=list_id, id=item_id)

    async def bulk_create(
        self, list_id: int, items: list[dict]
    ) -> Sequence[ShoppingItem]:
        """Создать несколько товаров сразу."""
        created_items = []
        for item_data in items:
            item_data["shopping_list_id"] = list_id
            item = await self.create(item_data)
            created_items.append(item)
        return created_items
