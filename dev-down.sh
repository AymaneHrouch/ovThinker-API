#!/usr/bin/env bash
# Stops the backend and frontend dev servers started by dev-up.sh (matched by port).
# Leaves the mini-mongo Docker container running; stop it manually with:
#   docker stop mini-mongo

for port in 3900 3000; do
  pid=$(netstat -ano 2>/dev/null | grep "LISTENING" | grep ":$port " | awk '{print $NF}' | head -1)
  if [ -n "$pid" ]; then
    echo "Stopping process on port $port (PID $pid)..."
    MSYS_NO_PATHCONV=1 taskkill /F /PID "$pid" >/dev/null 2>&1 || echo "  Could not kill PID $pid (already gone?)"
  else
    echo "Nothing listening on port $port."
  fi
done
