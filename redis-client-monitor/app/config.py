"""Environment-driven configuration for the Redis client monitor."""
import os
from dataclasses import dataclass


def _bool_env(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    redis_username: str | None = os.getenv("REDIS_USERNAME") or None
    redis_password: str | None = os.getenv("REDIS_PASSWORD") or None
    redis_tls: bool = _bool_env("REDIS_TLS", False)
    redis_socket_timeout: float = float(os.getenv("REDIS_SOCKET_TIMEOUT", "3"))

    poll_interval_seconds: float = float(os.getenv("POLL_INTERVAL_SECONDS", "5"))
    reconnect_backoff_min_seconds: float = float(os.getenv("RECONNECT_BACKOFF_MIN", "1"))
    reconnect_backoff_max_seconds: float = float(os.getenv("RECONNECT_BACKOFF_MAX", "30"))

    http_host: str = os.getenv("HTTP_HOST", "0.0.0.0")
    http_port: int = int(os.getenv("HTTP_PORT", "8001"))

    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()


settings = Settings()
