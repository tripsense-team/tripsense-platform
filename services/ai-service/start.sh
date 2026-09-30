#!/usr/bin/env bash
# ==============================================================================
# TripSense Platform - Khởi động AI Service (Hono + Vercel AI SDK)
# ==============================================================================

set -euo pipefail

# 1. Xác định đường dẫn thư mục
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROOT_ENV="$ROOT_DIR/env/.env"

# 2. Màu sắc hiển thị terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}        TripSense AI Service (Hono + Vercel AI SDK) - Khởi Động        ${NC}"
echo -e "${BLUE}======================================================================${NC}"

# 3. Kiểm tra và nạp file môi trường chung
echo -e "\n${YELLOW}1. Kiểm tra cấu hình môi trường...${NC}"
if [ ! -f "$ROOT_ENV" ]; then
    echo -e "  [${RED}LỖI${NC}] Không tìm thấy file môi trường tại: $ROOT_ENV"
    echo "  -> Hãy đảm bảo file env/.env đã tồn tại trước khi khởi động service."
    exit 1
fi

PORT="$(grep -E '^AI_SERVICE_PORT=' "$ROOT_ENV" | cut -d '=' -f2- | tr -d ' "\r' || true)"
PORT="${PORT:-$(grep -E '^AI_SERVICE_V2_PORT=' "$ROOT_ENV" | cut -d '=' -f2- | tr -d ' "\r' || true)}"
PORT="${PORT:-8089}"
echo -e "  [${GREEN}OK${NC}] File cấu hình sẵn sàng: ${CYAN}env/.env${NC}"
echo -e "  [${GREEN}OK${NC}] Cổng phục vụ được chỉ định: ${BOLD}${PORT}${NC}"

# 4. Kiểm tra Node.js & Dependencies
echo -e "\n${YELLOW}2. Kiểm tra môi trường Node.js & dependencies...${NC}"
if ! command -v node >/dev/null 2>&1; then
    echo -e "  [${RED}LỖI${NC}] Node.js chưa được cài đặt trong hệ thống!"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "  [${GREEN}OK${NC}] Node.js phiên bản: ${CYAN}${NODE_VERSION}${NC}"

cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
    echo -e "  [${YELLOW}INFO${NC}] Chưa tìm thấy node_modules, đang tự động chạy npm install..."
    npm install
else
    echo -e "  [${GREEN}OK${NC}] node_modules đã sẵn sàng."
fi

# Đảm bảo patch Gemini 3 thoughtSignature luôn có hiệu lực
if [ -f "scripts/patch-google-provider.js" ]; then
    node scripts/patch-google-provider.js >/dev/null 2>&1 || true
    echo -e "  [${GREEN}OK${NC}] Đã xác thực bản vá Gemini 3 thoughtSignature cho @ai-sdk/google."
fi

# 5. Xử lý các cờ database nếu người dùng truyền vào (vd: ./start.sh --db-push)
MODE="dev"
for arg in "$@"; do
    case "$arg" in
        --db-push|push)
            echo -e "\n${YELLOW}👉 Đang đồng bộ cấu trúc Database (Drizzle Push)...${NC}"
            npm run db:push
            ;;
        --db-migrate|migrate)
            echo -e "\n${YELLOW}👉 Đang chạy Database Migration...${NC}"
            npm run db:migrate
            ;;
        prod|start|production)
            MODE="prod"
            ;;
        dev|development)
            MODE="dev"
            ;;
        --help|-h)
            echo -e "\nCách dùng: ./start.sh [dev | prod] [--db-push] [--db-migrate]"
            echo -e "  - ${BOLD}dev${NC} (mặc định): Chạy chế độ phát triển có hot-reload (tsx watch)"
            echo -e "  - ${BOLD}prod${NC}: Biên dịch TypeScript (tsc) và chạy file dist/index.js"
            echo -e "  - ${BOLD}--db-push${NC}: Tự động đẩy schema lên PostgreSQL trước khi chạy"
            echo -e "  - ${BOLD}--db-migrate${NC}: Chạy migration script trước khi chạy"
            exit 0
            ;;
    esac
done

# 6. Kiểm tra và giải phóng cổng nếu đang bị chiếm dụng
echo -e "\n${YELLOW}3. Kiểm tra cổng ${PORT}...${NC}"
EXISTING_PID=$(lsof -ti :"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
    echo -e "  [${YELLOW}CẢNH BÁO${NC}] Cổng $PORT đang bị chiếm dụng bởi tiến trình (PID: $EXISTING_PID)."
    echo -e "  [${YELLOW}DỌN DẸP${NC}] Đang tự động giải phóng cổng $PORT..."
    kill -9 $EXISTING_PID 2>/dev/null || true
    sleep 1
    echo -e "  [${GREEN}OK${NC}] Cổng $PORT đã được giải phóng thành công."
else
    echo -e "  [${GREEN}OK${NC}] Cổng $PORT đang trống, sẵn sàng kết nối."
fi

MODE_UPPER=$(echo "$MODE" | tr '[:lower:]' '[:upper:]')
echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🚀 AI Service V2 đang khởi động ở chế độ: ${BOLD}${MODE_UPPER}${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "  - Base URL:    ${CYAN}http://localhost:${PORT}${NC}"
echo -e "  - Health:      ${CYAN}http://localhost:${PORT}/health${NC}"
echo -e "  - Ready:       ${CYAN}http://localhost:${PORT}/ready${NC}"
echo -e "  - Models:      ${CYAN}http://localhost:${PORT}/api/models${NC}"
echo -e "  - Chat API:    ${CYAN}http://localhost:${PORT}/api/chat${NC}"
echo -e "  - Bấm ${YELLOW}Ctrl + C${NC} để dừng service bất kỳ lúc nào."
echo -e "${GREEN}======================================================================${NC}\n"

if [ "$MODE" = "prod" ]; then
    echo -e "${YELLOW}Đang biên dịch TypeScript...${NC}"
    npm run build
    echo -e "${GREEN}Biên dịch hoàn tất, đang chạy node dist/index.js...${NC}\n"
    exec node dist/index.js
else
    exec npm run dev
fi
