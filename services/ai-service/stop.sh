#!/usr/bin/env bash
# ==============================================================================
# TripSense Platform - Dừng AI Service
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROOT_ENV="$ROOT_DIR/env/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}            TripSense AI Service - Dừng Dịch Vụ                        ${NC}"
echo -e "${BLUE}======================================================================${NC}"

if [ -f "$ROOT_ENV" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ROOT_ENV"
    set +a
fi

PORT="${AI_SERVICE_PORT:-${AI_SERVICE_V2_PORT:-8089}}"

echo -e "\n${YELLOW}Đang kiểm tra tiến trình trên cổng ${PORT}...${NC}"
PIDS=$(lsof -ti :"$PORT" -sTCP:LISTEN 2>/dev/null || lsof -ti :"$PORT" 2>/dev/null || true)

if [ -n "$PIDS" ]; then
    echo -e "  [${YELLOW}DỪNG${NC}] Tìm thấy tiến trình (PID: $(echo "$PIDS" | tr '\n' ' ')), đang dừng..."
    for pid in $PIDS; do
        pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
        if [ -n "$pgid" ] && [ "$pgid" -gt 1 ]; then
            kill -15 -"$pgid" 2>/dev/null || true
        fi
    done
    kill -15 $PIDS 2>/dev/null || true
    sleep 1
    # Dừng luôn process watcher tsx nếu còn
    pkill -9 -f "tsx watch src/index.ts" 2>/dev/null || true
    REMAINING=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
        for pid in $REMAINING; do
            pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
            if [ -n "$pgid" ] && [ "$pgid" -gt 1 ]; then
                kill -9 -"$pgid" 2>/dev/null || true
            fi
        done
        kill -9 $REMAINING 2>/dev/null || true
    fi
    echo -e "  [${GREEN}THÀNH CÔNG${NC}] Đã dừng AI Service trên cổng ${PORT}."
else
    echo -e "  [${GREEN}INFO${NC}] AI Service (Cổng ${PORT}) hiện không chạy."
fi

echo -e "\n${GREEN}======================================================================${NC}\n"
