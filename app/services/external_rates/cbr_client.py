import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from html import unescape
from xml.etree import ElementTree
from xml.etree.ElementTree import ParseError

import httpx

from app.config.env import settings

logger = logging.getLogger(__name__)

SOAP_ACTION = "http://web.cbr.ru/GetCursOnDateXML"
SOAP_NS = "http://web.cbr.ru/"


class CBRClient:
    """Клиент ЦБ РФ: SOAP DailyInfo + fallback XML_daily.asp."""

    async def fetch_rates_by_date(
        self, on_date: date
    ) -> tuple[datetime, dict[str, Decimal]]:
        timeout = httpx.Timeout(settings.exchange_http_timeout_seconds)
        parse_errors: list[str] = []

        # 1) Основной канал: DailyInfo.asmx SOAP POST (по документации CBR).
        try:
            rates = await self._fetch_via_dailyinfo_soap(on_date, timeout)
            logger.debug("CBR rates loaded from DailyInfo SOAP for %s", on_date.isoformat())
            return datetime.combine(on_date, datetime.min.time(), tzinfo=timezone.utc), rates
        except Exception as exc:
            parse_errors.append(f"DailyInfo SOAP error: {exc}")

        # 2) Резервный канал: XML_daily.asp (официальный XML ЦБ РФ).
        try:
            rates = await self._fetch_via_xml_daily(on_date, timeout)
            logger.debug("CBR rates loaded from XML_daily for %s", on_date.isoformat())
            return datetime.combine(on_date, datetime.min.time(), tzinfo=timezone.utc), rates
        except Exception as exc:
            parse_errors.append(f"XML_daily error: {exc}")

        raise ValueError(
            "; ".join(parse_errors) if parse_errors else "CBR response has unexpected format"
        )

    async def _fetch_via_dailyinfo_soap(
        self,
        on_date: date,
        timeout: httpx.Timeout,
    ) -> dict[str, Decimal]:
        soap_url = settings.cbr_dailyinfo_base_url.rstrip("/")
        on_date_iso = on_date.strftime("%Y-%m-%dT00:00:00")
        envelope = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCursOnDateXML xmlns="{SOAP_NS}">
      <On_date>{on_date_iso}</On_date>
    </GetCursOnDateXML>
  </soap:Body>
</soap:Envelope>"""

        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": f'"{SOAP_ACTION}"',
        }
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(soap_url, content=envelope.encode("utf-8"), headers=headers)
            response.raise_for_status()

        root = ElementTree.fromstring(response.text)
        result_xml = self._extract_dailyinfo_result_xml(root)
        if not result_xml:
            raise ValueError("GetCursOnDateXMLResult not found in SOAP response")

        parsed_root = self._parse_xml_payload(result_xml)
        rates = self._parse_rates_from_valute_data(parsed_root)
        if len(rates) <= 1:
            raise ValueError("No currency rates in SOAP result")
        return rates

    async def _fetch_via_xml_daily(
        self,
        on_date: date,
        timeout: httpx.Timeout,
    ) -> dict[str, Decimal]:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                "https://www.cbr.ru/scripts/XML_daily.asp",
                params={"date_req": on_date.strftime("%d/%m/%Y")},
            )
            response.raise_for_status()

        root = ElementTree.fromstring(response.text)
        rates = self._parse_rates_from_xml_daily(root)
        if len(rates) <= 1:
            raise ValueError("No currency rates in XML_daily response")
        return rates

    def _extract_dailyinfo_result_xml(self, soap_root: ElementTree.Element) -> str | None:
        for node in soap_root.iter():
            if node.tag.endswith("GetCursOnDateXMLResult"):
                # Вариант 1: XML пришел как escaped string в text.
                if node.text and node.text.strip():
                    return unescape(node.text.strip())
                # Вариант 2: XML пришел вложенным узлом.
                if list(node):
                    return ElementTree.tostring(list(node)[0], encoding="unicode")
        # Некоторые конфигурации возвращают <string> ... </string> при GET-пути.
        for node in soap_root.iter():
            if node.tag.endswith("string") and node.text and node.text.strip():
                return unescape(node.text.strip())
        return None

    def _parse_xml_payload(self, payload: str) -> ElementTree.Element:
        try:
            return ElementTree.fromstring(payload)
        except ParseError as exc:
            raise ValueError(f"Embedded XML parse error: {exc}") from exc

    def _parse_rates_from_valute_data(self, root: ElementTree.Element) -> dict[str, Decimal]:
        rates: dict[str, Decimal] = {"RUB": Decimal("1")}

        for row in root.iter():
            if not row.tag.endswith("ValuteCursOnDate"):
                continue
            char_code = self._child_text(row, "VchCode")
            nominal_raw = self._child_text(row, "Vnom") or "1"
            value_raw = self._child_text(row, "Vcurs")
            if not char_code or not value_raw:
                continue
            nominal = Decimal(nominal_raw.strip().replace(",", "."))
            value = Decimal(value_raw.strip().replace(",", "."))
            if nominal == 0:
                continue
            rates[char_code.strip().upper()] = value / nominal

        return rates

    def _parse_rates_from_xml_daily(self, root: ElementTree.Element) -> dict[str, Decimal]:
        rates: dict[str, Decimal] = {"RUB": Decimal("1")}

        for row in root.iter():
            if not row.tag.endswith("Valute"):
                continue
            char_code = self._child_text(row, "CharCode")
            nominal_raw = self._child_text(row, "Nominal") or "1"
            value_raw = self._child_text(row, "Value")
            if not char_code or not value_raw:
                continue
            nominal = Decimal(nominal_raw.strip().replace(",", "."))
            value = Decimal(value_raw.strip().replace(",", "."))
            if nominal == 0:
                continue
            rates[char_code.strip().upper()] = value / nominal

        return rates

    def _child_text(self, element: ElementTree.Element, local_name: str) -> str | None:
        for child in element:
            if child.tag.endswith(local_name):
                return child.text
        return None

