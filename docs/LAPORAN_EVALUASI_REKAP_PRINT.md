# Laporan Evaluasi Teknis — SIAJAR

**Sistem Informasi Agenda dan Jurnal Mengajar**
**Fokus evaluasi:** Modul Admin / Pusat Rekap — khususnya cetak (print) & export
**Tanggal:** 29 September 2026
**Ruang lingkup:** `/admin/rekap` (Harian, Mingguan, Bulanan, Log Jurnal), modul export Jadwal, lapisan data laporan
**Status:** hasil audit statis (read-only, tanpa perubahan kode)

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Cakupan & Metode](#2-cakupan--metode)
3. [Temuan Kritis (Critical Findings)](#3-temuan-kritis-critical-findings)
   - [3.1 Integritas Dokumen Cetak](#31-integritas-dokumen-cetak)
   - [3.2 Ketepatan Data & Kelengkapan Cetak](#32-ketepatan-data--kelengkapan-cetak)
   - [3.3 Kinerja & Skalabilitas Data](#33-kinerja--skalabilitas-data)
   - [3.4 Error Handling](#34-error-handling)
   - [3.5 Kebocoran Foto / Signed URL ke Dokumen](#35-kebocoran-foto--signed-url-ke-dokumen)
   - [3.6 Arsitektur Cetak](#36-arsitektur-cetak)
4. [Rekomendasi Perbaikan](#4-rekomendasi-perbaikan)
   - [4.1 Cetak Tanpa `window.print()` Mentah (wajib)](#41-cetak-tanpa-windowprint-mentah-wajib)
   - [4.2 Foto Hanya di Dashboard, Tidak di Print/Export (wajib)](#42-foto-hanya-di-dashboard-tidak-di-printexport-wajib)
   - [4.3 Integritas Dokumen & CSS Cetak](#43-integritas-dokumen--css-cetak)
   - [4.4 Kinerja & Paginasi](#44-kinerja--paginasi)
   - [4.5 Error Handling & UX Cetak](#45-error-handling--ux-cetak)
   - [4.6 Konsistensi Internal](#46-konsistensi-internal)
5. [Matriks Prioritas](#5-matriks-prioritas)
6. [Acceptance Criteria untuk Implementasi](#6-acceptance-criteria-untuk-implementasi)
7. [Lampiran: Peta Berkas Terkait](#7-lampiran-peta-berkas-terkait)

---

## 1. Ringkasan Eksekutif

Modul Pusat Rekap secara struktural sudah cukup matang: kop dokumen terpusat pada satu
komponen (`ReportPrintLayout.tsx`), kosakata status bersumber tunggal
(`reportStatus.ts`), dan pola export Jadwal sudah memisahkan model murni
(`scheduleExportModel.ts`) dari penulis berkas (`scheduleExcelExport.ts`) — sebuah pola
yang layak ditiru.

Namun pada jalur **cetak laporan**, ditemukan sejumlah masalah yang berdampak langsung
pada kualitas dokumen resmi sekolah (dokumen ini ditandatangani Waka Kurikulum dan
Kepala Sekolah):

1. **Nomor halaman salah** (`Halaman 1 / 1` di-hardcode) — setiap laporan lebih dari satu
   halaman akan mencetak nomor yang bohong di semua lembar.
2. **Header tabel tidak berulang** dan **baris bisa terpotong** antar halaman.
3. **Log Jurnal hanya mencetak halaman aktif** (25 baris), bukan seluruh hasil filter.
4. **Lebar halaman tidak ditetapkan** (tidak ada `@page`), sehingga tabel 10 kolom rawan
   terpotong pada kertas F4/Letter portrait.
5. **Pemanggilan `window.print()` mentah di 4 titik** tanpa lapisan mapping data,
   tanpa guard saat data belum termuat, dan tanpa penyeragaman.
6. **Signed URL foto ikut terangkut** ke dalam pipeline laporan (N+1 request) dan berisiko
   melekat pada dokumen cetak/export — padahal foto hanya boleh tampil di dashboard admin.

Secara keseluruhan: **fungsionalitas dasar berjalan, tetapi integritas dokumen cetak,
ketahanan terhadap volume data, dan pemisahan tanggung jawab dashboard-vs-dokumen belum
memenuhi standar dokumen resmi.** Rekomendasi perbaikan disusun pada Bagian 4.

---

## 2. Cakupan & Metode

**Berkas utama yang diperiksa**

| Berkas | Peran |
|---|---|
| `src/components/admin/report/ReportPrintLayout.tsx` | Kop resmi + blok tanda tangan + footer |
| `src/pages/admin/report/RekapHarianPage.tsx` | Tampilan Harian + tabel cetak |
| `src/pages/admin/report/RekapMingguanPage.tsx` | Tampilan Mingguan + tabel cetak |
| `src/pages/admin/report/RekapBulananPage.tsx` | Tampilan Bulanan + tabel cetak |
| `src/pages/RekapAgenda.tsx` | Log Jurnal + tabel cetak (custom signature) |
| `src/services/reportService.ts` | Ambil data laporan (harian/mingguan/bulanan) |
| `src/services/report/reportStatus.ts` | Kosakata status terpusat |
| `src/services/export/scheduleExportModel.ts` | Model export murni (referensi pola) |
| `src/services/export/scheduleExcelExport.ts` | Penulis `.xlsx` (referensi pola) |
| `src/index.css` | Blok `@media print` |
| `src/components/admin/AdminLayout.tsx` | Shell admin (perilaku `.no-print`) |

**Metode:** pembacaan statis kode, penelusuran alur data (fetch → transform → render cetak),
pemeriksaan aturan CSS cetak, dan perbandingan dengan pola export Jadwal yang sudah ada.
Tidak ada pengujian browser langsung pada sesi ini.

**Catatan batasan:** rekomendasi bersifat teknis dan dapat didiskusikan; belum ada
implementasi yang dilakukan dalam sesi audit ini.

---

## 3. Temuan Kritis (Critical Findings)

### 3.1 Integritas Dokumen Cetak

#### K-01 — Footer nomor halaman di-hardcode `Halaman 1 / 1` 🔴 **KRITIS**
- **Lokasi:** `ReportPrintLayout.tsx:109` → `<span>Halaman 1 / 1</span>`
- **Kondisi:** Nilai statis, tidak dihitung dari jumlah halaman aktual.
- **Kelemahan:** Setiap laporan yang melebihi satu halaman mencetak "Halaman 1 / 1" di
  **semua** lembar. Tidak ada mekanisme CSS counter maupun perhitungan halaman.
- **Dampak pengguna:** Dokumen resmi yang diserahkan ke Kepala Sekolah/arsip berisi
  informasi paginasi yang keliru — merusak kredibilitas dan menyulitkan verifikasi
  kelengkapan berkas.

#### K-02 — Header tabel tidak berulang di halaman berikutnya 🔴 **KRITIS**
- **Lokasi:** seluruh tabel cetak (`RekapHarianPage.tsx:468`, `RekapMingguanPage.tsx:434`,
  `RekapBulananPage.tsx:404`, `RekapAgenda.tsx:691`)
- **Kondisi:** `<thead>` tidak diberi `display: table-header-group`.
- **Kelemahan:** Pada halaman ke-2 dan seterusnya, tabel kehilangan judul kolom; pembaca
  hanya melihat deretan angka tanpa konteks kolom.
- **Dampak pengguna:** Laporan multi-halaman (mingguan/bulanan dengan puluhan guru) menjadi
  tidak terbaca; salah tafsir kolom JP vs Badal sangat mungkin terjadi.

#### K-03 — Baris tabel dapat terpotong antar halaman 🔴 **KRITIS**
- **Lokasi:** `<tbody>` tabel cetak, mis. `RekapBulananPage.tsx:419`
- **Kondisi:** Kelas `.page-break` (`break-inside: avoid`) sudah tersedia di
  `src/index.css:472`, tetapi **tidak diterapkan** ke `<tr>`. Pada `ReportPrintLayout.tsx:82`
  kelas tersebut hanya dipakai untuk blok tanda tangan.
- **Kelemahan:** Satu baris data bisa terbelah dua lembar (setengah di bawah, setengah di
  atas) sehingga nilai JP/durasi terbaca sebagai dua baris berbeda.
- **Dampak pengguna:** Kesalahan pembacaan data keuangan/kinerja guru; dokumen tampak
  tidak profesional.

#### K-04 — Kop resmi hanya muncul di halaman pertama 🔴 **KRITIS**
- **Lokasi:** `ReportPrintLayout.tsx:36–59`
- **Kondisi:** Kop dibungkus `div` biasa, bukan `position: running()` / header berulang.
- **Kelemahan:** Lembar lanjutan tidak memiliki identitas sekolah, tanggal, atau nomor
  halaman; jika lembar terpisah, tidak ada penanda dokumen apa itu.
- **Dampak pengguna:** Risiko lembar lepas tercampur dengan dokumen lain; tidak ada jejak
  asal-usul pada lembar lanjutan.

### 3.2 Ketepatan Data & Kelengkapan Cetak

#### K-05 — Log Jurnal hanya mencetak halaman aktif, bukan seluruh hasil filter 🔴 **KRITIS**
- **Lokasi:** `RekapAgenda.tsx:643` (`data={rows}`) & `RekapAgenda.tsx:669–732` (tabel cetak)
- **Kondisi:** `rows` berasal dari `queryJournalRows({ ...queryParams, page, pageSize })`
  dengan server-pagination default `pageSize = 25`. Tabel cetak memakai himpunan `rows`
  yang sama.
- **Kelemahan:** Menekan "Cetak" pada halaman 1 dari 12 hanya mencetak 25 baris pertama.
  Tidak ada peringatan, tidak ada opsi "cetak semua hasil filter".
- **Dampak pengguna:** **Kehilangan data secara senyap** — user mengira sudah mencetak
  seluruh rekap padahal 95% data tidak tercetak. Ini temuan paling berbahaya dari sisi
  integritas data.

#### K-06 — Tombol cetak tidak dinonaktifkan saat data masih dimuat 🟠 **TINGGI**
- **Lokasi:** `RekapHarianPage.tsx:314–320`, `RekapMingguanPage.tsx:137–143`,
  `RekapBulananPage.tsx:121–127`
- **Kondisi:** Tombol "Cetak Laporan" aktif meski `isLoading === true`.
- **Kelemahan:** Menekan tombol sebelum data selesai memuat menghasilkan dokumen kosong
  atau tidak lengkap, tanpa peringatan.
- **Dampak pengguna:** Dokumen kosong terlanjur tercetak/ditandatangani.

#### K-07 — Tabel cetak kosong tanpa penjelasan 🟡 **SEDANG**
- **Lokasi:** seluruh tabel cetak
- **Kondisi:** Jika `filteredItems`/`teacherSummaries` kosong, versi cetak hanya menampilkan
  tabel tanpa baris.
- **Kelemahan:** Tidak ada baris "Tidak ada data pada periode ini" pada versi cetak
  (padahal versi layar punya `EmptyState`).
- **Dampak pengguna:** Dokumen kosong ambigu — tidak jelas apakah memang tidak ada data
  atau terjadi kegagalan.

### 3.3 Kinerja & Skalabilitas Data

#### K-08 — Unduhan tanpa batas pada rekap mingguan/bulanan 🟠 **TINGGI**
- **Lokasi:** `reportService.ts:331–335` (`getWeeklyReport`)
- **Kondisi:** `getRekapAgenda({ startDate, endDate })` dipanggil **tanpa `limit`/`offset`**,
  dan `getSchedules({ academicYearId })` mengambil semua slot jadwal aktif. Bulanan
  memanggil ulang jalur yang sama untuk rentang 1 bulan penuh
  (`getMonthlyReport` → `getWeeklyReport`, baris 466).
- **Kelemahan:** Satu bulan = seluruh agenda sekolah dalam rentang itu diunduh ke klien.
  Tidak ada agregasi di sisi server (RPC/VIEW).
- **Dampak pengguna:** Waktu muat lama dan konsumsi bandwidth besar pada jaringan sekolah;
  pada data bertahun-tahun bisa menyebabkan timeout.

#### K-09 — N+1 signed URL pada pelengkapan bukti foto 🟠 **TINGGI**
- **Lokasi:** `reportService.ts:143–155` (`attachSignedUrls`)
- **Kondisi:** `Promise.all` memanggil `getEvidenceDisplayUrl(path)` satu per satu untuk
  **setiap** agenda berfoto.
- **Kelemahan:** Ratusan/ribuan request signed URL dijalankan sekaligus, membebani Storage
  dan memori klien. Data URL foto **tidak diperlukan** oleh dokumen cetak (lihat K-11).
- **Dampak pengguna:** Halaman rekap mingguan/bulanan terasa berat/tersendat.

#### K-10 — Tidak ada cache/short-circuit antar navigasi 🟡 **SEDANG**
- **Lokasi:** `RekapHarianPage.tsx:106`, `RekapMingguanPage.tsx:77`, `RekapBulananPage.tsx:90`
- **Kondisi:** Setiap perubahan tanggal/bulan/tahun ajaran memicu fetch penuh ulang.
- **Kelemahan:** Berpindah-pindah periode bolak-balik mengulang unduhan identik.
- **Dampak pengguna:** Respons terasa lambat saat eksplorasi data.

### 3.4 Error Handling

#### K-11 — Kegagalan fetch hanya berupa Toast; area cetak tetap dirender 🟠 **TINGGI**
- **Lokasi:** `RekapHarianPage.tsx:98–103`, `RekapMingguanPage.tsx:69–74`,
  `RekapBulananPage.tsx:82–87`
- **Kondisi:** `catch` menampilkan `showToast('error', ...)` lalu `finally` menutup loading.
- **Kelemahan:** Tidak ada state error yang mencegah pencetakan; user bisa langsung
  menekan "Cetak" dan mencetak dokumen kosong/parsial.
- **Dampak pengguna:** Dokumen invalid lolos ke pencetakan.

#### K-12 — Pesan error mentah ditampilkan ke pengguna 🟡 **SEDANG**
- **Lokasi:** `showToast('error', 'Gagal memuat rekap harian: ' + (err?.message || ''))`
- **Kondisi:** `err.message` dari Supabase dipakai apa adanya.
- **Kelemahan:** Bisa membocorkan detail teknis (nama tabel, kebijakan RLS) dan
  membingungkan pengguna non-teknis.
- **Dampak pengguna:** Pesan error tidak actionable.

### 3.5 Kebocoran Foto / Signed URL ke Dokumen

#### K-13 — Signed URL foto terangkut ke pipeline laporan 🔴 **KRITIS (sesuai arahan)**
- **Lokasi:** `reportService.ts:201` & `:334`, dipakai `DailyReportItem.evidenceUrl`
- **Kondisi:** `attachSignedUrls` dijalankan pada **semua** jalur laporan (harian, mingguan,
  bulanan) dan hasilnya menempel pada objek yang dipakai baik oleh dashboard **maupun**
  tabel cetak. Saat ini tabel cetak kebetulan hanya memakai boolean
  `r.hasDocumentation`/`r.evidence?.storage_path` (`RekapHarianPage.tsx:502`,
  `RekapAgenda.tsx:726`) — **bukan URL** — sehingga belum tercetak.
- **Kelemahan:** Ini **kebetulan aman, bukan aman secara desain.** Karena `evidenceUrl`
  berada di objek yang sama dengan data cetak, satu perubahan kecil (mis. ingin menampilkan
  thumbnail di dokumen, atau `console.log`/serialisasi objek) dapat menyebabkan URL foto
  (yang bertanda tangan & sementara) ikut ke dokumen atau ke luar. Tidak ada batas tipe
  yang memisahkan "data dashboard" dari "data dokumen".
- **Dampak pengguna:** Risiko dokumen memuat URL foto / gambar; juga pemborosan request
  (lihat K-09) untuk data yang tidak akan pernah dipakai di cetak.

### 3.6 Arsitektur Cetak

#### K-14 — `window.print()` mentah di 4 lokasi tanpa pemetaan data 🔴 **KRITIS (sesuai arahan)**
- **Lokasi:** `RekapHarianPage.tsx:110–112`, `RekapMingguanPage.tsx:110–112`,
  `RekapBulananPage.tsx:94–96`, `RekapAgenda.tsx:195`
- **Kondisi:** Keempatnya `const handlePrint = () => window.print();` secara langsung.
- **Kelemahan:**
  - Tidak ada lapisan yang memetakan struktur data UI → struktur khusus cetak; komponen
    cetak membaca langsung dari state UI yang bentuknya berorientasi layar.
  - Duplikasi di 4 tempat; perubahan kebijakan cetak harus disunting di 4 berkas.
  - Tidak ada guard status (loading/error/kosong) maupun konteks periode yang dikirim.
  - Tidak dapat diuji (tidak ada fungsi murni yang menghasilkan model cetak).
- **Dampak pengguna:** Perilaku cetak tidak konsisten antar tampilan dan sulit
  dievolusikan (mis. menambah opsi orientasi, kop berulang, atau judul dokumen dinamis).

#### K-15 — Tidak ada `@page`; orientasi & margin bergantung dialog browser 🟠 **TINGGI**
- **Lokasi:** `src/index.css:451–482`
- **Kondisi:** Tidak ada deklarasi `@page { size: ...; margin: ... }`.
- **Kelemahan:** Tabel mingguan/bulanan memiliki 10 kolom dengan lebar tetap
  (`w-14`…`w-28`); pada F4/Letter portrait dengan margin default, kolom "Capaian %" rentan
  terpotong. Hasil cetak berbeda antar perangkat/printer.
- **Dampak pengguna:** Laporan tidak konsisten; kolom hilang tanpa disadari. (Catat:
  modul *export Excel* sudah menangani ini dengan `paperSize: 9 / orientation / fitToWidth`
  di `scheduleExcelExport.ts:322–339` — modul cetak HTML belum.)

#### K-16 — Kontras header bergantung "Cetak latar belakang" 🟡 **SEDANG**
- **Lokasi:** tabel cetak, mis. `RekapHarianPage.tsx:469` (`bg-slate-100`)
- **Kondisi:** Latar header bergantung `print-color-adjust`; jika user mematikan
  background graphics, header menjadi putih polos.
- **Kelemahan:** Garis pemisah tipis (`divide-slate-400`) nyaris tak terlihat saat fotokopi
  hitam-putih.
- **Dampak pengguna:** Dokumen sulit dibaca saat diperbanyak dengan fotokopi.

---

## 4. Rekomendasi Perbaikan

Rekomendasi di bawah memuat **dua arahan wajib** dari pemilik produk (R-01 dan R-02) yang
harus dipenuhi lebih dulu, lalu diikuti perbaikan integritas dokumen, kinerja, dan konsistensi.

### 4.1 Cetak Tanpa `window.print()` Mentah (wajib)

#### R-01 — Perkenalkan lapisan *print model* murni + satu pintu cetak 🔴 **WAJIB**

**Prinsip:** Tiru pola export Jadwal yang sudah terbukti — pisahkan **model murni**
(`scheduleExportModel.ts`) dari **penulis output** (`scheduleExcelExport.ts`).
Untuk cetak, terapkan hal yang sama.

**Yang harus dibuat:**

1. **Model cetak murni** — `src/services/report/printReportModel.ts`
   - Fungsi murni (tanpa React, tanpa DOM) yang memetakan state UI → struktur dokumen cetak.
   - Menghasilkan bentuk yang **sadar-halaman**: judul, subjudul, periode, tahun ajaran,
     kolom, baris, ringkasan/total, dan penanda tanda tangan.
   - **Tidak menyertakan** `evidenceUrl`, `signedUrl`, atau field gambar apa pun.
   - Contoh bentuk:
     ```ts
     export interface PrintReportModel {
       title: string;
       subtitle: string;
       periodInfo: string;
       academicYearName: string;
       orientation: 'portrait' | 'landscape';
       columns: PrintColumn[];          // { key, header, align, width }
       rows: Record<string, string>[];  // sudah diformat ke string tampil
       totalsRow?: Record<string, string>;
       emptyMessage: string;            // teks saat 0 baris
     }
     ```

2. **Hook/pintu cetak tunggal** — `src/hooks/useReportPrint.ts`
   - Menggantikan 4 `handlePrint` mentah.
   - Bertanggung jawab: memvalidasi prasyarat (tidak sedang loading, tidak error, tidak
     kosong), memanggil `buildPrintReportModel(...)`, menyetel orientasi, lalu memicu cetak.
   - Karena tetap memerlukan dialog browser untuk "print to PDF", pemicu akhir boleh tetap
     `window.print()` — **tetapi hanya di dalam satu modul ini**, bukan tersebar di 4 halaman.
     Semua halaman memanggil `useReportPrint()`, tidak menyentuh `window.print()` langsung.

**Aturan implementasi:**
- ❌ Jangan `window.print()` langsung di komponen halaman.
- ✅ Data harus melewati `buildPrintReportModel()` **sebelum** dikirim ke fungsi cetak.
- ✅ Setiap perubahan kebutuhan cetak diselesaikan di model + hook, bukan di 4 halaman.

**Manfaat:** perilaku cetak seragam, dapat diuji (model murni), aman dari cetak saat loading,
dan evolusi (orientasi, kop berulang, judul dinamis) terpusat.

### 4.2 Foto Hanya di Dashboard, Tidak di Print/Export (wajib)

#### R-02 — Pisahkan tipe data dashboard dari data dokumen; buang signed URL dari jalur cetak 🔴 **WAJIB**

**Prinsip:** Foto (beserta signed URL-nya) adalah kebutuhan **dashboard admin** saja.
Dokumen cetak/export hanya memuat informasi tekstual (ada/tidak ada dokumentasi).

**Yang harus dilakukan:**

1. **Pisahkan alur pengambilan data.** `attachSignedUrls()` **tidak boleh** dijalankan pada
   jalur yang menyuplai dokumen cetak. Sediakan dua bentuk data:
   - `DashboardReportItem` — boleh memuat `evidenceUrl` (untuk lightbox/dashboard).
   - `PrintReportItem` — **hanya** boolean `hasDocumentation: boolean`; tanpa URL/gambar.

2. **Pastikan tabel cetak hanya membaca boolean.** Saat ini sudah begitu
   (`r.hasDocumentation ? 'Ada Foto' : '-'` pada `RekapHarianPage.tsx:502`, dan
   `r.evidence?.storage_path ? 'Ada' : '-'` pada `RekapAgenda.tsx:726`) — jadikan ini
   **kontrak tipe**, bukan kebetulan, dengan memakai `PrintReportItem` di model cetak.

3. **Pindahkan pemuatan signed URL ke titik konsumsi dashboard** (saat membuka lightbox
   `PhotoLightboxModal`), bukan saat memuat tabel. Ini sekaligus menyelesaikan K-09 (N+1).

4. **Tegakkan di level model:** `buildPrintReportModel()` menolak/mengabaikan field
   bertipe gambar. Tambahkan uji: model cetak tidak boleh memiliki properti berisi
   `http`/`signed`/`storage_path`.

**Acceptance:** Tidak ada satu pun berkas dalam alur cetak/export yang menerima atau
mencetak URL foto. Dokumen hanya menampilkan "Ada" / "-".

### 4.3 Integritas Dokumen & CSS Cetak

#### R-03 — `@page`, orientasi, dan margin eksplisit 🔴 **TINGGI**
- Tambahkan di `src/index.css`:
  ```css
  @page { size: A4; margin: 12mm 10mm; }
  @page landscape { size: A4 landscape; margin: 10mm; }
  ```
- Harian & Log Jurnal → portrait (kolom sedikit). Mingguan & Bulanan (10 kolom) →
  landscape, atau aktifkan `fitToWidth`.
- Selaraskan dengan `orientation` pada model cetak (R-01) agar satu sumber keputusan.

#### R-04 — Header berulang + baris tidak terpotong 🔴 **TINGGI**
- Terapkan ke seluruh tabel cetak:
  ```css
  @media print {
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr    { break-inside: avoid; page-break-inside: avoid; }
  }
  ```
- Pindahkan aturan ini ke satu kelas bersama (mis. `.print-table`) yang dipakai semua tabel
  cetak, agar tidak diulang per halaman.

#### R-05 — Nomor halaman dinamis 🔴 **TINGGI**
- Ganti footer statis `Halaman 1 / 1` (`ReportPrintLayout.tsx:109`) dengan nomor dinamis.
- Pilihan:
  - CSS `@page { @bottom-right { content: "Halaman " counter(page) " / " counter(pages); } }`
    (dukungan printer berbeda), atau
  - Menyembunyikan footer HTML dan mengandalkan header/footer dialog browser yang
    menampilkan nomor halaman, dengan **menghapus** teks statis agar tidak menyesatkan.
- Yang penting: **jangan** mencetak angka yang tidak benar.

#### R-06 — Kop berulang & penanda lembar lanjutan 🟠 **SEDANG**
- Tambahkan penanda halus "Lanjutan" pada halaman ≥2 (bila header printer dipakai) atau
  minimalkan kop ke satu baris baris identitas pada lembar lanjutan.

#### R-07 — Baris kosong bertuliskan pesan 🟡 **SEDANG**
- Saat 0 baris, cetak satu baris berisi `model.emptyMessage` (mis. "Tidak ada data pada
  periode ini") agar dokumen tidak ambigu.

### 4.4 Kinerja & Paginasi

#### R-08 — Paginasi/batas & agregasi server untuk mingguan–bulanan 🟠 **TINGGI**
- Tambahkan RPC/VIEW agregasi (JP per guru) di Supabase, atau minimal berikan batas
  eksplisit + `limit`/`offset` agar tidak mengunduh seluruh agenda rentang.
- Kurangi kolom yang di-select (mis. jangan tarik `AGENDA_DETAIL_SELECT` penuh bila hanya
  butuh tanggal/guru/status untuk agregasi).

#### R-09 — Hentikan N+1 signed URL 🟠 **TINGGI** *(selesai bersama R-02)*
- Pindahkan pemuatan URL foto ke titik konsumsi dashboard; gunakan batch
  `createSignedUrls` bila dashboard memang menampilkan banyak foto sekaligus.

#### R-10 — Cache ringan antar-periode 🟡 **SEDANG**
- Simpan hasil per kunci periode (mis. `{tanggal, ayId}`) dengan TTL singkat, atau pakai
  library cache (React Query) agar navigasi bolak-balik tidak mengunduh ulang.

### 4.5 Error Handling & UX Cetak

#### R-11 — Guard cetak + state error eksplisit 🟠 **TINGGI**
- Nonaktifkan tombol cetak saat `isLoading`.
- Saat fetch gagal, tampilkan state error (bukan hanya Toast) dan blokir cetak.
- Sediakan `errorState` yang juga tercermin di `PrintReportModel` (jangan hasilkan dokumen
  kosong yang tampak sah).

#### R-12 — Pesan error ramah pengguna 🟡 **SEDANG**
- Petakan error Supabase → pesan Indonesia yang actionable (mis. "Gagal memuat data rekap.
  Coba segarkan; bila berulang hubungi admin."). Jangan tampilkan `err.message` mentah.

#### R-13 — Pratinjau cetak & opsi cetak 🟡 **SEDANG**
- Tambahkan pratinjau (modal berisi `PrintReportModel`) dan opsi orientasi sebelum cetak,
  memanfaatkan `PrintReportModel.orientation`.

### 4.6 Konsistensi Internal

#### R-14 — Pusatkan formatter tanggal 🟢 **RENDAH**
- `formatDateIndo` (`RekapHarianPage.tsx:114`) dan `formatDateDisplay`
  (`RekapMingguanPage.tsx:97`) ditulis lokal, padahal konvensi proyek mewajibkan formatter
  terpusat di `src/utils/date.ts`. Pindahkan agar tidak ada `toLocaleDateString` tersebar.

#### R-15 — Filter guru memakai ID, bukan nama 🟢 **RENDAH**
- Nilai `option` kelas/guru memakai `nama_guru` sebagai kunci
  (mis. `RekapHarianPage.tsx:412`). Nama ganda akan menggabungkan data. Gunakan `id`.

#### R-16 — Pertimbangkan export Excel/PDF dari Pusat Rekap 🟢 **RENDAH**
- Saat ini export `.xlsx` hanya ada di Jadwal. Untuk rekap, `PrintReportModel` (R-01) dapat
  dipakai ulang untuk penulis Excel serupa `scheduleExcelExport.ts` — sekali model, banyak
  output (HTML print + XLSX + PDF).

---

## 5. Matriks Prioritas

| ID | Temuan | Tingkat | Upaya | Rekomendasi |
|---|---|---|---|---|
| K-01 | Nomor halaman salah | 🔴 Kritis | Rendah | R-05 |
| K-02 | Header tidak berulang | 🔴 Kritis | Rendah | R-04 |
| K-03 | Baris terpotong | 🔴 Kritis | Rendah | R-04 |
| K-04 | Kop hanya halaman 1 | 🔴 Kritis | Sedang | R-06 |
| K-05 | Log Jurnal cetak hanya halaman aktif | 🔴 Kritis | Sedang | R-01, R-08 |
| K-13 | Signed URL risiko bocor ke dokumen | 🔴 Kritis | Sedang | **R-02** |
| K-14 | `window.print()` mentah ×4 | 🔴 Kritis | Sedang | **R-01** |
| K-06 | Cetak saat loading | 🟠 Tinggi | Rendah | R-11 |
| K-08 | Unduhan tanpa batas | 🟠 Tinggi | Tinggi | R-08 |
| K-09 | N+1 signed URL | 🟠 Tinggi | Sedang | R-09, R-02 |
| K-11 | Error hanya Toast | 🟠 Tinggi | Rendah | R-11 |
| K-15 | Tidak ada `@page` | 🟠 Tinggi | Rendah | R-03 |
| K-07 | Tabel cetak kosong ambigu | 🟡 Sedang | Rendah | R-07 |
| K-10 | Tanpa cache | 🟡 Sedang | Sedang | R-10 |
| K-12 | Error mentah | 🟡 Sedang | Rendah | R-12 |
| K-16 | Kontras header rapuh | 🟡 Sedang | Rendah | R-04 |
| R-14 | Formatter tanggal tersebar | 🟢 Rendah | Rendah | R-14 |
| R-15 | Filter pakai nama | 🟢 Rendah | Sedang | R-15 |

**Urutan eksekusi yang disarankan:**
1. **R-01 + R-02** (arahan wajib) — pondasi arsitektur cetak.
2. **R-03, R-04, R-05** — integritas dokumen (cepat, dampak besar).
3. **R-11, R-07** — keamanan cetak.
4. **R-08, R-09** — kinerja.
5. **R-06, R-10, R-12, R-14** — penyempurnaan.

---

## 6. Acceptance Criteria untuk Implementasi

**R-01 (lapisan cetak)**
- [ ] Tidak ada `window.print()` yang dipanggil langsung dari komponen halaman; hanya dari
      `useReportPrint()`.
- [ ] Setiap cetakan melewati `buildPrintReportModel()` sebelum dirender/di-print.
- [ ] Model cetak adalah fungsi murni dan memiliki unit test (tanpa DOM).

**R-02 (foto tidak tercetak)**
- [ ] `PrintReportItem` tidak memiliki properti URL/gambar/`storage_path`.
- [ ] Tidak ada `evidenceUrl`/`signedUrl` pada objek yang diterima alur cetak/export.
- [ ] `attachSignedUrls` hanya dipanggil pada jalur dashboard, bukan jalur laporan cetak.
- [ ] Dokumen cetak menampilkan kolom dokumentasi sebagai "Ada"/"-" saja.

**R-03/R-04/R-05 (integritas dokumen)**
- [ ] `@page` mendefinisikan ukuran & margin.
- [ ] `thead` berulang, `tr` tidak terpotong (diverifikasi dengan laporan >1 halaman).
- [ ] Nomor halaman benar pada setiap lembar (atau teks statis dihapus).

**Verifikasi teknis standar proyek**
```
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
./node_modules/.bin/oxlint.exe
node node_modules/vite/bin/vite.js build
```
Baseline: 0 error lint; 43 warning pra-ada (`react(set-state-in-effect)` &
`no-unused-vars` catch param) — bukan regresi.

---

## 7. Lampiran: Peta Berkas Terkait

```
src/
├─ components/admin/report/
│  ├─ ReportPrintLayout.tsx     ← kop, tanda tangan, footer (K-01, K-04, R-05)
│  └─ DailyReportDetailModal.tsx
├─ pages/admin/report/
│  ├─ ReportCenterPage.tsx      ← 4 tampilan (lazy)
│  ├─ RekapHarianPage.tsx       ← K-05? (cetak), K-06, K-14
│  ├─ RekapMingguanPage.tsx     ← K-06, K-14, K-15
│  └─ RekapBulananPage.tsx      ← K-06, K-14, K-15
├─ pages/RekapAgenda.tsx        ← Log Jurnal (K-05, K-14)
├─ services/
│  ├─ reportService.ts          ← K-08, K-09, K-13
│  ├─ report/reportStatus.ts    ← kosakata status (sudah baik)
│  └─ export/
│     ├─ scheduleExportModel.ts ← POLA REFERENSI (model murni)
│     └─ scheduleExcelExport.ts ← POLA REFERENSI (penulis output)
├─ hooks/                       ← (baru) useReportPrint.ts (R-01)
├─ services/report/             ← (baru) printReportModel.ts (R-01)
└─ index.css                    ← blok @media print (K-15, K-16, R-03, R-04)
```

**Catatan penutup:** laporan ini bersifat evaluatif dan belum mengubah kode. Dua arahan
wajib (R-01 & R-02) membentuk ulang arsitektur cetak — dari pemanggilan `window.print()`
langsung menjadi *model cetak murni* + *satu pintu cetak*, sekaligus memastikan foto hanya
hidup di dashboard. Implementasi dapat dimulai dari langkah 1 pada Bagian 5.
