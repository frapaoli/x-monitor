#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[start]${NC} $1"; }
ok()   { echo -e "${GREEN}[  ok ]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn ]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ── Pre-flight checks ────────────────────────────────────────────────

log "Checking prerequisites..."

[[ -f .env ]] || err ".env file not found. Copy .env.example to .env and fill in your keys."

command -v docker  >/dev/null 2>&1 || err "docker is not installed."
command -v npm     >/dev/null 2>&1 || err "npm is not installed."

# Verify Docker daemon is running
docker info >/dev/null 2>&1 || err "Docker daemon is not running. Please start Docker first."

ok "All prerequisites met."

# ── Create required directories ──────────────────────────────────────

mkdir -p data/media
mkdir -p frontend/dist

# ── Build frontend ───────────────────────────────────────────────────

log "Installing frontend dependencies..."
npm ci --prefix frontend

log "Building frontend..."
npm run build --prefix frontend

ok "Frontend built to frontend/dist/"

# ── Start Docker services ────────────────────────────────────────────

log "Building and starting Docker containers..."
docker compose up --build -d

log "Waiting for services to be healthy..."

# Wait for the backend to respond (up to 60s)
max_wait=60
elapsed=0
until curl -sf http://localhost:8008/api/health >/dev/null 2>&1; do
  if (( elapsed >= max_wait )); then
    warn "Backend did not become healthy within ${max_wait}s."
    warn "Check logs with: docker compose logs backend"
    break
  fi
  sleep 2
  (( elapsed += 2 ))
done

if (( elapsed < max_wait )); then
  ok "Backend is healthy."
fi

# ── Start frontend dev server ────────────────────────────────────────

log "Starting frontend dev server..."
npm run dev --prefix frontend &
FRONTEND_PID=$!

# ── Summary ──────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  X Monitor v2 is running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend (dev):  ${CYAN}http://localhost:5173${NC}"
echo -e "  Backend API:     ${CYAN}http://localhost:8008${NC}"
echo -e "  Nginx proxy:     ${CYAN}http://localhost${NC}"
echo ""
echo -e "  Useful commands:"
echo -e "    docker compose logs -f backend   ${YELLOW}# backend logs${NC}"
echo -e "    docker compose logs -f db        ${YELLOW}# database logs${NC}"
echo -e "    docker compose down              ${YELLOW}# stop all containers${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop the frontend dev server."
echo ""

# Keep the script alive until the frontend dev server exits
wait $FRONTEND_PID
