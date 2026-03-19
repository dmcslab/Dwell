#!/bin/sh
set -e

echo "[entrypoint] Waiting for PostgreSQL..."
until pg_isready -h db -p 5432 -U cyber -d cyberrans -q; do
  sleep 1
done
echo "[entrypoint] PostgreSQL ready."

echo "[entrypoint] Running migrations..."
alembic upgrade head

echo "[entrypoint] Seeding admin..."
python scripts/seed_admin.py

echo "[entrypoint] Seeding scenarios..."
python scripts/seed_scenarios.py

echo "[entrypoint] Starting server..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --proxy-headers \
  --forwarded-allow-ips="*"
