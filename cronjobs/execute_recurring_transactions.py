import argparse
import asyncio
import logging
import sys
from datetime import date, datetime, timezone
from app.config.logging import setup_logging
from app.services.recurring_transaction_service import RecurringTransactionService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Execute pending recurring transactions for all users."
    )
    parser.add_argument(
        "--as-of-date",
        type=str,
        default=None,
        help="Date in YYYY-MM-DD format. Defaults to current UTC date.",
    )
    return parser.parse_args()


def parse_as_of_date(raw_value: str | None) -> date:
    if raw_value is None:
        return datetime.now(timezone.utc).date()
    return datetime.strptime(raw_value, "%Y-%m-%d").date()


async def run_job(as_of_date: date) -> int:
    logger = logging.getLogger(__name__)
    logger.info("Recurring transactions cronjob started. as_of_date=%s", as_of_date)

    try:
        report = await RecurringTransactionService.execute_pending_for_all_users(
            as_of_date=as_of_date
        )

        logger.info(
            "Recurring cronjob finished. processed=%s successful=%s failed=%s",
            report.processed_templates,
            report.successful_executions,
            report.failed_executions,
        )

        for error in report.errors:
            logger.error(
                "Recurring execution failed. recurring_id=%s workspace_id=%s message=%s",
                error.recurring_id,
                error.workspace_id,
                error.message,
            )

        return 1 if report.failed_executions > 0 else 0
    except Exception:
        logger.exception("Recurring transactions cronjob failed")
        return 1


def main() -> int:
    setup_logging()
    args = parse_args()
    as_of_date = parse_as_of_date(args.as_of_date)
    return asyncio.run(run_job(as_of_date))


if __name__ == "__main__":
    raise SystemExit(main())
