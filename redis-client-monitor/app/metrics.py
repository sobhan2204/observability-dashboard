"""Prometheus metrics and the background poller that keeps them fresh.

Per-client detail (id, ip, name, ...) is intentionally NOT exposed as
Prometheus labels: each of those is effectively unbounded cardinality and
would blow up Prometheus' series count as clients churn. Aggregate,
label-free metrics go here; per-client detail is served separately via the
/clients JSON endpoint (see main.py) for Grafana's JSON API/Infinity
datasource to consume.
"""
import asyncio
import logging
import threading
import time

from prometheus_client import Counter, Gauge, Histogram

from app.config import settings
from app.redis_client import ClientInfo, RedisClientMonitor, compute_backoff

logger = logging.getLogger(__name__)

redis_connected_clients_total = Gauge(
    "redis_connected_clients_total",
    "Number of clients currently connected to Redis, as seen by CLIENT LIST.",
)

redis_client_connection_age_seconds = Histogram(
    "redis_client_connection_age_seconds",
    "Distribution of connection age (seconds) across currently connected clients, "
    "sampled on each poll.",
    buckets=(1, 5, 15, 30, 60, 300, 900, 1800, 3600, 86400),
)

redis_client_idle_seconds = Histogram(
    "redis_client_idle_seconds",
    "Distribution of idle time (seconds) across currently connected clients, "
    "sampled on each poll.",
    buckets=(0, 1, 5, 15, 30, 60, 300, 900, 3600),
)

redis_client_monitor_scrape_errors_total = Counter(
    "redis_client_monitor_scrape_errors_total",
    "Number of failed attempts to poll Redis via CLIENT LIST.",
)

redis_client_monitor_last_scrape_timestamp_seconds = Gauge(
    "redis_client_monitor_last_scrape_timestamp_seconds",
    "Unix timestamp of the last successful CLIENT LIST poll.",
)

redis_client_monitor_up = Gauge(
    "redis_client_monitor_up",
    "Whether the last poll of Redis succeeded (1) or failed (0).",
)


class ClientStore:
    """Thread-safe holder for the most recent CLIENT LIST snapshot.

    A plain lock (not asyncio primitives) because the poller runs the blocking
    redis-py call in a worker thread via asyncio.to_thread, and this store is
    read from the async HTTP handlers too.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._clients: list[ClientInfo] = []
        self._last_updated: float | None = None

    def set(self, clients: list[ClientInfo]) -> None:
        with self._lock:
            self._clients = clients
            self._last_updated = time.time()

    def get(self) -> tuple[list[ClientInfo], float | None]:
        with self._lock:
            return list(self._clients), self._last_updated


client_store = ClientStore()


def _update_metrics(clients: list[ClientInfo]) -> None:
    redis_connected_clients_total.set(len(clients))
    for client in clients:
        redis_client_connection_age_seconds.observe(client.age)
        redis_client_idle_seconds.observe(client.idle)
    redis_client_monitor_last_scrape_timestamp_seconds.set(time.time())
    redis_client_monitor_up.set(1)


async def poll_loop(monitor: RedisClientMonitor, stop_event: asyncio.Event) -> None:
    """Poll CLIENT LIST on a fixed interval until stop_event is set.

    On failure, invalidates the connection and backs off exponentially (capped)
    before retrying, so a Redis restart or blip doesn't spin the poller.
    """
    attempt = 0
    while not stop_event.is_set():
        try:
            clients = await asyncio.to_thread(monitor.fetch_clients)
            client_store.set(clients)
            _update_metrics(clients)
            attempt = 0
            await asyncio.wait_for(stop_event.wait(), timeout=settings.poll_interval_seconds)
        except asyncio.TimeoutError:
            continue
        except Exception as exc:  # noqa: BLE001 - keep the poller alive
            redis_client_monitor_scrape_errors_total.inc()
            redis_client_monitor_up.set(0)
            monitor.invalidate()
            delay = compute_backoff(attempt)
            attempt += 1
            logger.error(
                "Failed to poll Redis CLIENT LIST (attempt %d), retrying in %.1fs: %s",
                attempt,
                delay,
                exc,
            )
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=delay)
            except asyncio.TimeoutError:
                continue
