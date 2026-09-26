# Deployment SIAJAR — aaPanel (Nginx)

Aplikasi ini adalah SPA statis (React + Vite). Tidak ada server aplikasi: browser mengakses Supabase secara langsung.

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

## 4. Edge Function `manage-users`

Satu fungsi ini yang membuat akun, mengubah kode, dan menonaktifkan akun guru. Ia menerima `service_role` key otomatis dari Supabase — tidak ada rahasia yang perlu Anda tempel.

**Cara A — Dashboard Supabase (tanpa CLI)**

1. Buka **Edge Functions → Create a new function**, beri nama `manage-users`.
2. Tempel seluruh isi `supabase/functions/manage-users/index.ts`.
3. Deploy.
4. Buka **Edge Functions → manage-users → Secrets**, tambahkan:
   - `AUTH_DOMAIN` = harus sama dengan `VITE_AUTH_DOMAIN` di `.env`
   - `ADMIN_EMAIL` = sama dengan `VITE_ADMIN_EMAIL` (opsional)

**Cara B — Supabase CLI**

```bash
supabase functions deploy manage-users
supabase secrets set AUTH_DOMAIN=siajar.local
```

> **Penting:** `AUTH_DOMAIN` di Edge Function harus **sama persis** dengan `VITE_AUTH_DOMAIN` di frontend. Email akun guru diturunkan dari nilai ini di kedua sisi; kalau berbeda, login guru akan gagal.

`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` tidak perlu diset — Supabase menyuntikkan keduanya otomatis.

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
