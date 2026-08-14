#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${TRIPSENSE_DEPLOY_DIR:-/opt/tripsense}"
DEPLOY_DIR="$BASE_DIR/deploy"
ENV_FILE="$BASE_DIR/.env"

cd "$DEPLOY_DIR"

echo "=== Pulling Docker images ==="
docker compose --env-file "$ENV_FILE" pull

echo "=== Starting TripSense ==="
docker compose --env-file "$ENV_FILE" up -d --remove-orphans

echo "=== Container status ==="
docker compose --env-file "$ENV_FILE" ps

echo "=== Cleaning old Docker images ==="
docker image prune -f

echo "=== Deployment completed ==="