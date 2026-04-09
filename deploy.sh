#!/usr/bin/env bash
# Deploy mini-golf to brain EC2 (served via nginx).
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-scott@100.105.131.123}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/mini-golf}"

cd "$(dirname "$0")"

rsync -avz --delete \
  --exclude '.git' \
  --exclude 'deploy.sh' \
  --exclude 'README.md' \
  --exclude 'node_modules' \
  --exclude '.wrangler' \
  --exclude 'worker' \
  ./ "$REMOTE_HOST:$REMOTE_PATH/"

echo "Deployed to $REMOTE_HOST:$REMOTE_PATH"
