import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.config.env import settings
from app.models.exchange_rate import ExchangeRateRunStatus, ExchangeRateSource
from app.repositories.currency_repository import CurrencyRepository
from app.repositories.exchange_rate_repository import (
    ExchangeRateRepository,
    ExchangeRateRunRepository,
)
from app.services.base_service import BaseService
from app.services.external_rates import CBRClient, ECBClient

logger = logging.getLogger(__name__)


class ExchangeRateCollectorService(BaseService):
    """Сервис фонового сбора и сохранения исторических курсов валют."""

    currency_repository: CurrencyRepository
    exchange_rate_repository: ExchangeRateRepository
    exchange_rate_run_repository: ExchangeRateRunRepository

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.ecb_client = ECBClient()
        self.cbr_client = CBRClient()

    async def collect_for_day(
        self,
        *,
        target_date: date,
        is_backfill: bool = False,
    ) -> ExchangeRateRunStatus:
        """Собрать курсы за выбранную дату."""
        run = await self.exchange_rate_run_repository.create_run(
            base_date=target_date,
            timezone_name=settings.exchange_rate_job_timezone,
        )
        logger.info(
            "Exchange rates run started. run_id=%s date=%s",
            run.id,
            target_date.isoformat(),
        )

        pairs_total = 0
        pairs_saved = 0
        pairs_skipped = 0
        error_count = 0
        errors: list[str] = []

        try:
            currency_codes = await self.currency_repository.get_all_codes()
            ordered_codes = sorted({code.upper() for code in currency_codes})
            pairs = [
                (from_code, to_code)
                for from_code in ordered_codes
                for to_code in ordered_codes
                if from_code != to_code
            ]
            pairs_total = len(pairs)

            ecb_timestamp: datetime | None = None
            cbr_timestamp: datetime | None = None
            ecb_rates: dict[str, Decimal] = {}
            cbr_rates: dict[str, Decimal] = {}

            try:
                ecb_timestamp, ecb_rates = await self.ecb_client.fetch_rates_by_date(
                    target_date
                )
            except Exception as exc:
                error_count += 1
                errors.append(f"ECB source unavailable: {exc}")
                logger.error("ECB source unavailable: %s", exc)

            try:
                cbr_timestamp, cbr_rates = await self.cbr_client.fetch_rates_by_date(
                    target_date
                )
            except Exception as exc:
                error_count += 1
                errors.append(f"CBR source unavailable: {exc}")
                logger.error("CBR source unavailable: %s", exc)

            for from_code, to_code in pairs:
                try:
                    source, rate, effective_at = self._resolve_pair_rate(
                        from_code=from_code,
                        to_code=to_code,
                        ecb_rates=ecb_rates,
                        cbr_rates=cbr_rates,
                        ecb_timestamp=ecb_timestamp,
                        cbr_timestamp=cbr_timestamp,
                    )
                    await self.exchange_rate_repository.create_rate(
                        run_id=run.id,
                        from_currency_code=from_code,
                        to_currency_code=to_code,
                        source=source,
                        rate=rate,
                        effective_at=effective_at,
                        is_backfill=is_backfill,
                    )
                    pairs_saved += 1
                except Exception as exc:
                    pairs_skipped += 1
                    error_count += 1
                    err_msg = f"pair={from_code}->{to_code}: {exc}"
                    errors.append(err_msg)
                    logger.exception("Failed to collect exchange rate: %s", err_msg)

            status = (
                ExchangeRateRunStatus.COMPLETED
                if error_count == 0
                else ExchangeRateRunStatus.COMPLETED_WITH_ERRORS
            )
            await self.exchange_rate_run_repository.finish_run(
                run.id,
                status=status,
                pairs_total=pairs_total,
                pairs_saved=pairs_saved,
                pairs_skipped=pairs_skipped,
                error_count=error_count,
                error_summary="\n".join(errors[:20]) if errors else None,
            )
            logger.info(
                "Exchange rates run finished. run_id=%s status=%s saved=%s skipped=%s",
                run.id,
                status.value,
                pairs_saved,
                pairs_skipped,
            )
            return status
        except Exception as exc:
            logger.exception("Exchange rates run failed. run_id=%s", run.id)
            await self.exchange_rate_run_repository.finish_run(
                run.id,
                status=ExchangeRateRunStatus.FAILED,
                pairs_total=pairs_total,
                pairs_saved=pairs_saved,
                pairs_skipped=pairs_skipped,
                error_count=error_count + 1,
                error_summary=str(exc),
            )
            return ExchangeRateRunStatus.FAILED

    async def collect_last_days(self, days: int) -> None:
        """Собрать курсы за последние N дней, включая сегодня."""
        now_utc = datetime.now(timezone.utc).date()
        for shift in range(days - 1, -1, -1):
            day = now_utc - timedelta(days=shift)
            await self.collect_for_day(target_date=day, is_backfill=True)

    def _resolve_pair_rate(
        self,
        *,
        from_code: str,
        to_code: str,
        ecb_rates: dict[str, Decimal],
        cbr_rates: dict[str, Decimal],
        ecb_timestamp: datetime | None,
        cbr_timestamp: datetime | None,
    ) -> tuple[ExchangeRateSource, Decimal, datetime]:
        """Рассчитать курс пары по правилам выбора источника."""
        if "RUB" in (from_code, to_code):
            if cbr_timestamp is None:
                raise ValueError("CBR timestamp is unavailable")
            from_rub = cbr_rates.get(from_code)
            to_rub = cbr_rates.get(to_code)
            if from_rub is None or to_rub is None:
                raise ValueError("Currency not supported by CBR")
            # cbr_rates хранит "сколько RUB за 1 единицу валюты",
            # значит курс from->to = from_rub / to_rub.
            rate = from_rub / to_rub
            return ExchangeRateSource.CBR, rate, cbr_timestamp

        if ecb_timestamp is None:
            raise ValueError("ECB timestamp is unavailable")
        from_eur = ecb_rates.get(from_code)
        to_eur = ecb_rates.get(to_code)
        if from_eur is not None and to_eur is not None:
            rate = to_eur / from_eur
            return ExchangeRateSource.ECB, rate, ecb_timestamp

        # Fallback: если ECB не покрывает валюту пары (например KZT),
        # считаем cross-rate через CBR при наличии обеих валют.
        if cbr_timestamp is None:
            raise ValueError("Currency not supported by ECB and CBR is unavailable")
        from_rub = cbr_rates.get(from_code)
        to_rub = cbr_rates.get(to_code)
        if from_rub is None or to_rub is None:
            raise ValueError("Currency is unsupported by both ECB and CBR")
        logger.warning(
            "ECB does not provide pair %s->%s, fallback to CBR cross-rate",
            from_code,
            to_code,
        )
        rate = from_rub / to_rub
        return ExchangeRateSource.CBR, rate, cbr_timestamp
