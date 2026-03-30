#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="$ROOT_DIR/deploy/hostinger"
API_OUT="$BUNDLE_DIR/api"
WEB_OUT="$BUNDLE_DIR/web"

rm -rf "$BUNDLE_DIR"
mkdir -p "$API_OUT" "$WEB_OUT"

cd "$ROOT_DIR"

npm install
npm run prisma:generate
npm run build -w api
npm run build -w web

cp apps/api/package.json "$API_OUT/package.json"
cp apps/api/.env.example "$API_OUT/.env.example"
cp -r apps/api/dist "$API_OUT/dist"
cp -r prisma "$API_OUT/prisma"

cp apps/web/package.json "$WEB_OUT/package.json"
cp apps/web/.env.example "$WEB_OUT/.env.example"
cp -r apps/web/public "$WEB_OUT/public"
cp -r apps/web/.next "$WEB_OUT/.next"
cp apps/web/next.config.ts "$WEB_OUT/next.config.ts"

cat > "$BUNDLE_DIR/DEPLOY_NOTES.txt" <<'TXT'
Hostinger deploy paketi:
1) Bu klasoru FTP ile public_html altina yukle.
2) API icin Node app root: public_html/hostinger/api
3) WEB icin Node app root: public_html/hostinger/web
4) API dizininde npm install --omit=dev komutunu calistir.
5) WEB dizininde npm install --omit=dev komutunu calistir.
6) API app start command: node dist/index.js
7) WEB app start command: npm run start
8) API .env ve WEB .env.local dosyalarini panelden olustur.
TXT

echo "Bundle hazir: $BUNDLE_DIR"
