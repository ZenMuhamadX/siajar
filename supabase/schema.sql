-- ==============================================================================
-- SKEMA & STRUKTUR DATABASE SISTEM AGENDA KELAS SDIT AS-SYIFA
-- Schema: agenda
-- ==============================================================================

-- 1. Buat Schema agenda jika belum ada
CREATE SCHEMA IF NOT EXISTS agenda;

-- Set search_path
SET search_path TO agenda, public;

-- ==============================================================================
-- 2. DDL PEMBUATAN TABEL
-- ==============================================================================

-- Tabel 1: Siswa
CREATE TABLE IF NOT EXISTS agenda.siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_siswa TEXT NOT NULL,
    kelas TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel 2: Guru
CREATE TABLE IF NOT EXISTS agenda.guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel 3: Mata Pelajaran (Master Mapel)
CREATE TABLE IF NOT EXISTS agenda.mapel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_mapel TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel 4: Penugasan Guru & Kelas (Guru Kelas / Pengampu Utama)
CREATE TABLE IF NOT EXISTS agenda.guru_kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    kelas TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel 5: Agenda Header (Jurnal Harian per Kelas)
CREATE TABLE IF NOT EXISTS agenda.agenda_header (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sekolah TEXT DEFAULT 'SDIT AS-SYIFA',
    kelas TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel 6: Agenda KBM (Kegiatan Belajar Mengajar per Jam Pelajaran)
CREATE TABLE IF NOT EXISTS agenda.agenda_kbm (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    jam_ke TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    mapel TEXT NOT NULL,
    materi TEXT NOT NULL,
    tugas_pr TEXT,
    is_badal BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel 7: Agenda Absensi (Hanya mencatat siswa yang TIDAK HADIR: Sakit / Izin / Alpha)
CREATE TABLE IF NOT EXISTS agenda.agenda_absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    siswa_id UUID REFERENCES agenda.siswa(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('S', 'I', 'A')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel 8: Agenda Kejadian Khusus
CREATE TABLE IF NOT EXISTS agenda.agenda_kejadian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    uraian_kejadian TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel 9: Kotak Saran (Feedback Guru)
CREATE TABLE IF NOT EXISTS agenda.kotak_saran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    kategori TEXT NOT NULL CHECK (kategori IN ('Fasilitas', 'Kurikulum', 'Aplikasi', 'Lainnya')),
    isi_saran TEXT NOT NULL,
    is_anonim BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 3. INDEX UNTUK PERFORMA QUERY
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_siswa_kelas ON agenda.siswa(kelas);
CREATE INDEX IF NOT EXISTS idx_mapel_nama ON agenda.mapel(nama_mapel);
CREATE INDEX IF NOT EXISTS idx_guru_kelas_guru ON agenda.guru_kelas(nama_guru);
CREATE INDEX IF NOT EXISTS idx_guru_kelas_kelas ON agenda.guru_kelas(kelas);
CREATE INDEX IF NOT EXISTS idx_agenda_header_kelas_tgl ON agenda.agenda_header(kelas, tanggal);
CREATE INDEX IF NOT EXISTS idx_agenda_kbm_agenda ON agenda.agenda_kbm(agenda_id);
CREATE INDEX IF NOT EXISTS idx_agenda_kbm_guru ON agenda.agenda_kbm(nama_guru);
CREATE INDEX IF NOT EXISTS idx_agenda_absensi_agenda ON agenda.agenda_absensi(agenda_id);
CREATE INDEX IF NOT EXISTS idx_agenda_absensi_siswa ON agenda.agenda_absensi(siswa_id);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & PUBLIC ACCESS POLICIES
-- ==============================================================================
ALTER TABLE agenda.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.guru_kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_kbm ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_kejadian ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.kotak_saran ENABLE ROW LEVEL SECURITY;

-- Drop policies jika sebelumnya sudah ada untuk idempotency
DROP POLICY IF EXISTS "Allow public read-write siswa" ON agenda.siswa;
DROP POLICY IF EXISTS "Allow public read-write guru" ON agenda.guru;
DROP POLICY IF EXISTS "Allow public read-write mapel" ON agenda.mapel;
DROP POLICY IF EXISTS "Allow public read-write guru_kelas" ON agenda.guru_kelas;
DROP POLICY IF EXISTS "Allow public read-write agenda_header" ON agenda.agenda_header;
DROP POLICY IF EXISTS "Allow public read-write agenda_kbm" ON agenda.agenda_kbm;
DROP POLICY IF EXISTS "Allow public read-write agenda_absensi" ON agenda.agenda_absensi;
DROP POLICY IF EXISTS "Allow public read-write agenda_kejadian" ON agenda.agenda_kejadian;
DROP POLICY IF EXISTS "Allow public read-write kotak_saran" ON agenda.kotak_saran;

-- Buat Policy Full Read-Write untuk akses anon & authenticated
CREATE POLICY "Allow public read-write siswa" ON agenda.siswa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write guru" ON agenda.guru FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write mapel" ON agenda.mapel FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write guru_kelas" ON agenda.guru_kelas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_header" ON agenda.agenda_header FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_kbm" ON agenda.agenda_kbm FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_absensi" ON agenda.agenda_absensi FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_kejadian" ON agenda.agenda_kejadian FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write kotak_saran" ON agenda.kotak_saran FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 5. HAK AKSES PERMISSION (GRANT) UNTUK SUPABASE
-- ==============================================================================
GRANT USAGE ON SCHEMA agenda TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA agenda TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA agenda TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT ALL ON TABLES TO anon, authenticated;
