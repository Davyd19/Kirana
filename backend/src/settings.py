"""MySQL connection settings for the backend."""

import os
from pathlib import Path

from dotenv import dotenv_values

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def environment():
    local = dotenv_values(ENV_FILE, encoding="utf-8-sig", interpolate=False)
    settings = {**{key: value for key, value in local.items() if value is not None}, **os.environ}
    return settings


def database_settings():
    settings = environment()
    return {
        "host": settings.get("KIRANA_DB_HOST", "127.0.0.1"),
        "port": int(settings.get("KIRANA_DB_PORT", "3306")),
        "user": settings.get("KIRANA_DB_USER", "kirana"),
        "password": settings.get("KIRANA_DB_PASSWORD", ""),
        "database": settings.get("KIRANA_DB_NAME", "kirana"),
    }
