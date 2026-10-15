# Memisahkan Lingkungan Dev dari Produksi — SIAJAR

Panduan langkah demi langkah supaya perubahan besar (struktur tabel, impor massal,
hapus data, seed) diuji di **lingkungan dev** dulu, dan **produksi hanya menerima
perubahan yang sudah lolos uji**.

---

## 0. Prinsip yang dipegang

1. **Produksi tidak pernah jadi tempat coba-coba.** Setiap DDL/DML destruktif
   (impor siswa, wipe, seed jadwal, ubah struktur) dijalankan di dev dulu.
2. **Satu sumber kebenaran skema.** Struktur DB tumbuh lewat **berkas migrasi berurut**,
   bukan tempel-menempel manual. File ad-hoc hanya untuk diagnosa baca-saja.
3. **Dev harus cukup mirip produksi** di titik yang bisa menggagalkan: Auth, Storage
   (bukti foto), Edge Function `manage-users`, dan RLS.
4. **Rahasia tidak pernah masuk repo.** `VITE_*` bukan rahasia (memang tampil di
   bundle) — jadi boleh di-commit. Yang di-ignore hanya `.env.local`.

---

## 1. Kondisi saat ini (yang mau kita ubah)

- Satu instance Supabase **self-hosted**: `https://supa.as-syifa.sch.id`.
- `.env` aplikasi menunjuk ke instance itu (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Tidak ada `supabase/config.toml`, tidak ada folder `supabase/migrations`.
  Semua perubahan struktur berupa file `.sql` lepas di `supabase/` dan `supabase/legacy/`.
- SQL dijalankan **manual** oleh pemilik di SQL Editor Supabase — langsung ke produksi.
- Edge Function `manage-users` hanya ada di produksi.
- **Akibatnya:** setiap revisi struktur menyentuh data nyata, tanpa ruang untuk salah.

---

## 2. Pilih jenis lingkungan dev

Ada tiga cara. Pilih satu (boleh kombinasi), sesuai kenyamanan dan tenaga server.

| | A. Supabase CLI lokal (Docker) | B. Instance self-hosted kedua | C. Project cloud Supabase (free) |
|---|---|---|---|
| Mirip produksi | Tinggi (versi bisa beda) | **Paling mirip** (stack sama persis) | Sedang (versi/ekstensi bisa beda) |
| Bisa diakses dari HP | Tidak (hanya komputer lokal) | **Ya** | **Ya** |
| Biaya | Gratis (butuh Docker Desktop) | Gratis, tapi makan RAM server | Gratis (kuota terbatas) |
| Kerumitan setup | Sedang (pasang Docker + CLI) | Sedang-tinggi (deploy stack kedua) | **Paling mudah** |
| Cocok untuk | Kerja harian cepat, uji migrasi & logika | Uji end-to-end + demo ke guru | Kerja harian + Studio praktis |
| Risiko | Drift versi dari prod | Beban server, biaya ops | Drift dari self-hosted |

**Rekomendasi:** mulai dari **C (project cloud Supabase gratis sebagai dev)** kalau
prioritasnya cepat dan murah — ia sudah memberi Studio, Auth, Storage, dan Edge
Functions tanpa urus server. Naik ke **B** kalau butuh paritas penuh dengan
self-hosted (termasuk perilaku GoTrue/Storage versi Anda) dan ingin diuji dari
perangkat guru sungguhan.

> Catatan: `btree_gist` (untuk exclusion constraint halaqoh) dan `pgcrypto` tersedia
> di Supabase cloud, jadi constraint bentrok tetap bisa diuji di opsi C.

---

## 3. Yang WAJIB diatur (checklist paritas dev)

Ini daftar hal yang sering terlupa saat bikin dev — kalau satu saja lewat, uji bisa
"lulus di dev" tapi gagal di produksi:

- [ ] **URL + anon key instance dev** (`sb_publishable_…` berbeda per instance).
- [ ] **Skema lengkap**: jalankan `supabase/schema.sql` (idempoten) di dev.
- [ ] **Storage bucket + policy bukti foto** — tanpa ini unggah foto gagal.
- [ ] **Edge Function `manage-users`** di-deploy ke dev (buat/ganti/nonaktif akun guru).
- [ ] **`AUTH_DOMAIN` di Edge Function dev** = `VITE_AUTH_DOMAIN` di `.env.development`.
      Email akun guru diturunkan dari sini di kedua sisi — **harus sama persis**.
- [ ] **Auth settings**: JWT expiry `3600` detik, refresh token expiry `30` hari
      (samakan dengan produksi, lihat `DEPLOY.md`).
- [ ] **Admin pertama** dibuat lewat layar setup di dev.
- [ ] **Tahun ajaran**: hanya SATU `academic_year` boleh `ACTIVE` (indeks unik parsial).
      Di dev, set tahun aktif sendiri; baris uji pakai status `'DRAFT'`.
- [ ] **Data seed** secukupnya (kelas, guru, mapel, jadwal contoh) — lihat §5.
- [ ] **RLS aktif** — jangan matikan RLS di dev, karena justru itu yang sering jadi
      sumber bug produksi (`anon → 42501`).

---

## 4. Memisahkan konfigurasi aplikasi (Vite)

Vite memuat `.env` sesuai **mode**: `bun run dev` → mode `development`,
`bun run build` → mode `production`. Urutan prioritas (yang bawah menimpa yang atas):
`.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`.

Rencana file untuk SIAJAR:

```
.env                 # nilai bersama, non-rahasia (opsional)
.env.development     # → instance DEV      (boleh di-commit)
.env.production      # → instance PRODUKSI (boleh di-commit)
.env.local           # override pribadi, DI-IGNORE (sudah ada di .gitignore)
```

Karena `VITE_*` memang tampil di bundle, **tidak masalah di-commit**. Yang penting:
`*.local` tetap di-ignore (sudah begitu di `.gitignore`).

`.env.development` (contoh):
```dotenv
VITE_SUPABASE_URL=https://<dev-instance>
VITE_SUPABASE_ANON_KEY=<anon-dev>
VITE_AUTH_DOMAIN=dev.as-syifa.local
VITE_ADMIN_EMAIL=admin@dev.as-syifa.local
```

`.env.production` = nilai yang sekarang ada di `.env` (produksi).

Tambahkan juga skrip npm untuk kejelasan:
```jsonc
"dev":     "vite",              // otomatis pakai .env.development
"dev:prod": "vite --mode production",
"build":   "tsc -b && vite build" // otomatis pakai .env.production
```

---

## 5. Merapikan skema menjadi migrasi + seed

Sekarang semua perubahan `.sql` lepas. Ubah jadi urutan yang bisa diulang:

1. `supabase init` (buat `supabase/config.toml`) — hanya bila memakai Supabase CLI.
2. Jadikan `supabase/schema.sql` sebagai **migrasi pertama**:
   `supabase/migrations/0001_baseline_schema.sql`.
3. File `supabase/legacy/stage_*.sql` yang sudah pernah dijalankan produksi
   **tidak perlu** diubah jadi migrasi (sudah ada di produksi). Untuk dev yang baru,
   cukup `0001_baseline_schema.sql` + migrasi baru sejak sekarang.
4. Setiap perubahan struktur **berikutnya** = satu berkas migrasi baru bernomor:
   `0002_tambah_kolom_x.sql`, `0003_ubah_constraint_y.sql`, dst. Satu perubahan,
   satu berkas, berurut. Jangan menimpa yang lama.
5. Sediakan **seed dev** yang terpisah dari data nyata:
   - struktur minimal: kelas 1A–6A, beberapa guru, mapel (tandai `is_halaqoh`),
     tahun ajaran aktif, slot waktu.
   - `bun scripts/seed-demo-data.ts` sudah ada untuk agenda contoh.
   - impor siswa contoh: `supabase/import_siswa_2026_2027_kelas_1A_6A.sql`.
6. Skrip **destruktif** (`wipe_all_app_data.sql`, `hapus_semua_siswa.sql`) tetap
   manual, tapi **hanya dijalankan di dev**.

---

## 6. Alur kerja perubahan (dev → uji → produksi)

```
tulis migrasi  →  jalankan di DEV  →  uji (browser/HP + skrip verifikasi)
                                        │
                                   lolos? ── tidak → perbaiki migrasi, ulangi
                                        │ ya
                                        ▼
                              jalankan migrasi SAMA PERSIS di PRODUKSI
```

Aturan:
- **Yang dipromosikan adalah berkas migrasinya, bukan "kebetulan query yang tadi
  diketik".** Dev dan produksi dijalankan dari berkas yang sama.
- Sebelum menyentuh produksi: **backup** (dump) dulu.
- Untuk data uji/seed: **jangan** dijalankan ke produksi.
- Skrip pembersihan di produksi hanya dengan niat sadar + backup.

---

## 7. Pagar pengaman (guardrails)

Supaya tidak salah tembak produksi:

1. **Nama instance jelas** — beri subdomain dev yang gampang dikenali
   (mis. `supa-dev.as-syifa.sch.id`), jangan pakai angka/port yang mudah tertukar.
2. **Nama berkas & header skrip** — beri komentar besar di tiap skrip:
   `-- !! JALANKAN HANYA DI DEV !!` atau `-- aman di produksi`.
3. **Cek environment di skrip destruktif.** Contoh pola di Supabase SQL Editor:
   ```sql
   DO $$
   BEGIN
     -- gagal-cepat kalau dijalankan di instance yang salah
     IF current_setting('app.env', true) <> 'dev' THEN
       RAISE EXCEPTION 'Bukan instance dev — skrip ini hanya untuk dev.';
     END IF;
   END $$;
   ```
   (Atau cukup: simpan skrip destruktif di folder terpisah `supabase/dev-only/`
   dan jangan pernah kirim berkasnya ke sesi produksi.)
4. **Warna tab Studio berbeda** — buka dev dan produksi di jendela browser berbeda,
   beri nama grup tab "DEV" / "PROD". Kelihatan sepele, tapi mencegah banyak insiden.
5. **`dist/` produksi hanya dibangun dari mode `production`** — jangan unggah hasil
   `bun run dev` ke server.

---

## 8. Langkah cepat (ringkas, untuk opsi C — cloud dev)

1. Buat project Supabase baru (free) → beri nama `siajar-dev`.
2. Salin `Project URL` + `anon key` → tulis ke `.env.development`.
3. Di SQL Editor dev: jalankan `supabase/schema.sql`.
4. Buat Storage bucket bukti foto + policy (lihat `schema.sql`, sudah termasuk bucket).
5. Deploy Edge Function `manage-users` ke dev; set `AUTH_DOMAIN`/`ADMIN_EMAIL` di dev.
6. Set Auth settings dev: JWT expiry 3600, refresh 30 hari.
7. `bun run dev` → buka aplikasi → jalankan layar setup (buat admin dev).
8. Jalankan seed: kelas, guru, mapel, tahun ajaran aktif, jadwal contoh.
9. Uji alur kunci: login guru, isi agenda + foto, rekap, halaqoh, kelola akun.
10. Baru setelah semuanya hijau, jalankan migrasi yang sama di produksi.

---

## 9. Untuk opsi B (instance self-hosted kedua)

Tidak jauh berbeda dari §8, tapi dikerjakan di server:

1. Salin folder instalasi Supabase self-hosted ke direktori baru.
2. Ubah `docker-compose.yml`: ganti **semua port** (Kong, Studio, Postgres) dan
   `COMPOSE_PROJECT_NAME` supaya tidak bentrok dengan produksi.
3. Di `.env` instalasi dev: ganti `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`,
   `SERVICE_ROLE_KEY` (jangan sama dengan produksi).
4. Tambah subdomain Nginx baru `supa-dev.as-syifa.sch.id` → Kong dev, aktifkan SSL.
5. `docker compose up -d` → jalankan `schema.sql` di Studio dev.
6. Salin Edge Function ke `volumes/functions/` dev + set `AUTH_DOMAIN` dev, restart.
7. Lanjutkan langkah 6–10 pada §8.

---

## 10. Setelah ini (yang perlu dijaga)

- Setiap revisi besar **selalu** lewat dev.
- Migrasi ditulis sekali, dijalankan di dua tempat (dev, lalu produksi) dari berkas yang sama.
- Backup produksi sebelum promosi.
- Data uji tidak pernah naik ke produksi.
