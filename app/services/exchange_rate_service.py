import logging
from datetime import datetime, timezone
from decimal import Decimal

from app.exceptions import NotFoundException
from app.repositories.exchange_rate_repository import ExchangeRateRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


class ExchangeRateNotFoundException(NotFoundException):
    """Курс обмена не найден."""

    message = "Курс обмена для указанной валютной пары не найден"


class ExchangeRateService(BaseService):
    """Сервис получения курсов из исторических данных в БД."""

    exchange_rate_repository: ExchangeRateRepository

    async def get_rate(
        self,
        from_currency: str,
        to_currency: str,
        at_datetime: datetime | None = None,
    ) -> Decimal:
        """Получить ближайший курс обмена для пары валют."""
        from_code = from_currency.upper()
        to_code = to_currency.upper()
        lookup_at = at_datetime or datetime.now(timezone.utc)

        if from_code == to_code:
            return Decimal("1")

        nearest_rate = await self.exchange_rate_repository.get_nearest_rate(
            from_currency_code=from_code,
            to_currency_code=to_code,
            at_datetime=lookup_at,
        )
        if not nearest_rate:
            raise ExchangeRateNotFoundException(
                details={
                    "from_currency": from_code,
                    "to_currency": to_code,
                    "at_datetime": lookup_at.isoformat(),
                }
            )

        logger.debug(
            "Exchange rate %s -> %s (%s): %s",
            from_code,
            to_code,
            nearest_rate.effective_at.isoformat(),
            nearest_rate.rate,
        )
        return Decimal(nearest_rate.rate)

    async def convert(
        self,
        amount: Decimal,
        from_currency: str,
        to_currency: str,
        at_datetime: datetime | None = None,
    ) -> Decimal:
        """Конвертировать сумму из одной валюты в другую."""
        rate = await self.get_rate(
            from_currency=from_currency,
            to_currency=to_currency,
            at_datetime=at_datetime,
        )
        return amount * rate
