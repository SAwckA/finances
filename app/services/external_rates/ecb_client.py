import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from xml.etree import ElementTree

import httpx

from app.config.env import settings

logger = logging.getLogger(__name__)

ECB_XML_NS = {
    "gesmes": "http://www.gesmes.org/xml/2002-08-01",
    "def": "http://www.ecb.int/vocabulary/2002-08-01/eurofxref",
}


class ECBClient:
    """Клиент ECB для чтения ежедневных курсов EUR cross."""

    async def fetch_rates_by_date(
        self, on_date: date
    ) -> tuple[datetime, dict[str, Decimal]]:
        """
        Вернуть последний доступный набор курсов ECB на дату <= on_date.
        Возвращает timestamp набора и map currency->rate_vs_eur.
        """
        timeout = httpx.Timeout(settings.exchange_http_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(settings.ecb_hist_rates_url)
            response.raise_for_status()

        root = ElementTree.fromstring(response.text)
        best_ts: datetime | None = None
        best_rates: dict[str, Decimal] | None = None
        target_date = on_date

        for cube in root.iter():
            if not cube.tag.endswith("Cube"):
                continue
            time_attr = cube.attrib.get("time")
            if not time_attr:
                continue
            cube_date = date.fromisoformat(time_attr)
            if cube_date > target_date:
                continue

            rates: dict[str, Decimal] = {"EUR": Decimal("1")}
            for rate_node in cube:
                if not rate_node.tag.endswith("Cube"):
                    continue
                currency = rate_node.attrib.get("currency")
                rate_value = rate_node.attrib.get("rate")
                if not currency or not rate_value:
                    continue
                rates[currency.upper()] = Decimal(rate_value)

            if not rates:
                continue

            cube_ts = datetime.combine(
                cube_date, datetime.min.time(), tzinfo=timezone.utc
            )
            if best_ts is None or cube_ts > best_ts:
                best_ts = cube_ts
                best_rates = rates

        if best_ts is None or best_rates is None:
            raise ValueError(
                f"ECB rates were not found for date <= {on_date.isoformat()}"
            )

        logger.debug("ECB rates loaded for %s", best_ts.date().isoformat())
        return best_ts, best_rates
