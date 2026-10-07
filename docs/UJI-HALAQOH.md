# Uji Manual — Halaqoh Ummi (Fase 0–4b)

Checklist untuk menguji sendiri seluruh alur halaqoh. Dijalankan **berurutan** —  
tiap bagian bergantung pada bagian sebelumnya.

Status kode: **Fase 0/1/1b/2/3 sudah lulus browser. Fase 4 & 4b BELUM pernah dibuka  
di browser.** Checklist ini terutama untuk memastikan Fase 4 & 4b.

---

## 0. Sebelum mulai — periksa database

Jalankan di Supabase SQL Editor:

| # | Skrip                                                  | Yang dipastikan                                                                       |
| - | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1 | `supabase/legacy/stage_10_0_verify_jurnal_halaqoh.sql` | FK `agenda_kbm.halaqoh_id → halaqoh(id)` ada, `mapel.is_halaqoh` ada, RLS halaqoh ada |

**Kenapa ini wajib:** Fase 4 & 4b menambah join `halaqoh:halaqoh_id (nama)` di  
6 query (`agendaService`, `scheduleService`, `reportQuery`). PostgREST **menolak**  
join yang tidak punya FK. Kalau FK hilang, Log Jurnal dan Rekap Harian akan error —  
bukan sekadar kolomnya kosong.

Di hasil skrip itu, perhatikan `kesimpulan`:

- Uji 3 `Relasi FK … ada` harus **OK**. Kalau `MASALAH` → **berhenti**, lapor dulu.
- Uji 7 `mapel.is_halaqoh ada` harus **OK**. Kalau tidak → jalankan  
  `supabase/legacy/stage_9_1_mapel_halaqoh.sql`.
- Uji 6 menyebut berapa baris jadwal Ummi yang `halaqoh_id`-nya masih kosong.  
  Kalau > 0, itu yang perlu diisi di langkah 2 di bawah.

---

## 1. Pastikan ada siswa

Menu **Data Siswa** harus berisi siswa. Kalau tadi semua siswa terhapus, isi ulang  
dulu (pilih salah satu):

- `supabase/import_siswa_2026_2027_kelas_1A_6A.sql` — 112 siswa nyata, kelas 1A..6A
- `supabase/legacy/stage_9_0_seed_siswa_uji.sql` — 60 siswa uji `ZZ*` di 1A/1B/2A/2B

---

## 2. Fase 2 — buat halaqoh & isi anggotanya

Menu **Master Data → Halaqoh**.

- [x] Pilih kelas **1A** (atau kelas yang mapelnya Ummi).
- [x] Buat 2 kelompok, mis. **Kelompok A** dan **Kelompok B**.
- [x] Masukkan siswa ke masing-masing kelompok.
- [x] Panel "belum masuk kelompok" harus menyusut sampai kosong.

**Perhatikan:** kalau ada siswa yang belum masuk kelompok, ia akan tampil di panel  
peringatan. Itu memang penjaganya — bukan error.

---

## 3. Fase 3 — jadwal Ummi per kelompok

Menu **Jadwal → Tambah Jadwal**.

- [x] Pilih kelas **1A** + mapel **Ummi**.
- [x] Pilihan guru tunggal harus **berubah** menjadi daftar per kelompok.
- [x] Isi guru **berbeda** untuk Kelompok A dan Kelompok B.
- [x] Simpan → harus berhasil (ini sudah lulus sebelumnya, tapi pastikan masih).
- [x] Cek di daftar jadwal: muncul **dua baris** pada jam yang sama, satu per kelompok.

**Yang harus GAGAL (uji batas):**

- [x] Coba isi **guru yang sama** untuk kedua kelompok pada jam yang sama →  
  harus ditolak (satu guru tidak bisa di dua tempat).
- [x] Coba buat jadwal Ummi **tanpa** memilih kelompok → harus ditolak.

---

## 4. Fase 4 — jurnal per kelompok  ⚠️ BELUM PERNAH DIUJI

Ini inti pengujian. Login sebagai **guru Kelompok A**.

- [x] Halaman utama guru menampilkan slot Ummi kelas 1A.
- [x] **Buka kartu jadwalnya** — harus ada penanda nama kelompok (mis. "Kelompok A").
- [x] Buka formulir agenda → kartu "Kelas" harus menampilkan lencana kelompok.
- [x] **Daftar absensi HANYA berisi siswa Kelompok A** — bukan seluruh kelas.  
  Ini pemeriksaan terpenting: kalau berisi seluruh kelas, Fase 4 tidak jalan.
- [x] Isi materi + absensi → Simpan → berhasil.

Lalu **login sebagai guru Kelompok B** pada tanggal & jam yang sama.

- [x] Buka slot Ummi yang sama → **daftar absensi harus berisi siswa Kelompok B**.
- [x] Materi yang tampil harus **kosong** (belum diisi), **bukan** materi Kelompok A.  
  Kalau materi Kelompok A muncul di sini → bug pencocokan agenda.
- [x] Isi materi berbeda → Simpan.

**Verifikasi pemisahan:**

- [x] Buka lagi sebagai guru A → materinya **tetap** materi A, tidak tertimpa B.

---

## 5. Fase 4b — nama kelompok di rekap  ⚠️ BELUM PERNAH DIUJI

Menu **Rekap**, untuk tanggal yang barusan diisi.

### Log Jurnal (`Rekap → Jurnal`)

- [x] Kolom **"Kelas / Kelompok"** menampilkan `1A` + nama kelompok di bawahnya.
- [x] Dua baris Ummi (Kelompok A & B) pada jam sama **terbaca berbeda**.
- [x] Klik **Unduh PDF** → PDF punya kolom **Kelompok** yang terisi.
- [x] Di PDF, baris non-Ummi (mapel seluruh kelas) kolom Kelompok-nya `—`.

### Rekap Harian (`Rekap → Harian`)

- [x] Nama kelompok muncul di bawah lencana kelas.
- [x] **Unduh PDF** → ada kolom **Kelompok**.

### Riwayat guru (`/riwayat`)

- [x] Lencana ringkas menampilkan `1A · Kelompok A`.
- [x] Buka detail agenda → tabel KBM punya kolom **Kelompok**.
- [x] Di HP (sempitkan jendela), baris KBM bertumpuk dan label "KELOMPOK" muncul.

### Dashboard admin

- [x] Kartu "sedang berlangsung" menyebut kelompok bila Ummi.
- [x] Kartu "agenda terbaru" menyebut kelompok bila Ummi.

### Monitoring agenda admin (`Agenda`)

- [x] Kolom Kelas menampilkan `1A · Kelompok A`.

---

## 6. Yang MEMANG belum ditangani (jangan dilaporkan sebagai bug)

| Layar                             | Alasan                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Export Excel jadwal** (`.xlsx`) | Belum menyertakan kelompok — saya batasi ke rekap saja sesuai permintaan. Bilang saja kalau mau ditambahkan.     |
| **Rekap Mingguan & Bulanan**      | Agregat per guru (tidak punya kolom kelas/mapel), jadi tidak ada tempat untuk kelompok. Memang begitu desainnya. |
| **Kelas kecil (1 halaqoh)**       | Kelompok yang namanya sama dengan kelasnya tidak ditampilkan — `1A · 1A` hanya menambah kebisingan.              |

---

## Kalau ada yang gagal

Catat: **menu apa, kelas apa, tanggal apa, akun guru mana**, dan apa yang tampil vs  
yang diharapkan. Untuk masalah rekap, sebutkan juga apakah di **layar** atau di **PDF**  
— keduanya jalur kode yang berbeda.

Kalau Log Jurnal / Rekap Harian **error total** (bukan kolom kosong), kemungkinan  
besar FK `agenda_kbm.halaqoh_id` tidak ada — kembali ke langkah 0, uji 3.
