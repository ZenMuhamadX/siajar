# Deployment SIAJAR — aaPanel (Nginx)

Aplikasi ini adalah SPA statis (React + Vite). Tidak ada server aplikasi: browser mengakses Supabase secara langsung.

> **Model keamanan:** login memakai PIN yang ditanam saat build. PIN bukan autentikasi per pengguna dan tidak membatasi akses database. Policy database dalam mode ini mengizinkan akses anon agar frontend dapat bekerja. Jangan anggap aplikasi ini memiliki RBAC atau audit identitas yang kuat.

Docker tidak digunakan. Build dilakukan di komputer lokal atau server build, lalu hanya isi folder `dist/` yang diunggah ke document root aaPanel.

---

## 1. Konfigurasi lokal

Salin `.env.example` menjadi `.env`, lalu isi:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TEACHER_PIN`
- `VITE_ADMIN_PIN`

Jangan pernah memasukkan `service_role` key. Nilai `VITE_*` akan masuk ke bundle browser.

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

Untuk database kosong, cukup jalankan **satu file**:

```text
supabase/schema.sql
```

File tersebut sudah mencakup seluruh tabel aktif, tahun ajaran, jadwal, homeroom, agenda, absensi, substitusi, bukti foto, Kotak Saran, RLS policy publik, grant `anon`, bucket Storage, dan policy Storage.

`schema.sql` tidak lagi membuat `guru_kelas`; tabel penugasan wali kelas yang aktif adalah `homeroom_assignment`.

Migration incremental di folder `supabase/` tetap dipertahankan untuk database existing, tetapi tidak perlu dijalankan untuk instalasi baru.

### 4.2 Databases yang sudah menjalankan Stage 5 Auth

Jika Supabase Auth pernah diaktifkan, **backup database terlebih dahulu**. Lalu jalankan:

1. `supabase/rollback_5_auth.sql` — menghapus policy/trigger/fungsi Stage 5, mengembalikan policy publik, grant anon, dan policy Storage.
2. `supabase/stage_6_drop_guru_kelas.sql` — memindahkan data `guru_kelas` ke `homeroom_assignment` bila masih diperlukan, lalu menghapus tabel legacy.

`stage_6_drop_guru_kelas.sql` berhenti tanpa menghapus data jika ada konflik guru per kelas atau tidak ada tahun ajaran `ACTIVE`.

Setelah migration selesai, build versi login PIN dan upload `dist/`. Jangan menjalankan migrasi Stage 5 Auth; model deployment ini tidak membutuhkannya.

---

## 5. Checklist setelah deploy

- [ ] Halaman login menampilkan dua opsi PIN, bukan form email.
- [ ] Login admin dapat membuka panel admin.
- [ ] Login guru dapat membuka agenda, absensi, jadwal, dan Kotak Saran.
- [ ] **Kotak Saran** dapat dibuka dari navbar dan sidebar admin.
- [ ] Agenda dapat disimpan dan absensi tetap dapat diisi.
- [ ] Bukti foto dapat diunggah dan dibuka.
- [ ] Tidak ada lagi file frontend yang querying `guru_kelas`.
- [ ] Folder `dist/` di server sudah ditimpa penuh.
