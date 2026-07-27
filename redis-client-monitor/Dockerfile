FROM python:3.12-slim

WORKDIR /app

# Keep the image lean and reproducible: only install what's pinned.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Runs as a non-root user for defense in depth.
RUN useradd --no-create-home --uid 1000 monitor
USER monitor

EXPOSE 8001

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health', timeout=2)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
