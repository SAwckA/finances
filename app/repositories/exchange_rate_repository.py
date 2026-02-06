from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Sequence

from sqlalchemy import and_, desc, func, select

from app.models.exchange_rate import (
    ExchangeRate,
    ExchangeRateRun,
    ExchangeRateRunStatus,
    ExchangeRateSource,
)
from app.repositories.base_repository import BaseRepository


class ExchangeRateRunRepository(BaseRepository[ExchangeRateRun]):
    """Репозиторий запусков сбора курсов."""

    async def create_run(
        self, base_date: date, timezone_name: str = "UTC"
    ) -> ExchangeRateRun:
        """Создать запись запуска."""
        return await self.create(
            {
                "started_at": datetime.now(timezone.utc),
                "status": ExchangeRateRunStatus.RUNNING,
                "base_date": base_date,
                "timezone": timezone_name,
            }
        )

    async def finish_run(
        self,
        run_id: int,
        *,
        status: ExchangeRateRunStatus,
        pairs_total: int,
        pairs_saved: int,
        pairs_skipped: int,
        error_count: int,
        error_summary: str | None = None,
    ) -> ExchangeRateRun | None:
        """Завершить запись запуска и сохранить статистику."""
        return await self.update(
            run_id,
            {
                "finished_at": datetime.now(timezone.utc),
                "status": status,
                "pairs_total": pairs_total,
                "pairs_saved": pairs_saved,
                "pairs_skipped": pairs_skipped,
                "error_count": error_count,
                "error_summary": error_summary,
            },
        )


class ExchangeRateRepository(BaseRepository[ExchangeRate]):
    """Репозиторий исторических курсов."""

    async def create_rate(
        self,
        *,
        run_id: int,
        from_currency_code: str,
        to_currency_code: str,
        source: ExchangeRateSource,
        rate: Decimal,
        effective_at: datetime,
        is_backfill: bool = False,
    ) -> ExchangeRate:
        """Создать запись курса."""
        return await self.create(
            {
                "run_id": run_id,
                "from_currency_code": from_currency_code,
                "to_currency_code": to_currency_code,
                "source": source,
                "rate": rate,
                "effective_at": effective_at,
                "is_backfill": is_backfill,
            }
        )

    async def get_nearest_rate(
        self,
        from_currency_code: str,
        to_currency_code: str,
        at_datetime: datetime,
    ) -> ExchangeRate | None:
        """Получить ближайший по времени курс для пары (tie-break: более новый)."""
        delta_seconds = func.abs(
            func.extract(
                "epoch",
                ExchangeRate.effective_at - at_datetime,
            )
        )
        query = (
            select(ExchangeRate)
            .where(
                and_(
                    ExchangeRate.from_currency_code == from_currency_code,
                    ExchangeRate.to_currency_code == to_currency_code,
                )
            )
            .order_by(delta_seconds.asc(), desc(ExchangeRate.effective_at))
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_latest_for_pairs(
        self,
        from_currency_code: str,
        to_currency_code: str,
        limit: int = 30,
    ) -> Sequence[ExchangeRate]:
        """Получить последние записи курса по паре."""
        query = (
            select(ExchangeRate)
            .where(
                and_(
                    ExchangeRate.from_currency_code == from_currency_code,
                    ExchangeRate.to_currency_code == to_currency_code,
                )
            )
            .order_by(desc(ExchangeRate.effective_at))
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()
