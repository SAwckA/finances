import logging

from app.exceptions import ForbiddenException, NotFoundException
from app.models.shopping_list import ShoppingListStatus
from app.models.shopping_template import (
    ShoppingTemplateCreate,
    ShoppingTemplateItemCreate,
    ShoppingTemplateItemUpdate,
    ShoppingTemplateUpdate,
)
from app.repositories.account_repository import AccountRepository
from app.repositories.category_repository import CategoryRepository
from app.repositories.shopping_list_repository import (
    ShoppingItemRepository,
    ShoppingListRepository,
)
from app.repositories.shopping_template_repository import (
    ShoppingTemplateItemRepository,
    ShoppingTemplateRepository,
)
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


# === EXCEPTIONS ===


class ShoppingTemplateNotFoundException(NotFoundException):
    """Шаблон списка покупок не найден."""

    message = "Шаблон списка покупок не найден"


class ShoppingTemplateItemNotFoundException(NotFoundException):
    """Товар в шаблоне не найден."""

    message = "Товар в шаблоне не найден"


class ShoppingTemplateAccessDeniedException(ForbiddenException):
    """Доступ к шаблону запрещён."""

    message = "Доступ к шаблону запрещён"


class DefaultAccountNotFoundException(NotFoundException):
    """Счёт по умолчанию не найден."""

    message = "Указанный счёт по умолчанию не найден"


class DefaultCategoryNotFoundException(NotFoundException):
    """Категория по умолчанию не найдена."""

    message = "Указанная категория по умолчанию не найдена"


# === SERVICE ===


class ShoppingTemplateService(BaseService):
    """Сервис для работы с шаблонами списков покупок."""

    template_repository: ShoppingTemplateRepository
    template_item_repository: ShoppingTemplateItemRepository
    shopping_list_repository: ShoppingListRepository
    shopping_item_repository: ShoppingItemRepository
    account_repository: AccountRepository
    category_repository: CategoryRepository

    async def get_workspace_templates(
        self,
        workspace_id: int,
        skip: int = 0,
        limit: int = 100,
    ):
        """Получить шаблоны рабочего пространства."""
        return await self.template_repository.get_by_workspace_id(
            workspace_id=workspace_id,
            skip=skip,
            limit=limit,
        )

    async def get_by_id(self, template_id: int, workspace_id: int):
        """Получить шаблон по ID с проверкой доступа."""
        template = await self.template_repository.get_workspace_template(
            workspace_id=workspace_id,
            template_id=template_id,
        )
        if not template:
            raise ShoppingTemplateNotFoundException(
                details={"template_id": template_id}
            )
        return template

    async def create(
        self,
        workspace_id: int,
        actor_user_id: int,
        data: ShoppingTemplateCreate,
    ):
        """Создать новый шаблон."""
        if data.default_account_id:
            await self._validate_account(workspace_id, data.default_account_id)
        if data.default_category_id:
            await self._validate_category(workspace_id, data.default_category_id)

        template_data = {
            "workspace_id": workspace_id,
            "user_id": actor_user_id,
            "name": data.name,
            "color": data.color,
            "icon": data.icon,
            "default_account_id": data.default_account_id,
            "default_category_id": data.default_category_id,
        }

        template = await self.template_repository.create(template_data)

        if data.items:
            items_data = [item.model_dump() for item in data.items]
            await self.template_item_repository.bulk_create(template.id, items_data)

        logger.info(
            "Created shopping template '%s' for workspace %s by user %s",
            data.name,
            workspace_id,
            actor_user_id,
        )
        return await self.template_repository.get_by_id_with_items(template.id)

    async def update(
        self,
        template_id: int,
        workspace_id: int,
        data: ShoppingTemplateUpdate,
    ):
        """Обновить шаблон."""
        await self.get_by_id(template_id, workspace_id)

        update_data = data.model_dump(exclude_unset=True)

        if "default_account_id" in update_data and update_data["default_account_id"]:
            await self._validate_account(
                workspace_id, update_data["default_account_id"]
            )
        if "default_category_id" in update_data and update_data["default_category_id"]:
            await self._validate_category(
                workspace_id, update_data["default_category_id"]
            )

        await self.template_repository.update(template_id, update_data)
        logger.info(f"Updated shopping template {template_id}")
        return await self.template_repository.get_by_id_with_items(template_id)

    async def delete(self, template_id: int, workspace_id: int) -> bool:
        """Удалить шаблон."""
        await self.get_by_id(template_id, workspace_id)
        result = await self.template_repository.delete(template_id)
        logger.info(f"Deleted shopping template {template_id}")
        return result

    async def add_item(
        self,
        template_id: int,
        workspace_id: int,
        data: ShoppingTemplateItemCreate,
    ):
        """Добавить товар в шаблон."""
        await self.get_by_id(template_id, workspace_id)

        item_data = data.model_dump()
        item_data["template_id"] = template_id
        item = await self.template_item_repository.create(item_data)
        logger.info(f"Added item '{data.name}' to template {template_id}")
        return item

    async def update_item(
        self,
        template_id: int,
        item_id: int,
        workspace_id: int,
        data: ShoppingTemplateItemUpdate,
    ):
        """Обновить товар в шаблоне."""
        await self.get_by_id(template_id, workspace_id)

        item = await self.template_item_repository.get_template_item(
            template_id, item_id
        )
        if not item:
            raise ShoppingTemplateItemNotFoundException(details={"item_id": item_id})

        update_data = data.model_dump(exclude_unset=True)
        updated = await self.template_item_repository.update(item_id, update_data)
        logger.info(f"Updated item {item_id} in template {template_id}")
        return updated

    async def remove_item(
        self,
        template_id: int,
        item_id: int,
        workspace_id: int,
    ) -> bool:
        """Удалить товар из шаблона."""
        await self.get_by_id(template_id, workspace_id)

        item = await self.template_item_repository.get_template_item(
            template_id, item_id
        )
        if not item:
            raise ShoppingTemplateItemNotFoundException(details={"item_id": item_id})

        result = await self.template_item_repository.delete(item_id)
        logger.info(f"Removed item {item_id} from template {template_id}")
        return result

    async def create_list_from_template(
        self,
        template_id: int,
        workspace_id: int,
        actor_user_id: int,
        name: str | None = None,
        account_id: int | None = None,
        category_id: int | None = None,
    ):
        """
        Создать список покупок из шаблона.

        Args:
            template_id: ID шаблона
            workspace_id: ID рабочего пространства
            actor_user_id: ID пользователя, создавшего список
            name: Название списка (по умолчанию берётся из шаблона)
            account_id: ID счёта (по умолчанию берётся из шаблона)
            category_id: ID категории (по умолчанию берётся из шаблона)
        """
        template = await self.get_by_id(template_id, workspace_id)

        final_account_id = account_id or template.default_account_id
        final_category_id = category_id or template.default_category_id

        if not final_account_id:
            raise DefaultAccountNotFoundException(
                message="Не указан счёт и в шаблоне нет счёта по умолчанию"
            )
        if not final_category_id:
            raise DefaultCategoryNotFoundException(
                message="Не указана категория и в шаблоне нет категории по умолчанию"
            )
        await self._validate_account(workspace_id, final_account_id)
        await self._validate_category(workspace_id, final_category_id)

        list_data = {
            "workspace_id": workspace_id,
            "user_id": actor_user_id,
            "name": name or template.name,
            "account_id": final_account_id,
            "category_id": final_category_id,
            "status": ShoppingListStatus.DRAFT,
        }

        shopping_list = await self.shopping_list_repository.create(list_data)

        if template.items:
            items_data = [
                {
                    "name": item.name,
                    "quantity": item.default_quantity,
                    "price": item.default_price,
                }
                for item in template.items
            ]
            await self.shopping_item_repository.bulk_create(
                shopping_list.id, items_data
            )

        logger.info(
            f"Created shopping list {shopping_list.id} from template {template_id}"
        )
        return await self.shopping_list_repository.get_by_id_with_items(
            shopping_list.id
        )

    async def _validate_account(self, workspace_id: int, account_id: int) -> None:
        """Проверить существование и доступ к счёту."""
        account = await self.account_repository.get_by_id(account_id)
        if not account or account.workspace_id != workspace_id:
            raise DefaultAccountNotFoundException(details={"account_id": account_id})

    async def _validate_category(self, workspace_id: int, category_id: int) -> None:
        """Проверить существование и доступ к категории."""
        category = await self.category_repository.get_by_id(category_id)
        if not category or category.workspace_id != workspace_id:
            raise DefaultCategoryNotFoundException(details={"category_id": category_id})
