#!/usr/bin/env bash
# upgrade.sh — safe Dwell upgrade script
# Run from the repo root: ./upgrade.sh
set -e

REPO_URL="https://github.com/dmcslab/Dwell.git"
BRANCH="main"

GREEN='\033[0;32m' CYAN='\033[0;36m' YELLOW='\033[1;33m' RED='\033[0;31m' NC='\033[0m'
info()    { echo -e "${CYAN}▶  $*${NC}"; }
success() { echo -e "${GREEN}✓  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $*${NC}"; }
error()   { echo -e "${RED}✗  $*${NC}"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Dwell — Upgrade Check                  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Pre-flight ────────────────────────────────────────────────────────────────
command -v docker &>/dev/null  || error "Docker not found."
command -v git    &>/dev/null  || error "Git not found."
docker info &>/dev/null 2>&1   || error "Docker daemon is not running."
[ -f "docker-compose.yml" ]    || error "Run this script from the Dwell repo root."

docker compose version &>/dev/null 2>&1 && COMPOSE="docker compose" || COMPOSE="docker-compose"

# Ensure the remote is pointing at the correct repo
git remote set-url origin "$REPO_URL" 2>/dev/null || true

# ── Step 1: Check for remote updates ─────────────────────────────────────────
info "Checking for updates from $REPO_URL..."

if ! git fetch origin "$BRANCH" 2>/dev/null; then
    warn "Could not reach GitHub. Check your internet connection."
    warn "Your current installation is unchanged."
    exit 0
fi

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   You are already on the latest version! ║${NC}"
    echo -e "${GREEN}║   No upgrade needed.                     ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    exit 0
fi

# Show incoming changes
echo ""
info "Updates available:"
git log HEAD.."origin/$BRANCH" --oneline | while IFS= read -r line; do
    echo -e "   ${CYAN}•${NC} $line"
done
echo ""

# ── Step 2: Back up .env ──────────────────────────────────────────────────────
ENV_FILE="backend/.env"
ENV_BACKUP="backend/.env.upgrade-backup"

if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "$ENV_BACKUP"
    success "Backed up $ENV_FILE → $ENV_BACKUP"
else
    warn "No $ENV_FILE found — skipping backup."
fi

# ── Step 3: Snapshot worker file hashes before pull ──────────────────────────
WORKER_HASH_BEFORE=""
if [ -f "scenario-worker/Dockerfile" ]; then
    WORKER_HASH_BEFORE=$(find scenario-worker/ backend/app/game/logic.py \
        -type f 2>/dev/null | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)
fi

# ── Step 4: Stop containers (volumes are never touched) ───────────────────────
info "Stopping containers (your data is preserved)..."
$COMPOSE down
success "Containers stopped."

# ── Step 5: Pull updates ──────────────────────────────────────────────────────
info "Downloading updates..."
git pull origin "$BRANCH"
success "Code updated."

# ── Step 6: Restore .env if the pull overwrote it ────────────────────────────
if [ -f "$ENV_BACKUP" ]; then
    if ! diff -q "$ENV_FILE" "$ENV_BACKUP" &>/dev/null 2>&1; then
        warn ".env was modified by the update — restoring your configuration."
        cp "$ENV_BACKUP" "$ENV_FILE"
        success "Your configuration restored."
    else
        success ".env unchanged — no restore needed."
    fi
fi

# ── Step 7: Rebuild images and restart ───────────────────────────────────────
info "Rebuilding and restarting services..."
$COMPOSE up -d --build
success "Services restarted."

# ── Step 8: Rebuild scenario-worker image only if its files changed ───────────
WORKER_HASH_AFTER=""
if [ -f "scenario-worker/Dockerfile" ]; then
    WORKER_HASH_AFTER=$(find scenario-worker/ backend/app/game/logic.py \
        -type f 2>/dev/null | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)
fi

if [ -n "$WORKER_HASH_BEFORE" ] && [ "$WORKER_HASH_BEFORE" != "$WORKER_HASH_AFTER" ]; then
    info "Scenario-worker files changed — rebuilding worker image..."
    ./build_worker.sh
    success "Scenario-worker image rebuilt."
else
    success "Scenario-worker unchanged — skipping rebuild."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Upgrade complete!                      ║${NC}"
echo -e "${GREEN}║   Open: http://localhost:5173            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
success "Backup kept at $ENV_BACKUP — safe to delete once you've verified the app."
