# Desain Halaqoh Lintas Kelas (Metode Ummi)

**Status:** keputusan terkunci. **Belum ada kode yang ditulis.**
**Tanggal:** 9 Oktober 2026

## Keputusan yang sudah dikunci

| # | Keputusan | Konsekuensi |
|---|---|---|
| 1 | **Halaqoh punya daftar kelas sumber** (kolam), bukan satu kelas pemilik | `halaqoh.kelas_id` diganti relasi `halaqoh_kelas` (M—N) |
| 2 | **Anggota tetap dipilih per siswa** — bukan otomatis semua siswa kelas | `siswa_halaqoh` **tetap ada**; satu siswa satu halaqoh per tahun ajaran |
| 3 | **Satu kelas boleh menyuplai beberapa halaqoh**, dan sebaliknya | Kelas 4 bisa masuk Halaqoh A *dan* B; Halaqoh B bisa menarik dari kelas 4 & 3 |
| 4 | **Halaqoh dibuat ulang tiap tahun ajaran** | `halaqoh` mendapat `academic_year_id`; tidak diwariskan saat naik kelas |
| 5 | **Tanpa kuota/kapasitas** | Guru yang mengatur komposisi; sistem tidak membatasi jumlah anggota |
| 6 | **Rekap mengikuti kelas sumber yang dideklarasikan** | Anggota dijamin berasal dari kelas sumber, jadi kelas sumber = kelas penerima rekap |
| 7 | **Satu baris agenda**, bukan N baris per kelas | Laporan yang meng-*expand* ke kelas sumber; data tidak terduplikasi |
| 8 | **Guru ditentukan di baris jadwal, diisi manual** | Halaqoh **tidak** menyimpan guru; guru diisi saat menyusun jadwal, **bukan** otomatis dari halaqoh |

---

## 1. Ringkasan

Untuk mapel berkelompok (Ummi), satu halaqoh **tidak lagi milik satu kelas**. Satu halaqoh dapat
berisi siswa dari beberapa kelas (mis. kelas 3 dan 4 digabung), dan sebuah kelas dapat dipecah ke
beberapa halaqoh (sebagian kelas 4 di Halaqoh A, sisanya di Halaqoh B).

Karena itu halaqoh berubah menjadi **objek ber-`id` yang punya daftar kelas sumber** (kolam kandidat),
sementara keanggotaannya **tetap dipilih per siswa**. Halaqoh juga menjadi **milik satu tahun ajaran**,
karena siswa kelas 4 tahun ini pasti naik ke kelas 5 tahun depan — komposisinya tidak diwariskan.

**Alur singkat:** Master Halaqoh (nama + kelas sumber) → Jadwal Ummi (hari, jam, halaqoh, guru) →
Agenda guru (materi + absensi) → Rekap otomatis masuk ke **setiap kelas sumber**.

**Yang paling menenangkan:** `siswa_halaqoh` **tidak dibongkar**. Keanggotaan per siswa per tahun,
beserta aturan "satu siswa satu halaqoh per tahun ajaran", tetap persis seperti sekarang.

**Guru tetap di baris jadwal.** Halaqoh **tidak** menyimpan guru pengampu — keputusan lama di
`supabase/schema.sql` dan `src/types/index.ts:152` **dipertahankan**. Guru diisi **manual** setiap
kali menyusun baris jadwal, dan **tidak** diisi otomatis dari halaqoh. Halaqoh tetap "punya guru"
dalam arti praktik (setiap halaqoh diajar seseorang), tetapi gurunya dicatat di baris jadwal.

---

## 2. Model data target

### 2.1 `agenda.halaqoh` (berubah)

Buang `kelas_id`; tambah `academic_year_id`; ganti aturan keunikan. **Tidak** menambah kolom guru.

```sql
CREATE TABLE IF NOT EXISTS agenda.halaqoh (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL
        REFERENCES agenda.academic_year(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    urutan INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_halaqoh_nama_per_tahun UNIQUE (academic_year_id, nama)
);
```

Perubahan dari sekarang: `kelas_id` hilang, dan `uq_halaqoh_nama_per_kelas` menjadi
`uq_halaqoh_nama_per_tahun`. Kolom guru tidak ditambahkan — guru tetap di `schedule`.

### 2.2 `agenda.halaqoh_kelas` (baru)

Daftar kelas sumber sebuah halaqoh — inilah "kolam kandidat".

```sql
CREATE TABLE IF NOT EXISTS agenda.halaqoh_kelas (
    halaqoh_id UUID NOT NULL REFERENCES agenda.halaqoh(id) ON DELETE CASCADE,
    kelas_id   UUID NOT NULL REFERENCES agenda.kelas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (halaqoh_id, kelas_id)
);
```

### 2.3 `agenda.siswa_halaqoh` (tetap)

Tidak berubah. `academic_year_id` **tetap dipertahankan** justru karena dialah yang menegakkan
aturan "satu siswa hanya boleh ada di satu halaqoh per tahun ajaran"
(`uq_siswa_halaqoh_per_ay`). Kalau kolom itu dibuang, aturan tersebut kehilangan penegaknya.

### 2.4 `agenda.schedule` (berubah sedikit)

Baris Ummi menunjuk halaqoh, bukan satu kelas. `kelas_id` dibuat boleh kosong **hanya** untuk
baris ber-halaqoh. Kolom guru (`teacher_id`, `teacher_name`) **tetap** dan diisi manual.

```sql
ALTER TABLE agenda.schedule ALTER COLUMN kelas_id DROP NOT NULL;
ALTER TABLE agenda.schedule ADD CONSTRAINT chk_schedule_kelas_atau_halaqoh
    CHECK (kelas_id IS NOT NULL OR halaqoh_id IS NOT NULL);
```

### 2.5 `agenda.agenda_header` (berubah sedikit)

Sesi halaqoh juga lintas kelas, jadi `kelas_id` boleh kosong. Agar kelas penerima rekap bisa
dijawab langsung tanpa menelusuri baris KBM, header mendapat `halaqoh_id`.

```sql
ALTER TABLE agenda.agenda_header ADD COLUMN IF NOT EXISTS halaqoh_id UUID
    REFERENCES agenda.halaqoh(id) ON DELETE CASCADE;
ALTER TABLE agenda.agenda_header ALTER COLUMN kelas_id DROP NOT NULL;
ALTER TABLE agenda.agenda_header ADD CONSTRAINT chk_agenda_header_kelas_atau_halaqoh
    CHECK (kelas_id IS NOT NULL OR halaqoh_id IS NOT NULL);
```

`agenda_kbm.halaqoh_id` (sudah ada) tetap dipakai untuk penanda tingkat baris.

### 2.6 Ringkasan relasi

| Relasi | Sekarang | Menjadi |
|---|---|---|
| `halaqoh` → `kelas` | N—1 (`kelas_id`) | **M—N** via `halaqoh_kelas` |
| `halaqoh` → `academic_year` | tidak ada | N—1 (`academic_year_id`) |
| `halaqoh` → `guru` | tidak ada | **tidak ada** (guru tetap di `schedule`) |
| `siswa_halaqoh` → `halaqoh`/`siswa` | tetap | tetap |
| `schedule` → `halaqoh` | 1 halaqoh per baris | tetap (kelas jadi turunan) |
| `agenda_header` → `halaqoh` | tidak ada | N—1 baru |

---

## 3. Aturan bisnis

1. **Anggota ⊆ kelas sumber.** Seorang siswa hanya boleh dimasukkan ke halaqoh yang daftar kelas
   sumbernya memuat kelas siswa itu pada tahun ajaran berjalan. Ditegakkan di service (dan idealnya
   di UI dengan menyaring kandidat).
2. **Satu halaqoh per siswa per tahun ajaran.** Tetap, lewat `uq_siswa_halaqoh_per_ay`.
3. **Keunikan nama** per `(academic_year_id, nama)`.
4. **Kandidat anggota** = siswa dari kelas sumber halaqoh yang **belum masuk halaqoh mana pun**
   tahun itu. Inilah pengganti panel "belum masuk kelompok", kini berbasis kelas sumber.
5. **Guru diisi manual di baris jadwal.** Guru bukan properti halaqoh; ia dipilih setiap kali
   menyusun baris jadwal dan **tidak** diisi otomatis. Guru tamu tetap ditangani pola lama
   (`teacher_id` boleh kosong, `teacher_name` diisi teks).
6. **Bentrok halaqoh:** satu halaqoh tidak boleh punya dua jadwal bertumpuk (sudah ada lewat
   `excl_schedule_halaqoh_overlap`).
7. **Bentrok guru:** satu guru tidak boleh di dua tempat pada jam bertumpuk (sudah ada).
8. **Bentrok kelas (baru):** karena halaqoh menyentuh beberapa kelas sekaligus —
   - dua halaqoh yang **berbagi kelas sumber** tidak boleh pada jam yang sama;
   - sesi halaqoh tidak boleh bertumpuk dengan sesi **seluruh-kelas** dari kelas sumbernya.
   Aturan ini belum ada dan **tidak tertangkap** validator lama (bentrok kelas hanya aktif bila
   kedua baris tanpa halaqoh) maupun exclusion constraint (kunci berbeda).
9. **Kelas yang dideklarasikan ≠ kelas anggota.** Kelas sumber adalah *kolam*, bukan jaminan bahwa
   semua siswanya ikut. Siswa yang tidak dipilih tetap tersedia untuk halaqoh lain.

---

## 4. Alur (contoh: kelas 4, 30 siswa)

1. **Master Halaqoh** — buat "Halaqoh A", centang kelas sumber **4**. Buat "Halaqoh B", centang
   kelas sumber **4 & 3**. Guru **tidak** diisi di sini.
2. **Isi anggota** — Halaqoh A: pilih 12 siswa kelas 4 dari daftar kandidat. Halaqoh B: pilih 18
   siswa kelas 4 (sisa) + beberapa siswa kelas 3. Panel kandidat menyusut sesuai pilihan.
3. **Jadwal Ummi** — baris Senin jam 2: pilih halaqoh **Halaqoh A**, lalu **isi guru manual**
   (mis. Dian Kusumawati). Halaqoh B punya barisnya sendiri di jam yang sama dengan guru lain.
4. **Agenda guru** — Dian membuka slot Senin jam 2 → form agenda untuk Halaqoh A, absensi berisi
   **12 anggota halaqoh** (dengan label kelas masing-masing). Isi → simpan.
5. **Rekap** — sesi itu muncul di **rekap harian kelas 4** (kelas sumbernya), berlabel
   "Halaqoh A · kelas 4". Kalau Halaqoh B mengajar di jam yang sama, rekap kelas 4 memuat dua baris
   Ummi.

### 4.1 Alur menyusun jadwal (mapel Ummi)

Inti perubahannya: menyusun jadwal Ummi **berbasis halaqoh**, bukan berbasis kelas. Kelas tidak
lagi menjadi titik masuk, karena satu halaqoh mencakup beberapa kelas.

1. **Pilih tahun ajaran** (default: yang aktif). Daftar halaqoh diambil dari tahun ajaran itu.
2. **Mapel biasa (bukan Ummi) — tidak berubah:** pilih kelas, mapel, hari, jam, guru → satu baris
   jadwal.
3. **Mapel Ummi:**
   a. pilih mapel Ummi + hari + jam;
   b. sistem menampilkan daftar halaqoh tahun itu (lintas kelas), lengkap dengan kelas sumber;
   c. centang halaqoh yang mengajar di slot itu;
   d. **isi guru manual untuk tiap halaqoh** — tidak diisi otomatis;
   e. simpan → sistem membuat **satu baris jadwal per halaqoh** (hari & jam sama, guru berbeda).
4. **Validasi sebelum simpan** (aturan §3 no. 6–8): guru tidak bentrok; halaqoh tidak bentrok;
   kelas sumber tidak bentrok — dua halaqoh yang berbagi kelas, atau halaqoh vs sesi seluruh-kelas
   dari kelas sumbernya.
5. **Tampilan grid:** sesi Ummi muncul di jadwal **tiap kelas sumbernya**, berlabel
   "Ummi · Halaqoh A". Baris Ummi tidak lagi punya satu `kelas_id` — kelasnya diturunkan dari
   `halaqoh_kelas`.

**Yang perlu diperhatikan:**
- Halaqoh yang belum punya anggota tetap boleh dijadwalkan, tetapi sebaiknya diberi peringatan
  (siswanya akan kosong di absensi).
- Guru wajib diisi saat menyimpan baris jadwal (tidak ada pengisian otomatis dari halaqoh).
- Tidak semua halaqoh harus dijadwalkan di slot yang sama; halaqoh yang tidak dicentang tetap bisa
  dijadwalkan di slot lain.

---

## 5. Peta dampak ke kode

| Berkas | Perubahan |
|---|---|
| `supabase/schema.sql` | `halaqoh` (+`academic_year_id`, −`kelas_id`), tabel `halaqoh_kelas`, `schedule`/`agenda_header` longgar, RLS + index, migrasi data lama |
| `src/types/index.ts` | `Halaqoh` (+`academic_year_id`, +`kelas_ids`), `HalaqohTerdaftar` (kelas sumber, bukan satu label), `AnggotaHalaqoh` (+`kelas`). Komentar "guru TIDAK disimpan di sini" tetap berlaku |
| `src/services/halaqohService.ts` | `getHalaqohByTahunAjaran`, `getKelasSumberHalaqoh`, `addHalaqoh({academicYearId,nama,kelasIds})`, `setKelasSumber`, kandidat anggota, validasi anggota ⊆ kelas sumber |
| `src/services/agendaService.ts` | `getSiswaHalaqoh`: kelas per siswa dari `siswa_kelas` (bukan `halaqoh.kelas_id`); `simpanAgenda`: tulis `agenda_header.halaqoh_id` |
| `src/utils/halaqohLabel.ts` | Label multi-kelas, mis. `"Halaqoh A · kelas 4"`, `"Halaqoh B · kelas 4 & 3"` |
| `src/utils/scheduleValidation.ts` | Aturan bentrok #8 (halaqoh berbagi kelas; halaqoh vs seluruh-kelas kelas sumber) |
| `src/pages/admin/HalaqohPage.tsx` | Pilih kelas sumber (multi) saat membuat halaqoh; filter per tahun ajaran; panel kandidat per kelas sumber |
| `src/pages/admin/ScheduleManagement.tsx` | Pemilihan halaqoh lintas kelas (bukan per kelas terpilih); guru **diisi manual**, tidak otomatis |
| `src/components/agenda/AgendaDetailForm.tsx` | Absensi anggota lintas kelas + label kelas per baris |
| `src/services/report/reportQuery.ts`, `src/services/report/reportViewModel.ts` | *Fan-out*: sesi halaqoh masuk ke tiap kelas sumber; pencocokan agenda ↔ jadwal ikut `halaqoh_id` |
| `src/services/scheduleDetectionService.ts` | Pencocokan tetap membandingkan `halaqoh_id` (sudah ada) |
| `docs/UJI-HALAQOH.md` | Checklist diarahkan ulang ke alur lintas kelas |

---

## 6. Rencana fase

**6 fase (Fase 0–5).** Setiap fase bisa dirilis sendiri dan aplikasi tetap jalan.

### Fase 0 — Skema database + migrasi data lama
- `supabase/schema.sql`: `halaqoh` (+`academic_year_id`, −`kelas_id`), tabel `halaqoh_kelas`,
  RLS + policy + grant, index baru.
- Migrasi di dalam blok `DO` yang dijaga: pindahkan `halaqoh.kelas_id` lama ke `halaqoh_kelas`,
  isi `academic_year_id` (tahun ajaran aktif atau yang paling akhir), lalu `DROP COLUMN kelas_id`.
- `schedule.kelas_id` & `agenda_header` dilonggarkan + `agenda_header.halaqoh_id`.
- Wajib idempoten (lihat §8).
- **Selesai bila:** skema lama bisa dijalankan berulang tanpa error; data halaqoh lama utuh di
  `halaqoh_kelas`.

### Fase 1 — Tipe & service
- `src/types/index.ts`: bentuk `Halaqoh`, `HalaqohTerdaftar`, `AnggotaHalaqoh` baru.
- `src/services/halaqohService.ts`: daftar halaqoh per tahun ajaran, kelola kelas sumber, kandidat
  anggota, validasi anggota ⊆ kelas sumber.
- `src/services/agendaService.ts`: `getSiswaHalaqoh` membaca kelas dari `siswa_kelas`.
- **Selesai bila:** `bunx tsc --noEmit` bersih; skrip `test_*.ts` relevan lulus.

### Fase 2 — UI Master Halaqoh
- `HalaqohPage.tsx`: buat halaqoh + pilih kelas sumber (multi-select), pemilih tahun ajaran,
  panel kandidat per kelas sumber, pindahkan/keluarkan anggota.
- **Selesai bila:** bisa membuat halaqoh lintas kelas, mengisi sebagian siswa, dan sisa siswa tetap
  tersedia untuk halaqoh lain.

### Fase 3 — Jadwal & agenda guru
- `ScheduleManagement.tsx`: pilih halaqoh (multi-kelas); **guru diisi manual** per baris (tidak
  ada pengisian otomatis).
- `AgendaDetailForm.tsx`: absensi = anggota halaqoh lintas kelas, label kelas per baris.
- `scheduleValidation.ts`: aturan bentrok #8.
- **Selesai bila:** guru Ummi bisa menyimpan jadwal & agenda halaqoh lintas kelas; dua halaqoh yang
  berbagi kelas ditolak pada jam yang sama.

### Fase 4 — Rekap & cetak
- `reportQuery.ts` / `reportViewModel.ts`: *fan-out* sesi ke tiap kelas sumber; label multi-kelas.
- Layar rekap (harian, log jurnal, riwayat) + PDF + dashboard/monitoring.
- **Selesai bila:** satu sesi halaqoh tampil di rekap tiap kelas sumbernya, terbaca sebagai satu
  baris berlabel kelompok, dan PDF memuat kolom kelompok.

### Fase 5 — Tahun ajaran baru & verifikasi akhir
- Integrasi dengan alur kenaikan kelas (`docs/DESAIN_KENAIKAN_KELAS.md`): saat tahun ajaran baru,
  halaqoh dibuat ulang. Sediakan bantuan opsional "salin kelas sumber dari tahun lalu" (anggota
  tetap kosong karena roster berubah).
- `docs/UJI-HALAQOH.md` diperbarui; uji manual browser; `bun run lint`, `bunx tsc --noEmit`,
  `test_*.ts`, `bun run build`.
- **Selesai bila:** ganti tahun ajaran menghasilkan halaqoh baru yang bersih, tanpa warisan anggota.

---

## 7. Verifikasi

- `bun run lint`
- `bunx tsc --noEmit -p tsconfig.app.json`
- Skrip uji relevan: `test_schema_struktur.ts`, `test_conflict.ts`, dan skrip baru untuk aturan
  halaqoh lintas kelas (kandidat, validasi anggota ⊆ kelas sumber, bentrok berbagi kelas).
- `bun run build`
- Uji manual browser (checklist `docs/UJI-HALAQOH.md`).

---

## 8. Aturan wajib saat menyunting `supabase/schema.sql`

Mengikuti aturan yang sudah berlaku (dijaga `test_schema_struktur.ts`):

1. **Setiap `DROP COLUMN` berada di dalam blok `DO` yang dijaga** pengecekan keberadaan kolom itu,
   dan perapian datanya ada di blok yang sama. Ini berlaku untuk `halaqoh.kelas_id`.
2. **Index di atas kolom baru memakai nama baru.** `idx_halaqoh_kelas` (index lama di
   `halaqoh(kelas_id)`) harus **dihapus** bersama kolomnya, dan index baru memakai nama berbeda.
3. **`CREATE TABLE IF NOT EXISTS` tidak menyentuh tabel yang sudah ada** — kolom baru pada tabel
   lama ditambahkan lewat `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` terpisah.

---

## 9. Pertanyaan yang masih terbuka

Tidak ada. Semua keputusan sudah dikunci di §1: kuota (tidak perlu), tahun ajaran (per tahun),
basis rekap (kelas sumber), dan guru (**diisi manual di baris jadwal** — halaqoh tidak menyimpan
guru, dan jadwal tidak mengisi otomatis).
