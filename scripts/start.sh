#!/usr/bin/env bash
# ==============================================================================
# TripSense Platform - Khởi động Microservices & Web Frontend thông minh
# (Tự động kiểm tra: service nào đang chạy rồi sẽ BỎ QUA, chỉ mở cái chưa chạy)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Màu sắc hiển thị
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}       TripSense Platform - Khởi động Toàn bộ Hệ Thống${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Kiểm tra các dịch vụ nền tảng (PostgreSQL, MongoDB, Redis)
check_port() {
    local port=$1
    local name=$2
    if lsof -i :"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "  [${GREEN}OK${NC}] $name đang chạy trên cổng $port"
        return 0
    else
        echo -e "  [${YELLOW}CẢNH BÁO${NC}] $name KHÔNG tìm thấy trên cổng $port!"
        return 1
    fi
}

echo -e "\n${YELLOW}1. Kiểm tra cơ sở dữ liệu & cache...${NC}"
check_port 5432 "PostgreSQL" || echo "    -> Gợi ý: brew services start postgresql@18"
check_port 27017 "MongoDB" || echo "    -> Gợi ý: brew services start mongodb-community"
check_port 6379 "Redis" || echo "    -> Gợi ý: brew services start redis"

# 2. Danh sách toàn bộ các service
SERVICES=(
    "discovery-server:8761:services/discovery-server:backend"
    "place-service:8083:services/place-service:backend"
    "user-service:8081:services/user-service:backend"
    "trip-service:8084:services/trip-service:backend"
    "social-service:8086:services/social-service:backend"
    "mail-service:8082:services/mail-service:backend"
    "context-service:8087:services/context-service:backend"
    "recommendation-service:8088:services/recommendation-service:backend"
    "ai-service:8089:services/ai-service:node"
    "api-gateway:8080:services/api-gateway:backend"
    "web-frontend:3000:apps/web/tripsense:frontend"
)

SERVICES_TO_START=()

echo -e "\n${YELLOW}2. Kiểm tra trạng thái từng dịch vụ...${NC}"
for svcInfo in "${SERVICES[@]}"; do
    IFS=":" read -r svcName svcPort svcPath svcType <<< "$svcInfo"
    if lsof -i :"$svcPort" -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "  [${GREEN}ĐÃ CHẠY${NC}] $svcName (Port $svcPort) -> ${YELLOW}Bỏ qua, không mở lại${NC}"
    else
        echo -e "  [${RED}CHƯA CHẠY${NC}] $svcName (Port $svcPort) -> ${GREEN}Sẽ mở Terminal${NC}"
        SERVICES_TO_START+=("$svcInfo")
    fi
done

# Đảm bảo tất cả file mvnw đều có quyền thực thi
chmod +x "$ROOT_DIR"/services/*/mvnw 2>/dev/null || true

# Chuẩn bị môi trường cho ai-service
AI_DIR="$ROOT_DIR/services/ai-service"
if [ -d "$AI_DIR" ] && [ ! -d "$AI_DIR/node_modules" ]; then
    echo -e "  [${YELLOW}INFO${NC}] Cài đặt node_modules cho ai-service..."
    (cd "$AI_DIR" && npm install)
fi

# Nếu tất cả đã chạy rồi thì không cần mở thêm terminal nào
if [ ${#SERVICES_TO_START[@]} -eq 0 ]; then
    echo -e "\n${GREEN} Tất cả các dịch vụ đều đang chạy đầy đủ! Không cần mở thêm terminal nào.${NC}"
else
    echo -e "\n${GREEN}3. Đang mở Terminal cho ${#SERVICES_TO_START[@]} dịch vụ chưa chạy...${NC}"

    APPLESCRIPT_FILE="$(mktemp /tmp/tripsense_start.XXXXXX)"

    cat << 'EOF' > "$APPLESCRIPT_FILE"
on run argv
    set rootDir to item 1 of argv
    set servicesList to items 2 through (count of argv) of argv
    
    tell application "Terminal"
        activate
        
        set isFirst to true
        
        repeat with svcInfo in servicesList
            set AppleScript's text item delimiters to ":"
            set svcParts to text items of svcInfo
            set svcName to item 1 of svcParts
            set svcPort to item 2 of svcParts
            set svcPath to item 3 of svcParts
            set svcType to item 4 of svcParts
            set AppleScript's text item delimiters to ""
            
            set svcDir to rootDir & "/" & svcPath
            set loadEnvCmd to "if [ -x /usr/libexec/java_home ]; then export JAVA_HOME=$(/usr/libexec/java_home -v 21 2>/dev/null || /usr/libexec/java_home); export PATH=\"$JAVA_HOME/bin:$PATH\"; fi && if [ -f \"" & rootDir & "/env/.env\" ]; then set -a; source \"" & rootDir & "/env/.env\"; set +a; fi && "
            set diagnosticsCmd to ""
            if svcName is "api-gateway" or svcName is "recommendation-service" or svcName is "place-service" or svcName is "context-service" then
                set diagnosticsCmd to "mkdir -p " & quoted form of (rootDir & "/logs") & " && export LOGGING_FILE_NAME=" & quoted form of (rootDir & "/logs/" & svcName & ".log") & " && "
            end if
            
            if svcType is "frontend" or svcType is "node" then
                set cmd to "cd \"" & svcDir & "\" && " & loadEnvCmd & "clear && printf '\\e]2;" & svcName & " (" & svcPort & ")\\a' && echo '============================================' && echo '🚀 Đang chạy: " & svcName & " (Port " & svcPort & ")' && echo '============================================' && npm run dev"
            else if svcType is "python" or svcType is "ai" then
                set cmd to "cd \"" & svcDir & "\" && " & loadEnvCmd & "clear && printf '\\e]2;" & svcName & " (" & svcPort & ")\\a' && echo '============================================' && echo '🚀 Đang chạy: " & svcName & " (Port " & svcPort & ")' && echo '============================================' && if [ -d .venv ]; then source .venv/bin/activate; elif [ -d venv ]; then source venv/bin/activate; else PY_CMD=$(command -v python3.11 || command -v python3.12 || command -v python3); echo '⚠️  Chưa có .venv, đang khởi tạo môi trường ảo...'; $PY_CMD -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt; fi && python -m uvicorn app.main:app --host 0.0.0.0 --port " & svcPort & " --reload"
            else
                set cmd to "cd \"" & svcDir & "\" && " & loadEnvCmd & diagnosticsCmd & "clear && printf '\\e]2;" & svcName & " (" & svcPort & ")\\a' && echo '============================================' && echo '🚀 Đang chạy: " & svcName & " (Port " & svcPort & ")' && echo '============================================' && if [ -f ./mvnw ]; then chmod +x ./mvnw 2>/dev/null; ./mvnw spring-boot:run; else mvn spring-boot:run; fi"
            end if
            
            if isFirst then
                do script cmd
                set isFirst to false
                delay 1.5
            else
                set tabOpened to false
                try
                    tell application "System Events"
                        tell process "Terminal"
                            keystroke "t" using command down
                        end tell
                    end tell
                    delay 0.5
                    do script cmd in selected tab of front window
                    set tabOpened to true
                on error
                    do script cmd
                end try
                delay 0.8
            end if
        end repeat
    end tell
end run
EOF

    osascript "$APPLESCRIPT_FILE" "$ROOT_DIR" "${SERVICES_TO_START[@]}"
    rm -f "$APPLESCRIPT_FILE"

    # Tự động sắp xếp các cửa sổ thành lưới ngay ngắn
    sleep 0.5
    osascript << 'EOF' 2>/dev/null || true
tell application "Finder"
    set screenBounds to bounds of window of desktop
    set screenWidth to item 3 of screenBounds
    set screenHeight to item 4 of screenBounds
end tell

tell application "Terminal"
    set winList to every window whose visible is true
    set numWins to count of winList
    if numWins = 0 then return
    
    set topBar to 25
    set dockMargin to 65
    set usableHeight to screenHeight - topBar - dockMargin
    
    if numWins <= 2 then
        set cols to 2
        set rows to 1
    else if numWins <= 4 then
        set cols to 2
        set rows to 2
    else if numWins <= 6 then
        set cols to 3
        set rows to 2
    else if numWins <= 8 then
        set cols to 4
        set rows to 2
    else if numWins <= 10 then
        set cols to 5
        set rows to 2
    else
        set cols to 4
        set rows to 3
    end if
    
    set wWidth to (screenWidth / cols) as integer
    set wHeight to (usableHeight / rows) as integer
    
    repeat with i from 1 to numWins
        if i <= (cols * rows) then
            set colIdx to (i - 1) mod cols
            set rowIdx to (i - 1) div cols
            
            set x1 to (colIdx * wWidth) as integer
            set y1 to (topBar + (rowIdx * wHeight)) as integer
            set x2 to (x1 + wWidth) as integer
            set y2 to (y1 + wHeight) as integer
            
            try
                set bounds of (item i of winList) to {x1, y1, x2, y2}
            end try
        end if
    end repeat
end tell
EOF
fi

# 3. Mở trình duyệt Web Frontend nếu cổng 3000 đang/sẽ chạy
echo -e "\n${YELLOW}4. Kiểm tra giao diện Web Frontend...${NC}"
web_ready=false
for i in {1..20}; do
    if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
        web_ready=true
        break
    fi
    sleep 0.5
done

if [ "$web_ready" = true ]; then
    echo -e "  [${GREEN}BROWSER${NC}] Đang mở trình duyệt: ${GREEN}http://localhost:3000${NC}"
    open "http://localhost:3000"
else
    echo -e "  [${YELLOW}INFO${NC}] Web frontend đang khởi động, bạn có thể truy cập: ${BLUE}http://localhost:3000${NC}"
fi

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN} Hoàn tất khởi động hệ thống TripSense!${NC}"
echo -e "  - Dừng toàn bộ hệ thống & tắt Terminal: ${YELLOW}./scripts/stop.sh${NC}"
echo -e "  - Xem thời gian For You: ${YELLOW}bash scripts/monitor-explore.sh${NC}"
echo -e "  - Log local: ${BLUE}$ROOT_DIR/logs/{api-gateway,recommendation-service,place-service,context-service}.log${NC}"
echo -e "${GREEN}======================================================${NC}\n"
