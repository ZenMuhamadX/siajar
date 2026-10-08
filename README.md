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

### Versi desktop (.exe)

Ada juga kemasan **SIAJAR Desktop** (Electron) untuk guru yang lebih nyaman
membuka aplikasi dari ikon di desktop. Isinya bundle React yang sama dan tetap
menyambung ke Supabase, jadi **tidak bisa dipakai offline**.

```bash
bun run desktop:dev      # mode pengembangan (Vite + Electron)
bun run desktop:build    # uji cepat → release/win-unpacked/SIAJAR.exe
bun run desktop:dist     # rilis → installer NSIS + versi portable
```

Yang dibagikan ke guru adalah `release/SIAJAR-Setup-<versi>.exe`. Naikkan
`version` di `package.json` setiap kali merilis.

Penjelasan lengkap—termasuk cara membagikan ke guru, penyesuaian CORS di
Supabase, izin kamera, dan konfigurasi server per sekolah lewat
`siajar-config.json`—ada di
**[docs/DESKTOP-ELECTRON.md](docs/DESKTOP-ELECTRON.md)**.

## Database

Untuk **instalasi baru**, cukup jalankan **satu file**:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
```

File itu idempoten dan sudah mencakup seluruh tabel (termasuk `app_settings`), index, RLS, fungsi otorisasi, policy, grant, bucket Storage, policy Storage, dan trigger jejak pelaku. Aman dijalankan berulang.

File migrasi lama dipindahkan ke `supabase/legacy/` dan hanya diperlukan untuk database yang sudah berjalan sebelumnya.

### Urutan deploy saat master kelas berubah

`schema.sql` bagian 9 mengubah nilai teks kelas di `agenda.siswa`, `agenda.schedule`,
`agenda.homeroom_assignment`, dan `agenda.agenda_header` dari `KELAS 1` menjadi `1A`.
Daftar kelas di frontend **tidak lagi hardcoded** — ia dibaca dari tabel `agenda.kelas`
lewat `ClassProvider`.

Karena itu, menjalankan `schema.sql` dan mengunggah bundle baru harus **berdekatan**.
Kalau SQL jalan sementara bundle lama masih terpasang, pilihan filter kelas akan kosong
sampai bundle baru naik. Lakukan di luar jam sekolah.

Untuk instalasi baru, urutan itu tidak berlaku — tidak ada data lama yang perlu diubah.

### Database existing

Backup dulu, lalu jalankan `supabase/schema.sql` untuk menyelaraskan struktur dan policy. Untuk tabel legacy `guru_kelas`, lihat `supabase/legacy/stage_6_drop_guru_kelas.sql`.

`supabase/legacy/rollback_5_auth.sql` sudah **tidak dipakai**. File itu mengembalikan model akses publik yang menjadi sumber celah fatal; jangan dijalankan.

## Perintah verifikasi

```bash
bun run lint
bunx tsc --noEmit -p tsconfig.app.json
bun test_conflict.ts
bun test_stage2_integration.ts
bun test_report_pdf_model.ts
bun test_promotion_preview.ts
bun test_status_per_tahun.ts
bun test_schema_struktur.ts
bun run build
```

`test_schema_struktur.ts` memeriksa `supabase/schema.sql` tanpa perlu database:
keseimbangan `$$`, pasangan `THEN` ↔ `END IF;` di setiap blok `DO`, dan yang
paling penting — **setiap `DROP COLUMN` harus berada di dalam blok `DO` yang
dijaga**. Aturan terakhir itu lahir dari bug nyata: `UPDATE agenda.schedule SET
class_id = …` sempat ditulis di luar penjaga sementara `DROP COLUMN class_id`
dikerjakan di dalam penjaga di bagian lain. Sekali dijalankan file itu berhasil,
dijalankan lagi gagal dengan `column s.class_id does not exist`.

**Aturan saat menambah kolom ke `schema.sql`:** kalau sebuah kolom di-`DROP`, maka
perapian data untuk kolom itu harus berada di blok `DO` yang sama-sama dijaga
pengecekan keberadaan kolomnya. Kalau sebuah index dibuat di atas kolom baru,
namanya harus berbeda dari index lama di kolom yang akan dihapus.

`test_status_per_tahun.ts` mengunci aturan status per tahun ajaran. Bug yang
dijaganya: `siswa.status` dulu hanya satu kolom global, sehingga menjalankan
kenaikan kelas membuat siswa tingkat 6 berstatus LULUS **berlaku surut** —
membuka tahun ajaran lama menampilkan mereka punya kelas sekaligus berstatus
lulus, dan form absensinya jadi kosong. Sekarang status pada sebuah tahun dibaca
dari penempatan tahun itu (`agenda.siswa_kelas.status`).

`test_promotion_preview.ts` mengunci aturan kenaikan kelas yang dihitung di klien
(siapa naik, siapa lulus, siapa dilewati). Aturan yang sama diulang di fungsi SQL
`agenda.kenaikan_kelas` — kalau keduanya berbeda, pratinjau di halaman akan
berbohong tentang apa yang benar-benar terjadi.

`tmp-settings.test.ts` adalah berkas kerja, bukan bagian dari rangkaian di atas.
Satu uji di dalamnya (`showBorders=false`) memang sudah gagal sejak sebelum
perubahan kenaikan kelas.
