# SIAJAR — Sistem Agenda Pembelajaran SDIT AS-SYIFA

Aplikasi web untuk mencatat agenda pembelajaran, absensi, bukti foto, dan rekap mengajar guru. Dibangun sebagai SPA (React + TypeScript + Vite) dengan Supabase (PostgreSQL + Storage) sebagai backend.

## Menjalankan secara lokal

```bash
bun install
cp .env.example .env   # isi konfigurasi Supabase
bun run dev             # http://127.0.0.1:9090
```

Perintah lain: `bun run build`, `bun run lint`, dan `bun run preview`.

## Login dan akses database

Aplikasi memakai **Supabase Auth**. Guru memilih namanya lalu memasukkan **kode pribadinya**; admin memakai tab Admin dengan sandinya sendiri.

Cara kerjanya:

1. Tiap guru punya satu akun Supabase Auth (email sintetis `guru-<guru.id>@<VITE_AUTH_DOMAIN>`) yang **dibuatkan admin dari panel Data Guru**.
2. Kode diverifikasi **di server** oleh Supabase Auth — tidak ada rahasia apa pun di bundle browser.
3. Peran (`guru`/`admin`) dan identitas guru disimpan di `app_metadata` JWT. Kolom itu hanya bisa ditulis lewat `service_role`, sehingga tidak bisa dipalsukan dari browser.
4. Sesi disimpan di perangkat dan diperbarui otomatis. Tombol keluar ada di navbar dan panel admin.

Otorisasi ditegakkan oleh RLS di `supabase/schema.sql`. Tanpa sesi yang sah, role `anon` hanya boleh membaca kolom `id` dan `nama_guru` untuk mengisi daftar nama di halaman login.

**Jangan pernah** menaruh `service_role` key di kode frontend atau di variabel `VITE_*`.

### Instalasi baru: urutan singkat

1. Jalankan `supabase/schema.sql` — satu file, idempoten.
2. Pasang Edge Function `manage-users` ke Supabase **self-hosted** Anda — salin foldernya ke `volumes/functions/` lalu restart container `functions`. Langkah lengkapnya di [DEPLOY.md](DEPLOY.md) bagian 4.
3. Buka aplikasi. Layar setup akan meminta pembuatan **admin pertama**.
4. Masuk sebagai admin → menu **Data Guru** → tambah guru beserta kodenya.

Tidak ada skrip yang perlu dijalankan di terminal.

> **Catatan self-hosted:** Edge Function `manage-users` memakai `npm:@supabase/supabase-js@2`. Satu hal yang harus disamakan: `AUTH_DOMAIN` pada environment service `functions` dan `VITE_AUTH_DOMAIN` di `.env`. Halaman setup akan memperingatkan Anda kalau keduanya berbeda.

### Mengatur akun guru

Semua dari panel **Data Guru**:

| Aksi | Efek |
|---|---|
| Tambah Guru | Menambah nama ke daftar (belum punya akun) |
| Tombol kunci | Buatkan akun, ubah kode, atau nonaktifkan |
| Acak | Mengisi kode acak yang mudah dibaca (tanpa I/O/0/1) |

Kode disimpan Supabase sebagai sandi ter-hash, jadi **tidak bisa ditampilkan lagi**. Kalau guru lupa, buat kode baru dari tombol kunci yang sama.

Guru yang akunnya belum dibuatkan tetap muncul di daftar nama, tetapi tidak bisa masuk — pesan loginnya akan menyarankan menghubungi admin.

### Sandi admin

Diganti dari **Pengaturan → Keamanan Akun**. Sandi lama diminta lebih dulu sebagai verifikasi. Kalau sandi admin lupa, reset dari dashboard Supabase → Authentication → Users — tidak perlu terminal.

### Masa sesi 30 hari

Atur di dashboard Supabase → Authentication → Settings:

- **JWT expiry**: 3600 detik (diperbarui otomatis oleh klien).
- **Refresh token expiry**: 30 hari.

Selama sesi masih berlaku, guru tidak perlu memasukkan kode lagi.

## Deployment

Aplikasi ini statis dan di-host di **aaPanel (Nginx)**. Docker tidak digunakan. Panduan lengkap—termasuk konfigurasi Nginx dan setup database—ada di **[DEPLOY.md](DEPLOY.md)**.

## Database

Untuk **instalasi baru**, cukup jalankan **satu file**:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
```

File itu idempoten dan sudah mencakup seluruh tabel (termasuk `app_settings`), index, RLS, fungsi otorisasi, policy, grant, bucket Storage, policy Storage, dan trigger jejak pelaku. Aman dijalankan berulang.

File migrasi lama dipindahkan ke `supabase/legacy/` dan hanya diperlukan untuk database yang sudah berjalan sebelumnya.

### Database existing

Backup dulu, lalu jalankan `supabase/schema.sql` untuk menyelaraskan struktur dan policy. Untuk tabel legacy `guru_kelas`, lihat `supabase/legacy/stage_6_drop_guru_kelas.sql`.

`supabase/legacy/rollback_5_auth.sql` sudah **tidak dipakai**. File itu mengembalikan model akses publik yang menjadi sumber celah fatal; jangan dijalankan.

## Perintah verifikasi

```bash
bun run lint
bunx tsc --noEmit -p tsconfig.app.json
bun test_conflict.ts
bun test_stage2_integration.ts
bun run build
```
