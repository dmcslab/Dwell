# Build context: repo root  (docker build -f scenario-worker/Dockerfile .)
# This lets us COPY backend/app/game/logic.py directly, eliminating the
# duplicate copy that previously lived at scenario-worker/app/logic.py.
# The single source of truth is backend/app/game/logic.py.

# ── Build stage ───────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /build
COPY scenario-worker/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM python:3.12-slim
RUN addgroup --system worker && adduser --system --ingroup worker worker
WORKDIR /app
COPY --from=builder /install /usr/local

# Worker application code
COPY scenario-worker/app/ ./app/

# Single source of truth for game logic — pulled directly from the backend.
# No separate copy to maintain or keep in sync.
COPY backend/app/game/logic.py ./app/logic.py

USER worker
EXPOSE 8765
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${WORKER_PORT:-8765}"]
