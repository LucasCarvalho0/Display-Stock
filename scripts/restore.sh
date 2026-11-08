#!/usr/bin/env bash
# Uso: scripts/restore.sh backups/display_stock_XXXX.sql.gz   (restaure em um banco VAZIO ou de homologação primeiro!)
set -euo pipefail
[ $# -eq 1 ] || { echo "Informe o arquivo de backup"; exit 1; }
gunzip -c "$1" | psql "${DATABASE_URL%%\?*}"
