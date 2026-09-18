-- ==============================================================================
-- STAGE 4 MIGRATION: FOTO DOKUMENTASI AGENDA (EVIDENCE ENHANCEMENT)
-- Schema: agenda
-- Bucket: agenda-evidence
-- ==============================================================================

SET search_path TO agenda, public;

-- 1. Tambahkan kolom captured_at, actual_teacher_name, dan actual_teacher_id
-- pada tabel agenda.agenda_evidence jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'agenda' 
          AND table_name = 'agenda_evidence' 
          AND column_name = 'captured_at'
    ) THEN
        ALTER TABLE agenda.agenda_evidence 
        ADD COLUMN captured_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'agenda' 
          AND table_name = 'agenda_evidence' 
          AND column_name = 'actual_teacher_name'
    ) THEN
        ALTER TABLE agenda.agenda_evidence 
        ADD COLUMN actual_teacher_name TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'agenda' 
          AND table_name = 'agenda_evidence' 
          AND column_name = 'actual_teacher_id'
    ) THEN
        ALTER TABLE agenda.agenda_evidence 
        ADD COLUMN actual_teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Index untuk audit query
CREATE INDEX IF NOT EXISTS idx_agenda_evidence_actual_teacher 
ON agenda.agenda_evidence(actual_teacher_name);

CREATE INDEX IF NOT EXISTS idx_agenda_evidence_captured_at 
ON agenda.agenda_evidence(captured_at);

CREATE INDEX IF NOT EXISTS idx_agenda_evidence_uploaded_at 
ON agenda.agenda_evidence(uploaded_at);

-- 3. Pastikan RLS tetap aktif dan aman
ALTER TABLE agenda.agenda_evidence ENABLE ROW LEVEL SECURITY;
GRANT ALL ON agenda.agenda_evidence TO anon, authenticated;
