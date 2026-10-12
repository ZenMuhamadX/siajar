# Finalisasi Rilis SIAJAR v1.0.0

Dokumen ini adalah panduan rilis terurut untuk versi **1.0.0**: rilis yang memuat
**halaqoh lintas kelas** dan **SIAJAR Desktop (Electron)** sekaligus.

> **Baca dulu.** Urutannya penting. Langkah database dan Edge Function harus
> selesai **sebelum** aplikasi dipakai guru — kalau tidak, layar akan gagal
> memuat data. `DEPLOY.md` tetap jadi rujukan teknis rinci; dokumen ini adalah
> ringkasan urutan kerjanya.

---

## 0. Ringkasan isi rilis

| Bagian | Isi |
|---|---|
| Halaqoh lintas kelas | Kelompok belajar lintas kelas dengan daftar kelas sumber; jadwal, agenda, dan rekap ikut menyesuaikan |
| Tanpa salin antar tahun | Halaqoh **wajib dibuat dari nol** tiap tahun ajaran — tidak ada impor dari tahun lalu |
| SIAJAR Desktop | Pembungkus Electron (`.exe`), protokol `app://`, `HashRouter`, konfigurasi runtime per sekolah |
| Skema database | `halaqoh_kelas`, `halaqoh.academic_year_id`, `agenda_header.halaqoh_id`, CHECK baru pada `schedule`/`agenda_header` |

**Cakupan:** branch `release/v1.0.0`, gabungan `feat/halaqoh-lintas-kelas` dan
`feat/electron-desktop`, **sudah di-merge ke `main`** (merge commit `a80b86d`) dan
**sudah ditandai tag `v1.0.0`**. Yang tersisa di dokumen ini adalah pekerjaan
sisi server — bukan lagi pekerjaan git.

---

## 1. Pemeriksaan sebelum menyentuh server

- [ ] Kode sudah hijau: `bun run lint`, `bunx tsc --noEmit -p tsconfig.app.json`,
      seluruh skrip `test_*.ts` yang Anda punya, `bun run build`. **(sudah diverifikasi)**
      Catatan: skrip `test_*.ts` tidak ada di repositori (di-gitignore), jadi hanya
      tersedia di mesin pengembang.
- [ ] `version` di `package.json` sudah dinaikkan — sekarang **1.0.0**.
- [ ] **Cadangkan database** (`pg_dump`) sebelum menjalankan migrasi apa pun.
- [ ] Tentukan `AUTH_DOMAIN` final dan pastikan nilainya sama di **tiga** tempat:
      `VITE_AUTH_DOMAIN` (`.env` aplikasi), `AUTH_DOMAIN` (docker-compose service
      `functions`), dan domain akun guru yang **sudah terlanjur dibuat**.
      Email akun tidak bisa diubah tanpa membuat ulang akunnya.

---

## 2. Database (paling berisiko — kerjakan lebih dulu)

1. **Cadangkan** database target.
2. **Periksa dulu** apakah ada baris halaqoh yang tidak punya acuan sama sekali.
   Jalankan di SQL Editor dan **harus menghasilkan 0**:

   ```sql
   SELECT count(*) FROM agenda.halaqoh
   WHERE academic_year_id IS NULL
     AND id NOT IN (SELECT halaqoh_id FROM agenda.halaqoh_kelas);
   ```

   Kalau hasilnya bukan 0, migrasi §14.2 akan melewati `SET NOT NULL` dan skema
   jadi menyimpang dari definisinya. Isi tahun ajarannya dulu secara manual
   sebelum melanjutkan.

3. Jalankan **`supabase/schema.sql`** di SQL Editor. File ini idempoten — aman
   dijalankan berulang.
4. Perhatikan pesan `NOTICE` di output. Pesan berikut **normal** dan bukan galat:
   - `Halaqoh: N kelas sumber dipindahkan ke halaqoh_kelas.`
   - `Halaqoh: belum ada tahun ajaran; ...` → hanya muncul di DB kosong.
5. **Verifikasi** (blok §15 di `schema.sql`):

   ```sql
   -- a. Semua tabel harus punya RLS aktif
   SELECT relname, relrowsecurity FROM pg_class
   WHERE relnamespace = 'agenda'::regnamespace AND relkind = 'r'
   ORDER BY relname;

   -- b. Kolom lama harus sudah hilang
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'agenda' AND table_name = 'halaqoh';

   -- c. CHECK baru harus terpasang
   SELECT conname FROM pg_constraint
   WHERE conname IN ('chk_schedule_kelas_atau_halaqoh',
                     'chk_agenda_header_kelas_atau_halaqoh');
   ```

   Yang harus terlihat: `halaqoh.academic_year_id` **ada**, `halaqoh.kelas_id`
   **tidak ada**, dan kedua CHECK terpasang.

---

## 3. Edge Function `manage-users`

1. Salin berkasnya **tanpa lewat shell yang mengekspansi backtick** — pakai
   `docker cp` (cara A di `DEPLOY.md` §4). Heredoc tanpa kutip pada penutupnya
   akan merusak isi file.
2. Verifikasi penyalinan utuh: `wc -l` harus **542**. (Kalau memakai versi tanpa dependensi
   dari `DEPLOY.md` §4, angkanya **397** — dan versi itu ketinggalan fitur manajemen staf.)
3. Pastikan `AUTH_DOMAIN` dan `ADMIN_EMAIL` di service `functions` **terisi**,
   bukan variabel kosong. Variabel yang ada tapi kosong akan menghasilkan galat
   `Cannot create a user without either an email or phone`.
4. `docker compose up -d functions`, lalu uji:

   ```bash
   curl -s -X POST https://supabase.<domain>/functions/v1/manage-users \
     -H "apikey: <anon-key>" -H 'Content-Type: application/json' \
     -d '{"action":"status"}'
   ```

---

## 4. Build web

```bash
bun install
bun run build          # hasil di dist/
```

Unggah **seluruh isi** `dist/` ke document root aaPanel, hapus berkas lama dulu.
Terapkan blok Nginx + header keamanan dari `DEPLOY.md` §3 — termasuk
`Permissions-Policy: camera=(self)` yang **wajib** untuk bukti foto.

---

## 5. Build desktop (`.exe`)

> **Bangun paling akhir.** `.exe` membungkus isi `dist/` pada saat perintah dijalankan. Kalau ada
> perbaikan kode setelah `.exe` dibuat, berkas itu **basi** dan harus dibangun ulang — guru akan
> memakai versi lama tanpa menyadarinya. Ini pernah terjadi di rilis ini: installer dari build pagi
> belum memuat perbaikan halaqoh yang masuk siang.

```bash
bun run desktop:dist
```

Menghasilkan dua berkas di `release/`:

| Berkas | Untuk |
|---|---|
| `SIAJAR-Setup-1.0.0.exe` | **Dibagikan ke guru** (installer NSIS) |
| `SIAJAR-1.0.0-x64.exe` | Versi portable, tanpa memasang |

Bagikan lewat **folder bersama sekolah** (paling hemat kuota internet sekolah) atau
**GitHub Releases**.

> **Repositori ini privat.** Konsekuensinya tautan Release **tidak bisa diunduh tanpa akun GitHub
> yang diberi akses**. Untuk guru di lapangan, folder bersama sekolah atau flashdisk tetap cara
> utama; GitHub Releases lebih cocok sebagai arsip resmi, sumber unduhan pengelola, dan jalan
> rollback ke versi lama.

Tag `v1.0.0` **sudah dibuat dan sudah dipush**, jadi Release tinggal dibuat di web UI GitHub
(*Releases → Draft a new release → pilih tag `v1.0.0`*). Kalau memakai CLI — perhatikan bahwa
`gh` **belum terpasang** di mesin pengembangan ini:

```bash
gh release create v1.0.0 \
  "release/SIAJAR-Setup-1.0.0.exe" \
  "release/SIAJAR-1.0.0-x64.exe" \
  --title "SIAJAR 1.0.0" \
  --notes-file <berkas-catatan-rilis>
```

Isi catatan rilisnya sama dengan pesan tag `v1.0.0` — lihat dengan:

```bash
git tag -n99 v1.0.0
```

Yang perlu diingat: `.exe` **butuh internet** (Supabase tetap di jaringan), dan
belum ditandatangani digital sehingga Windows akan menampilkan peringatan
*"Windows protected your PC"*.

---

## 6. Verifikasi manual setelah deploy

Checklist `DEPLOY.md` §6, ditambah yang khusus rilis ini
(`docs/UJI-HALAQOH.md`):

- [ ] Login guru dengan kode pribadi; sesi bertahan setelah refresh.
- [ ] Tanpa login, query langsung ke `agenda.siswa` **ditolak server**.
- [ ] Bukti foto bisa diunggah dan dibuka; tanpa login ditolak.
- [ ] **Halaqoh lintas kelas** (§1–4 `UJI-HALAQOH.md`): buat halaqoh dengan
      beberapa kelas sumber, isi anggota dari kandidat.
- [ ] **Daftar absensi benar-benar termuat** (§4): tulisan "Memuat data siswa…" hilang
      dan diganti daftar nama — bukan berputar terus.
- [ ] **Filter kelas di admin** (§4b): baris halaqoh tetap muncul saat difilter ke
      kelas sumbernya (3A maupun 4A), dan hilang saat difilter ke kelas lain.
- [ ] **Fan-out rekap** (§5): satu sesi halaqoh muncul di rekap **setiap** kelas
      sumbernya, terbaca sebagai satu baris berlabel kelompok.
- [ ] **Tahun ajaran baru** (§6): daftar halaqoh kosong dan **tidak ada** tombol
      salin dari tahun lalu.
- [ ] Akun staf bisa dibuat/dihapus dari **Pengaturan → Akun Staf** (butuh Edge Function
      versi terbaru, bukan versi fallback di `DEPLOY.md` §4).
- [ ] Aplikasi desktop terbuka, kamera bekerja, dan menyambung ke server yang benar.

---

## 7. Kalau ada yang gagal

Catat: **menu apa, kelas apa, halaqoh apa, tanggal apa, akun guru mana**, dan
apa yang tampil. Untuk masalah database, simpan pesan `NOTICE`/`ERROR` lengkap
dari SQL Editor.

**Aturan rollback:** migrasi `schema.sql` menghapus kolom `kelas_id` dan
memindahkan datanya. Setelah dijalankan, rollback berarti memulihkan dari
cadangan pg_dump — bukan menjalankan skrip mundur. Karena itu langkah 2.1
(cadangkan dulu) tidak boleh dilewati.
