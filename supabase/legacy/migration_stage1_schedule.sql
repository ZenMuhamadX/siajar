-- ==============================================================================
-- STAGE 1: ACADEMIC YEAR & SCHEDULE MIGRATION
-- Schema: agenda
-- ==============================================================================

SET search_path TO agenda, public;

-- 1. Tabel Academic Year (Tahun Ajaran)
CREATE TABLE IF NOT EXISTS agenda.academic_year (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- Contoh: '2026/2027'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hanya 1 Academic Year yang boleh berstatus ACTIVE dalam satu waktu
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_academic_year 
ON agenda.academic_year (status) 
WHERE (status = 'ACTIVE');

CREATE INDEX IF NOT EXISTS idx_academic_year_status ON agenda.academic_year (status);

-- 2. Tabel Schedule (Jadwal Pengajaran per Guru & Kelas)
CREATE TABLE IF NOT EXISTS agenda.schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES agenda.academic_year(id) ON DELETE RESTRICT,
    day TEXT NOT NULL CHECK (day IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY')),
    period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 20),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    class_id TEXT NOT NULL, -- e.g. 'KELAS 1', 'KELAS 2', dsb.
    subject_id UUID REFERENCES agenda.mapel(id) ON DELETE SET NULL,
    subject_name TEXT NOT NULL, -- Disimpan redundant agar tahan jika mapel diubah/ekstrakurikuler di kemudian hari
    teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    teacher_name TEXT NOT NULL,
    activity_type TEXT NOT NULL DEFAULT 'KBM' CHECK (activity_type IN ('KBM', 'EXTRACURRICULAR', 'LIFESKILL', 'SPECIAL')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_schedule_time_range CHECK (start_time < end_time)
);

-- Index performa query schedule
CREATE INDEX IF NOT EXISTS idx_schedule_academic_year ON agenda.schedule(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_schedule_day ON agenda.schedule(day);
CREATE INDEX IF NOT EXISTS idx_schedule_teacher ON agenda.schedule(teacher_name);
CREATE INDEX IF NOT EXISTS idx_schedule_teacher_id ON agenda.schedule(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedule_class ON agenda.schedule(class_id);
CREATE INDEX IF NOT EXISTS idx_schedule_status ON agenda.schedule(status);
CREATE INDEX IF NOT EXISTS idx_schedule_composite_conflict ON agenda.schedule(academic_year_id, day, status);

-- 3. Row Level Security (RLS) & Policies
ALTER TABLE agenda.academic_year ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write academic_year" ON agenda.academic_year;
CREATE POLICY "Allow public read-write academic_year" 
ON agenda.academic_year FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read-write schedule" ON agenda.schedule;
CREATE POLICY "Allow public read-write schedule" 
ON agenda.schedule FOR ALL USING (true) WITH CHECK (true);

-- 4. Hak Akses Supabase
GRANT ALL ON agenda.academic_year TO anon, authenticated;
GRANT ALL ON agenda.schedule TO anon, authenticated;
