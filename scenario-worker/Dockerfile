# ── Build stage ──────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM python:3.12-slim
RUN addgroup --system worker && adduser --system --ingroup worker worker
WORKDIR /app
COPY --from=builder /install /usr/local
COPY app/ ./app/
USER worker
EXPOSE 8765
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${WORKER_PORT:-8765}"]
