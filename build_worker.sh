#!/usr/bin/env bash
# build_worker.sh — builds the scenario-worker image from the repo root.
#
# Must be run from the repo root (same directory as this script) because the
# Dockerfile references both scenario-worker/ and backend/ paths.
#
# Usage:
#   ./build_worker.sh              # builds dwell_scenario_worker:latest
#   ./build_worker.sh --no-cache   # force clean rebuild
#
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

TAG="dwell_scenario_worker:latest"
DOCKERFILE="scenario-worker/Dockerfile"

echo "Building $TAG from repo root..."
docker build -f "$DOCKERFILE" "${@}" -t "$TAG" .
echo "✓ $TAG built successfully"
