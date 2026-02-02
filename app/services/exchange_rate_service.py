import logging
from decimal import Decimal

from app.exceptions import NotFoundException
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


# === EXCEPTIONS ===


class ExchangeRateNotFoundException(NotFoundException):
    """Курс обмена не найден."""

    message = "Курс обмена для указанной валютной пары не найден"


# === SERVICE ===


class ExchangeRateService(BaseService):
    """
    Мок-сервис для получения курсов валют.

    TODO: В будущем будет интегрирован с биржевым API.
    """

    MOCK_RATES: dict[str, dict[str, Decimal]] = {
        "USD": {
            "RUB": Decimal("92.50"),
            "EUR": Decimal("0.92"),
            "GBP": Decimal("0.79"),
            "CNY": Decimal("7.24"),
            "JPY": Decimal("149.50"),
            "BTC": Decimal("0.000011"),
            "ETH": Decimal("0.00029"),
            "USDT": Decimal("1.00"),
        },
        "EUR": {
            "USD": Decimal("1.09"),
            "RUB": Decimal("100.80"),
            "GBP": Decimal("0.86"),
            "CNY": Decimal("7.88"),
            "JPY": Decimal("162.70"),
            "BTC": Decimal("0.000012"),
            "ETH": Decimal("0.00032"),
            "USDT": Decimal("1.09"),
        },
        "RUB": {
            "USD": Decimal("0.0108"),
            "EUR": Decimal("0.0099"),
            "GBP": Decimal("0.0085"),
            "CNY": Decimal("0.078"),
            "JPY": Decimal("1.62"),
            "BTC": Decimal("0.00000012"),
            "ETH": Decimal("0.0000031"),
            "USDT": Decimal("0.0108"),
        },
        "GBP": {
            "USD": Decimal("1.27"),
            "EUR": Decimal("1.16"),
            "RUB": Decimal("117.20"),
            "CNY": Decimal("9.17"),
            "JPY": Decimal("189.50"),
            "BTC": Decimal("0.000014"),
            "ETH": Decimal("0.00037"),
            "USDT": Decimal("1.27"),
        },
        "CNY": {
            "USD": Decimal("0.138"),
            "EUR": Decimal("0.127"),
            "RUB": Decimal("12.78"),
            "GBP": Decimal("0.109"),
            "JPY": Decimal("20.65"),
            "BTC": Decimal("0.0000015"),
            "ETH": Decimal("0.00004"),
            "USDT": Decimal("0.138"),
        },
        "JPY": {
            "USD": Decimal("0.0067"),
            "EUR": Decimal("0.0061"),
            "RUB": Decimal("0.619"),
            "GBP": Decimal("0.0053"),
            "CNY": Decimal("0.0484"),
            "BTC": Decimal("0.000000074"),
            "ETH": Decimal("0.0000019"),
            "USDT": Decimal("0.0067"),
        },
        "BTC": {
            "USD": Decimal("91000"),
            "EUR": Decimal("83500"),
            "RUB": Decimal("8418500"),
            "GBP": Decimal("71890"),
            "CNY": Decimal("659000"),
            "JPY": Decimal("13600000"),
            "ETH": Decimal("26.5"),
            "USDT": Decimal("91000"),
        },
        "ETH": {
            "USD": Decimal("3450"),
            "EUR": Decimal("3170"),
            "RUB": Decimal("319125"),
            "GBP": Decimal("2726"),
            "CNY": Decimal("24978"),
            "JPY": Decimal("515775"),
            "BTC": Decimal("0.0377"),
            "USDT": Decimal("3450"),
        },
        "USDT": {
            "USD": Decimal("1.00"),
            "EUR": Decimal("0.92"),
            "RUB": Decimal("92.50"),
            "GBP": Decimal("0.79"),
            "CNY": Decimal("7.24"),
            "JPY": Decimal("149.50"),
            "BTC": Decimal("0.000011"),
            "ETH": Decimal("0.00029"),
        },
    }

    async def get_rate(self, from_currency: str, to_currency: str) -> Decimal:
        """
        Получить курс обмена между двумя валютами.

        Args:
            from_currency: Код исходной валюты (например, "USD")
            to_currency: Код целевой валюты (например, "RUB")

        Returns:
            Курс обмена (сколько единиц to_currency за 1 единицу from_currency)

        Raises:
            ExchangeRateNotFoundException: Если курс для пары не найден
        """
        from_code = from_currency.upper()
        to_code = to_currency.upper()

        if from_code == to_code:
            return Decimal("1")

        if from_code not in self.MOCK_RATES:
            raise ExchangeRateNotFoundException(
                details={"from_currency": from_code, "to_currency": to_code}
            )

        rates = self.MOCK_RATES[from_code]
        if to_code not in rates:
            raise ExchangeRateNotFoundException(
                details={"from_currency": from_code, "to_currency": to_code}
            )

        rate = rates[to_code]
        logger.debug(f"Exchange rate {from_code} -> {to_code}: {rate}")
        return rate

    async def convert(
        self,
        amount: Decimal,
        from_currency: str,
        to_currency: str,
    ) -> Decimal:
        """
        Конвертировать сумму из одной валюты в другую.

        Args:
            amount: Сумма для конвертации
            from_currency: Код исходной валюты
            to_currency: Код целевой валюты

        Returns:
            Сконвертированная сумма
        """
        rate = await self.get_rate(from_currency, to_currency)
        return amount * rate

