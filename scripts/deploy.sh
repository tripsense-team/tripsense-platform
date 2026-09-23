#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${TRIPSENSE_DEPLOY_DIR:-/opt/tripsense}"
DEPLOY_DIR="$BASE_DIR/deploy"
ENV_FILE="$BASE_DIR/.env"
PROJECT_NAME="${TRIPSENSE_COMPOSE_PROJECT:-tripsense}"
LEGACY_PROJECT_NAME="${TRIPSENSE_LEGACY_COMPOSE_PROJECT:-deploy}"
LEGACY_CONTAINERS=(
  api-gateway
  discovery-server
  email-service
  mail-service
  place-service
  trip-service
  user-service
  social-service
  context-service
)

cd "$DEPLOY_DIR"

echo "=== Stop legacy compose project, if present ==="
docker compose -p "$LEGACY_PROJECT_NAME" --env-file "$ENV_FILE" down --remove-orphans || true

echo "=== Stop legacy standalone containers, if present ==="
for container in "${LEGACY_CONTAINERS[@]}"; do
  if docker container inspect "$container" >/dev/null 2>&1; then
    docker stop "$container" || true
    docker rm "$container" || true
  fi
done

echo "=== Pull Docker images ==="
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" pull

echo "=== Start containers ==="
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --remove-orphans

echo "=== Waiting for core services to become healthy (Zero-Downtime Guard) ==="
MAX_WAIT_SECONDS=120
WAIT_INTERVAL=5
ELAPSED=0

check_health() {
  local service_name="$1"
  local status
  status=$(docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" ps "$service_name" --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | head -n 1 | cut -d'"' -f4 || true)
  if [ -z "$status" ]; then
    local cid
    cid=$(docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" ps -q "$service_name" 2>/dev/null || true)
    if [ -n "$cid" ]; then
      status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo "starting")
    else
      status="not_found"
    fi
  fi
  echo "$status"
}

until [ "$ELAPSED" -ge "$MAX_WAIT_SECONDS" ]; do
  WEB_HEALTH=$(check_health "web")
  GW_HEALTH=$(check_health "api-gateway")

  echo "[Waiting ${ELAPSED}s/${MAX_WAIT_SECONDS}s] web: ${WEB_HEALTH}, api-gateway: ${GW_HEALTH}"

  if [ "$WEB_HEALTH" = "healthy" ] && [ "$GW_HEALTH" = "healthy" ]; then
    echo "=== Core services are HEALTHY and ready to serve traffic! ==="
    break
  fi

  sleep "$WAIT_INTERVAL"
  ELAPSED=$((ELAPSED + WAIT_INTERVAL))
done

if [ "$ELAPSED" -ge "$MAX_WAIT_SECONDS" ]; then
  echo "❌ Error: Timed out waiting for core services to become healthy after ${MAX_WAIT_SECONDS}s!"
  echo "=== Container logs snapshot for debugging ==="
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" logs --tail=50 web api-gateway || true
  exit 1
fi

echo "=== Reload reverse proxy (Zero-Downtime) ==="
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" exec -T nginx nginx -s reload || docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --force-recreate --no-deps nginx

echo "=== Deployment status ==="
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" ps

echo "=== Docker resource snapshot ==="
docker stats --no-stream || true

echo "=== Clean unused images ==="
docker image prune -f
