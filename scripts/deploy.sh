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
  db
  trip-db
  social-db
  context-db
  ai-db
  mongodb
  redis
  user-postgres
  trip-postgres
  social-postgres
  context-postgres
  ai-postgres
)

echo "=== [Step 1/9] Pre-flight Check: Validating environment variables ==="

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ CRITICAL ERROR: Environment file '$ENV_FILE' does not exist!"
  echo "Please create $ENV_FILE on the server before running deployment."
  exit 1
fi

get_env_val() {
  local var_name="$1"
  local env_val="${!var_name:-}"
  if [ -n "$env_val" ]; then
    echo "$env_val"
    return 0
  fi
  local file_val
  file_val=$(grep -E "^[[:space:]]*${var_name}=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d'=' -f2- | tr -d '\r"' || true)
  echo "$file_val"
}

REQUIRED_VARS=(
  "USER_DATASOURCE_URL:JDBC URL kết nối database Neon cho user-service"
  "USER_DB_USER:Username Neon PostgreSQL cho user-service"
  "USER_DB_PASS:Mật khẩu PostgreSQL cho user-service"
  "TRIP_DATASOURCE_URL:JDBC URL kết nối database Neon cho trip-service"
  "TRIP_DB_USER:Username Neon PostgreSQL cho trip-service"
  "TRIP_DB_PASS:Mật khẩu PostgreSQL cho trip-service"
  "SOCIAL_DATASOURCE_URL:JDBC URL kết nối database Neon cho social-service"
  "SOCIAL_DB_USER:Username Neon PostgreSQL cho social-service"
  "SOCIAL_DB_PASS:Mật khẩu PostgreSQL cho social-service"
  "CONTEXT_DATASOURCE_URL:JDBC URL kết nối database Neon cho context-service"
  "CONTEXT_DB_USER:Username Neon PostgreSQL cho context-service"
  "CONTEXT_DB_PASS:Mật khẩu PostgreSQL cho context-service"
  "AI_DATABASE_URL:URL kết nối database Neon cho ai-service"
  "MONGODB_URI:URI kết nối MongoDB Atlas cho place-service"
  "REDIS_URL:URL kết nối Upstash Redis"
  "JWT_ACCESS_SECRET:Khóa bí mật JWT Access Token"
  "JWT_REFRESH_SECRET:Khóa bí mật JWT Refresh Token"
  "RESEND_API_KEY:API Key Resend cho mail-service gửi email"
  "ZIOMAP_API_KEY:API Key Ziomap cho place-service bản đồ & địa điểm"
  "CLOUDINARY_CLOUD_NAME:Cloud Name Cloudinary cho social-service upload ảnh"
  "CLOUDINARY_API_KEY:API Key Cloudinary cho social-service"
  "CLOUDINARY_API_SECRET:API Secret Cloudinary cho social-service"
  "CONTEXT_ENCRYPTION_SECRET:Khóa mã hóa bảo mật dữ liệu cho context-service"
  "OPENAI_API_KEY:API Key OpenAI cho ai-service (tính năng gợi ý & chat AI)"
)

MISSING_VARS=()

for item in "${REQUIRED_VARS[@]}"; do
  var_name="${item%%:*}"
  var_desc="${item#*:}"
  val=$(get_env_val "$var_name")
  if [ -z "$val" ]; then
    MISSING_VARS+=("  ❌ ${var_name} : ${var_desc}")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo ""
  echo "================================================================================"
  echo "🚨 [PRE-FLIGHT CHECK FAILED] THIẾU BIẾN MÔI TRƯỜNG TRONG ${ENV_FILE}"
  echo "================================================================================"
  echo "Hệ thống phát hiện các biến bắt buộc sau đang BỊ THIẾU hoặc ĐỂ TRỐNG:"
  echo ""
  for missing in "${MISSING_VARS[@]}"; do
    echo "$missing"
  done
  echo ""
  echo "👉 HƯỚNG DẪN KHẮC PHỤC:"
  echo "1. SSH vào máy chủ VPS Azure."
  echo "2. Mở và chỉnh sửa file: nano ${ENV_FILE}"
  echo "3. Bổ sung các biến trên với giá trị cấu hình tương ứng."
  echo "4. Kích hoạt lại quá trình Deploy."
  echo "================================================================================"
  echo ""
  exit 1
fi

echo "✅ [Pre-flight Check] Đã kiểm tra đầy đủ các biến môi trường bắt buộc!"

if [ -z "$(get_env_val "IMAGE_TAG")" ]; then
  echo "⚠️ Cảnh báo: IMAGE_TAG chưa được đặt, mặc định sử dụng tag 'latest'"
  export IMAGE_TAG="latest"
fi

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
docker image prune -a -f

