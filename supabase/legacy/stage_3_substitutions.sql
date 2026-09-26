-- ==============================================================================
-- STAGE 3: BADAL / GURU PENGGANTI
-- Schema: agenda
-- ==============================================================================

SET search_path TO agenda, public;

-- 1. Tabel Substitutions (Badal)
CREATE TABLE IF NOT EXISTS agenda.substitutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES agenda.schedule(id) ON DELETE RESTRICT,
    substitution_date DATE NOT NULL,
    original_teacher_name TEXT NOT NULL,   -- snapshot dari schedule.teacher_name
    original_teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    substitute_teacher_name TEXT NOT NULL, -- guru pengganti (logged-in)
    substitute_teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    reason TEXT NOT NULL DEFAULT 'Guru berhalangan',
    reason_detail TEXT,                    -- isian bebas jika reason = 'Lainnya'
    created_by TEXT NOT NULL,              -- activeTeacherName saat membuat
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ               -- soft cancel; NULL = aktif
);

-- 2. Unique index: 1 schedule + tanggal = 1 substitution aktif (non-cancelled)
CREATE UNIQUE INDEX IF NOT EXISTS idx_substitution_unique_active
ON agenda.substitutions (schedule_id, substitution_date)
WHERE (cancelled_at IS NULL);

-- 3. Index performa
CREATE INDEX IF NOT EXISTS idx_substitutions_date
ON agenda.substitutions (substitution_date);

CREATE INDEX IF NOT EXISTS idx_substitutions_schedule
ON agenda.substitutions (schedule_id);

CREATE INDEX IF NOT EXISTS idx_substitutions_substitute
ON agenda.substitutions (substitute_teacher_name);

CREATE INDEX IF NOT EXISTS idx_substitutions_original
ON agenda.substitutions (original_teacher_name);

-- 4. RLS
ALTER TABLE agenda.substitutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write substitutions" ON agenda.substitutions;
CREATE POLICY "Allow public read-write substitutions"
ON agenda.substitutions FOR ALL USING (true) WITH CHECK (true);

-- 5. Hak akses
GRANT ALL ON agenda.substitutions TO anon, authenticated;
