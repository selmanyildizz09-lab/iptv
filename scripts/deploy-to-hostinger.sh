#!/usr/bin/env bash
set -euo pipefail

# Run this script from your own machine (where Hostinger SSH port is reachable)
# Usage:
#   HOSTINGER_USER="uXXXX" HOSTINGER_HOST="x.x.x.x" HOSTINGER_PORT="65002" \
#   ./scripts/deploy-to-hostinger.sh

HOSTINGER_USER="${HOSTINGER_USER:-u537684673}"
HOSTINGER_HOST="${HOSTINGER_HOST:-46.202.158.223}"
HOSTINGER_PORT="${HOSTINGER_PORT:-65002}"
REMOTE_BASE="${REMOTE_BASE:-$HOME/public_html/hostinger}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_TAR="$ROOT_DIR/deploy/hostinger-bundle.tar.gz"

if [[ ! -f "$BUNDLE_TAR" ]]; then
  echo "Bundle not found: $BUNDLE_TAR"
  echo "Run: ./scripts/prepare-hostinger-bundle.sh"
  exit 1
fi

echo "Uploading bundle..."
scp -P "$HOSTINGER_PORT" "$BUNDLE_TAR" "$HOSTINGER_USER@$HOSTINGER_HOST:~/hostinger-bundle.tar.gz"

echo "Running remote install..."
ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_HOST" bash <<'REMOTE'
set -euo pipefail

REMOTE_BASE="$HOME/public_html/hostinger"
mkdir -p "$REMOTE_BASE"

tar -xzf "$HOME/hostinger-bundle.tar.gz" -C "$REMOTE_BASE"

API_DIR="$REMOTE_BASE/hostinger/api"
WEB_DIR="$REMOTE_BASE/hostinger/web"

if [[ ! -d "$API_DIR" || ! -d "$WEB_DIR" ]]; then
  echo "Expected directories not found after extract"
  ls -la "$REMOTE_BASE"
  exit 1
fi

cd "$API_DIR"
npm install --omit=dev

cat > .env <<'EOF'
DATABASE_URL=mysql://u537684673_vtbuser:j%2F8fI%5Eiive6Z@localhost:3306/u537684673_vtb
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
WEB_ORIGIN=https://edaferyazilim.online
PORT=4000
ADMIN_EMAIL=admin@edaferyazilim.online
ADMIN_PASSWORD=ChangeThisAdminPassword123!
EOF

npx prisma generate --schema prisma/schema.prisma
npx prisma db push --schema prisma/schema.prisma
node dist/seed.js || true

cd "$WEB_DIR"
npm install --omit=dev
cat > .env.local <<'EOF'
NEXT_PUBLIC_API_URL=https://edaferyazilim.online/api
EOF

echo "Remote install finished."
echo "API dir: $API_DIR"
echo "WEB dir: $WEB_DIR"
echo "Start API command: node dist/index.js"
echo "Start WEB command: npm run start"
REMOTE

echo "Done. Configure Node.js apps in Hostinger panel for api/web directories."
