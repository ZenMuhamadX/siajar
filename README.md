# SIAJAR — Sistem Agenda Pembelajaran SDIT AS-SYIFA

Aplikasi web untuk mencatat agenda pembelajaran, absensi, bukti foto, dan rekap mengajar guru. Dibangun sebagai SPA (React + TypeScript + Vite) dengan Supabase (PostgreSQL + Storage) sebagai backend.

## Menjalankan secara lokal

```bash
bun install
cp .env.example .env   # isi konfigurasi Supabase dan PIN lokal
bun run dev             # http://127.0.0.1:9090
```

Perintah lain: `bun run build`, `bun run lint`, dan `bun run preview`.

## Login dan akses database

Aplikasi memakai **Supabase Auth** dengan UX yang tetap sederhana: guru memilih namanya lalu memasukkan **kode sekolah bersama**. Tidak ada sandi panjang yang perlu dihafal, dan guru cukup masuk sekali per perangkat.

Cara kerjanya:

1. Tiap guru punya satu akun Supabase Auth (email sintetis `guru-<guru.id>@<VITE_AUTH_DOMAIN>`) yang dibuat oleh `scripts/provision-auth-accounts.ts`.
2. Kode sekolah diverifikasi **di server** oleh Supabase Auth — tidak lagi di bundle browser.
3. Peran (`guru`/`admin`) dan identitas guru disimpan di `app_metadata` JWT. Kolom itu hanya bisa ditulis lewat `service_role`, sehingga tidak bisa dipalsukan dari browser.
4. Sesi disimpan di perangkat dan diperbarui otomatis. Tombol keluar ada di navbar dan panel admin.

Otorisasi ditegakkan oleh RLS di `supabase/stage_7_rls_auth.sql`. Tanpa sesi yang sah, role `anon` hanya boleh membaca kolom `id` dan `nama_guru` untuk mengisi daftar nama di halaman login.

**Jangan pernah** menaruh `service_role` key di kode frontend atau di variabel `VITE_*`.

### Menyiapkan akun guru

```bash
# isi SUPABASE_SERVICE_ROLE_KEY, SCHOOL_CODE, dan ADMIN_CODE di .env
bun scripts/provision-auth-accounts.ts --dry-run   # lihat rencana tanpa menulis
bun scripts/provision-auth-accounts.ts             # buat / segarkan akun
```

Menjalankan ulang skrip ini akan mengganti sandi semua akun, jadi sekaligus berfungsi sebagai rotasi kode sekolah.

### Masa sesi 30 hari

Atur di dashboard Supabase → Authentication → Settings:

- **JWT expiry**: 3600 detik (diperbarui otomatis oleh klien).
- **Refresh token expiry**: 30 hari.

Selama sesi masih berlaku, guru tidak perlu memasukkan kode lagi.

## Deployment

Aplikasi ini statis dan di-host di **aaPanel (Nginx)**. Docker tidak digunakan. Panduan lengkap—termasuk konfigurasi Nginx dan setup database—ada di **[DEPLOY.md](DEPLOY.md)**.

## Database

Untuk **instalasi baru**, jalankan dua file secara berurutan:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/stage_7_rls_auth.sql
```

- `schema.sql` — struktur: tabel, FK, index, RLS dalam keadaan gagal-tertutup, dan bucket Storage `agenda-evidence`.
- `stage_7_rls_auth.sql` — keamanan: fungsi helper, seluruh policy otorisasi berbasis `auth.jwt()`, grant untuk `authenticated`, grant kolom untuk halaman login, dan policy Storage.

**Keduanya wajib.** Selama `stage_7` belum dijalankan, aplikasi tidak dapat mengakses data — ini disengaja supaya database tidak pernah dalam keadaan terbuka. Tabel legacy `guru_kelas` tidak disertakan.

File migration incremental tetap disimpan untuk database yang sudah berjalan sebelumnya. Jangan menjalankan `schema.sql` sebagai pengganti migration pada database existing karena `CREATE TABLE IF NOT EXISTS` tidak otomatis menambahkan seluruh kolom lama.

### Database existing (termasuk yang pernah menjalankan Stage 5)

Backup dulu, lalu jalankan:

1. `supabase/stage_7_rls_auth.sql` — memasang RLS dan policy otorisasi yang benar.
2. `supabase/stage_6_drop_guru_kelas.sql` — bila tabel legacy `guru_kelas` masih ada.

Setelah itu jalankan provisioning akun (`scripts/provision-auth-accounts.ts`).

`supabase/rollback_5_auth.sql` sudah **tidak dipakai lagi**. File itu mengembalikan model akses publik yang menjadi sumber celah fatal; jangan dijalankan kecuali Anda memang ingin memundurkan keamanan.

## Perintah verifikasi

```bash
bun run lint
bunx tsc --noEmit -p tsconfig.app.json
bun test_conflict.ts
bun test_stage2_integration.ts
bun run build
```
