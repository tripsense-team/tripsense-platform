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

echo "=== Deployment status ==="
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" ps

echo "=== Docker resource snapshot ==="
docker stats --no-stream || true

echo "=== Clean unused images ==="
docker image prune -f
