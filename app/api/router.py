from fastapi import APIRouter

from app.api.controllers import (
    accounts,
    auth,
    categories,
    currencies,
    recurring_transactions,
    shopping_lists,
    shopping_templates,
    statistics,
    transactions,
    users,
)

router = APIRouter(prefix="/api")

router.include_router(auth.router)
router.include_router(users.router)
router.include_router(currencies.router)
router.include_router(accounts.router)
router.include_router(categories.router)
router.include_router(transactions.router)
router.include_router(statistics.router)
router.include_router(shopping_lists.router)
router.include_router(shopping_templates.router)
router.include_router(recurring_transactions.router)

