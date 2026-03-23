#!/bin/sh
set -euo pipefail

# ── Config (injected as env vars by Scaleway Serverless Job) ─────────────
BUCKET="${SCW_BUCKET:-lecocon-backups}"
REGION="${SCW_REGION:-fr-par}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP=$(date -u +%Y-%m-%d_%H%M%S)
FILENAME="lecocon-${TIMESTAMP}.dump"

# ── Configure rclone for Scaleway Object Storage (no config file) ────────
export RCLONE_CONFIG_SCW_TYPE=s3
export RCLONE_CONFIG_SCW_PROVIDER=Scaleway
export RCLONE_CONFIG_SCW_ACCESS_KEY_ID="${SCW_ACCESS_KEY}"
export RCLONE_CONFIG_SCW_SECRET_ACCESS_KEY="${SCW_SECRET_KEY}"
export RCLONE_CONFIG_SCW_REGION="${REGION}"
export RCLONE_CONFIG_SCW_ENDPOINT="s3.${REGION}.scw.cloud"

# ── 1. Dump ──────────────────────────────────────────────────────────────
echo "[backup] Starting pg_dump..."
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  "$DATABASE_URL" > "/tmp/${FILENAME}"

SIZE=$(du -h "/tmp/${FILENAME}" | cut -f1)
echo "[backup] Dump complete: ${FILENAME} (${SIZE})"

# ── 2. Upload to Scaleway Object Storage ─────────────────────────────────
echo "[backup] Uploading to scw:${BUCKET}/${FILENAME}..."
rclone copyto "/tmp/${FILENAME}" "scw:${BUCKET}/${FILENAME}"
echo "[backup] Upload complete"

# ── 3. Cleanup old backups ───────────────────────────────────────────────
echo "[backup] Cleaning backups older than ${RETENTION_DAYS} days..."
rclone delete "scw:${BUCKET}/" --min-age "${RETENTION_DAYS}d"

REMAINING=$(rclone ls "scw:${BUCKET}/" | wc -l)
echo "[backup] ${REMAINING} backups remaining in bucket"

# ── 4. Cleanup local ────────────────────────────────────────────────────
rm -f "/tmp/${FILENAME}"
echo "[backup] Done"
