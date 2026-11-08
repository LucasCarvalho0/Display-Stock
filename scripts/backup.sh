#!/usr/bin/env bash
# Backup diário do PostgreSQL com retenção. Agende no cron:  0 2 * * * /opt/display-stock/scripts/backup.sh
set -euo pipefail
DIR="${BACKUP_DIR:-./backups}"; KEEP_DAYS="${KEEP_DAYS:-30}"; mkdir -p "$DIR"
FILE="$DIR/display_stock_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump "${DATABASE_URL%%\?*}" --no-owner | gzip > "$FILE"
find "$DIR" -name 'display_stock_*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup gerado: $FILE"
