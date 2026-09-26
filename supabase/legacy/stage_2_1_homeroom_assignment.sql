-- ==============================================================================
-- STAGE 2.1 MIGRATION: HOMEROOM ASSIGNMENT & TEACHER REFACTOR
-- Schema: agenda
-- ==============================================================================

SET search_path TO agenda, public;

-- 1. Buat tabel homeroom_assignment
CREATE TABLE IF NOT EXISTS agenda.homeroom_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES agenda.academic_year(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL,
    teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    teacher_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_homeroom_class_ay UNIQUE (academic_year_id, class_id)
);

-- 2. Buat index pencarian
CREATE INDEX IF NOT EXISTS idx_homeroom_ay_class 
ON agenda.homeroom_assignment (academic_year_id, class_id);

CREATE INDEX IF NOT EXISTS idx_homeroom_teacher 
ON agenda.homeroom_assignment (teacher_id, teacher_name);

-- 3. Backfill aman dari tabel guru_kelas legacy bila tabel tersebut masih ada.
--    Jika tabel sudah dibuang, blok ini dilewati tanpa error.
DO $$
DECLARE
    active_ay_id UUID;
BEGIN
    IF to_regclass('agenda.guru_kelas') IS NULL THEN
        RETURN;
    END IF;

    SELECT id INTO active_ay_id
    FROM agenda.academic_year
    WHERE status = 'ACTIVE'
    LIMIT 1;

    IF active_ay_id IS NOT NULL THEN
        -- Insert distinct kelas dari guru_kelas jika belum ada di homeroom_assignment
        INSERT INTO agenda.homeroom_assignment (academic_year_id, class_id, teacher_id, teacher_name)
        SELECT DISTINCT ON (gk.kelas)
            active_ay_id,
            gk.kelas,
            g.id AS teacher_id,
            gk.nama_guru AS teacher_name
        FROM agenda.guru_kelas gk
        LEFT JOIN agenda.guru g ON LOWER(TRIM(g.nama_guru)) = LOWER(TRIM(gk.nama_guru))
        WHERE NOT EXISTS (
            SELECT 1 FROM agenda.homeroom_assignment ha
            WHERE ha.academic_year_id = active_ay_id
              AND ha.class_id = gk.kelas
        );
    END IF;
END $$;

-- 4. RLS & hak akses publik, konsisten dengan migrasi schema lainnya.
ALTER TABLE agenda.homeroom_assignment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write homeroom_assignment"
    ON agenda.homeroom_assignment;
CREATE POLICY "Allow public read-write homeroom_assignment"
    ON agenda.homeroom_assignment FOR ALL
    USING (true) WITH CHECK (true);

GRANT ALL ON agenda.homeroom_assignment TO anon, authenticated;
