# Uji Manual — Halaqoh Lintas Kelas (Metode Ummi)

Checklist untuk menguji sendiri seluruh alur halaqoh **lintas kelas**. Dijalankan
**berurutan** — tiap bagian bergantung pada bagian sebelumnya.

Latar desain lengkap: `docs/DESAIN-HALAQOH-LINTAS-KELAS.md`.

---

## 0. Sebelum mulai — jalankan skema

Jalankan `supabase/schema.sql` di **Supabase SQL Editor**. File ini idempoten —
aman dijalankan berulang. Yang penting dipastikan:

| # | Yang dipastikan                                                                                     |
| - | --------------------------------------------------------------------------------------------------- |
| 1 | Tabel `agenda.halaqoh_kelas` ada, dan `agenda.halaqoh` sudah punya kolom `academic_year_id`          |
| 2 | Kolom `agenda.halaqoh.kelas_id` **sudah hilang**                                                     |
| 3 | `agenda_header` punya kolom `halaqoh_id`                                                             |
| 4 | Constraint `uq_halaqoh_nama_per_tahun`, `chk_schedule_kelas_atau_halaqoh`, `chk_agenda_header_kelas_atau_halaqoh` ada |
| 5 | RLS aktif pada `halaqoh`, `halaqoh_kelas`, dan `siswa_halaqoh` (lihat §14 bagian Verifikasi)          |

Query pemeriksanya ada di bagian **15. VERIFIKASI** di akhir `schema.sql`.

---

## 1. Pastikan ada siswa

Menu **Data Siswa** harus berisi siswa, minimal di **dua kelas** berbeda (mis. 3A
dan 4A) — uji lintas kelas membutuhkannya.

---

## 2. Master Halaqoh — buat halaqoh lintas kelas

Menu **Master Data → Halaqoh**.

- [ ] Klik **Tambah Halaqoh**. Isi nama **"Halaqoh A"**, centang kelas sumber **3A dan 4A**.
- [ ] Simpan. Kartu "Halaqoh A" muncul dengan keterangan `kelas 3A, 4A` dan jumlah anggota 0.
- [ ] Buat **"Halaqoh B"**, kelas sumber **4A** saja.
- [ ] Klik **Anggota** pada Halaqoh A. Daftar kandidat harus berisi **siswa 3A dan 4A** yang belum masuk halaqoh.
- [ ] Pilih **sebagian** siswa (bukan semua), lalu **Masukkan terpilih**.

**Yang harus benar:**

- [ ] Siswa yang tidak dipilih tetap tersedia sebagai kandidat di Halaqoh B (kelas 4A yang belum masuk).
- [ ] Anggota tiap kelompok menampilkan **kelasnya masing-masing** (3A atau 4A) — bukan kelas halaqoh.
- [ ] Coba masukkan siswa kelas lain (di luar kelas sumber) lewat jalur mana pun → harus ditolak.

---

## 3. Jadwal Ummi

Menu **Jadwal → Tambah Jadwal**.

- [ ] Pilih kelas **3A** + mapel **Ummi**. Pilihan guru tunggal berubah menjadi daftar per kelompok.
- [ ] Isi guru **berbeda** untuk tiap kelompok (guru **diisi manual**, tidak otomatis).
- [ ] Simpan → harus berhasil. Di daftar jadwal muncul baris per kelompok pada jam yang sama.

**Yang harus GAGAL (uji batas):**

- [ ] Guru yang **sama** untuk dua kelompok pada jam yang sama → ditolak (satu guru di dua tempat).
- [ ] Sesi halaqoh bertumpuk dengan pelajaran **seluruh kelas** dari kelas sumbernya
      (mis. Halaqoh A mencakup 4A, lalu ada jadwal Matematika 4A pada jam yang sama) → **ditolak**
      dengan pesan "Bentrok Kelas".
- [ ] Dua **halaqoh berbeda** pada jam yang sama → **SAH** (bukan bentrok). Ini bentuk Ummi
      yang benar: satu kelas dipecah jadi beberapa kelompok.

---

## 4. Agenda per kelompok

Login sebagai guru salah satu kelompok.

- [ ] Buka kartu jadwal Ummi → formulir agenda muncul dengan penanda kelompok.
- [ ] **Daftar absensi hanya berisi anggota kelompok itu** (bukan seluruh kelas), dan tiap baris
      menampilkan kelas siswanya.
- [ ] **Daftar absensi benar-benar termuat** — tulisan "Memuat data siswa…" hilang dan diganti
      daftar nama. Kalau tulisan itu berputar terus, berarti bug kelas-kosong kambuh: baris halaqoh
      tidak punya `kelas_id`, jadi penjaga `if (!kelas)` di formulir tidak boleh menghentikan
      pemuatan.
- [ ] Kartu **Kelas** di formulir menampilkan seluruh kelas sumbernya (mis. `3A, 4A`), bukan kosong.
- [ ] Isi materi + absensi → Simpan → berhasil.

Lalu login sebagai guru kelompok lain pada tanggal & jam yang sama:

- [ ] Absensinya berisi anggota kelompok yang lain.
- [ ] Materinya **kosong** (belum diisi), bukan materi kelompok pertama.

---

## 4b. Jadwal & agenda di sisi admin

Baris halaqoh tidak punya satu kelas, jadi kelasnya dibaca dari kelas sumber. Yang diuji di sini:
baris itu **tetap muncul** dan **tetap terbaca** — jangan sampai hilang saat difilter kelas.

### Admin → Jadwal Pembelajaran

- [ ] Tanpa filter, baris halaqoh muncul dan kolom **Kelas** menampilkan `3A, 4A` (bukan kosong).
- [ ] Filter kelas **3A** → baris halaqoh **tetap muncul**.
- [ ] Filter kelas **4A** → baris halaqoh **tetap muncul**.
- [ ] Filter kelas **5A** → baris halaqoh **hilang** (5A bukan kelas sumbernya).
- [ ] Cari dengan kata kunci `3A` → baris halaqoh ikut ketemu.
- [ ] Buka **Ubah** pada baris halaqoh, lalu simpan tanpa mengubah apa pun → **tidak** muncul baris
      ganda pada jam yang sama.

### Admin → Agenda

- [ ] Filter kelas **3A** / **4A** → sesi halaqoh tetap muncul.
- [ ] Kolom kelas menampilkan `3A, 4A · <nama kelompok>`.

---

## 5. Rekap — sesi masuk ke tiap kelas sumber

Menu **Rekap**, untuk tanggal yang barusan diisi.

### Log Jurnal (`Rekap → Jurnal`)

- [ ] Filter kelas **3A** → sesi "Halaqoh A" **muncul** (meski halaqohnya lintas kelas).
- [ ] Filter kelas **4A** → sesi yang **sama** juga muncul.
- [ ] Kolom kelas menampilkan kelas sumbernya (mis. `3A, 4A`) + nama kelompok.
- [ ] Unduh PDF → kolom kelompok terisi.

### Rekap Harian (`Rekap → Harian`)

- [ ] Pilih tanggal + kelas 3A → baris Ummi muncul.
- [ ] Ganti ke kelas 4A → baris yang sama muncul (satu sesi, dua rekap kelas).
- [ ] Unduh PDF → ada kolom Kelompok.

---

## 6. Tahun ajaran baru (halaqoh dibuat dari nol)

Setelah kenaikan kelas (menu **Pengaturan → Kenaikan Kelas**):

- [ ] Buka **Master Data → Halaqoh** pada tahun ajaran baru. Daftarnya kosong.
- [ ] **Tidak ada** tombol salin/impor dari tahun lalu — halaqoh harus dibuat manual.
- [ ] Tambah halaqoh baru + pilih kelas sumbernya, lalu isi anggotanya dari daftar kandidat.

---

## 7. Yang memang belum ditangani (jangan dilaporkan sebagai bug)

| Layar | Alasan |
| --- | --- |
| **Export Excel jadwal** (`.xlsx`) | Belum menyertakan kelompok — dibatasi ke rekap saja. |
| **Rekap Mingguan & Bulanan** | Agregat per guru (tidak punya kolom kelas/mapel), jadi tidak ada tempat untuk kelompok. |
| **Kuota anggota halaqoh** | Memang tidak dibatasi — guru yang mengatur komposisi. |

---

## Kalau ada yang gagal

Catat: **menu apa, kelas apa, halaqoh apa, tanggal apa, akun guru mana**, dan apa yang tampil
vs yang diharapkan. Untuk masalah rekap, sebutkan juga apakah di **layar** atau di **PDF** —
keduanya jalur kode yang berbeda.
