#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Cyber-Rans — one-command launcher
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m' CYAN='\033[0;36m' YELLOW='\033[1;33m' RED='\033[0;31m' NC='\033[0m'
info()    { echo -e "${CYAN}▶  $*${NC}"; }
success() { echo -e "${GREEN}✓  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $*${NC}"; }
error()   { echo -e "${RED}✗  $*${NC}"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Cyber-Rans IR Training Platform          ║${NC}"
echo -e "${CYAN}║     by dMCSlab                               ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  error "Docker is not installed. Download it from https://docs.docker.com/get-docker/"
fi

# Check Docker daemon is running
if ! docker info &>/dev/null 2>&1; then
  error "Docker is not running. Please start Docker Desktop (or the Docker daemon) and try again."
fi

# Check docker compose (v2 plugin or standalone)
if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  error "docker compose not found. Update Docker Desktop or install the Compose plugin."
fi

success "Docker is running"

# Stop any existing containers gracefully
if $COMPOSE ps --quiet 2>/dev/null | grep -q .; then
  info "Stopping existing containers..."
  $COMPOSE down --remove-orphans
fi

# Build and start
info "Building images (this takes ~2 minutes on first run)..."
$COMPOSE build --quiet

info "Starting all services..."
$COMPOSE up -d

# Wait for frontend to be ready
info "Waiting for application to be ready..."
TIMEOUT=90
ELAPSED=0
until curl -sf http://localhost:5173 >/dev/null 2>&1; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  if [ $ELAPSED -ge $TIMEOUT ]; then
    warn "Startup is taking longer than expected."
    warn "Check logs with: docker compose logs -f"
    break
  fi
done

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   🟢  Cyber-Rans is running!                 ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   Open in browser:                           ║${NC}"
echo -e "${GREEN}║   👉  http://localhost:5173                  ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   Default admin login:                       ║${NC}"
echo -e "${GREEN}║   User:  admin                               ║${NC}"
echo -e "${GREEN}║   Pass:  CyberRans!Change123                 ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   To stop:  ./stop.sh  (or Ctrl+C)          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
