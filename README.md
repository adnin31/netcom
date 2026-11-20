# Netcom — E-Commerce Dashboard

Technical test **Senior Software Engineer — Netcom Scinergy Newsantara**.

Dashboard untuk dataset **Olist Brazilian E-Commerce** (9 CSV, ±1,5 juta baris): login, CRUD semua dataset, grafik revenue harian, deteksi anomali revenue, dan daftar pesanan yang belum dikirim.

| | |
|---|---|
| **Frontend + Backend** | Next.js 16 (App Router, Route Handlers, Proxy), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, lucide-react |
| **Grafik** | [Recharts](https://recharts.org) (library third-party) |
| **Database** | PostgreSQL 16, driver [`postgres`](https://github.com/porsager/postgres) (SQL murni, tanpa ORM) |
| **Auth** | JWT (HS256, `jose`) di cookie HttpOnly + bcrypt |
| **Arsitektur** | Clean Architecture (Entities → Use Cases → Adapters → Frameworks), dijaga ESLint, diuji Vitest |
| **Deploy** | Docker multi-stage (Next.js standalone) + Docker Compose, GitHub Actions → GHCR |

---

## Daftar isi

1. [Pemenuhan tugas](#1-pemenuhan-tugas)
2. [Cara menjalankan](#2-cara-menjalankan)
3. [Cara menggunakan](#3-cara-menggunakan)
4. [Arsitektur & data modeling](#4-arsitektur--data-modeling)
5. [CI/CD](#5-cicd)
6. [C. Analytical & Operation: strategi saat data ×100 dan ratusan user bersamaan](#6-c-analytical--operation)

---

## 1. Pemenuhan tugas

| Tugas | Implementasi |
|---|---|
| Dashboard + **CRUD semua dataset** | Menu *Dataset (CRUD)* — 9 tabel (orders, order_items, order_payments, order_reviews, customers, products, sellers, geolocation, category translation). Pencarian, sorting, pagination server-side, tambah/edit/hapus dengan validasi & pesan error relasi (FK). |
| **Dashboard login** | `/login`, sesi JWT di cookie HttpOnly 8 jam, semua halaman & API diproteksi (`src/proxy.ts` + cek ulang di setiap route handler). |
| **Grafik revenue harian per bulan & tahun** | `/revenue` — pilih tahun & bulan → grafik batang revenue harian + garis jumlah order, KPI (total, growth MoM, rata-rata, hari terbaik), grafik bulanan setahun, tabel rincian harian. |
| **Info anomali revenue harian (tanggal, bulan, tahun)** | `/anomalies` — pilih **tahun**, **bulan** (atau *Semua bulan* → kalender heatmap setahun), lalu klik **tanggal** untuk detail (revenue vs baseline, skor, kategori penyumbang, status order). 3 metode: Median/MAD (default), Z-score, IQR, dengan ambang yang bisa diatur. |
| **Pesanan belum dikirim** | `/unshipped` — filter status/tahun/bulan/ID, urutan, umur pesanan, penanda *lewat estimasi*, dan aksi **Kirim** (status → `shipped`). |
| **ERD (image)** | [`docs/erd.png`](docs/erd.png) (sumber vektor: `docs/erd.svg`) |
| **Dump database** | [`db/netcom_dump.sql.gz`](db/netcom_dump.sql.gz) (pg_dump PostgreSQL 16, schema + data + index + user admin) |
| **Analisis skalabilitas** | [Bagian 6](#6-c-analytical--operation) |

![ERD](docs/erd.png)

---

## 2. Cara menjalankan

### Opsi A — Docker (disarankan, satu perintah)

Prasyarat: Docker + Docker Compose v2.

```bash
git clone <url-repo> netcom && cd netcom
docker compose up -d --build
```

- Postgres otomatis me-*restore* `db/netcom_dump.sql.gz` saat pertama kali start (±1–2 menit, tunggu sampai `db` *healthy*).
- Buka **http://localhost:3000**
- Cek status: `docker compose ps` · log: `docker compose logs -f app`
- Reset database ke kondisi awal: `docker compose down -v && docker compose up -d`

Variabel opsional (buat file `.env` di samping `docker-compose.yml`):

| Variabel | Default | Keterangan |
|---|---|---|
| `AUTH_SECRET` | nilai contoh | **Wajib diganti di production**: `openssl rand -base64 32` |
| `APP_PORT` / `DB_PORT` | `3000` / `5433` | Port host |
| `POSTGRES_USER/PASSWORD/DB` | `netcom` | Kredensial database |
| `APP_IMAGE` | `ghcr.io/adnin31/netcom:latest` | Pakai image dari GHCR tanpa build lokal: `docker compose pull app && docker compose up -d` |
| `COOKIE_SECURE` | `false` | `true` bila di balik HTTPS |

### Opsi B — Development lokal

Prasyarat: Node.js 22+, PostgreSQL 16 (atau Postgres dari Docker).

```bash
# 1. Database (contoh pakai Docker)
docker run -d --name netcom-db -e POSTGRES_USER=netcom -e POSTGRES_PASSWORD=netcom \
  -e POSTGRES_DB=netcom -p 5433:5432 postgres:16-alpine

# 2. Restore dump
gunzip -c db/netcom_dump.sql.gz | psql postgres://netcom:netcom@localhost:5433/netcom

# 3. Aplikasi
cp .env.example .env.local      # sesuaikan DATABASE_URL & AUTH_SECRET
npm ci
npm run dev                     # http://localhost:3000
```

### Opsi C — Deploy gratis: Vercel + Neon

Live: **https://dashboard.arraidev.site** (juga https://netcom-mocha.vercel.app)

1. **Neon** — project sudah di-link lewat Neon CLI (`neon init` → `neon.ts`, `neon deploy`). Region **AWS US East 2 (Ohio)**, Postgres 18. `neon deploy` menulis `DATABASE_URL` (pooled) dan `DATABASE_URL_UNPOOLED` (direct) ke `.env.local`. Restore dump memakai koneksi **direct**:
   ```bash
   gunzip -c db/netcom_dump.sql.gz | psql "$DATABASE_URL_UNPOOLED"
   ```
2. **Vercel** — *Add New → Project → Import* repo ini (framework terdeteksi Next.js). `vercel.json` mengunci region function ke `cle1` (Cleveland), region Vercel terdekat dengan database di Ohio. Environment variables:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | connection string Neon **pooled** (host `-pooler`) |
   | `DB_PREPARE` | `false` (pooler mode transaksi) |
   | `DB_POOL_MAX` | `3` |
   | `AUTH_SECRET` | hasil `openssl rand -base64 32` |
   | `COOKIE_SECURE` | `true` |

3. **Domain** — Vercel → Project → Settings → Domains → tambah `dashboard.arraidev.site`, lalu di DNS (Hostinger) tambahkan record `CNAME dashboard → <target dari Vercel>`. HTTPS aktif otomatis.

Setiap push ke `main` otomatis di-deploy ulang oleh Vercel.

### Import ulang dari CSV (opsional)

Dump sudah berisi seluruh data. Bila ingin membangun ulang dari CSV asli:

```bash
unzip dataset_technical_test_netcom.zip -d /tmp/olist
DATABASE_URL=postgres://netcom:netcom@localhost:5433/netcom ./scripts/import-dataset.sh /tmp/olist
```

Script membuat schema (`db/schema.sql`), memuat CSV dengan `COPY`, membuat index setelah load (`db/indexes.sql`), lalu membuat user admin. Membuat dump baru:

```bash
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > db/netcom_dump.sql.gz
```

---

## 3. Cara menggunakan

**Akun demo**

| Email | Password |
|---|---|
| `admin@netcom.local` | `admin123` |

| Halaman | Fungsi |
|---|---|
| **Overview** `/` | KPI (revenue, order, pelanggan unik, belum dikirim), tren revenue bulanan (klik titik → ke revenue harian bulan itu), kategori terlaris, status order, metode pembayaran, top state. |
| **Revenue Harian** `/revenue?year=2017&month=11` | Pilih tahun & bulan. Grafik harian, growth vs bulan lalu, tabel rincian. |
| **Anomali Revenue** `/anomalies?year=2017&month=11&date=2017-11-24` | Pilih tahun, bulan (atau *Semua bulan*), metode & ambang. Klik titik merah / tanggal di kalender / baris tabel untuk detail hari tersebut. |
| **Belum Dikirim** `/unshipped` | Daftar 622 order yang belum diserahkan ke kurir. Tombol **Kirim** mengubah status menjadi `shipped` dan mengisi `order_delivered_carrier_date`. |
| **Dataset (CRUD)** `/data/<tabel>` | Cari, urutkan (klik header kolom), paging, **Tambah**, ✏️ edit, 🗑️ hapus. Primary key tidak bisa diubah saat edit. |

### Definisi bisnis yang dipakai

- **Revenue harian** = `SUM(order_payments.payment_value)` untuk order dengan status selain `canceled` / `unavailable`, dikelompokkan berdasarkan tanggal `order_purchase_timestamp`. Hari tanpa transaksi diisi 0 (`generate_series`).
- **Anomali** — setiap hari dibandingkan dengan distribusi revenue harian **di bulan yang sama** (minimal 7 hari data; hari di luar cakupan dataset tidak dihitung):
  - *Median/MAD (default)*: modified z = 0,6745·(x − median)/MAD, anomali bila |z| ≥ 3,5. Dipilih sebagai default karena tidak "tertarik" oleh outlier ekstrem (mis. Black Friday 24-11-2017 = +507% dari baseline).
  - *Z-score*: (x − mean)/std, |z| ≥ 2.
  - *IQR*: di luar [Q1 − k·IQR, Q3 + k·IQR], k = 1,5.
  - Hasil diklasifikasikan **Lonjakan** (di atas normal) atau **Penurunan** (di bawah normal).
- **Belum dikirim** = `order_delivered_carrier_date IS NULL` dan status bukan `canceled`, `unavailable`, `delivered` (status `created`, `approved`, `invoiced`, `processing`). Umur & "lewat estimasi" dihitung terhadap tanggal terakhir di dataset (2018-10-17), karena datanya historis.

### REST API (butuh cookie sesi)

| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/auth/login` · `/api/auth/logout` | `{ email, password }` |
| `GET` | `/api/data/:table?q=&page=&pageSize=&sort=&dir=` | List + search + sort + paging |
| `POST` | `/api/data/:table` | `{ values }` |
| `PUT` | `/api/data/:table` | `{ key, values }` (key = object primary key, mendukung composite key) |
| `DELETE` | `/api/data/:table` | `{ key }` |
| `POST` | `/api/orders/:id/ship` | Tandai order dikirim |
| `GET` | `/api/health` | Health check (publik) |

---

## 4. Arsitektur & data modeling

Kode disusun mengikuti **[The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)** (Robert C. Martin). Ada 4 lingkaran, dan **Dependency Rule** berlaku: dependensi source code hanya boleh mengarah **ke dalam**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Frameworks & Drivers   src/app, src/components, src/proxy.ts, src/infrastructure │
│  Next.js pages/route handlers, React UI, PostgreSQL pool, config, DI container   │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ Interface Adapters   src/adapters                                         │ │
│  │  http/ controllers + error presenter · persistence/postgres/ repositories │ │
│  │  security/ bcrypt & JWT · system-clock                                    │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Use Cases   src/core/application                                    │   │ │
│  │  │  Login, GetOverview, GetDailyRevenue, DetectRevenueAnomalies,      │   │ │
│  │  │  ListUnshippedOrders, ShipOrder, List/Create/Update/DeleteRecord   │   │ │
│  │  │  ports.ts = interface Repository/PasswordHasher/TokenService/Clock │   │ │
│  │  │  ┌──────────────────────────────────────────────────────────────┐ │   │ │
│  │  │  │ Entities   src/core/domain                                   │ │   │ │
│  │  │  │  Order (aturan pengiriman), Revenue, Anomaly (MAD/Z/IQR),    │ │   │ │
│  │  │  │  Period, Dataset (definisi + validasi record), User, errors  │ │   │ │
│  │  │  └──────────────────────────────────────────────────────────────┘ │   │ │
│  │  └────────────────────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Alur satu request** (contoh: tombol *Kirim*):

```
route.ts (Next) → OrderController (adapter) → ShipOrder (use case)
                                                 ├─ OrderRepository.findById  ← port, diimplementasi PostgresOrderRepository
                                                 ├─ assertCanShip(order)      ← aturan bisnis di entity Order
                                                 ├─ Clock.now()               ← port, diimplementasi SystemClock
                                                 └─ OrderRepository.markShipped
             ← DomainError → error-presenter → HTTP 400/404/409
```

| Lingkaran | Boleh bergantung pada | Tidak boleh tahu |
|---|---|---|
| **Entities** `core/domain` | — (TypeScript murni) | use case, SQL, HTTP, Next.js, React |
| **Use Cases** `core/application` | Entities + *port* yang ia definisikan sendiri | PostgreSQL, bcrypt/jose, Next.js |
| **Adapters** `adapters` | Core + driver (postgres, jose, bcrypt) | Next.js, composition root, UI |
| **Frameworks** `app`, `components`, `infrastructure` | Semua lapisan di dalamnya | — |

Prinsip yang diterapkan:

- **Dependency Inversion lewat ports.** Use case memanggil `interface` di `core/application/ports.ts`. Implementasinya ada di luar (`PostgresRevenueRepository`, `BcryptPasswordHasher`, `JoseTokenService`, `SystemClock`). Mengganti Postgres ke DB lain hanya menambah adapter baru tanpa menyentuh core.
- **Hanya DTO sederhana yang melewati batas.** Repository mengembalikan objek data polos (mis. `DayRevenue`, `UnshippedRow`), bukan baris driver. Error SQL (`23505`, `23503`, …) diterjemahkan menjadi `ConflictError`/`ValidationError` di adapter, sehingga core tidak pernah melihat kode SQLSTATE.
- **Aturan bisnis ada di entity, bukan di SQL atau UI.** Contohnya: siapa yang boleh dikirim (`assertCanShip`), hitungan umur dan *overdue*, definisi revenue, ringkasan bulanan, deteksi anomali, dan validasi record CRUD.
- **Composition root tunggal** (`src/infrastructure/container.ts`) merakit semua dependensi. Container dibangun *lazy*, sehingga `next build` jalan tanpa database maupun secret.
- **Lapisan framework tipis.** Route handler cukup satu baris yang memanggil controller. Page memanggil `getUseCases()` lalu menampilkan output use case.
- **Dependency Rule dijaga otomatis.** `eslint.config.mjs` memakai `no-restricted-imports` per lapisan. Contohnya, `import postgres` atau `@/infrastructure/*` di `core/domain` menyebabkan **lint error**, dan CI pun gagal.
- **Testable tanpa infrastruktur.** `npm test` (Vitest) menguji entity dan use case dengan *fake* in-memory, tanpa database maupun web server.

**Keputusan modeling**

- Nama kolom mengikuti header CSV asli (termasuk typo `product_name_lenght`) agar dataset bisa di-import ulang tanpa transformasi.
- **Composite primary key** sesuai grain data: `order_items (order_id, order_item_id)`, `order_payments (order_id, payment_sequential)`, `order_reviews (review_id, order_id)` — `review_id` di dataset **tidak unik** (satu review bisa untuk beberapa order).
- `geolocation` tidak punya natural key (zip prefix berulang) → surrogate `id bigserial`. Relasinya ke customers/sellers adalah relasi **logis** via zip prefix (tanpa FK) — ditandai garis putus-putus di ERD.
- Foreign key dengan aturan eksplisit: item/payment/review `ON DELETE CASCADE` ke orders; orders → customers dan items → products/sellers `RESTRICT` (UI menampilkan pesan "masih dipakai tabel lain").
- Dua kategori produk (`pc_gamer`, `portateis_cozinha_e_preparadores_de_alimentos`) tidak ada di file terjemahan → didaftarkan saat import agar FK `products → product_category_name_translation` tetap valid.
- `numeric(12,2)` untuk uang, `CHECK` untuk nilai negatif & skor review 1–5.
- Index dibuat **setelah** bulk load: timestamp pembelian (query revenue), FK (join), zip prefix, dan **partial index** khusus halaman *belum dikirim*.

**Keamanan**

- Password bcrypt; login membandingkan hash dummy bila email tidak ada (mencegah *user enumeration* lewat timing).
- Cookie `HttpOnly`, `SameSite=Lax`, opsional `Secure`.
- Semua nilai SQL ter-parameterisasi; nama tabel/kolom/sort hanya dari whitelist metadata (`?sort=order_id;drop` diabaikan).
- Container berjalan sebagai user non-root.

**Struktur folder**

```
netcom/
├─ src/
│  ├─ core/                         ← tidak bergantung pada framework/DB apa pun
│  │  ├─ domain/                    Entities: order, revenue, anomaly, period, dataset, user, errors (+ unit test)
│  │  └─ application/
│  │     ├─ ports.ts                interface yang dibutuhkan use case
│  │     └─ use-cases/              login, get-overview, get-daily-revenue, detect-revenue-anomalies,
│  │                                get-day-breakdown, list-unshipped-orders, ship-order, manage-dataset (+ test)
│  ├─ adapters/
│  │  ├─ http/                      controllers, error-presenter, session-cookie
│  │  ├─ persistence/postgres/      repository SQL + penerjemah error PG
│  │  ├─ security/                  bcrypt-password-hasher, jose-token-service
│  │  └─ system-clock.ts
│  ├─ infrastructure/               config, database pool, container (DI), session (Next cookies)
│  ├─ app/                          Next.js: pages (dashboard, login) & route handlers (1 baris → controller)
│  ├─ components/                   React UI: charts (Recharts), data-table, filter, sidebar, format
│  └─ proxy.ts                      cek sesi sebelum routing
├─ db/                              schema.sql, indexes.sql, netcom_dump.sql.gz
├─ docs/                            erd.png, erd.svg
├─ scripts/                         import-dataset.sh
├─ Dockerfile · docker-compose.yml · .github/workflows/ci-cd.yml
```

**Perintah pengembangan**

```bash
npm run dev        # dev server
npm test           # unit test domain + use case (tanpa DB)
npm run lint       # ESLint + pengecekan Dependency Rule
npm run typecheck  # TypeScript
npm run build      # build produksi (standalone)
```

---

## 5. CI/CD

Workflow `.github/workflows/ci-cd.yml`:

1. **check** (push & PR ke `main`/`develop`): `npm ci` → lint (termasuk Dependency Rule) → typecheck → **unit test** → `next build`.
2. **docker** (push branch/tag): build image multi-stage dengan cache GitHub Actions, push ke **GHCR** `ghcr.io/<owner>/netcom` dengan tag `latest` (branch default), nama branch, `sha-xxxxxxx`, dan semver dari tag `v*`.
3. **deploy** (opsional, hanya `main`): SSH ke server lalu `git pull && docker compose pull app && docker compose up -d`. Aktif bila repository variable `DEPLOY_HOST` diisi. Butuh: variables `DEPLOY_HOST`, `DEPLOY_USER`, (`DEPLOY_PATH`), secret `DEPLOY_SSH_KEY`.

> Bila package GHCR masih *private*, ubah visibility menjadi public di GitHub → Packages agar bisa `docker pull` tanpa login.

---

## 6. C. Analytical & Operation

> *Apa yang dilakukan bila data membesar ratusan kali lipat dan aplikasi diakses ratusan orang bersamaan?*

Saat ini: ~100 rb order, ~1 juta geolokasi. ×100 berarti **±10 juta order, ±11 juta item, ±100 juta baris geolokasi**. Pendekatan saya bertahap — ukur dulu, lalu perbaiki bottleneck terbesar, bukan langsung menambah infrastruktur.

### 6.1 Ukur dulu
- Aktifkan `pg_stat_statements`, slow query log (`log_min_duration_statement`), dan APM/tracing (OpenTelemetry) di Next.js; dashboard p95 latency, error rate, koneksi DB, cache hit ratio.
- Load test (k6) dengan skenario realistis (mis. 300 user bersamaan) sebelum & sesudah setiap perubahan, dijalankan di CI/staging.

### 6.2 Database (bottleneck pertama)
1. **Pre-aggregation untuk analitik.** Query revenue/anomali saat ini meng-agregasi tabel transaksi setiap request. Dengan 10 juta order, ganti dengan tabel ringkasan `daily_revenue (date, revenue, orders, …)` — hanya ±800 baris untuk 2 tahun — yang di-update **inkremental** (trigger / job setiap N menit / materialized view `REFRESH … CONCURRENTLY`). Grafik & anomali jadi O(jumlah hari), bukan O(jumlah order). Skor anomali juga bisa dihitung sekali per hari oleh job, bukan per request.
2. **Index yang tepat & cek `EXPLAIN ANALYZE`**: composite index sesuai pola filter (mis. `(order_status, order_purchase_timestamp)`), *covering index* (`INCLUDE`), partial index seperti untuk *belum dikirim* (sudah diterapkan), `pg_trgm` GIN untuk pencarian teks (`ILIKE '%…%'`), BRIN untuk kolom waktu di tabel append-only besar.
3. **Pagination keyset/seek** (`WHERE (sort_col, pk) > (…) LIMIT 20`) menggantikan `OFFSET` yang makin lambat di halaman dalam; `COUNT(*)` diganti estimasi (`pg_class.reltuples`) atau di-cache untuk tabel ratusan juta baris.
4. **Partitioning** tabel besar per waktu (orders/items/payments per bulan, `PARTITION BY RANGE`) → partition pruning, maintenance & arsip data lama lebih murah. Geolocation (100 jt baris) cukup di-*dedup* per zip prefix (1 koordinat rata-rata per zip) untuk kebutuhan aplikasi.
5. **Connection pooling** dengan **PgBouncer** (transaction mode): ratusan user × beberapa instance app tidak boleh membuka ratusan koneksi Postgres langsung. Pool kecil per instance (`DB_POOL_MAX`).
6. **Read replica**: query baca/analitik ke replica, write (CRUD) ke primary. Untuk analitik yang sangat berat, pisahkan ke OLAP (ClickHouse/BigQuery/TimescaleDB continuous aggregates) via CDC (Debezium) agar tidak membebani OLTP.
7. Tuning: `shared_buffers`, `work_mem`, autovacuum per tabel besar, `statement_timeout` agar query liar tidak menahan koneksi.

### 6.3 Caching
- Data historis/analitik jarang berubah → cache hasilnya. Di Next.js 16 sudah tersedia `"use cache"` + `cacheTag`/`cacheLife`: cache revenue per bulan, invalidasi dengan `revalidateTag('revenue')` saat ada CRUD orders/payments.
- Untuk banyak instance: **Redis** sebagai shared cache (cache-aside, TTL + invalidasi berbasis event), juga untuk rate limiting & sesi bila diperlukan.
- CDN di depan aplikasi untuk aset statis (`/_next/static`, font) — shell halaman sudah di-*prerender* (Partial Prerendering), jadi hanya bagian data yang di-stream.

### 6.4 Aplikasi & infrastruktur
- Aplikasi **stateless** (sesi di JWT, tidak ada state di memori) → bisa **horizontal scaling**: beberapa container di belakang load balancer (Nginx/Traefik/ALB), atau Kubernetes dengan HPA berbasis CPU/latency. Health check `/api/health` sudah tersedia untuk readiness/liveness.
- Batasi ukuran respons: pagination wajib, `pageSize` maks 100 (sudah), kolom yang di-select seperlunya, kompresi gzip/brotli.
- Pekerjaan berat (import CSV, export laporan, refresh agregat, notifikasi) dipindah ke **background job/queue** (BullMQ/RabbitMQ) agar request user tetap cepat.
- Rate limiting di API & login (cegah brute force dan *noisy neighbor*).
- Deploy tanpa downtime: image immutable dari CI (sudah), rolling update, migrasi DB yang *backward-compatible* (expand → migrate → contract).

### 6.5 Operasional
- Monitoring & alerting (Prometheus + Grafana / Datadog): p95 latency, error rate, saturasi CPU/memori, lag replica, jumlah koneksi.
- Backup otomatis + PITR (WAL archiving), uji restore berkala.
- Kapasitas direncanakan dari hasil load test, dengan *autoscaling* untuk lonjakan seperti Black Friday — yang juga terlihat di data ini sebagai anomali terbesar (24-11-2017).

**Prioritas bila harus memilih urutan:** (1) tabel agregat harian + cache untuk analitik, (2) PgBouncer + index/keyset pagination untuk CRUD, (3) horizontal scaling app di balik load balancer, (4) read replica / partitioning, (5) OLAP terpisah bila kebutuhan analitik terus bertambah.
