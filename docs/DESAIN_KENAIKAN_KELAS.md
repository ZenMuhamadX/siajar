# Desain Kenaikan Kelas & Riwayat Penempatan Siswa

**Status:** keputusan terkunci. **Fase 0–3 SELESAI** beserta perbaikan pasca-uji-coba
(lihat §7).
**Tanggal:** 1 Oktober 2026 · status diperbarui 12 Oktober 2026

## Keputusan yang sudah dikunci

| # | Keputusan | Konsekuensi |
|---|---|---|
| 1 | Pakai **tabel enrollment** (bukan batch update) | Riwayat penempatan tersimpan per tahun ajaran |
| 2 | **Kolom kelas berbasis string boleh dihapus** | Kelas jadi entitas ber-`id`; `siswa.kelas` dihapus |
| 3 | **Tidak ada tinggal kelas** | Mapping selalu naik satu tingkat, tidak ada opsi "tetap" |
| 4 | **NIS diimplementasikan tapi opsional** | Kolom ada, boleh kosong, tidak wajib diisi di UI |
| 5 | **Rombel diimplementasikan sekarang** | Label default `1A`, berikutnya `1B`, dst. |
| 6 | **Wali kelas tetap di tingkat yang sama**, harus bisa diedit | Generate = salin dari kelas yang sama di TA sebelumnya |
| 7 | **Kenaikan kelas dijalankan sekaligus** untuk seluruh sekolah | Tidak ada eksekusi parsial per kelas |
| 8 | **Siswa nonaktif ikut dinaikkan** | Tidak ada filter status saat promosi |

---

## 1. Ringkasan

Kelas siswa saat ini hanya satu kolom teks di `agenda.siswa`, sehingga kenaikan kelas harus
diubah satu siswa per satu, tidak ada riwayat, tidak ada kolom status, dan rombel mustahil
ditambahkan.

Usulan: **pisahkan identitas siswa dari penempatan kelas per tahun ajaran**, jadikan kelas
sebagai entitas ber-`id`, lalu bangun **wizard kenaikan kelas** yang berjalan sekali jalan
untuk seluruh sekolah.

**Yang paling menenangkan:** riwayat absensi tidak akan rusak. Filter dan laporan kelas
membaca `agenda_header.kelas` — snapshot saat agenda dibuat — bukan kelas siswa saat ini
(`src/services/report/reportQuery.ts:183` dan `:331`).

---

## 2. Strategi kolom kelas

Kesimpulan: **semua kolom kelas bisa dijadikan referensi ber-`id`, termasuk
`agenda_header.kelas`.** Ini adalah **koreksi dari versi pertama dokumen ini**, yang sempat
menyatakan `agenda_header.kelas` harus dipertahankan sebagai snapshot teks.

### 2.1 Apa fungsi `agenda_header.kelas`

`agenda_header` adalah tabel **jurnal** — satu baris = satu agenda pembelajaran. Kolom
`kelas` mencatat jurnal itu untuk kelas mana. Nilainya **selalu diturunkan** dari
`schedule.class_id` (`src/components/agenda/AgendaDetailForm.tsx:125`), tidak pernah
diketik bebas. Jadi ia murni referensi kelas, bukan teks bebas.

Kolom ini dipakai untuk empat hal:

| Kegunaan | Lokasi |
|---|---|
| Ditampilkan (Riwayat Agenda, detail rekap, dashboard) | ~12 tempat, mis. `RiwayatAgenda.tsx:715`, `AgendaDetailDrawer.tsx:152` |
| **Dicocokkan dengan jadwal** | `scheduleDetectionService.ts:256,406,475`, `reportViewModel.ts:99` |
| Filter laporan | `reportQuery.ts:183,331` |
| Pencarian teks | `RiwayatAgenda.tsx:294` |

### 2.2 Koreksi: snapshot teks ternyata tidak diperlukan

Versi pertama dokumen ini menyatakan bahwa menghapus kolom itu akan membuat laporan lama
menampilkan kelas terkini siswa. **Itu tidak akurat.** Yang berubah mengikuti kenaikan kelas
adalah `siswa.kelas` — kelas siswa saat ini. `agenda_header.kelas` menunjuk ke **kelas**,
bukan ke siswa, dan kelas `1A` tidak berpindah identitas sepanjang waktu.

Jadi diganti FK ke `kelas.id`:

- jurnal kelas `1A` tetap menunjuk kelas `1A` selamanya;
- yang tampil adalah `label` kelas itu — dan labelnya `1A`, persis seperti yang diinginkan;
- perbedaan hanya muncul kalau admin mengganti nama kelas, dan dalam kasus itu justru lebih
  masuk akal kalau laporan lama ikut menampilkan nama barunya, karena kelasnya memang kelas
  yang sama.

**Argumen pendukung:** kode sekarang sudah harus menormalkan string dengan
`.trim().toUpperCase()` sebelum membandingkan kelas
(`src/utils/scheduleValidation.ts:74`). Itu tanda pencocokan string sudah rapuh. Dengan FK,
perbandingannya menjadi perbandingan `id` — lebih kokoh, dan seluruh kelas bug akibat spasi
atau huruf besar-kecil hilang.

### 2.3 Tabel keputusan

| Kolom | Sekarang | Menjadi |
|---|---|---|
| `siswa.kelas` | TEXT | **DIHAPUS** → `siswa_kelas.kelas_id` |
| `homeroom_assignment.class_id` | TEXT | → `kelas_id` UUID (FK) |
| `schedule.class_id` | TEXT | → `kelas_id` UUID (FK) |
| `agenda_header.kelas` | TEXT | → `kelas_id` UUID (FK) |

Semua nilai lama `KELAS 1` … `KELAS 6` di-backfill menjadi `1A` … `6A` di Fase 0.

**Aturan wajib:** menghapus kelas memakai **soft delete** (`is_active = false`), bukan
`DELETE` baris. FK-nya `ON DELETE RESTRICT` supaya kelas yang masih punya jurnal atau jadwal
tidak bisa terhapus.

---

## 3. Model data final

### 3.1 `agenda.kelas` (baru)

```sql
CREATE TABLE IF NOT EXISTS agenda.kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tingkat INTEGER NOT NULL CHECK (tingkat BETWEEN 1 AND 6),
    rombel TEXT NOT NULL DEFAULT 'A',
    label TEXT NOT NULL,                 -- '1A', '1B', '2A', …
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_kelas_tingkat_rombel UNIQUE (tingkat, rombel)
);
```

- **Identitas = `id` (UUID).** `tingkat` + `rombel` kunci bisnis, `label` murni tampilan.
- Seed awal: 6 baris → `1A`, `2A`, `3A`, `4A`, `5A`, `6A`.
- Tidak di-scope per tahun ajaran: kelas adalah entitas yang bertahan; yang berubah tiap
  tahun adalah penempatan siswa dan wali kelasnya.

### 3.2 `agenda.siswa_kelas` (baru)

```sql
CREATE TABLE IF NOT EXISTS agenda.siswa_kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES agenda.siswa(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES agenda.academic_year(id) ON DELETE RESTRICT,
    kelas_id UUID NOT NULL REFERENCES agenda.kelas(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_siswa_kelas_per_ay UNIQUE (siswa_id, academic_year_id)
);
```

Index tambahan: `(academic_year_id, kelas_id)`.
**Tanpa kolom status** — tinggal kelas sudah diputuskan tidak ada, jadi tidak diperlukan.

### 3.3 `agenda.siswa`

```sql
ALTER TABLE agenda.siswa ADD COLUMN IF NOT EXISTS nis TEXT;              -- opsional
ALTER TABLE agenda.siswa ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AKTIF'
    CHECK (status IN ('AKTIF', 'LULUS', 'PINDAH_KELUAR', 'NONAKTIF'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_siswa_nis
    ON agenda.siswa (nis) WHERE nis IS NOT NULL;
ALTER TABLE agenda.siswa DROP COLUMN IF EXISTS kelas;                    -- digantikan enrollment
```

- `nis` **opsional**: kolomnya ada dan unik kalau diisi, tetapi UI tidak mewajibkannya.
- `status` menambal badge "Aktif" yang sekarang hardcoded di `src/pages/DataSiswa.tsx:223`.

### 3.4 Dampak ke kode yang membaca kelas siswa

Karena `siswa.kelas` dihapus, pemanggil berikut harus dialihkan ke `siswa_kelas` join
`agenda.kelas` untuk tahun ajaran aktif:

| Pemanggil | Lokasi |
|---|---|
| `getDaftarSiswa()` | `src/services/agendaService.ts:13` |
| Daftar & filter siswa | `src/pages/DataSiswa.tsx:49` |
| Dropdown absensi | `src/components/agenda/AgendaDetailForm.tsx:338` |
| Hitungan dashboard | `src/pages/admin/DashboardOverview.tsx:74` |

---

## 4. Wizard Kenaikan Kelas

Dijalankan **sekali jalan untuk seluruh sekolah**. Tidak ada pemilihan per kelas.

| Langkah | Isi |
|---|---|
| 1. Pilih tahun ajaran | Asal (default `ACTIVE`) → tujuan (harus `DRAFT`; boleh dibuat dari wizard) |
| 2. Mapping kelas | Otomatis: `1A` → `2A`, …, `5A` → `6A`, `6A` → **`LULUS`**. Karena tidak ada tinggal kelas, mapping tidak perlu diubah manual. |
| 3. Review | Daftar kelas asal + jumlah siswa + daftar kelas tujuan. Hanya untuk konfirmasi, bukan pemilihan. |
| 4. Wali kelas TA baru | Generate `homeroom_assignment` untuk tiap kelas tujuan |
| 5. Eksekusi | Satu fungsi DB transaksional ber-`batch_id` |

**Aturan promosi:**
- Semua siswa yang punya penempatan di TA asal **ikut naik**, termasuk yang berstatus
  `NONAKTIF`. Tidak ada filter status.
- Siswa tingkat 6 → `status = 'LULUS'`, **tidak dibuatkan penempatan baru**, dan
  **tidak dihapus** (`agenda_absensi` memakai `ON DELETE CASCADE`; menghapus siswa berarti
  riwayat absensinya hilang permanen).
- Setiap siswa yang naik dapat satu baris `siswa_kelas` baru di TA tujuan.

**Aturan wali kelas:**
- Wali **tetap di tingkat yang sama**, jadi salin langsung: kelas `2A` di TA baru mendapat
  wali dari kelas `2A` di TA sebelumnya.
- Kelas tujuan yang belum punya pasangan di TA sebelumnya (mis. `1B` yang baru dibuka)
  dibiarkan kosong dan ditandai di UI untuk diisi manual.
- Semua hasil generate **bisa diedit** kapan saja dari halaman Wali Kelas yang sudah ada
  (`src/pages/admin/HomeroomManagement.tsx`). Belum ada use case yang memakainya, jadi
  perilaku default ini cukup dan tidak perlu dikunci.

**Eksekusi & rollback:**
- Langkah 5 dijalankan sebagai satu fungsi database (RPC) transaksional, bukan rangkaian
  panggilan dari browser, supaya tidak ada kondisi setengah jadi kalau koneksi terputus.
- Semua baris yang dibuat diberi `batch_id` yang sama.
- Rollback = hapus `siswa_kelas` + `homeroom_assignment` milik `batch_id` itu, kembalikan
  `status` siswa. Diizinkan selama TA tujuan **tidak sedang `ACTIVE`** — jadi
  `DRAFT` maupun `ARCHIVED`.

  Semula penjaganya hanya `DRAFT`, dan itu keliru. Tahun ajaran menjadi `ARCHIVED`
  **secara otomatis** begitu admin mengaktifkan tahun ajaran lain, sehingga jendela
  pembatalan tertutup oleh tindakan yang tidak ada hubungannya dengan kenaikan
  kelas. Akibatnya tahun ajaran yang salah dibuat terkunci di antara dua pesan:
  "tidak bisa dibatalkan" dan "tidak bisa dihapus karena masih berisi".

  Yang benar-benar berbahaya hanya tahun ajaran yang **sedang** aktif — hanya di
  situ sekolah memakai datanya. `DRAFT` belum dipakai, `ARCHIVED` sudah lewat.
  Untuk keluar dari `ACTIVE`, admin mengaktifkan tahun ajaran lain dulu; tahun itu
  otomatis diarsipkan, lalu pembatalannya bisa dijalankan.

---

## 5. Modul Data Kelas

Yang saya maksud: **halaman admin untuk mengelola master `agenda.kelas`**, polanya sama
persis dengan **Data Guru** dan **Data Mapel** yang sudah ada.

Isinya:

- daftar kelas yang ada (`1A` … `6A`), dikelompokkan per tingkat;
- tombol **Tambah Rombel** → pilih tingkat + huruf rombel, mis. tingkat 1 + `B` → `1B`;
- edit label;
- aktif/nonaktifkan kelas (kalau ada rombel yang ditutup).

**Kenapa ini perlu, bukan opsional.** Begitu rombel diimplementasikan, admin harus bisa
menambah `1B` **tanpa lewat SQL**. Kalau tidak ada halaman ini, satu-satunya jalan menambah
rombel adalah lewat wizard kenaikan kelas — padahal menambah rombel tidak selalu bertepatan
dengan kenaikan kelas (bisa dibuka di tengah tahun, atau hanya untuk tahun ajaran tertentu).

**Alternatif yang lebih ringan:** tidak membuat halaman sendiri, cukup tombol "Kelola Kelas"
di dalam wizard dan di halaman Pengaturan. Lebih hemat satu halaman, tapi tersembunyi.

**Rekomendasi saya: halaman tersendiri**, karena konsisten dengan pola Data Guru / Data Mapel
yang sudah dipakai, dan admin akan mencari kelas di tempat yang sama seperti data master lain.

---

## 6. Peta dampak ke kode

### 6.1 Berkas yang terpengaruh perubahan label (`KELAS 1` → `1A`)

| Berkas | Peran |
|---|---|
| `src/types/index.ts:3` | `DAFTAR_KELAS` — sumber hardcode yang akan diganti |
| `src/types/index.ts:86`, `src/types/schedule.ts:42` | Tipe `class_id` |
| `src/pages/DataSiswa.tsx:164,320` | Dropdown kelas |
| `src/pages/admin/HomeroomManagement.tsx:185,362` | Daftar kelas wali |
| `src/pages/admin/ScheduleManagement.tsx:251,705,955` | Dropdown kelas jadwal |
| `src/pages/admin/AdminAgendaPage.tsx:405` | Filter kelas |
| `src/pages/admin/report/RekapHarianPage.tsx:472` | Filter kelas laporan |
| `src/pages/RekapAgenda.tsx:709` | Filter kelas rekap |
| `src/services/export/scheduleExportModel.ts:47,296` | Kolom ekspor jadwal |
| `src/services/export/scheduleExcelExport.ts:229` | Ekspor Excel |
| `src/components/TeacherScheduleModal.tsx:185` | Komentar lebar kolom — menyebut `"KELAS 3"`; **harus diperbarui** karena label jadi lebih pendek |

### 6.2 Berkas yang terpengaruh perubahan kolom FK (`class_id` → `kelas_id`)

| Berkas | Peran |
|---|---|
| `src/services/scheduleService.ts:193,210,251` | Filter & query jadwal |
| `src/services/homeroomService.ts:34,62,77,87,101` | Upsert wali kelas (`onConflict: 'academic_year_id,class_id'`) |
| `src/services/substitutionService.ts:53,152` | Join jadwal untuk badal |
| `src/services/scheduleDetectionService.ts:239,256,406,475,486` | **Pencocokan string agenda ↔ jadwal** |
| `src/services/reportService.ts:66,219,265,288` | Filter kelas laporan |
| `src/services/report/reportViewModel.ts:31,99,202,233,257` | View model rekap |
| `src/services/report/reportQuery.ts:183,331` | Filter `agenda_header.kelas` |
| `src/utils/scheduleValidation.ts:52,74,102,107,112` | Deteksi bentrok jadwal |
| `src/components/agenda/AgendaDetailForm.tsx:125` | `kelas = schedule?.class_id \|\| header.kelas` |
| `src/components/agenda/ScheduleTimelineCard.tsx:135,178` | Tampilan jadwal |
| `src/components/agenda/ActiveScheduleHero.tsx:58` | Kartu jadwal aktif |
| `src/components/agenda/SubstitutionConfirmModal.tsx:85` | Konfirmasi badal |
| `src/components/admin/report/DailyReportDetailModal.tsx:118,307` | Detail rekap harian |
| `src/services/agendaService.ts:158,182,284` | `SimpanAgendaPayload.kelas` → menulis `kelas_id` |
| `src/pages/RiwayatAgenda.tsx:294,598,715,752,778,822,941,975` | Tampilan + pencarian kelas |
| `src/components/report/AgendaDetailDrawer.tsx:152,203,342` | Tampilan detail agenda |
| `src/pages/admin/DashboardOverview.tsx:528`, `src/pages/admin/AdminAgendaPage.tsx:303`, `src/pages/InputAgenda.tsx:408` | Tampilan kelas |
| `src/services/report/reportQuery.ts:37,214` | Ambil label lewat join |
| `src/components/agenda/AgendaDetailForm.tsx:125` | Fallback hardcoded `'KELAS 1'` — dihapus, diganti `kelas_id` |

### 6.3 Berkas baru

| Berkas | Isi |
|---|---|
| `src/pages/admin/DataKelasPage.tsx` | Modul Data Kelas (CRUD master kelas) |
| `src/services/classService.ts` | Query & mutasi `agenda.kelas` |
| `src/contexts/ClassContext.tsx` | Sumber daftar kelas dinamis, menggantikan `DAFTAR_KELAS` |
| `src/pages/admin/KenaikanKelasPage.tsx` | Wizard 5 langkah |
| `src/services/promotionService.ts` | Preview mapping, panggil RPC, rollback |

---

## 7. Rencana fase

Setiap fase bisa dirilis sendiri dan aplikasi tetap jalan.

**Fase 0 — Master kelas + seragamkan label — ✅ SELESAI**

- `supabase/schema.sql`: tabel `agenda.kelas` + index + RLS + policy + grant, dan
  bagian 9 yang melakukan seed `1A` … `6A` sekaligus backfill empat kolom teks
  (`siswa.kelas`, `schedule.class_id`, `homeroom_assignment.class_id`,
  `agenda_header.kelas`) dari `KELAS n` → `nA`. Idempoten, satu file, tidak ada
  migrasi terpisah.
- `src/services/classService.ts` (baru) — get/add/update/aktif-nonaktif kelas.
- `src/contexts/ClassContext.tsx` (baru) — memuat kelas sekali saat login,
  menyediakan `classes` dan `labels`.
- `src/pages/admin/DataKelasPage.tsx` (baru) + menu **Master Data → Kelas** —
  tambah rombel (1B), edit label, aktif/nonaktifkan. Kelas yang dinonaktifkan
  tidak dihapus, hanya disembunyikan dari pilihan.
- `DAFTAR_KELAS` dan `KelasOption` **dihapus** dari `src/types/index.ts`. Delapan
  berkas dialihkan ke `useClassLabels()`: DataSiswa, HomeroomManagement,
  ScheduleManagement, AdminAgendaPage, RekapHarianPage, RekapAgenda, App,
  `scheduleExportModel.ts` (kini menerima `classOptions` dari pemanggil).

*Catatan urutan deploy:* karena satu file mengubah label dan tabel sekaligus,
jalankan `schema.sql` berdekatan dengan pengunggahan bundle baru. Kalau SQL jalan
sementara bundle lama masih terpasang, pilihan filter kelas kosong sampai bundle
baru naik. Di luar jam sekolah, urutan mana pun aman.

**Fase 1 — Identitas siswa + enrollment — ✅ SELESAI**

- `supabase/schema.sql`: `agenda.siswa` kehilangan `kelas`, mendapat `nis`
  (opsional) dan `status` (AKTIF/LULUS/PINDAH_KELUAR/NONAKTIF) — dengan `ALTER`
  terpisah agar database lama ikut terselaraskan.
- Tabel `agenda.siswa_kelas` + index + RLS + policy.
- Bagian 10: migrasi di dalam `DO` block yang **hanya berjalan kalau kolom
  `siswa.kelas` masih ada** — rapikan label, backfill penempatan ke tahun ajaran
  terpilih (ACTIVE, atau `start_date` terakhir), lalu `DROP COLUMN`. Instalasi
  baru melewatinya, dan menjalankan ulang file ini tidak melakukan apa-apa.
- `CREATE INDEX idx_siswa_kelas ON agenda.siswa(kelas)` di bagian 2 **dihapus** —
  kalau dibiarkan, file ini akan gagal saat dijalankan ulang setelah kolomnya
  hilang.
- `src/types/index.ts`: `Siswa` (identitas), `SiswaStatus`,
  `LABEL_STATUS_SISWA`, dan `SiswaTerdaftar` (siswa + kelas/kelas_id/academic_year_id).
- `src/services/agendaService.ts`: `getDaftarSiswa({ kelas?, academicYearId? })`
  membaca `siswa_kelas` join `kelas`; `addSiswa`/`updateSiswa` menulis identitas
  **dan** penempatan lewat satu jalur `tempatkanSiswa()`.
- `src/pages/DataSiswa.tsx`: badge Status membaca kolom asli (bukan lagi
  hardcoded "Aktif"), **status bisa diubah** dari form (Aktif / Lulus / Pindah
  Keluar / Nonaktif), ada filter Status, kolom dan isian NIS opsional, dan
  pencarian mencakup NIS.
- `getDaftarSiswa({ …, sertakanTanpaKelas })`: halaman Data Siswa memakai opsi ini
  supaya siswa yang sudah lulus atau pindah — yang tidak lagi punya penempatan —
  **tetap terlihat dan statusnya tetap bisa diubah**. Tanpa ini, filter Status
  tidak ada gunanya karena barisnya tidak pernah muncul. Pemakai lain (absensi,
  dashboard) tetap memakai daftar berbasis penempatan.
- Saat menyunting, kelas boleh kosong ("— Tidak ditempatkan —"); kelas hanya wajib
  ketika menambah siswa baru.

**Fase 2 — Semua kolom kelas jadi FK — ✅ SELESAI**
- `homeroom_assignment.class_id`, `schedule.class_id`, dan `agenda_header.kelas` →
  `kelas_id` UUID (FK), mengikuti langkah di §8.
- `supabase/schema.sql` bagian 11 menghapus ketiga kolom lama itu di dalam blok `DO` yang
  dijaga keberadaan kolomnya: `schedule.class_id`, `homeroom_assignment.class_id`, dan
  `agenda_header.kelas` (baris 1448, 1483, 1515).
- Sesuaikan berkas-berkas di §6.2 — sudah dikerjakan.
- **Selesai bila:** tidak ada lagi kolom kelas berbentuk teks. Terpenuhi: sisa penyebutan
  `class_id` di `src/` hanya ada di komentar dan penyesuaian cache localStorage lama,
  bukan pemakaian kolom.

**Fase 3 — Wizard kenaikan kelas — ✅ SELESAI**

- `supabase/schema.sql` bagian 12: tabel `agenda.promotion_log`, fungsi
  `agenda.kenaikan_kelas(p_from, p_to)` dan `agenda.batalkan_kenaikan_kelas(p_batch)`,
  keduanya `SECURITY INVOKER` dengan gerbang `agenda.is_admin()` di awal, dan
  `EXECUTE` dicabut dari `anon`/`PUBLIC` lalu diberikan ke `authenticated`.
- `src/services/promotionService.ts`: `buildPromotionPreview()` (murni, diuji),
  `cekTahunAjaranTujuanBersih()`, `jalankanKenaikanKelas()`,
  `batalkanKenaikanKelas()`, `getBatchForTahunAjaran()`.
- `src/pages/admin/KenaikanKelasPage.tsx` + menu **Pengaturan → Kenaikan Kelas**.
- `test_promotion_preview.ts` — 8 verifikasi aturan.

**Perbaikan setelah uji coba (bug status berlaku surut) — ✅ SELESAI**

Bug yang dilaporkan pemilik produk: setelah kenaikan kelas dijalankan, membuka
tahun ajaran lama menampilkan siswa tingkat 6 berstatus **Lulus padahal masih
punya kelas**.

Akar masalahnya bukan salah ketik, melainkan rancangan: `siswa.status` hanya satu
kolom untuk semua tahun ajaran, padahal status itu sifatnya **per tahun**. Anak
yang lulus tahun ini tetap aktif di tahun-tahun sebelumnya, jadi menulis `LULUS`
ke kolom global membuatnya berlaku surut. Gejala keduanya lebih parah dan tidak
disadari: karena `AgendaDetailForm` menyaring siswa aktif, form absensi tahun lama
menampilkan semua nama dengan label "(nonaktif)" dan hitungan **0 hadir**.

Perbaikan:
- `agenda.siswa_kelas.status` (BARU) — status siswa **pada tahun itu**. Isinya
  `AKTIF` / `PINDAH_KELUAR` / `NONAKTIF`; **`LULUS` sengaja tidak boleh ada**,
  karena lulus berarti tidak ada kelas lagi, sehingga "punya kelas berstatus
  lulus" menjadi mustahil.
- `siswa.status` tetap ada, artinya dipersempit jadi **"status sekarang"**, dan
  hanya dipakai untuk siswa yang tidak punya penempatan di tahun yang dibuka.
- Aturannya dikurung di satu fungsi murni `statusSiswaPadaTahun()` supaya bisa
  diuji tanpa database (`test_status_per_tahun.ts`, 6 verifikasi).
- `updateSiswa` menulis kedua kolom sekaligus — satu-satunya tempat keduanya
  ditulis bersamaan, supaya tidak saling menyimpang. `LULUS` hanya ditulis ke
  kolom global.
- Fungsi `agenda.kenaikan_kelas` membaca `siswa_kelas.status`, bukan
  `siswa.status` — pertanyaannya memang "apakah anak ini aktif **di tahun itu**".
- Pilihan status di Data Siswa menyesuaikan keadaan: siswa yang punya kelas hanya
  ditawari `AKTIF` / `PINDAH_KELUAR` / `NONAKTIF`; `LULUS` muncul hanya untuk
  siswa yang sudah tidak punya kelas. Aturan ini yang membuat kontradiksinya
  tidak bisa dibuat lagi dari UI.

**Temuan ketiga yang ikut diperbaiki:** `AgendaDetailForm` mengambil daftar siswa
tanpa menyebut tahun ajaran, jadi selalu memakai tahun yang sedang aktif — artinya
mengedit agenda lama menampilkan roster tahun yang salah. Sekarang daftarnya
mengikuti **tanggal agendanya** lewat `resolveAcademicYearIdForDate()`, dan hanya
memuat siswa berstatus `AKTIF`.

**Aturan wajib saat menyunting `supabase/schema.sql`**

File ini dirancang aman dijalankan berulang, dan dua kali sudah gagal karena
aturan ini dilanggar. Keduanya sudah ditutup, dan `test_schema_struktur.ts`
menjaganya:

1. **Setiap `DROP COLUMN` harus berada di dalam blok `DO` yang dijaga** pengecekan
   keberadaan kolom itu — dan perapian datanya harus di blok yang sama.
   Pelanggarannya: `UPDATE agenda.schedule SET class_id = …` sempat ditulis di
   bagian 9 tanpa penjaga, sementara `DROP COLUMN class_id` dikerjakan di bagian
   11. Sekali jalan berhasil, jalan kedua gagal `column s.class_id does not exist`.
2. **Index di atas kolom baru harus memakai nama baru.** Kalau namanya sama dengan
   index lama di kolom yang akan dihapus, `CREATE INDEX IF NOT EXISTS` akan
   melihat nama itu masih terpakai lalu melewatinya — dan index-nya hilang bersama
   kolomnya tanpa pernah dibuat ulang. Karena itu `idx_schedule_class` menjadi
   `idx_schedule_kelas`, dan seterusnya.

**Keputusan yang berubah dari versi awal desain:**

| Hal | Semula | Menjadi | Alasan |
|---|---|---|---|
| Siswa nonaktif | Ikut dinaikkan | **Dilewati** | Kalau ikut, ia muncul di dropdown absensi dan dihitung hadir setiap hari |
| Tahun ajaran tujuan | Cukup DRAFT | **Harus bersih** (tanpa penempatan & wali kelas) | Supaya pembatalan bisa menghapus tanpa menebak mana baris buatan siapa |
| Jendela pembatalan | Hanya saat TA tujuan `DRAFT` | **Selama TA tujuan tidak `ACTIVE`** | TA menjadi ARCHIVED otomatis saat admin mengaktifkan TA lain, jadi penjaga `DRAFT` menutup jendelanya sendiri |
| Kelas tujuan | Boleh dibuat wizard | **Wizard memperingatkan**, tidak membuat | Master data tetap satu pintu |

**Dua celah yang ditemukan dan ditutup saat mengerjakan:**
1. **Status siswa tidak pernah dipakai menyaring apa pun.** Di `AgendaDetailForm`,
   daftar siswa diambil hanya dari penempatan dan `presentCount` = jumlah siswa
   dikurangi yang ditandai absen — jadi siswa yang sudah keluar tetap terhitung
   hadir. Diperbaiki: siswa nonaktif tetap ditampilkan (supaya absensi periode
   sebelum mereka keluar masih bisa dicatat) tetapi diberi penanda "(nonaktif)"
   dan dikeluarkan dari hitungan hadir.
2. **Siswa yang kelas asalnya tidak ada di daftar kelas dibuang diam-diam.**
   `buildPromotionPreview` semula `continue` tanpa jejak. Sekarang dihitung sebagai
   `siswaTanpaKelasSumber` dan memblokir eksekusi dengan peringatan. Sekaligus
   wizard memuat kelas **termasuk yang nonaktif** sebagai sumber — kelas asal bisa
   saja sudah ditutup sementara siswanya masih tercatat di sana. Sisi tujuan tetap
   dibatasi ke kelas aktif.

---

## 8. Cara menghapus kolom string dengan aman

Urutannya wajib begini — kolom teks dihapus **paling akhir**, setelah semua pembacanya
dialihkan. Kalau dibalik, aplikasi mati di tengah migrasi.

**Langkah 1 — Tambah kolom FK (nullable dulu).**

```sql
ALTER TABLE agenda.agenda_header
    ADD COLUMN IF NOT EXISTS kelas_id UUID REFERENCES agenda.kelas(id) ON DELETE RESTRICT;
-- sama untuk agenda.schedule dan agenda.homeroom_assignment
```

Dibuat nullable supaya baris lama tetap sah selama proses.

**Langkah 2 — Backfill.** Cocokkan nilai teks lama ke `kelas.label` (yang sudah di-rename
jadi `1A` … `6A` di Fase 0), lalu isi `kelas_id`.

**Langkah 3 — Alihkan penulis.** `simpanAgenda` (`src/services/agendaService.ts:158,182`)
berhenti mengirim `kelas`, mulai mengirim `kelas_id` — diambil dari `schedule.kelas_id`.
Fallback hardcoded `'KELAS 1'` di `src/components/agenda/AgendaDetailForm.tsx:125` dihapus.

**Langkah 4 — Alihkan pembaca.** Empat kelompok:

| Kelompok | Cara alih |
|---|---|
| Tampilan (~12 tempat) | Ambil `label` lewat join. Pola nested select sudah dipakai proyek ini — lihat `agendaService.ts:230` (`siswa:siswa_id (*)`). |
| Pencocokan jadwal (`scheduleDetectionService.ts:256,406,475`, `reportViewModel.ts:99`) | Bandingkan `kelas_id === kelas_id` — menghapus kebutuhan normalisasi `.trim().toUpperCase()`. |
| Filter laporan (`reportQuery.ts:183,331`) | `.eq('kelas_id', ...)` |
| Pencarian teks (`RiwayatAgenda.tsx:294`) | Cari pada `label` hasil join |

**Langkah 5 — Baru hapus kolomnya.**

```sql
ALTER TABLE agenda.agenda_header DROP COLUMN IF EXISTS kelas;
```

Setelah langkah ini, satu-satunya tempat label kelas disimpan adalah `agenda.kelas.label` —
dan isinya `1A`, `1B`, `2A`, `2B`. Tidak ada lagi `KELAS 1` di mana pun.
