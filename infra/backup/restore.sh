#!/bin/sh
set -euo pipefail

# ── Restore a Le Cocon backup from Scaleway Object Storage ──────────────
#
# Usage:
#   ./restore.sh                          # restore latest backup
#   ./restore.sh lecocon-2026-03-22.dump  # restore specific file
#
# Required env vars:
#   DATABASE_URL    — target PostgreSQL connection string
#   SCW_ACCESS_KEY  — Scaleway API access key
#   SCW_SECRET_KEY  — Scaleway API secret key

BUCKET="${SCW_BUCKET:-lecocon-backups}"
REGION="${SCW_REGION:-fr-par}"

export RCLONE_CONFIG_SCW_TYPE=s3
export RCLONE_CONFIG_SCW_PROVIDER=Scaleway
export RCLONE_CONFIG_SCW_ACCESS_KEY_ID="${SCW_ACCESS_KEY}"
export RCLONE_CONFIG_SCW_SECRET_ACCESS_KEY="${SCW_SECRET_KEY}"
export RCLONE_CONFIG_SCW_REGION="${REGION}"
export RCLONE_CONFIG_SCW_ENDPOINT="s3.${REGION}.scw.cloud"

# Determine which backup to restore
if [ -n "${1:-}" ]; then
  FILENAME="$1"
else
  echo "[restore] Finding latest backup..."
  FILENAME=$(rclone ls "scw:${BUCKET}/" | sort -k2 | tail -1 | awk '{print $2}')
  if [ -z "$FILENAME" ]; then
    echo "[restore] ERROR: No backups found in bucket ${BUCKET}"
    exit 1
  fi
fi

echo "[restore] Downloading ${FILENAME}..."
rclone copyto "scw:${BUCKET}/${FILENAME}" "/tmp/${FILENAME}"

SIZE=$(du -h "/tmp/${FILENAME}" | cut -f1)
echo "[restore] Downloaded: ${FILENAME} (${SIZE})"

echo ""
echo "  WARNING: This will overwrite the target database."
echo "  Target: ${DATABASE_URL%%@*}@..."
echo "  Backup: ${FILENAME}"
echo ""
printf "  Continue? [y/N] "
read -r confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "[restore] Aborted"
  rm -f "/tmp/${FILENAME}"
  exit 0
fi

echo "[restore] Restoring..."
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "/tmp/${FILENAME}"

rm -f "/tmp/${FILENAME}"
echo "[restore] Done"
