"""Redis connection management and CLIENT LIST parsing.

We use redis-py's native CLIENT LIST support rather than shelling out to the
`redis-cli` binary: it talks RESP directly over the existing connection pool,
avoids subprocess overhead per poll, and sidesteps any shell-quoting/injection
concerns entirely. redis-py already tokenizes the "key=value" pairs CLIENT
LIST returns into a list of dicts, so this module's job is to normalize that
into the shape the rest of the service expects (typed fields, ip/port split,
consistent keys across Redis versions).
"""
import logging
from dataclasses import asdict, dataclass
from typing import Any

import redis

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ClientInfo:
    id: int
    name: str
    user: str
    ip: str
    port: int
    db: int
    age: int
    idle: int
    flags: str
    resp: str | None
    last_command: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _split_addr(addr: str) -> tuple[str, int]:
    """Split a 'host:port' address, tolerating IPv6 (e.g. '[::1]:6379')."""
    if not addr:
        return "", 0
    host, _, port = addr.rpartition(":")
    if not host:
        host = addr
        port = "0"
    host = host.strip("[]")
    try:
        return host, int(port)
    except ValueError:
        return host, 0


def parse_client_entry(raw: dict[str, Any]) -> ClientInfo:
    ip, port = _split_addr(raw.get("addr", ""))
    return ClientInfo(
        id=int(raw.get("id", 0)),
        name=raw.get("name", "") or "",
        user=raw.get("user", "") or "default",
        ip=ip,
        port=port,
        db=int(raw.get("db", 0)),
        age=int(raw.get("age", 0)),
        idle=int(raw.get("idle", 0)),
        flags=raw.get("flags", "") or "",
        resp=raw.get("resp"),
        last_command=raw.get("cmd", "") or "",
    )


class RedisClientMonitor:
    """Owns the Redis connection and knows how to fetch+parse CLIENT LIST.

    Reconnection is handled lazily: `fetch_clients` raises on failure, and the
    caller (the poller loop) is responsible for backoff between retries. This
    keeps connection-lifecycle policy in one place instead of scattering
    retry loops across both this class and the poller.
    """

    def __init__(self) -> None:
        self._redis: redis.Redis | None = None

    def _build_client(self) -> redis.Redis:
        return redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            username=settings.redis_username,
            password=settings.redis_password,
            ssl=settings.redis_tls,
            socket_timeout=settings.redis_socket_timeout,
            socket_connect_timeout=settings.redis_socket_timeout,
            decode_responses=True,
            health_check_interval=30,
        )

    def _ensure_connected(self) -> redis.Redis:
        if self._redis is None:
            self._redis = self._build_client()
        return self._redis

    def fetch_clients(self) -> list[ClientInfo]:
        client = self._ensure_connected()
        raw_entries = client.client_list()
        return [parse_client_entry(entry) for entry in raw_entries]

    def close(self) -> None:
        if self._redis is not None:
            try:
                self._redis.close()
            except Exception:  # noqa: BLE001 - best-effort cleanup
                logger.debug("Error closing Redis connection", exc_info=True)
            self._redis = None

    def invalidate(self) -> None:
        """Drop the current connection so the next fetch reconnects from scratch."""
        self.close()


def compute_backoff(attempt: int) -> float:
    delay = settings.reconnect_backoff_min_seconds * (2 ** attempt)
    return min(delay, settings.reconnect_backoff_max_seconds)
