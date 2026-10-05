#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${TRIPSENSE_DEPLOY_DIR:-/opt/tripsense}"
DEPLOY_DIR="$BASE_DIR/deploy"
ENV_FILE="$BASE_DIR/.env"
PROJECT_NAME="${TRIPSENSE_COMPOSE_PROJECT:-tripsense}"
STATE_FILE="$BASE_DIR/.last_stable_tag"

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
  "RECOMMENDATION_DATASOURCE_URL:JDBC URL kết nối database Neon cho recommendation-service"
  "RECOMMENDATION_DB_USER:Username Neon PostgreSQL cho recommendation-service"
  "RECOMMENDATION_DB_PASS:Mật khẩu PostgreSQL cho recommendation-service"
  "JWT_ACCESS_SECRET:Khóa bí mật JWT Access Token"
  "JWT_REFRESH_SECRET:Khóa bí mật JWT Refresh Token"
  "RESEND_API_KEY:API Key Resend cho mail-service gửi email"
  "ZIOMAP_API_KEY:API Key Ziomap cho place-service bản đồ & địa điểm"
  "CLOUDINARY_CLOUD_NAME:Cloud Name Cloudinary cho social-service upload ảnh"
  "CLOUDINARY_API_KEY:API Key Cloudinary cho social-service"
  "CLOUDINARY_API_SECRET:API Secret Cloudinary cho social-service"
  "CONTEXT_ENCRYPTION_SECRET:Khóa mã hóa bảo mật dữ liệu cho context-service"
  "AI_TRIP_COMMIT_SECRET:Khóa bí mật HMAC ký kết lưu lịch trình giữa ai-service và trip-service"
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

PREV_STABLE_TAG=""
if [ -f "$STATE_FILE" ]; then
  PREV_STABLE_TAG=$(cat "$STATE_FILE" 2>/dev/null | tr -d '[:space:]' || true)
  if [ -n "$PREV_STABLE_TAG" ]; then
    echo "ℹ️ [State] Phiên bản ổn định trước đó: $PREV_STABLE_TAG"
  fi
fi

cd "$DEPLOY_DIR"


echo "=== Pull Docker images ==="
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" pull

# ==============================================================================
# Healthcheck & Readiness Helper Functions
# ==============================================================================

check_service_health() {
  local service_name="$1"
  local cid
  cid=$(docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" ps -q "$service_name" 2>/dev/null || true)
  if [ -z "$cid" ]; then
    echo "not_found"
    return 0
  fi
  local status
  status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo "unknown")
  if [ -z "$status" ]; then
    status="unknown"
  fi
  echo "$status"
}

is_eureka_registered() {
  local service_name="$1"
  local app_name
  app_name=$(echo "$service_name" | tr '[:lower:]' '[:upper:]')
  local disc_cid
  disc_cid=$(docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" ps -q "discovery-server" 2>/dev/null || true)
  if [ -z "$disc_cid" ]; then
    return 1
  fi
  local res
  res=$(docker exec "$disc_cid" curl -fsS "http://localhost:8761/eureka/apps/${app_name}" 2>/dev/null || true)
  if echo "$res" | grep -q "<status>UP</status>"; then
    return 0
  else
    return 1
  fi
}

is_service_ready() {
  local service_name="$1"
  local status
  status=$(check_service_health "$service_name")

  case "$status" in
    healthy)
      return 0
      ;;
    unhealthy|exited|dead)
      return 2
      ;;
    starting)
      return 1
      ;;
    running)
      case "$service_name" in
        user-service|trip-service|place-service|mail-service|context-service|social-service)
          if is_eureka_registered "$service_name"; then
            return 0
          else
            return 1
          fi
          ;;
        *)
          return 0
          ;;
      esac
      ;;
    *)
      return 1
      ;;
  esac
}

wait_for_services() {
  local timeout="$1"
  shift
  local services=("$@")
  local interval=5
  local elapsed=0

  echo "⏳ Waiting up to ${timeout}s for service(s): ${services[*]}..."

  while [ "$elapsed" -lt "$timeout" ]; do
    local all_ready=true
    local status_line=""

    for svc in "${services[@]}"; do
      local raw_status
      raw_status=$(check_service_health "$svc")

      if [ "$raw_status" = "unhealthy" ] || [ "$raw_status" = "exited" ] || [ "$raw_status" = "dead" ]; then
        echo ""
        echo "❌ CRITICAL: Service '$svc' failed with status: '$raw_status'!"
        echo "=== Container logs for $svc (last 50 lines) ==="
        docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" logs --tail=50 "$svc" || true
        return 1
      fi

      if is_service_ready "$svc"; then
        status_line+="$svc(ready) "
      else
        # Fallback: If container is alive without crashing (either running or starting) and has been up for a reasonable duration
        if { [ "$raw_status" = "running" ] && [ "$elapsed" -ge 45 ]; } || \
           { [ "$raw_status" = "starting" ] && [ "$elapsed" -ge 75 ]; }; then
          status_line+="$svc(alive-fallback) "
        else
          all_ready=false
          status_line+="$svc($raw_status) "
        fi
      fi
    done

    if [ "$all_ready" = true ]; then
      echo "✅ Services ready: ${services[*]} (${elapsed}s elapsed)"
      return 0
    fi

    echo "   [+${elapsed}s/${timeout}s] Status: $status_line"
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done

  echo ""
  echo "❌ Error: Timed out waiting for services after ${timeout}s: ${services[*]}"
  for svc in "${services[@]}"; do
    echo "=== Last 30 lines of logs for $svc ==="
    docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" logs --tail=30 "$svc" || true
  done
  return 1
}

# ==============================================================================
# Automated Rollback Engine (Zero-Downtime Guard)
# ==============================================================================

ROLLBACK_ACTIVE=false

rollback_deployment() {
  local exit_code=$?
  if [ "$exit_code" -eq 0 ] || [ "$ROLLBACK_ACTIVE" = true ]; then
    return 0
  fi

  ROLLBACK_ACTIVE=true
  echo ""
  echo "================================================================================"
  echo "🚨 [DEPLOYMENT FAILED] Quá trình triển khai gặp sự cố (Exit code: $exit_code)!"
  echo "================================================================================"

  if [ -n "$PREV_STABLE_TAG" ] && [ "$PREV_STABLE_TAG" != "$IMAGE_TAG" ]; then
    echo "🔄 [AUTO-ROLLBACK] Đang tiến hành tự động hoàn nguyên về phiên bản ổn định:"
    echo "   Target Stable Tag: $PREV_STABLE_TAG"
    echo "================================================================================"

    local failed_tag="$IMAGE_TAG"
    export IMAGE_TAG="$PREV_STABLE_TAG"

    echo "--> [Rollback] Khởi động lại toàn bộ dịch vụ bằng image tag $PREV_STABLE_TAG..."
    docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --no-deps \
      discovery-server place-service mail-service user-service context-service trip-service ai-service \
      social-service recommendation-service api-gateway web nginx certbot || true

    echo "--> [Rollback] Kiểm tra sức khỏe hệ thống sau hoàn nguyên..."
    if wait_for_services 90 web api-gateway nginx; then
      echo ""
      echo "✅ [AUTO-ROLLBACK SUCCESS] Hệ thống đã được hoàn nguyên về phiên bản $PREV_STABLE_TAG thành công!"
      echo "   Website và API đang hoạt động bình thường trên phiên bản ổn định cũ."
      echo "⚠️ Chú ý: Bản deploy mới ($failed_tag) bị lỗi và đã bị hủy bỏ."
    else
      echo ""
      echo "❌ [AUTO-ROLLBACK FAILED] Không thể tự động hoàn nguyên về $PREV_STABLE_TAG. Cần kỹ sư can thiệp kiểm tra thủ công!"
    fi
  else
    echo "⚠️ [NO ROLLBACK TARGET] Không có phiên bản ổn định trước đó (lần deploy đầu tiên hoặc trùng tag)."
    echo "   Không thể tự động rollback. Vui lòng kiểm tra log lỗi bên trên."
  fi

  exit "$exit_code"
}

trap rollback_deployment EXIT ERR

echo "=== Start containers in waves (Prevent CPU Starvation & Dependency Cascade) ==="

# Wave 1: Service Discovery
echo "--> [Wave 1/6] Starting Discovery Server..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --no-deps discovery-server
wait_for_services 90 discovery-server

# Wave 2: Core Data Services & AI
echo "--> [Wave 2/6] Starting Core Backend & AI Services..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --no-deps \
  place-service mail-service user-service context-service trip-service ai-service
wait_for_services 120 place-service mail-service user-service context-service trip-service ai-service

# Wave 3: Heavy Composite Services (Recommendation & Social)
echo "--> [Wave 3/6] Starting Social & Recommendation Services..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --no-deps \
  social-service recommendation-service
wait_for_services 180 social-service recommendation-service

# Wave 4: API Gateway
echo "--> [Wave 4/6] Starting API Gateway..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --no-deps api-gateway
wait_for_services 120 api-gateway

# Wave 5: Web Frontend
echo "--> [Wave 5/6] Starting Web Frontend..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --no-deps web
wait_for_services 120 web

# Wave 6: Ingress Reverse Proxy (Nginx) & SSL Management
echo "--> [Wave 6/6] Configuring Ingress Reverse Proxy & SSL (Nginx & Certbot)..."

SSL_DOMAIN="$(get_env_val "SSL_DOMAIN")"
# Tự động chuẩn hóa domain (loại bỏ http://, https://, dấu gạch chéo cuối nếu vô tình nhập vào .env)
SSL_DOMAIN="${SSL_DOMAIN#http://}"
SSL_DOMAIN="${SSL_DOMAIN#https://}"
SSL_DOMAIN="${SSL_DOMAIN%%/*}"
SSL_DOMAIN="$(echo "$SSL_DOMAIN" | tr -d '[:space:]')"

if [ -z "$SSL_DOMAIN" ]; then
  SSL_DOMAIN="tripsense.duckdns.org"
fi
export SSL_DOMAIN

SSL_EMAIL="$(get_env_val "SSL_EMAIL")"
if [ -z "$SSL_EMAIL" ]; then
  SSL_EMAIL="admin@tripsense.com"
fi

CERT_FILE="$DEPLOY_DIR/certbot/conf/live/$SSL_DOMAIN/fullchain.pem"

# Ensure host mount directories exist
mkdir -p "$DEPLOY_DIR/certbot/www" "$DEPLOY_DIR/certbot/conf" "$DEPLOY_DIR/nginx"

# ==============================================================================
# Render Nginx Configuration Templates with $SSL_DOMAIN
# ==============================================================================
render_nginx_template() {
  local src="$1"
  local dest="$2"
  if [ -f "$src" ]; then
    echo "--> [Template] Rendering: $(basename "$src") -> $(basename "$dest") (Domain: $SSL_DOMAIN)"
    if command -v envsubst >/dev/null 2>&1; then
      envsubst '${SSL_DOMAIN}' < "$src" > "$dest"
    else
      # Dual-safety fallback using sed if envsubst is not installed on host
      sed "s|\${SSL_DOMAIN}|$SSL_DOMAIN|g; s|\$SSL_DOMAIN|$SSL_DOMAIN|g" "$src" > "$dest"
    fi
  fi
}

# 1. Render production HTTPS configuration from template if available
if [ -f "$DEPLOY_DIR/nginx/nginx.conf.template" ]; then
  render_nginx_template "$DEPLOY_DIR/nginx/nginx.conf.template" "$DEPLOY_DIR/nginx/nginx.conf"
fi

# 2. Render initial HTTP bootstrap configuration from template if available
if [ -f "$DEPLOY_DIR/nginx/nginx.init.conf.template" ]; then
  render_nginx_template "$DEPLOY_DIR/nginx/nginx.init.conf.template" "$DEPLOY_DIR/nginx/nginx.init.conf"
fi

if [ ! -f "$CERT_FILE" ]; then
  echo ""
  echo "================================================================================"
  echo "🔒 [SSL BOOTSTRAP] Không tìm thấy chứng chỉ SSL cho domain: $SSL_DOMAIN"
  echo "   Tiến hành Bootstrap 2 giai đoạn trên EC2 mới..."
  echo "================================================================================"

  # Giai đoạn 1: Kích hoạt cấu hình HTTP tạm thời (chỉ mở port 80 phục vụ ACME challenge)
  echo "--> [Bootstrap 1/4] Chuyển đổi Nginx sang cấu hình HTTP tạm thời..."
  cp "$DEPLOY_DIR/nginx/nginx.conf" "$DEPLOY_DIR/nginx/nginx.conf.prod.bak"

  if [ -f "$DEPLOY_DIR/nginx/nginx.init.conf" ]; then
    cp "$DEPLOY_DIR/nginx/nginx.init.conf" "$DEPLOY_DIR/nginx/nginx.conf"
  else
    # Fallback inline: Nếu không có file init sẵn, tạo ngay cấu hình HTTP tạm thời
    cat <<EOF > "$DEPLOY_DIR/nginx/nginx.conf"
server {
    listen 80;
    server_name ${SSL_DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /health {
        default_type application/json;
        return 200 '{"status":"BOOTSTRAPPING"}';
    }

    location / {
        default_type text/plain;
        return 200 "Tripsense SSL Bootstrapping in progress...\n";
    }
}
EOF
  fi

  # Khởi động Nginx HTTP tạm thời
  echo "--> [Bootstrap 2/4] Khởi động Nginx HTTP để mở port 80..."
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --no-deps nginx
  wait_for_services 30 nginx

  # Giai đoạn 2: Gọi Certbot cấp chứng chỉ chính thức
  echo "--> [Bootstrap 3/4] Chạy Certbot xin cấp chứng chỉ từ Let's Encrypt..."
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" run --rm --entrypoint certbot certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$SSL_DOMAIN" \
    --email "$SSL_EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive

  # Giai đoạn 3: Khôi phục cấu hình HTTPS đầy đủ cho Nginx
  echo "--> [Bootstrap 4/4] Khôi phục cấu hình Nginx HTTPS đầy đủ..."
  if [ -f "$DEPLOY_DIR/nginx/nginx.conf.prod.bak" ]; then
    mv "$DEPLOY_DIR/nginx/nginx.conf.prod.bak" "$DEPLOY_DIR/nginx/nginx.conf"
  fi

  echo "--> Tải lại Nginx với chứng chỉ SSL mới..."
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --force-recreate --no-deps nginx
  wait_for_services 30 nginx
  echo "✅ [SSL Bootstrap] Hoàn tất cấp chứng chỉ SSL thành công!"
else
  echo "✅ [SSL Check] Đã tìm thấy chứng chỉ SSL hợp lệ tại: $CERT_FILE"

  # Kiểm tra và tự động gia hạn nếu chứng chỉ sắp hết hạn (Auto-renewal check)
  echo "--> Kiểm tra và tự động gia hạn chứng chỉ nếu cần (certbot renew)..."
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" run --rm --entrypoint certbot certbot renew \
    --webroot -w /var/www/certbot --quiet || true

  # Khởi chạy Nginx và reload cấu hình (Zero-downtime)
  echo "--> Khởi động Nginx và reload SSL..."
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --no-deps nginx
  wait_for_services 30 nginx

  echo "=== Reload reverse proxy (Zero-Downtime Traffic Switch) ==="
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" exec -T nginx nginx -s reload || \
    docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --force-recreate --no-deps nginx
fi

# Khởi chạy Certbot daemon nền để tự động gia hạn định kỳ mỗi 12h
echo "--> Khởi chạy Certbot background daemon để tự động gia hạn định kỳ..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --no-deps certbot || true

echo "=== Deployment status ==="
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" ps

echo "=== Docker resource snapshot ==="
docker stats --no-stream || true

# Ghi nhận trạng thái thành công vào .last_stable_tag
echo "$IMAGE_TAG" > "$STATE_FILE"
echo ""
echo "================================================================================"
echo "🎉 [DEPLOYMENT SUCCESS] Triển khai thành công phiên bản: $IMAGE_TAG!"
echo "   Đã lưu trạng thái ổn định vào: $STATE_FILE"
echo "================================================================================"
echo ""

echo "=== Clean dangling images (Smart Prune: Giữ cache image n-1 để rollback tức thì) ==="
docker image prune -f
