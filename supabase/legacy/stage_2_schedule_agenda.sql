-- ==============================================================================
-- STAGE 2 MIGRATION: SCHEDULE -> AGENDA INTEGRATION
-- Schema: agenda
-- ==============================================================================

SET search_path TO agenda, public;

-- 1. Tambahkan kolom schedule_id dan actual_teacher_name ke agenda.agenda_header
-- jika belum ada (nullable agar data agenda historis tetap valid)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'agenda' 
          AND table_name = 'agenda_header' 
          AND column_name = 'schedule_id'
    ) THEN
        ALTER TABLE agenda.agenda_header 
        ADD COLUMN schedule_id UUID REFERENCES agenda.schedule(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'agenda' 
          AND table_name = 'agenda_header' 
          AND column_name = 'actual_teacher_name'
    ) THEN
        ALTER TABLE agenda.agenda_header 
        ADD COLUMN actual_teacher_name TEXT;
    END IF;
END $$;

-- 2. Index untuk pencarian agenda berdasarkan schedule dan tanggal
CREATE INDEX IF NOT EXISTS idx_agenda_header_schedule_id 
ON agenda.agenda_header(schedule_id);

CREATE INDEX IF NOT EXISTS idx_agenda_header_schedule_date 
ON agenda.agenda_header(schedule_id, tanggal);

-- 3. Unique Constraint partial: Satu schedule hanya boleh menghasilkan satu agenda pada tanggal yang sama
-- (Hanya berlaku untuk baris yang memiliki schedule_id IS NOT NULL agar data agenda manual lama tidak bentrok)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_schedule_date 
ON agenda.agenda_header (schedule_id, tanggal) 
WHERE (schedule_id IS NOT NULL);
