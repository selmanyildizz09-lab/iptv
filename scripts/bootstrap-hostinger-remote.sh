#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export NVM_DIR="$HOME/.nvm"
NODE_VERSION="20"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed."
  exit 1
fi

if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "Installing nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js ${NODE_VERSION}..."
  nvm install "$NODE_VERSION"
fi

nvm use "$NODE_VERSION"

if ! command -v openssl >/dev/null 2>&1; then
  JWT_SECRET_VALUE="CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
else
  JWT_SECRET_VALUE="$(openssl rand -hex 32)"
fi

mkdir -p apps/api apps/web

cat > apps/api/.env <<EOF
DATABASE_URL=mysql://u537684673_vtbuser:j%2F8fI%5Eiive6Z@localhost:3306/u537684673_vtb
JWT_SECRET=${JWT_SECRET_VALUE}
WEB_ORIGIN=https://edaferyazilim.online
PORT=4000
ADMIN_EMAIL=admin@edaferyazilim.online
ADMIN_PASSWORD=ChangeThisAdminPassword123!
EOF

cat > apps/web/.env.local <<'EOF'
NEXT_PUBLIC_API_URL=https://edaferyazilim.online/api
EOF

echo "Installing project dependencies..."
npm install

echo "Generating Prisma client..."
npm run prisma:generate

echo "Applying database schema..."
npm run prisma:push

echo "Seeding admin user..."
npm run seed -w api

echo "Building api and web..."
npm run build -w api
npm run build -w web

pkill -f "node dist/index.js" || true
pkill -f "next start" || true

echo "Starting api..."
nohup bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use 20 >/dev/null && cd "$HOME/iptv" && npm run start -w api' > "$HOME/api.log" 2>&1 &

echo "Starting web..."
nohup bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use 20 >/dev/null && cd "$HOME/iptv" && npm run start -w web' > "$HOME/web.log" 2>&1 &

sleep 5

echo "Bootstrap finished."
echo "Node: $(node -v)"
echo "Npm: $(npm -v)"
echo "API log tail:"
tail -n 20 "$HOME/api.log" || true
echo "WEB log tail:"
tail -n 20 "$HOME/web.log" || true
echo "JWT secret used in apps/api/.env"
