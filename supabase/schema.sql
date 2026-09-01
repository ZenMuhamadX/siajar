-- Skema Database Sistem Agenda Kelas SDIT AS-SYIFA (Schema: agenda)

CREATE SCHEMA IF NOT EXISTS agenda;

SET search_path TO agenda, public;

-- 1. Tabel Siswa
CREATE TABLE IF NOT EXISTS agenda.siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_siswa TEXT NOT NULL,
    kelas TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Guru
CREATE TABLE IF NOT EXISTS agenda.guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Penugasan Guru & Kelas (Guru Kelas / Pengampu Utama)
CREATE TABLE IF NOT EXISTS agenda.guru_kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    kelas TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabel Agenda Header
CREATE TABLE IF NOT EXISTS agenda.agenda_header (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sekolah TEXT DEFAULT 'SDIT AS-SYIFA',
    kelas TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabel Agenda KBM (Kegiatan Belajar Mengajar)
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

-- 6. Tabel Agenda Absensi (Hanya siswa yang tidak hadir)
CREATE TABLE IF NOT EXISTS agenda.agenda_absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    siswa_id UUID REFERENCES agenda.siswa(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('S', 'I', 'A')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabel Agenda Kejadian Khusus
CREATE TABLE IF NOT EXISTS agenda.agenda_kejadian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    uraian_kejadian TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabel Kotak Saran
CREATE TABLE IF NOT EXISTS agenda.kotak_saran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    kategori TEXT NOT NULL CHECK (kategori IN ('Fasilitas', 'Kurikulum', 'Aplikasi', 'Lainnya')),
    isi_saran TEXT NOT NULL,
    is_anonim BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) & Public access policies
ALTER TABLE agenda.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.guru_kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_kbm ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_kejadian ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.kotak_saran ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write siswa" ON agenda.siswa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write guru" ON agenda.guru FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write guru_kelas" ON agenda.guru_kelas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_header" ON agenda.agenda_header FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_kbm" ON agenda.agenda_kbm FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_absensi" ON agenda.agenda_absensi FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_kejadian" ON agenda.agenda_kejadian FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write kotak_saran" ON agenda.kotak_saran FOR ALL USING (true) WITH CHECK (true);

-- Berikan izin akses pada schema agenda untuk role anon dan authenticated
GRANT USAGE ON SCHEMA agenda TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA agenda TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA agenda TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT ALL ON TABLES TO anon, authenticated;
