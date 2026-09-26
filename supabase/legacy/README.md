# Migrasi lama — JANGAN dijalankan untuk instalasi baru

Folder ini berisi riwayat migrasi SIAJAR sebelum semuanya dilipat ke satu file.

## Untuk instalasi baru

Cukup jalankan **satu file**:

```text
supabase/schema.sql
```

File itu sudah mencakup seluruh tabel (termasuk `app_settings`), index, RLS,
fungsi otorisasi, policy, grant, bucket Storage, policy Storage, dan trigger
jejak pelaku. Tidak ada urutan yang perlu diikuti.

## Kapan folder ini masih dipakai

Hanya untuk **database yang sudah berjalan** dan perlu diselaraskan. Jalankan
seperlunya, dan hanya setelah backup.

| File | Isi |
|---|---|
| `migration_evidence.sql` | Kolom/tabel bukti foto (sudah ada di schema.sql) |
| `migration_stage1_schedule.sql` | Perubahan jadwal tahap 1 |
| `stage_2_schedule_agenda.sql` | Jadwal + agenda tahap 2 |
| `stage_2_1_homeroom_assignment.sql` | Tabel `homeroom_assignment` |
| `stage_2_3_period_templates.sql` | Tabel `period_templates` |
| `stage_3_substitutions.sql` | Tabel `substitutions` |
| `stage_4_documentation_photo.sql` | Tabel `agenda_evidence` |
| `stage_5_3_app_settings.sql` | Tabel `app_settings` |
| `stage_6_drop_guru_kelas.sql` | Membuang tabel legacy `guru_kelas` |
| `stage_7_rls_auth.sql` | RLS + policy berbasis Supabase Auth |
| `seed_kelas1.sql` | Data contoh kelas 1 |

## Peringatan penting

**`rollback_5_auth.sql`** mengembalikan model akses publik: seluruh tabel
menjadi `USING (true)` dan role `anon` diberi hak penuh. Itu adalah model yang
dulu menjadi sumber celah fatal (database terbuka untuk siapa pun). File ini
disimpan hanya sebagai catatan sejarah — **jangan dijalankan.**

**`stage_5_3_app_settings.sql`** juga berisi `CREATE POLICY "Allow public
read-write app_settings"` dan `GRANT ALL ... TO anon`. Policy dan grant itu
sudah digantikan oleh versi aman di `schema.sql` (baca untuk anggota, ubah
hanya admin). Kalau file ini dijalankan **setelah** `schema.sql`, lubang anon
akan terbuka kembali — jadi jangan dijalankan pada database baru.
