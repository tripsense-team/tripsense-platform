#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${TRIPSENSE_DEPLOY_DIR:-/opt/tripsense}"
DEPLOY_DIR="$BASE_DIR/deploy"
ENV_FILE="$BASE_DIR/.env"

cd "$DEPLOY_DIR"

echo "=== Pull Docker images ==="
docker compose --env-file "$ENV_FILE" pull

echo "=== Start containers ==="
docker compose --env-file "$ENV_FILE" up -d --remove-orphans

echo "=== Deployment status ==="
docker compose --env-file "$ENV_FILE" ps

echo "=== Clean unused images ==="
docker image prune -f