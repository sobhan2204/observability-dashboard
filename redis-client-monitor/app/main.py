"""FastAPI app exposing Redis client connection data for Grafana.

Endpoints:
  GET /metrics  - Prometheus exposition (aggregate, label-free metrics)
  GET /clients  - JSON array of per-client detail, for Grafana's JSON
                  API/Infinity datasource (table, bar-by-IP, pie-by-user panels)
  GET /health   - liveness/readiness probe
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.config import settings
from app.logging_config import configure_logging
from app.metrics import client_store, poll_loop
from app.redis_client import RedisClientMonitor

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    monitor = RedisClientMonitor()
    stop_event = asyncio.Event()
    poller_task = asyncio.create_task(poll_loop(monitor, stop_event))
    logger.info(
        "Started Redis client monitor: target=%s:%s poll_interval=%ss",
        settings.redis_host,
        settings.redis_port,
        settings.poll_interval_seconds,
    )
    try:
        yield
    finally:
        stop_event.set()
        poller_task.cancel()
        try:
            await poller_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
        monitor.close()
        logger.info("Redis client monitor stopped")


app = FastAPI(
    title="Redis Client Monitor",
    description="Exposes detailed Redis CLIENT LIST data for Grafana dashboards.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/metrics")
def metrics() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/clients")
def clients() -> list[dict]:
    entries, _ = client_store.get()
    return [c.to_dict() for c in entries]


@app.get("/health")
def health() -> dict:
    entries, last_updated = client_store.get()
    return {
        "status": "ok",
        "clients_tracked": len(entries),
        "last_updated": last_updated,
    }
