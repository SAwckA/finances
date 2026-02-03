import logging
import logging.config
from pathlib import Path

import yaml

from app.config.env import settings


class Colors:
    """ANSI цветовые коды для терминала."""

    GREY = "\x1b[38;21m"
    BLUE = "\x1b[38;5;39m"
    YELLOW = "\x1b[38;5;226m"
    RED = "\x1b[38;5;196m"
    BOLD_RED = "\x1b[31;1m"
    RESET = "\x1b[0m"


class ColoredFormatter(logging.Formatter):
    """Форматтер с цветным выводом для консоли."""

    LEVEL_COLORS = {
        logging.DEBUG: Colors.GREY,
        logging.INFO: Colors.BLUE,
        logging.WARNING: Colors.YELLOW,
        logging.ERROR: Colors.RED,
        logging.CRITICAL: Colors.BOLD_RED,
    }

    def format(self, record: logging.LogRecord) -> str:
        color = self.LEVEL_COLORS.get(record.levelno, Colors.RESET)
        record.levelname = f"{color}{record.levelname}{Colors.RESET}"
        return super().format(record)


def setup_logging() -> None:
    """Настройка логирования через dictConfig из YAML файла."""
    config_path = Path(__file__).parent / "logging.yaml"

    with open(config_path) as f:
        config = yaml.safe_load(f)

    if not settings.debug:
        config["handlers"]["console"]["formatter"] = "standard"
        config["handlers"]["console"]["level"] = "INFO"
        config["loggers"]["app"]["level"] = "INFO"

    logging.config.dictConfig(config)

    logger = logging.getLogger(__name__)
    log_level = "DEBUG" if settings.debug else "INFO"
    logger.info(f"Logging configured via dictConfig. Level: {log_level}")
