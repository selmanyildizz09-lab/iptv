# IPTV Platform (Web + API + MySQL)

Smarters Pro yaklaşımına yakın, modern web tabanlı IPTV MVP platformu.

## Özellikler

- Kullanıcı kayıt/giriş ve JWT tabanlı kimlik doğrulama
- Admin ve user rol ayrımı
- M3U link içe aktarma
- Xtream Codes API içe aktarma
- Kanal kategori listeleme, arama ve video oynatma
- Duyuru yönetimi
- Reklam konfigürasyonu (banner/interstitial alanları)
- Admin kullanıcı askıya alma/aktifleştirme
- Admin manuel abonelik süresi tanımlama
- Stream CORS sorunlarına karşı proxy endpoint

## Teknoloji

- Frontend: Next.js + Tailwind + HLS.js
- Backend: Node.js + Express + Prisma
- Veritabanı: MySQL
- Orkestrasyon: Docker Compose

## Proje Yapısı

```
.
├── apps
│   ├── api
│   └── web
├── prisma
│   └── schema.prisma
└── docker-compose.yml
```

## Geliştirme Kurulumu

1. Ortam dosyalarını oluştur:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

2. MySQL bağlantını hazırla:

```bash
# Örnek local mysql docker
docker run -d --name iptv-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=iptv -p 3306:3306 mysql:8
```

3. Prisma generate + schema push:

```bash
npm run prisma:generate
npm run prisma:push
```

4. Seed admin kullanıcı:

```bash
npm run seed -w api
```

5. Uygulamaları çalıştır:

```bash
npm run dev:api
npm run dev:web
```

6. Arayüz:

- Web: http://localhost:3000
- API: http://localhost:4000

## Docker ile Çalıştırma

```bash
docker compose up --build
```

## Varsayılan Admin

- E-posta: `admin@iptv.local`
- Şifre: `Admin123!`

## Kritik Notlar

- IPTV kaynakları farklı origin'lerden geldiği için tarayıcıda CORS çıkabilir.
- Bu proje `GET /api/proxy/stream?url=` endpointi ile proxy desteği sunar.
- Prod ortamda bu endpoint için domain allowlist + rate limit eklenmelidir.
- Xtream ve M3U importları MVP düzeyindedir; production için queue/retry gerekir.

## Hostinger FTP + MySQL Kurulum

1. Hostinger panelde Node.js App desteğini kontrol et:

- Eğer Node.js App desteği yoksa bu proje çalışmaz (çünkü hem API hem Next.js server gerekir).
- Destek yoksa VPS planına geçmelisin.

2. API ve web için ortam değişkenleri:

- API için apps/api/.env içinde:
	- DATABASE_URL=mysql://DB_USER:DB_PASS@DB_HOST:3306/DB_NAME
	- JWT_SECRET=uzun-ve-guclu-bir-anahtar
	- WEB_ORIGIN=https://edaferyazilim.online
	- PORT=4000
	- ADMIN_EMAIL=admin@edaferyazilim.online
	- ADMIN_PASSWORD=guclu-sifre
- WEB için apps/web/.env.local içinde:
	- NEXT_PUBLIC_API_URL=https://edaferyazilim.online/api

3. Build al:

```bash
npm install
npm run prisma:generate
npm run build
```

4. Veritabanını oluştur:

```bash
npm run prisma:push
npm run seed -w api
```

5. FTP ile public_html altına yükle:

- public_html altında ayrı klasörler aç:
	- public_html/web
	- public_html/api
- apps/web build çıktısını web klasörüne yükle.
- apps/api build çıktısını api klasörüne yükle.
- package.json ve gerekli node_modules kurulumunu panelde npm install ile tamamla.

6. Hostinger Node.js App ayarları:

- Web app start command: npm run start
- API app start command: npm run start
- API için entry: dist/index.js

7. Reverse proxy ayarı:

- Ana domain web'e yönlensin.
- /api path'i API uygulamasına proxy edilsin.

## Örnek API Uçları

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/playlists/import/m3u`
- `POST /api/playlists/import/xtream`
- `GET /api/categories`
- `GET /api/streams`
- `GET /api/admin/users`
- `PUT /api/admin/ads`