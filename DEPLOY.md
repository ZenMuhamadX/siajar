# Deployment SIAJAR — aaPanel (Nginx)

Aplikasi ini adalah SPA statis (React + Vite). Tidak ada server aplikasi: browser mengakses Supabase secara langsung.

> **Model keamanan:** login memakai Supabase Auth dengan kode sekolah bersama. Verifikasi terjadi di **server**, peran (`guru`/`admin`) dibaca dari `app_metadata` JWT, dan seluruh akses data dibatasi RLS di `supabase/stage_7_rls_auth.sql`. Anon key tetap ada di bundle (itu normal), tetapi tanpa sesi yang sah ia hanya boleh membaca nama guru untuk mengisi halaman login.

Docker tidak digunakan. Build dilakukan di komputer lokal atau server build, lalu hanya isi folder `dist/` yang diunggah ke document root aaPanel.

---

## 1. Konfigurasi lokal

Salin `.env.example` menjadi `.env`, lalu isi:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_DOMAIN` (mis. `siajar.local`)
- `VITE_ADMIN_EMAIL` (mis. `admin@siajar.local`)

Untuk skrip provisioning (dijalankan lokal / server tepercaya, **tidak ikut ke bundle**):

- `SUPABASE_SERVICE_ROLE_KEY`
- `SCHOOL_CODE`
- `ADMIN_CODE`

Nilai `VITE_*` masuk ke bundle browser, jadi hanya boleh berisi alamat atau nama — **bukan rahasia**. Kode sekolah dan kode admin sengaja tanpa prefiks `VITE_` supaya tidak ikut ter-bundle.

Siapkan akun guru setelah `.env` terisi:

```bash
bun scripts/provision-auth-accounts.ts --dry-run   # lihat rencana
bun scripts/provision-auth-accounts.ts             # buat / segarkan akun
```

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

## 4. Database

### 4.1 Instalasi baru

Untuk database kosong, jalankan **dua file berurutan**:

```text
supabase/schema.sql            -- struktur: tabel, index, RLS (gagal-tertutup), bucket Storage
supabase/stage_7_rls_auth.sql  -- keamanan: policy otorisasi, grant, policy Storage
```

`schema.sql` mencakup seluruh tabel aktif, tahun ajaran, jadwal, homeroom, agenda, absensi, substitusi, bukti foto, dan Kotak Saran. `schema.sql` tidak lagi membuat `guru_kelas`; tabel penugasan wali kelas yang aktif adalah `homeroom_assignment`.

**Keduanya wajib.** Setelah `schema.sql` saja, aplikasi belum dapat mengakses data — ini disengaja, karena gagal-tertutup jauh lebih baik daripada database terbuka.

### 4.2 Database existing

Backup database terlebih dahulu, lalu jalankan:

1. `supabase/stage_7_rls_auth.sql` — memasang RLS dan policy otorisasi.
2. `supabase/stage_6_drop_guru_kelas.sql` — bila tabel legacy `guru_kelas` masih ada.

`supabase/rollback_5_auth.sql` sudah **tidak dipakai**; jangan dijalankan karena mengembalikan model akses publik.

---

## 5. Checklist setelah deploy

- [ ] Halaman login menampilkan pilihan nama guru dan kolom "Kode Sekolah".
- [ ] Guru dapat masuk dengan kode sekolah dan tetap masuk setelah refresh.
- [ ] Tanpa login, query langsung ke `agenda.siswa` ditolak server (bukan hanya disembunyikan UI).
- [ ] Login admin dapat membuka panel admin.
- [ ] Login guru dapat membuka agenda, absensi, jadwal, dan Kotak Saran.
- [ ] **Kotak Saran** dapat dibuka dari navbar dan sidebar admin.
- [ ] Agenda dapat disimpan dan absensi tetap dapat diisi.
- [ ] Bukti foto dapat diunggah dan dibuka.
- [ ] Tidak ada lagi file frontend yang querying `guru_kelas`.
- [ ] Folder `dist/` di server sudah ditimpa penuh.
