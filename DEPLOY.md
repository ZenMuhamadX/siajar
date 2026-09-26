# Deployment SIAJAR — aaPanel (Nginx)

Aplikasi ini adalah SPA statis (React + Vite). Tidak ada server aplikasi milik sendiri: browser mengakses Supabase secara langsung. Satu-satunya komponen server adalah Edge Function `manage-users`, yang berjalan di dalam stack **Supabase self-hosted** Anda.

> **Model keamanan:** login memakai Supabase Auth dengan **kode pribadi per guru**. Verifikasi terjadi di **server**, peran (`guru`/`admin`) dibaca dari `app_metadata` JWT, dan seluruh akses data dibatasi RLS di `supabase/schema.sql`. Anon key tetap ada di bundle (itu normal), tetapi tanpa sesi yang sah ia hanya boleh membaca nama guru untuk mengisi halaman login. Tidak ada rahasia apa pun di frontend.

Docker tidak digunakan. Build dilakukan di komputer lokal atau server build, lalu hanya isi folder `dist/` yang diunggah ke document root aaPanel.

---

## 1. Konfigurasi lokal

Salin `.env.example` menjadi `.env`, lalu isi:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_DOMAIN` (mis. `siajar.local`)
- `VITE_ADMIN_EMAIL` (mis. `admin@siajar.local`)

Nilai `VITE_*` masuk ke bundle browser, jadi hanya boleh berisi alamat atau nama — **bukan rahasia**. `.env` tidak lagi menyimpan rahasia apa pun: kode guru diatur admin dari panel, sandi admin dibuat lewat layar setup, dan `service_role` key tidak diperlukan di sini.

Lalu atur masa sesi di dashboard Supabase → **Authentication → Settings**: JWT expiry `3600` detik dan **Refresh token expiry `30` hari**, supaya guru cukup masuk sekali per perangkat.

Build:

```bash
bun install
bun run build
```

Hasil build berada di `dist/`.

---

## 2. Unggah ke aaPanel

1. Buka **Website → situs sekolah → Document Root**.
2. Upload seluruh isi `dist/` ke document root.
3. Pastikan `index.html` berada satu level di bawah document root.
4. Hapus file build lama sebelum mengunggah versi baru agar aset lama tidak tertinggal.

---

## 3. Konfigurasi Nginx

aaPanel menyediakan menu **Website → Config → Config File**. Tambahkan blok ini di dalam `server { ... }` dan hapus blok `location /` bawaan yang bentrok:

```nginx
# Routing SPA: semua path dilayani index.html
location / {
    try_files $uri $uri/ /index.html;
}

# Aset ber-hash: aman di-cache lama
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}

location = /index.html {
    add_header Cache-Control "no-cache";
}

# Header keamanan
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;
```

`camera=(self)` wajib karena aplikasi memakai kamera untuk bukti foto.

Aktifkan TLS melalui **Website → SSL → Let's Encrypt**, lalu aktifkan **Force HTTPS**. Jika `nginx -t` gagal, kembalikan konfigurasi aaPanel sebelumnya sebelum melakukan perubahan lain.

---

## 4. Edge Function `manage-users` (Supabase self-hosted)

Satu fungsi ini yang membuat akun, mengubah kode, dan menonaktifkan akun guru. Fungsinya memakai `npm:@supabase/supabase-js@2`.

> Butuh `edge-runtime` yang mendukung specifier `npm:` (instalasi self-hosted 2024 ke atas) dan akses ke registry npm. Kalau muncul galat module resolution saat deploy, ganti ke versi tanpa dependensi:
>
> ```bash
> git show 1879fc4:supabase/functions/manage-users/index.ts > volumes/functions/manage-users/index.ts
> docker compose restart functions
> ```

### 4.1 Pasang fungsinya

Pada instalasi self-hosted, Edge Function dilayani dari folder `volumes/functions/` yang di-mount ke container `functions`. **Tidak perlu CLI:**

```bash
# jalankan dari root instalasi Supabase self-hosted Anda
cp -r /path/ke/siajar/supabase/functions/manage-users volumes/functions/manage-users
docker compose restart functions
```

Struktur yang benar:

```text
volumes/
  functions/
    manage-users/
      index.ts
```

Bila Anda memakai Supabase CLI yang diarahkan ke instance self-hosted:

```bash
supabase functions deploy manage-users --project-ref <ref>
```

### 4.2 Variabel lingkungan

Ada empat variabel yang perlu dibedakan. Satu di antaranya **tidak ada di Supabase sama sekali** dan harus Anda tambahkan sendiri:

| Variabel | Status | Nilai |
|---|---|---|
| `SUPABASE_URL` | sudah ada di docker-compose | `http://kong:8000` — **jangan diubah** |
| `SUPABASE_SERVICE_ROLE_KEY` | sudah ada di docker-compose | otomatis dari `${SERVICE_ROLE_KEY}` |
| `AUTH_DOMAIN` | **belum ada — Anda yang menambahkan** | samakan dengan `VITE_AUTH_DOMAIN` |
| `ADMIN_EMAIL` | opsional, belum ada | `admin@<AUTH_DOMAIN>` |

`AUTH_DOMAIN` bukan variabel Supabase, melainkan variabel milik aplikasi ini. Karena itu ia tidak akan ditemukan di mana pun sampai Anda sendiri menambahkannya.

**Di mana menambahkannya.** Buka `docker-compose.yml` di root instalasi Supabase self-hosted, lalu cari service bernama `functions` (image-nya `supabase/edge-runtime`). Bentuknya seperti ini:

```yaml
  functions:
    container_name: supabase-edge-functions
    image: supabase/edge-runtime:v1.x.x
    restart: unless-stopped
    volumes:
      - ./volumes/functions:/home/deno/functions:Z
    environment:
      JWT_SECRET: ${JWT_SECRET}
      SUPABASE_URL: http://kong:8000        # jangan diubah
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
      SUPABASE_DB_URL: postgresql://...
      VERIFY_JWT: "false"
      AUTH_DOMAIN: as-syifa.sch.id          # <-- tambahkan dua baris ini
      ADMIN_EMAIL: admin@as-syifa.sch.id
```

Lalu terapkan:

```bash
docker compose up -d functions
```

> **Jangan tertukar dua file `.env`.** File `.env` di root Supabase self-hosted (berisi `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`) adalah file yang **berbeda** dari `.env` aplikasi SIAJAR (berisi `VITE_*`). `AUTH_DOMAIN` tidak wajib ada di file Supabase itu — cukup ditulis langsung di `docker-compose.yml` seperti contoh di atas.

**Alternatif tanpa menyentuh docker-compose.** Karena nilainya tetap, domain bisa langsung ditulis di sumber Edge Function. Ubah baris:

```ts
const AUTH_DOMAIN = Deno.env.get('AUTH_DOMAIN') ?? 'siajar.local';
```

menjadi:

```ts
const AUTH_DOMAIN = Deno.env.get('AUTH_DOMAIN') ?? 'as-syifa.sch.id';
```

Lalu salin ulang file ke `volumes/functions/` dan restart container. Cukup satu tempat, tanpa mengedit docker-compose.

> **Penting:** nilai ini harus **sama persis** dengan `VITE_AUTH_DOMAIN` di `.env` aplikasi, karena email akun guru diturunkan dari nilai ini di kedua sisi. Perhatikan juga: akun yang **sudah terlanjur dibuat** memakai domain tertentu, dan email itu tidak bisa diubah tanpa membuat ulang akunnya. Jadi samakan dengan domain yang sudah dipakai, bukan dengan nilai default. Default di kode (`siajar.local`) hanya cocok bila `VITE_AUTH_DOMAIN` juga dibiarkan default.

Catatan: pada self-hosted, service `functions` default memakai `VERIFY_JWT: "false"`. Itu tidak masalah — fungsi ini memverifikasi token pemanggil sendiri lewat GoTrue sebelum mengizinkan aksi apa pun.

### 4.3 Verifikasi cepat

```bash
curl -s -X POST https://supabase.sekolahanda.sch.id/functions/v1/manage-users \
  -H "apikey: <anon-key>" \
  -H 'Content-Type: application/json' \
  -d '{"action":"status"}'
```

Sebelum admin pertama dibuat, jawabannya harus seperti:

```json
{ "hasAdmin": false, "authDomain": "siajar.local", "adminEmail": "admin@siajar.local" }
```

Kalau muncul galat tentang `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` kosong, berarti environment service `functions` belum benar — ulangi langkah 4.2.

---

## 5. Database

### 5.1 Instalasi baru

Untuk database kosong, cukup jalankan **satu file**:

```text
supabase/schema.sql
```

File itu idempoten dan sudah mencakup seluruh tabel (termasuk `app_settings`), index, RLS, fungsi otorisasi, policy, grant, bucket Storage, policy Storage, dan trigger jejak pelaku. Aman dijalankan berulang.

`schema.sql` tidak membuat `guru_kelas`; tabel penugasan wali kelas yang aktif adalah `homeroom_assignment`.

### 5.2 Database existing

Backup database terlebih dahulu, lalu jalankan `supabase/schema.sql` untuk menyelaraskan struktur dan policy. Untuk tabel legacy `guru_kelas`, lihat `supabase/legacy/stage_6_drop_guru_kelas.sql`.

`supabase/legacy/rollback_5_auth.sql` sudah **tidak dipakai**; jangan dijalankan karena mengembalikan model akses publik.

---

## 6. Checklist setelah deploy

- [ ] Halaman login menampilkan pilihan nama guru dan kolom **"Kode Anda"**.
- [ ] Saat database masih kosong, halaman login menampilkan tautan *"Instance ini belum punya admin"*.
- [ ] Layar setup berhasil membuat admin pertama dan langsung masuk ke panel.
- [ ] Layar setup mati sendiri setelah admin ada (dialihkan ke `/login`).
- [ ] Admin dapat membuatkan akun guru + kode dari menu **Data Guru**.
- [ ] Guru dapat masuk dengan kode pribadinya dan tetap masuk setelah refresh.
- [ ] Kode guru bisa diganti dari panel; kode lama tidak berlaku lagi.
- [ ] Akun guru yang dinonaktifkan tidak bisa masuk.
- [ ] Sandi admin dapat diganti dari **Pengaturan → Keamanan Akun**.
- [ ] Tanpa login, query langsung ke `agenda.siswa` ditolak server (bukan hanya disembunyikan UI).
- [ ] Bukti foto dapat diunggah dan dibuka; tanpa login ditolak.
- [ ] Folder `dist/` di server sudah ditimpa penuh.
