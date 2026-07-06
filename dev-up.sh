#!/usr/bin/env bash
# Spins up Mongo (Docker), seeds it with a dev user + sample journal entries,
# then launches the backend and frontend dev servers in the background.
#
# Usage: ./dev-up.sh
# Safe to re-run: reuses the Mongo container, reseeds journals for the dev user.
# Stop everything with ./dev-down.sh

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$BACKEND_DIR/../aymanediary"
MONGO_CONTAINER="mini-mongo"
MONGO_IMAGE="mongo:4.4"
JWT_SECRET="dev_jwt_secret"
DB_URI="mongodb://localhost/mini"
LOG_DIR="$BACKEND_DIR/.dev-logs"

mkdir -p "$LOG_DIR"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Expected frontend checkout at $FRONTEND_DIR but it doesn't exist. Edit FRONTEND_DIR in this script." >&2
  exit 1
fi

# 1. MongoDB via Docker
if docker ps -a --format '{{.Names}}' | grep -qx "$MONGO_CONTAINER"; then
  if docker ps --format '{{.Names}}' | grep -qx "$MONGO_CONTAINER"; then
    echo "MongoDB container already running."
  else
    echo "Starting existing MongoDB container '$MONGO_CONTAINER'..."
    docker start "$MONGO_CONTAINER" >/dev/null
    sleep 3
  fi
else
  echo "Creating MongoDB container '$MONGO_CONTAINER'..."
  docker run -d --name "$MONGO_CONTAINER" -p 27017:27017 "$MONGO_IMAGE" >/dev/null
  echo "Waiting for MongoDB to accept connections..."
  sleep 6
fi

export mini_jwtPrivateKey="$JWT_SECRET"
export mini_db="$DB_URI"

# 2. Seed the database (idempotent: reuses/creates dev@example.com, reseeds journals)
echo "Seeding database..."
(cd "$BACKEND_DIR" && node scripts/seed.js)

# 3. Warn (don't fight it) if the ports are already taken
for port in 3900 3000; do
  pid=$(netstat -ano 2>/dev/null | grep "LISTENING" | grep ":$port " | awk '{print $NF}' | head -1 || true)
  if [ -n "${pid:-}" ]; then
    echo "Warning: port $port is already in use (PID $pid). Run ./dev-down.sh first for a clean start."
  fi
done

# 4. Backend dev server in the background
echo "Starting backend on http://localhost:3900 ..."
(cd "$BACKEND_DIR" && nohup npm start > "$LOG_DIR/backend.log" 2>&1 &)

# 5. Frontend dev server in the background (install deps first if missing, skip browser auto-open)
# NODE_OPTIONS=--openssl-legacy-provider works around react-scripts@4/webpack4's
# incompatibility with OpenSSL 3 on modern Node (Node 17+).
echo "Starting frontend on http://localhost:3000 ..."
(cd "$FRONTEND_DIR" && [ -d node_modules ] || npm install
 cd "$FRONTEND_DIR" && BROWSER=none NODE_OPTIONS=--openssl-legacy-provider nohup npm start > "$LOG_DIR/frontend.log" 2>&1 &)

sleep 1
echo ""
echo "Dev environment starting up:"
echo "  Backend:  http://localhost:3900   (log: $LOG_DIR/backend.log)"
echo "  Frontend: http://localhost:3000   (log: $LOG_DIR/frontend.log)"
echo "  Login:    aymane@hrouch.com / password123"
echo ""
echo "Tail logs with: tail -f $LOG_DIR/backend.log $LOG_DIR/frontend.log"
echo "Stop everything with: ./dev-down.sh"
