#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${TRIPSENSE_DEPLOY_DIR:-/opt/tripsense}/deploy"

cd "$DEPLOY_DIR"

docker compose --env-file .env pull
docker compose --env-file .env up -d
docker image prune -f
