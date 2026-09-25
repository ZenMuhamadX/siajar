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

Aplikasi memakai **login PIN** untuk mode sederhana. PIN admin dan PIN guru dibaca dari `.env` saat build:

- `VITE_TEACHER_PIN`
- `VITE_ADMIN_PIN`

Nilai `VITE_*` akan tertanam di bundle browser. Model ini **tidak memiliki autentikasi per pengguna atau otorisasi database**: PIN hanya membatasi tampilan frontend, sedangkan policy database yang dipakai adalah akses publik agar frontend dapat mengakses database tanpa Supabase Auth.

Konsekuensinya, aplikasi ini tidak boleh dianggap sebagai sistem dengan keamanan granular. Jangan menaruh `service_role` key di `.env` atau kode frontend.

## Deployment

Aplikasi ini statis dan di-host di **aaPanel (Nginx)**. Docker tidak digunakan. Panduan lengkap—termasuk konfigurasi Nginx dan setup database—ada di **[DEPLOY.md](DEPLOY.md)**.

## Database

Untuk **instalasi baru**, `supabase/schema.sql` sudah merupakan bootstrap lengkap. Cukup jalankan satu file ini melalui Supabase SQL Editor atau `psql`:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
```

`schema.sql` mencakup seluruh tabel aktif, FK, index, RLS policy publik, grant `anon`, `homeroom_assignment`, Storage bucket `agenda-evidence`, dan policy Storage. Tabel legacy `guru_kelas` tidak disertakan.

File migration incremental tetap disimpan untuk database yang sudah berjalan sebelumnya. Jangan menjalankan `schema.sql` sebagai pengganti migration pada database existing karena `CREATE TABLE IF NOT EXISTS` tidak otomatis menambahkan seluruh kolom lama.

### Database yang sudah pernah menjalankan Stage 5 Auth

Jika Supabase Auth sudah pernah diaktifkan, backup database lalu jalankan:

1. `supabase/rollback_5_auth.sql` — mengembalikan policy publik dan grant anon.
2. `supabase/stage_6_drop_guru_kelas.sql` — memindahkan data legacy yang masih diperlukan lalu menghapus `guru_kelas`.

Setelah keduanya selesai, build dan upload versi login PIN.

## Perintah verifikasi

```bash
bun run lint
bunx tsc --noEmit -p tsconfig.app.json
bun test_conflict.ts
bun test_stage2_integration.ts
bun run build
```
