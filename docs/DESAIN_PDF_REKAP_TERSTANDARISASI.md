# Desain PDF Terstandarisasi — Rekap Harian, Mingguan, Bulanan

**Status:** usulan desain (belum ada perubahan kode)
**Acuan gaya:** `src/services/export/journalPdfExport.ts` — PDF Log Jurnal yang sudah dikustomisasi
**Tanggal:** 1 Oktober 2026

---

## 1. Ringkasan

Saat ini **hanya Log Jurnal** yang menghasilkan PDF melalui kanvas dokumen terprogram
(pdfmake). Rekap **Harian, Mingguan, dan Bulanan** masih memakai `window.print()` +
CSS `@media print`, sehingga:

- bergantung pada dialog printer browser (hasil berbeda antar perangkat),
- tidak punya nomor halaman yang benar,
- dan tidak bisa menjamin "hanya data cetak" yang tampil.

Usulan: **ketiga rekap memakai mesin PDF yang sama persis dengan Log Jurnal**, sehingga
satu jenis dokumen, satu gaya, satu perilaku — tanpa `window.print()`.

Kabar baiknya: ketiga halaman **sudah** membangun model dokumen yang seragam
(`PrintReportModel` di `src/services/report/printReportModel.ts`). Yang kurang hanya
**penulis PDF-nya** (masih khusus Log Jurnal) dan **lebar kolom dalam satuan cetak**.
Jadi ini penyatuan, bukan pembangunan ulang.

---

## 2. Kondisi saat ini (fakta dari kode)

| Jenis | Sumber data | Cara menghasilkan dokumen | Nomor halaman | Orientasi |
|---|---|---|---|---|
| Log Jurnal | `queryAllJournalRowsForPrint()` | `downloadJournalPdf()` → pdfmake | dinamis (`Halaman x dari y`) | landscape |
| Rekap Harian | `getDailyReport()` | `useReportPrint()` → `window.print()` | menyerahkan ke footer browser | portrait |
| Rekap Mingguan | `getWeeklyReport()` | `useReportPrint()` → `window.print()` | menyerahkan ke footer browser | landscape |
| Rekap Bulanan | `getMonthlyReport()` | `useReportPrint()` → `window.print()` | menyerahkan ke footer browser | landscape |

Mesin PDF Log Jurnal (`journalPdfExport.ts`) sudah memiliki semua yang dibutuhkan
dokumen resmi:

- kop resmi 3 baris + garis pemisah,
- judul + baris periode/tahun ajaran,
- tabel dengan `headerRows: 1` (header berulang otomatis di setiap halaman),
- zebra striping, garis kotak penuh 0.5pt (aman difotokopi),
- baris total tebal,
- baris "tidak ada data" saat kosong,
- blok tanda tangan dua kolom,
- footer nomor halaman yang **benar**.

Yang perlu dilakukan hanyalah menggeneralisasi mesin itu, bukan menulis yang baru.

---

## 3. Analisis kesenjangan

### 3.1 Mesin PDF terikat ke Log Jurnal (bukan dapat dipakai ulang)

`journalPdfExport.ts` memuat hal-hal yang spesifik Log Jurnal di dalam fungsi umum:

- `COLUMN_WIDTHS` — lebar kolom **hardcoded** 7 kolom, hanya cocok untuk jurnal
  (`[24, 62, 48, 118, 88, 34, '*']`),
- `journalPdfFileName()` — nama berkas khusus jurnal,
- `buildJournalDocDefinition()` — nama fungsi terikat jurnal,
- blok judul selalu menambahkan "Periode: …" (rekap harian mengirim periode berupa
  tanggal mentah `2026-10-01`, sehingga akan tercetak tidak rapi).

**Akibat:** rekap mingguan/bulanan (10 kolom) mustahil memakai mesin ini tanpa
mengubah lebar kolom secara manual per jenis.

### 3.2 Model cetak belum membawa lebar kolom dalam satuan cetak

`PrintColumn.width` berisi **kelas Tailwind** (`w-8`, `w-16`, `w-44`). Kelas itu hanya
bermakna di HTML, bukan di PDF. pdfmake memerlukan lebar dalam **pt**.

**Akibat:** tanpa perubahan ini, PDF mingguan/bulanan akan memakai lebar default
pdfmake (kolom rata) atau memaksa hardcode lagi per jenis — persis masalah 3.1.

### 3.3 Rekap harian tidak punya ringkasan agregat

Mingguan & bulanan punya `totalsRow` (baris TOTAL KESELURUHAN). Harian tidak — padahal
di layar harian punya 4 kartu ringkasan (Total Jadwal, Terealisasi, Badal, Belum
Terealisasi) yang justru informasi paling penting untuk laporan harian.

**Akibat:** dokumen harian terasa "hanya tabel", tidak setara dengan dua dokumen lain.

### 3.4 Nama penandatangan tidak konsisten

- PDF Log Jurnal: `Waka Kurikulum` (nama default) + `Kepala Sekolah`.
- Dokumen cetak HTML Log Jurnal: blok tanda tangan **kustom** bertanda titik-titik
  ("( ......... )"), tanpa nama.

**Akibat:** dua dokumen resmi dari aplikasi yang sama punya bentuk tanda tangan berbeda.

### 3.5 Subtitle tidak seragam antar jenis

| Jenis | `title` | `subtitle` | `periodInfo` |
|---|---|---|---|
| Harian | `LAPORAN REKAP PEMBELAJARAN HARIAN` | `Hari, Tanggal: …` | `2026-10-01` |
| Mingguan | `LAPORAN REKAPITULASI PEMBELAJARAN MINGGUAN` | `Periode: … s.d. …` | `2026-09-28 s.d. 2026-10-04` |
| Bulanan | `LAPORAN REKAPITULASI PEMBELAJARAN BULANAN` | `Bulan: Oktober 2026` | `Oktober 2026` |
| Jurnal | `Laporan Rekapitulasi Agenda & KBM Kelas` | `Kelas: … • Guru: …` | `Periode: … s.d. …` |

**Akibat:** saat dicetak, kata "Periode:" muncul di beberapa tempat dengan bentuk
berbeda. Perlu satu aturan baku.

---

## 4. Spesifikasi dokumen terstandarisasi

Semua jenis laporan memakai **enam zona** dengan urutan dan gaya yang identik.

### Zona 1 — Kop resmi
- Nama sekolah, UPPERCASE, bold 12pt, rata tengah, `characterSpacing` 0.4.
- "SISTEM INFORMASI AGENDA DAN JURNAL MENGAJAR (SIAJAR)", 8pt, rata tengah, abu `#5F5E5A`.
- Alamat sekolah, 8pt, rata tengah, abu.
- Garis pemisah 1.2pt `#2C2C2A`, lebar penuh area cetak.

### Zona 2 — Judul & meta
- Judul: UPPERCASE, bold 10pt, rata tengah, **bergaris bawah**.
- Subtitle (opsional): 8pt, rata tengah, abu.
- Baris meta: `Periode: {periodInfo}   •   Tahun Ajaran: {academicYearName}`, 8pt, rata tengah, abu.

### Zona 3 — Ringkasan capaian (BARU, seragam)
- Satu tabel horizontal, 4–5 sel, tanpa padding luar.
- Setiap sel: label kecil 7pt abu (huruf besar), nilai 11pt bold di bawahnya.
- Garis kotak penuh 0.5pt, latar sel putih.

| Jenis | Indikator |
|---|---|
| Harian | Total Jadwal (JP) · Terealisasi (JP) · Badal (JP) · Belum Terealisasi (JP) |
| Mingguan | JP Terjadwal · JP Terealisasi · Badal (Masuk/Keluar) · Belum Realisasi · Capaian % |
| Bulanan | JP Terjadwal · JP Terealisasi · Durasi Mengajar · Badal Terlaksana · Belum Terealisasi |
| Jurnal | *(tidak dipakai — dokumen arsip per sesi)* |

### Zona 4 — Tabel utama
- `headerRows: 1` → header **berulang otomatis** di setiap halaman.
- Header: latar `#5F5E5A`, teks putih bold 8pt, perataan mengikuti `column.align`.
- Isi: 8pt, baris ganjil berlatar `#F1EFE8` (zebra) agar baris panjang mudah ditelusuri.
- Garis: kotak penuh 0.5pt `#2C2C2A` — tetap terbaca saat difotokopi hitam-putih.
- Baris total: latar `#D3D1C7`, tebal. Muncul **bila tabel berisi agregat per guru**
  (mingguan, bulanan) — tidak untuk harian yang barisnya per slot.
- Bila 0 baris: satu baris bergabung berisi `emptyMessage`, miring, rata tengah.

### Zona 5 — Blok tanda tangan
- Dua kolom, rata tengah, masing-masing 50% lebar.
- Kiri: `Mengetahui,` / `Waka Kurikulum` / *(ruang tanda tangan ±28pt)* / nama bold bergaris bawah.
- Kanan: `Cikarang, {tanggal}` / `Kepala Sekolah` / *(ruang)* / nama bold bergaris bawah.
- **Aturan baru:** nama penandatangan diambil dari Pengaturan sekolah dan dipakai
  sama untuk **semua** dokumen PDF (Log Jurnal maupun ketiga rekap).

### Zona 6 — Footer
- Kiri: `Dicetak otomatis melalui SIAJAR - {nama sekolah}`, 7pt abu.
- Kanan: `Halaman {currentPage} dari {pageCount}`, 7pt abu — dihitung saat render.

### Ukuran halaman & margin
- A4, margin `[24, 24, 24, 34]` pt (≈ 8.5 mm), sama dengan dokumen Log Jurnal.
- **Harian → portrait** (7 kolom).
- **Mingguan & Bulanan → landscape** (10 kolom).

---

## 5. Spesifikasi kolom per jenis

### 5.1 Harian — A4 portrait (area cetak ≈ 547pt)

Tanpa kolom Dokumentasi: dokumen cetak hanya memuat informasi tekstual. Status
keberadaan foto tetap tampil di tabel layar — dokumen arsip tidak perlu
menyatakannya, apalagi gambarnya.

| # | Kolom | Rata | Lebar |
|---|---|---|---|
| 1 | No | tengah | 20pt |
| 2 | Waktu | tengah | 60pt |
| 3 | Kelas | tengah | 40pt |
| 4 | Mata Pelajaran | kiri | sisa (`*`, ≈203pt) |
| 5 | Guru Terjadwal | kiri | 86pt |
| 6 | Guru Aktual | kiri | 86pt |
| 7 | Status | tengah | 52pt |

### 5.2 Mingguan & Bulanan — A4 landscape (area cetak ≈ 794pt)

Kedua jenis memakai kolom **identik** — hanya judul, periode, dan isi angkanya berbeda.

| # | Kolom | Rata | Lebar |
|---|---|---|---|
| 1 | No | tengah | 22pt |
| 2 | Nama Guru | kiri | sisa (`*`) |
| 3 | JP Terjadwal | tengah | 54pt |
| 4 | JP Realisasi | tengah | 54pt |
| 5 | Durasi Terjadwal | tengah | 68pt |
| 6 | Durasi Realisasi | tengah | 68pt |
| 7 | Badal Masuk | tengah | 50pt |
| 8 | Badal Keluar | tengah | 50pt |
| 9 | Belum Realisasi | tengah | 58pt |
| 10 | Capaian % | tengah | 52pt |

### 5.3 Aturan isi sel (dari model yang sudah ada)

- `badalMasuk` → `+3` bila > 0, selain itu `0`.
- `badalKeluar` → `-2` bila > 0, selain itu `0`.
- `capaian` → `88%`.
- `durasi*` → `1j 40m` (formatter `formatMinutesToHourMin`).
- Tidak ada sel yang memuat status dokumentasi foto — kolomnya tidak dipakai di
  dokumen (lihat §5.1).

---

## 6. Penamaan berkas

| Jenis | Pola | Contoh |
|---|---|---|
| Harian | `Rekap_Harian_{tanggal}.pdf` | `Rekap_Harian_2026-10-01.pdf` |
| Mingguan | `Rekap_Mingguan_{awal}_sd_{akhir}.pdf` | `Rekap_Mingguan_2026-09-28_sd_2026-10-04.pdf` |
| Bulanan | `Rekap_Bulanan_{tahun}-{bulan}.pdf` | `Rekap_Bulanan_2026-10.pdf` |
| Jurnal | `Jurnal_Agenda_{tanggal}.pdf` | `Jurnal_Agenda_2026-10-01.pdf` *(sudah ada)* |

---

## 7. Rencana implementasi

### 7.1 Berkas baru

| Berkas | Isi |
|---|---|
| `src/services/export/reportPdfExport.ts` | Generalisasi `journalPdfExport.ts`: `buildReportDocDefinition(model, options)`, `downloadReportPdf(model, options)`, `reportPdfFileName(kind, model)`. Memuat kop, judul, **strip ringkasan**, tabel (lebar dari model), total, tanda tangan, footer. |
| `src/hooks/useReportPdf.ts` | Satu pintu unduh PDF untuk tiga halaman: state `isPreparing`, guard (`!isLoading && !loadError && rows > 0`), toast hasil, error ramah. Menggantikan `useReportPrint` untuk tombol ini. |

### 7.2 Berkas yang diubah

| Berkas | Perubahan |
|---|---|
| `src/services/report/printReportModel.ts` | Tambah `PrintColumn.ptWidth?: number` + `grow?: boolean`; tambah `summary?: PrintSummaryItem[]`; tambah `documentKind`; `assertNoImages` juga memeriksa `summary`. |
| `src/services/export/journalPdfExport.ts` | Jadi pembungkus tipis di atas `reportPdfExport` (atau diarahkan ulang) supaya Log Jurnal & ketiga rekap benar-benar memakai **satu mesin**. |
| `src/pages/admin/report/RekapHarianPage.tsx` | Tombol "Cetak Laporan" → "Unduh PDF"; tambah `ptWidth` per kolom; tambah `summary` (4 indikator). |
| `src/pages/admin/report/RekapMingguanPage.tsx` | Sama; `summary` 5 indikator dari `totals`. |
| `src/pages/admin/report/RekapBulananPage.tsx` | Sama; `summary` 5 indikator dari `totals`. |
| `src/hooks/useReportPrint.ts` | Dihapus bila tidak ada pemakai tersisa. |

### 7.3 Yang **tidak** diubah

- Lapisan data (`reportService.ts`, `reportViewModel.ts`, `reportQuery.ts`) — sudah benar.
- Pemisahan foto: model cetak tetap hanya memuat `hasDocumentation` (boolean).
- `ReportPrintLayout.tsx` + blok `@media print` — dipertahankan sebagai pratinjau cetak
  browser, bukan lagi jalur utama.

### 7.4 Urutan kerja

1. Tambah `ptWidth`/`grow`/`summary` ke model + unit test ringan.
2. Bangun `reportPdfExport.ts` (pindahkan fungsi umum dari `journalPdfExport.ts`).
3. Arahkan Log Jurnal ke mesin baru — **verifikasi PDF jurnal tidak berubah**.
4. Alihkan Rekap Harian → portrait + strip 4 indikator.
5. Alihkan Rekap Mingguan & Bulanan → landscape + strip 5 indikator.
6. Hapus `useReportPrint.ts` bila sudah tak terpakai.
7. Verifikasi: `tsc --noEmit`, `oxlint`, `vite build`.

---

## 8. Keputusan yang diambil

1. **Logo sekolah di kop PDF** — **tidak dipakai**. Kop murni teks, sama persis
   dengan PDF Log Jurnal yang sudah disetujui, sehingga keempat dokumen identik.
2. **Nama penandatangan** — dikumpulkan sebagai konstanta bersama
   (`DEFAULT_LEFT_SIGNER` / `DEFAULT_RIGHT_SIGNER` di `reportPdfExport.ts`).
   Belum diambil dari halaman Pengaturan karena Pengaturan belum punya field
   penandatangan; satu tempat ini membuat penambahannya nanti hanya satu titik ubah.
3. **Baris TOTAL pada harian** — **tidak ada**. Baris harian adalah per slot,
   bukan agregat per guru; angka agregatnya dipindahkan ke strip ringkasan.
4. **Dokumen kosong** — **tetap dihasilkan**, berisi satu baris `emptyMessage`,
   supaya permintaan "tidak ada data pada periode ini" punya dokumen arsipnya.
   (Log Jurnal tetap menampilkan info dan tidak mengunduh apa pun, karena
   halaman itu sudah memeriksa hasil filter lebih dulu.)
5. **Baris "Periode:" tidak lagi berulang.** `periodInfo` kini berisi nilai
   periode saja; label "Periode:" ditambahkan sekali oleh penulis dokumen.
   Ini juga memperbaiki keluaran ganda "Periode: Periode: …" pada Log Jurnal.
6. **Nama berkas diseragamkan** ke token periode, termasuk Log Jurnal:
   `Jurnal_Agenda_2026-10-01.pdf` (sebelumnya memakai tanggal siap-tampil).
7. **Subtitle** hanya dipakai bila menambah informasi yang tidak ada di baris
   meta: harian ("Hari, Tanggal: …") dan jurnal ("Kelas: … • Guru: …").
   Mingguan & bulanan tidak memakai subtitle karena periodenya sudah lengkap
   di baris meta.

---

## 9. Kriteria penerimaan

- [x] Tidak ada `window.print()` di jalur unduh ketiga rekap.
- [x] Harian, mingguan, bulanan, dan jurnal memakai **satu** mesin PDF yang sama.
- [x] Enam zona dokumen identik secara visual pada keempat jenis laporan.
- [x] Nomor halaman benar (`Halaman x dari y`) di setiap lembar.
- [x] Header tabel berulang di halaman ke-2 dan seterusnya.
- [x] Tidak ada satu pun berkas di jalur PDF yang menerima URL/gambar foto.
- [x] `tsc --noEmit`, `oxlint`, dan `vite build` bersih (tanpa regresi).

---

## 10. Status implementasi

**Selesai.** Ringkasan perubahan:

| Berkas | Status | Keterangan |
|---|---|---|
| `src/services/report/printReportModel.ts` | diubah | `documentKind`, `fileLabel`, `summary`, `ptWidth`; `assertNoImages` kini juga memeriksa strip ringkasan |
| `src/services/export/reportPdfExport.ts` | **baru** | Satu mesin PDF: kop, judul, strip ringkasan, tabel berlebar dinamis, total, tanda tangan, footer |
| `src/hooks/useReportPdf.ts` | **baru** | Satu pintu unduh PDF (guard loading/error, status "Menyiapkan…", error ramah) |
| `src/pages/admin/report/RekapHarianPage.tsx` | diubah | Portrait 7 kolom + strip 4 indikator; tombol → "Unduh PDF" |
| `src/pages/admin/report/RekapMingguanPage.tsx` | diubah | Landscape 10 kolom + strip 5 indikator |
| `src/pages/admin/report/RekapBulananPage.tsx` | diubah | Kolom identik mingguan |
| `src/pages/RekapAgenda.tsx` | diubah | Memakai mesin baru; blok cetak tersembunyi dihapus |
| `src/utils/date.ts` | diubah | Tambah `formatDateMedium` ("1 Oktober 2026") |
| `src/index.css` | diubah | Aturan `.print-table*` / `.print-avoid-break` dihapus (tidak ada lagi konsumen) |
| `src/hooks/useReportPrint.ts` | **dihapus** | Digantikan `useReportPdf` |
| `src/components/admin/report/ReportPrintLayout.tsx` | **dihapus** | Digantikan kop/tabel/tanda tangan di `reportPdfExport.ts` |
| `src/services/export/journalPdfExport.ts` | **dihapus** | Digantikan `reportPdfExport.ts` (satu mesin untuk keempat jenis) |
| `test_report_pdf_model.ts` | **baru** | 7 verifikasi: lebar kolom, keseragaman mingguan=bulanan, penamaan berkas, penjaga foto |
| `scripts/generate-preview-pdf.ts` | **baru** | Pembuat contoh PDF nyata dari kode produksi (lihat di bawah) |

### Contoh PDF nyata

`scripts/generate-preview-pdf.ts` menghasilkan tiga berkas PDF sungguhan ke
`docs/contoh-pdf/` dengan memanggil `buildReportDocDefinition` yang sama seperti
aplikasi — jadi hasilnya tidak mungkin berbeda dari yang diunduh pengguna.

```
bun scripts/generate-preview-pdf.ts
```

Hasil yang sudah diverifikasi pada berkas keluaran:

| Berkas | Halaman | Ukuran halaman | Font |
|---|---|---|---|
| `Rekap_Harian_2026-10-01.pdf` | 1 | 595,28 × 841,89 pt (A4 **portrait**) | Roboto Regular + Medium (tertanam) |
| `Rekap_Mingguan_2026-09-28-sd-2026-10-04.pdf` | 1 | 841,89 × 595,28 pt (A4 **landscape**) | Roboto Regular + Medium (tertanam) |
| `Rekap_Bulanan_2026-10.pdf` | 1 | 841,89 × 595,28 pt (A4 **landscape**) | Roboto Regular + Medium (tertanam) |

Tertanamnya `Roboto-Medium` memastikan bagian **bold** (kop, judul, header tabel,
nama penandatangan) benar-benar terender — bukan gagal diam-diam seperti yang
pernah terjadi saat font belum terpasang.

Hasil verifikasi:

```
tsc --noEmit -p tsconfig.app.json   → 0 error
oxlint                              → 0 error, 42 warning (baseline 43 — turun 1, tanpa regresi)
vite build                          → sukses (pdfmake & vfs_fonts tetap chunk terpisah/lazy)
bun test_report_pdf_model.ts        → 7/7 lulus
```

**Catatan yang perlu diketahui:** karena dokumen kini dihasilkan mesin PDF, UI
layar tiap halaman rekap dibungkus `no-print`. Menekan Ctrl+P pada halaman rekap
karena itu menghasilkan halaman kosong — jalur resminya adalah tombol
**Unduh PDF**. Bila diinginkan, bisa ditambahkan pesan singkat di layar saat
pengguna mencetak lewat browser.

---

## 11. Perbaikan setelah implementasi

### 11.1 Garis kop terpotong (dilaporkan pemilik produk)

**Gejala:** garis bawah kop berhenti jauh sebelum tepi tabel — pada semua rekap,
termasuk Log Jurnal.

**Dua sebab, keduanya warisan dari penulis PDF Log Jurnal yang dulu hanya
melayani landscape:**

1. `buildLetterhead()` memakai lebar garis **hardcode 515pt**. Pada portrait
   (area cetak 547,3pt) garisnya kurang ~32pt; pada landscape (793,9pt) kurang
   ~278pt — garisnya berhenti sekitar 65% lebar tabel.
2. Konstanta `CONTENT_WIDTH_*` menghitung lebar area cetak dari **margin
   vertikal**, bukan horizontal. pdfmake memakai urutan
   `pageMargins = [kiri, atas, kanan, bawah]` — bukan urutan CSS. Akibatnya area
   cetak terbaca 537/784pt, padahal seharusnya 547,3/793,9pt.

**Perbaikan:**

- Lebar garis kop kini berasal dari satu sumber kebenaran, `PAGE_CONTENT_WIDTH`,
  yang juga dipakai strip ringkasan dan perhitungan lebar kolom. Karena ketiganya
  membaca nilai yang sama, tepi kanan dokumen tidak bisa lagi berbeda.
- Dikurangi `TABLE_BORDER_WIDTH` (0,5pt) karena garis kotak tabel menempati
  0,5pt di tepinya — supaya garis kop persis rata dengan tepi tabel, bukan
  menonjol setengah poin.
- Urutan `pageMargins` diberi komentar peringatan agar tidak salah dibaca lagi.

**Hasil pengukuran pada PDF keluaran** (dari operator path, bukan perkiraan):

| Dokumen | Garis kop | Strip ringkasan & tabel | Selisih |
|---|---|---|---|
| Harian (portrait) | 24,00 → 570,78 pt | 24,00 → 570,78 pt | **0 pt** |
| Mingguan (landscape) | 24,00 → 817,39 pt | 24,00 → 817,39 pt | **0 pt** |
| Bulanan (landscape) | 24,00 → 817,39 pt | 24,00 → 817,39 pt | **0 pt** |

Sebelum perbaikan, garis kop hanya 515pt pada ketiga dokumen.

**Verifikasi regresi:** Test 8 pada `test_report_pdf_model.ts` mengunci lebar
garis kop terhadap `PAGE_CONTENT_WIDTH` untuk kedua orientasi.

### 11.2 Kolom Dokumentasi dihapus dari PDF rekap harian

**Permintaan pemilik produk:** dokumentasi jangan dimasukkan ke kanvas PDF rekap
harian.

**Perubahan:** kolom `Dokumentasi` dihapus dari model cetak harian (8 → 7 kolom).
Ruang 48pt yang dibebaskan diserap kolom `Mata Pelajaran`, sehingga nama mapel
panjang membungkus penuh.

Yang **tidak** berubah:

- Tabel **layar** rekap harian tetap menampilkan kolom Dokumentasi beserta tombol
  pembuka lightbox foto — itu kebutuhan dashboard.
- Data `hasDocumentation` tetap ada di `DailyReportItem`, hanya tidak lagi
  dikirim ke model cetak.

Ini sekaligus memperkuat prinsip R-02 (foto hanya di dashboard): dokumen cetak
kini tidak menyatakan apa pun soal foto, bukan sekadar menyatakannya sebagai teks.
Test 2 pada `test_report_pdf_model.ts` menegaskan model harian tidak boleh punya
kolom `dokumentasi`.



