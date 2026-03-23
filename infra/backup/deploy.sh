#!/bin/sh
set -euo pipefail

# ── Deploy backup job to Scaleway Serverless ─────────────────────────────
#
# Prerequisites:
#   1. scw CLI installed and configured (scw init)
#   2. A Scaleway Container Registry namespace created
#   3. A Scaleway Object Storage bucket created:
#      scw object bucket create name=lecocon-backups region=fr-par
#   4. An API key with ObjectStorage and Database permissions
#
# Required env vars:
#   SCW_REGISTRY     — Container Registry endpoint (e.g. rg.fr-par.scw.cloud/lecocon)
#   DATABASE_URL     — Managed PostgreSQL connection string (internal)
#   SCW_ACCESS_KEY   — Scaleway API access key (for Object Storage)
#   SCW_SECRET_KEY   — Scaleway API secret key (for Object Storage)

REGISTRY="${SCW_REGISTRY:?Set SCW_REGISTRY (e.g. rg.fr-par.scw.cloud/lecocon)}"
IMAGE="${REGISTRY}/backup:latest"
REGION="${SCW_REGION:-fr-par}"

echo "[deploy] Building backup image..."
docker build -t "$IMAGE" "$(dirname "$0")"

echo "[deploy] Pushing to Scaleway Container Registry..."
docker push "$IMAGE"

echo "[deploy] Creating Serverless Job..."
echo ""
echo "  Run this command to create the cron job:"
echo ""
echo "  scw jobs definition create \\"
echo "    name=lecocon-backup \\"
echo "    cpu-limit=1000 \\"
echo "    memory-limit=256 \\"
echo "    image-uri=${IMAGE} \\"
echo "    region=${REGION} \\"
echo "    cron-schedule='0 3 * * *' \\"
echo "    environment-variables.DATABASE_URL=\$DATABASE_URL \\"
echo "    environment-variables.SCW_ACCESS_KEY=\$SCW_ACCESS_KEY \\"
echo "    environment-variables.SCW_SECRET_KEY=\$SCW_SECRET_KEY \\"
echo "    environment-variables.SCW_BUCKET=lecocon-backups \\"
echo "    environment-variables.SCW_REGION=${REGION}"
echo ""
echo "[deploy] Image pushed. Create the job definition above to activate the cron."
