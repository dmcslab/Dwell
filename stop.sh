#!/usr/bin/env bash
set -e
COMPOSE="docker compose"
command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null && COMPOSE="docker-compose"
echo "Stopping Cyber-Rans..."
$COMPOSE down
echo "✓ Stopped."
