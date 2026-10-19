#!/usr/bin/env bash
# Read local For You diagnostic logs produced by scripts/start.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    echo "bash scripts/monitor-explore.sh                  # Bảng tổng hợp log local hiện có"
    echo "bash scripts/monitor-explore.sh --follow         # Xem sự kiện mới trực tiếp; Ctrl+C để dừng"
    echo "bash scripts/monitor-explore.sh --request-id ID  # Các chặng của một request"
    exit 0
fi
LOG_FILES=()
for service in api-gateway recommendation-service place-service; do
    file="$ROOT_DIR/logs/$service.log"
    if [ -f "$file" ]; then
        LOG_FILES+=("$file")
    else
        echo "Chưa có log $service: dừng service đó bằng Ctrl+C rồi chạy lại bash scripts/start.sh." >&2
    fi
done

# Context diagnostics are optional for older running instances; don't request a full restart.
if [ -f "$ROOT_DIR/logs/context-service.log" ]; then
    LOG_FILES+=("$ROOT_DIR/logs/context-service.log")
fi

if [ ${#LOG_FILES[@]} -eq 0 ]; then
    exit 1
fi

case "${1:-}" in
    --follow)
        # grep only bounded diagnostic events, not application payloads or raw exceptions.
        tail -n 0 -F "${LOG_FILES[@]}" | grep --line-buffered -E 'explore_(request_started|request_completed|phase|state) '
        ;;
    *)
        cat "${LOG_FILES[@]}" | python3 "$SCRIPT_DIR/analyze-explore-latency.py" "$@"
        ;;
esac
