import argparse
import asyncio
import logging
import sys
from datetime import datetime, timezone

from app.config.logging import setup_logging
from app.models.exchange_rate import ExchangeRateRunStatus
from app.services.exchange_rate_collector_service import ExchangeRateCollectorService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect and store historical exchange rates from ECB and CBR."
    )
    parser.add_argument(
        "--backfill-days",
        type=int,
        default=0,
        help="Collect rates for last N days (including today). If 0, collect only for today.",
    )
    return parser.parse_args()


async def run_job(backfill_days: int) -> int:
    logger = logging.getLogger(__name__)
    logger.info("Exchange rates cronjob started. backfill_days=%s", backfill_days)

    try:
        async with ExchangeRateCollectorService() as service:
            if backfill_days > 0:
                await service.collect_last_days(backfill_days)
            else:
                today = datetime.now(timezone.utc).date()
                status = await service.collect_for_day(
                    target_date=today,
                    is_backfill=False,
                )
                if status == ExchangeRateRunStatus.FAILED:
                    logger.error("Exchange rates cronjob finished with FAILED status")
                    return 1
        logger.info("Exchange rates cronjob finished successfully")
        return 0
    except Exception:
        logger.exception("Exchange rates cronjob failed")
        return 1


def main() -> int:
    setup_logging()
    args = parse_args()
    if args.backfill_days < 0:
        raise ValueError("--backfill-days must be >= 0")
    return asyncio.run(run_job(args.backfill_days))


if __name__ == "__main__":
    raise SystemExit(main())
