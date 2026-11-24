#!/usr/bin/env bash
# Render build step. Installs dependencies, prepares the database client and
# schema, then downloads the web build GitHub made for this exact commit
# (see .github/workflows/build-web.yml) instead of compiling on a 512 MB box.
set -euo pipefail

npm ci --include=dev
npx prisma generate --schema apps/indexer/prisma/schema.prisma
(cd apps/web && node scripts/prepare-db.mjs)

SHA="${RENDER_GIT_COMMIT:?RENDER_GIT_COMMIT is not set}"
URL="https://github.com/angelraph/VERIQA/releases/download/render-build/next-build-${SHA}.tar.gz"

echo "Waiting for the GitHub build of ${SHA}..."
for i in $(seq 1 60); do
  if curl -fsSL -o /tmp/next-build.tar.gz "$URL"; then
    rm -rf apps/web/.next
    tar -xzf /tmp/next-build.tar.gz -C apps/web
    echo "Using the GitHub build of ${SHA}."
    exit 0
  fi
  sleep 15
done
echo "No GitHub build found for ${SHA} after 15 minutes. Check the 'Build the web app for Render' workflow."
exit 1
