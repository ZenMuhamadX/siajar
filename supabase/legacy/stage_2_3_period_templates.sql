-- ==============================================================================
-- STAGE 2.3 MIGRATION: MASTER JP / PERIOD TEMPLATES
-- Schema: agenda
-- Safe: idempotent, tidak drop tabel existing, tidak merusak data existing
-- ==============================================================================

SET search_path TO agenda, public;

-- 1. Tabel period_templates
-- Menyimpan konfigurasi Jam Pelajaran (JP) per Tahun Ajaran.
-- Setiap academic_year bisa punya konfigurasi JP sendiri.
CREATE TABLE IF NOT EXISTS agenda.period_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES agenda.academic_year(id) ON DELETE RESTRICT,
    period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 20),
    label TEXT NOT NULL,           -- Contoh: "JP 1", "JP 2"
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- period_number unik per academic_year
    CONSTRAINT uq_period_template_ay_number UNIQUE (academic_year_id, period_number),
    -- start_time harus lebih awal dari end_time
    CONSTRAINT chk_period_template_time CHECK (start_time < end_time)
);

-- 2. Index performa
CREATE INDEX IF NOT EXISTS idx_period_templates_ay ON agenda.period_templates(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_period_templates_active ON agenda.period_templates(academic_year_id, is_active);

-- 3. Tambahkan kolom period_template_id ke agenda.schedule (nullable, soft reference)
-- Nullable agar jadwal existing tetap valid.
-- Tidak menggunakan FK hard karena waktu disimpan snapshot di schedule row.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'agenda'
          AND table_name = 'schedule'
          AND column_name = 'period_template_id'
    ) THEN
        ALTER TABLE agenda.schedule
        ADD COLUMN period_template_id UUID REFERENCES agenda.period_templates(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_period_template ON agenda.schedule(period_template_id);

-- 4. RLS
ALTER TABLE agenda.period_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write period_templates" ON agenda.period_templates;
CREATE POLICY "Allow public read-write period_templates"
ON agenda.period_templates FOR ALL USING (true) WITH CHECK (true);

-- 5. Grant
GRANT ALL ON agenda.period_templates TO anon, authenticated;
