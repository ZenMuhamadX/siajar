-- ==============================================================================
-- SKEMA MIGRATION: BUKTI FOTO MENGAJAR (EVIDENCE)
-- Bucket Supabase Storage: agenda-evidence (Private)
-- Tabel: agenda.agenda_evidence
-- ==============================================================================

-- 1. Buat Bucket Storage 'agenda-evidence' jika belum ada (Private bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'agenda-evidence',
    'agenda-evidence',
    false, -- Private bucket, akses via signed URL
    10485760, -- Limit 10MB per file
    ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg'];

-- 2. Storage Policies untuk Bucket 'agenda-evidence'
DROP POLICY IF EXISTS "Allow anon & authenticated read agenda-evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon & authenticated upload agenda-evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon & authenticated update agenda-evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon & authenticated delete agenda-evidence" ON storage.objects;

CREATE POLICY "Allow anon & authenticated read agenda-evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'agenda-evidence');

CREATE POLICY "Allow anon & authenticated upload agenda-evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'agenda-evidence');

CREATE POLICY "Allow anon & authenticated update agenda-evidence"
ON storage.objects FOR UPDATE
USING (bucket_id = 'agenda-evidence')
WITH CHECK (bucket_id = 'agenda-evidence');

CREATE POLICY "Allow anon & authenticated delete agenda-evidence"
ON storage.objects FOR DELETE
USING (bucket_id = 'agenda-evidence');

-- 3. Tabel Metadata Evidence: agenda.agenda_evidence
CREATE TABLE IF NOT EXISTS agenda.agenda_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID NOT NULL REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'image/webp',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_agenda_evidence UNIQUE (agenda_id)
);

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_agenda_evidence_agenda ON agenda.agenda_evidence(agenda_id);

-- 5. Row Level Security (RLS)
ALTER TABLE agenda.agenda_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write agenda_evidence" ON agenda.agenda_evidence;
CREATE POLICY "Allow public read-write agenda_evidence"
ON agenda.agenda_evidence FOR ALL
USING (true) WITH CHECK (true);

-- 6. Grant Permissions
GRANT ALL ON agenda.agenda_evidence TO anon, authenticated;
