-- =============================================================================
-- ROLLBACK STAGE 5 AUTH -> MODEL PIN LAMA
-- =============================================================================
-- HANYA jalankan file ini setelah membuat backup database.
-- Efek sengaja: aplikasi kembali memakai login PIN dan akses anon publik.
-- Jangan jalankan file ini bila Supabase Auth masih harus dipertahankan.
--
-- File ini idempoten dan aman dijalankan ulang. Kolom/data yang dibuat Stage 5
-- tidak dihapus; hanya dependensi RLS, trigger, fungsi, dan grant Auth yang
-- dibatalkan. Jalankan stage_6_drop_guru_kelas.sql setelah file ini.
-- =============================================================================

SET search_path TO agenda, public;

-- 1. Hentikan trigger yang bergantung pada auth.uid() sebelum policy/functions
--    dihapus.
DROP TRIGGER IF EXISTS trg_lock_substitution_identity ON agenda.substitutions;
DROP TRIGGER IF EXISTS trg_lock_evidence_identity ON agenda.agenda_evidence;
DROP TRIGGER IF EXISTS trg_lock_agenda_header_teacher ON agenda.agenda_header;
DROP TRIGGER IF EXISTS trg_lock_agenda_kbm_teacher ON agenda.agenda_kbm;

-- 2. Buang policy Stage 5. Policy publik lama dibuang juga agar dapat dibuat
--    ulang dengan bentuk yang sama pada langkah 3.
DROP POLICY IF EXISTS master_siswa_read ON agenda.siswa;
DROP POLICY IF EXISTS master_siswa_write ON agenda.siswa;
DROP POLICY IF EXISTS master_mapel_read ON agenda.mapel;
DROP POLICY IF EXISTS master_mapel_write ON agenda.mapel;
DROP POLICY IF EXISTS master_guru_read ON agenda.guru;
DROP POLICY IF EXISTS master_guru_write ON agenda.guru;
DROP POLICY IF EXISTS master_ak_read ON agenda.academic_year;
DROP POLICY IF EXISTS master_ak_write ON agenda.academic_year;
DROP POLICY IF EXISTS master_jp_read ON agenda.period_templates;
DROP POLICY IF EXISTS master_jp_write ON agenda.period_templates;
DROP POLICY IF EXISTS master_homeroom_read ON agenda.homeroom_assignment;
DROP POLICY IF EXISTS master_homeroom_write ON agenda.homeroom_assignment;
DROP POLICY IF EXISTS schedule_read ON agenda.schedule;
DROP POLICY IF EXISTS schedule_write ON agenda.schedule;
DROP POLICY IF EXISTS agenda_header_read ON agenda.agenda_header;
DROP POLICY IF EXISTS agenda_header_insert ON agenda.agenda_header;
DROP POLICY IF EXISTS agenda_header_update ON agenda.agenda_header;
DROP POLICY IF EXISTS agenda_header_delete ON agenda.agenda_header;
DROP POLICY IF EXISTS agenda_kbm_read ON agenda.agenda_kbm;
DROP POLICY IF EXISTS agenda_kbm_write ON agenda.agenda_kbm;
DROP POLICY IF EXISTS agenda_absensi_read ON agenda.agenda_absensi;
DROP POLICY IF EXISTS agenda_absensi_write ON agenda.agenda_absensi;
DROP POLICY IF EXISTS agenda_kejadian_read ON agenda.agenda_kejadian;
DROP POLICY IF EXISTS agenda_kejadian_write ON agenda.agenda_kejadian;
DROP POLICY IF EXISTS agenda_evidence_read ON agenda.agenda_evidence;
DROP POLICY IF EXISTS agenda_evidence_write ON agenda.agenda_evidence;
DROP POLICY IF EXISTS substitutions_read ON agenda.substitutions;
DROP POLICY IF EXISTS substitutions_insert ON agenda.substitutions;
DROP POLICY IF EXISTS substitutions_update ON agenda.substitutions;
DROP POLICY IF EXISTS substitutions_delete ON agenda.substitutions;
DROP POLICY IF EXISTS saran_read ON agenda.kotak_saran;
DROP POLICY IF EXISTS saran_insert ON agenda.kotak_saran;
DROP POLICY IF EXISTS saran_update ON agenda.kotak_saran;
DROP POLICY IF EXISTS saran_delete ON agenda.kotak_saran;

-- Policy ini hanya ada jika Stage 5 sudah dijalankan pada database lama.
DO $$
BEGIN
    IF to_regclass('agenda.guru_kelas') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS master_guru_kelas_read ON agenda.guru_kelas';
        EXECUTE 'DROP POLICY IF EXISTS master_guru_kelas_write ON agenda.guru_kelas';
    END IF;
END $$;

DROP POLICY IF EXISTS "Allow public read-write siswa" ON agenda.siswa;
DROP POLICY IF EXISTS "Allow public read-write guru" ON agenda.guru;
DROP POLICY IF EXISTS "Allow public read-write mapel" ON agenda.mapel;
DROP POLICY IF EXISTS "Allow public read-write agenda_header" ON agenda.agenda_header;
DROP POLICY IF EXISTS "Allow public read-write agenda_kbm" ON agenda.agenda_kbm;
DROP POLICY IF EXISTS "Allow public read-write agenda_absensi" ON agenda.agenda_absensi;
DROP POLICY IF EXISTS "Allow public read-write agenda_kejadian" ON agenda.agenda_kejadian;
DROP POLICY IF EXISTS "Allow public read-write kotak_saran" ON agenda.kotak_saran;
DROP POLICY IF EXISTS "Allow public read-write academic_year" ON agenda.academic_year;
DROP POLICY IF EXISTS "Allow public read-write schedule" ON agenda.schedule;
DROP POLICY IF EXISTS "Allow public read-write period_templates" ON agenda.period_templates;
DROP POLICY IF EXISTS "Allow public read-write homeroom_assignment" ON agenda.homeroom_assignment;
DROP POLICY IF EXISTS "Allow public read-write substitutions" ON agenda.substitutions;
DROP POLICY IF EXISTS "Allow public read-write agenda_evidence" ON agenda.agenda_evidence;

-- 3. Kembalikan model akses publik yang digunakan frontend PIN.
CREATE POLICY "Allow public read-write siswa"
    ON agenda.siswa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write guru"
    ON agenda.guru FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write mapel"
    ON agenda.mapel FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_header"
    ON agenda.agenda_header FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_kbm"
    ON agenda.agenda_kbm FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_absensi"
    ON agenda.agenda_absensi FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_kejadian"
    ON agenda.agenda_kejadian FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write kotak_saran"
    ON agenda.kotak_saran FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write academic_year"
    ON agenda.academic_year FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write schedule"
    ON agenda.schedule FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write period_templates"
    ON agenda.period_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write homeroom_assignment"
    ON agenda.homeroom_assignment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write substitutions"
    ON agenda.substitutions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write agenda_evidence"
    ON agenda.agenda_evidence FOR ALL USING (true) WITH CHECK (true);

-- 4. Kembalikan policy Storage publik untuk bucket bukti foto.
--    Policy Stage 5 hanya berlaku untuk authenticated user yang memiliki file.
DO $$
BEGIN
    IF to_regclass('storage.objects') IS NULL THEN
        RAISE NOTICE 'Tabel storage.objects tidak tersedia; policy Storage dilewati.';
        RETURN;
    END IF;

    EXECUTE 'DROP POLICY IF EXISTS evidence_read ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_insert ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_update ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_delete ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon & authenticated read agenda-evidence" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon & authenticated upload agenda-evidence" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon & authenticated update agenda-evidence" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon & authenticated delete agenda-evidence" ON storage.objects';

    EXECUTE $policy$
        CREATE POLICY "Allow anon & authenticated read agenda-evidence"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'agenda-evidence')
    $policy$;
    EXECUTE $policy$
        CREATE POLICY "Allow anon & authenticated upload agenda-evidence"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'agenda-evidence')
    $policy$;
    EXECUTE $policy$
        CREATE POLICY "Allow anon & authenticated update agenda-evidence"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'agenda-evidence')
        WITH CHECK (bucket_id = 'agenda-evidence')
    $policy$;
    EXECUTE $policy$
        CREATE POLICY "Allow anon & authenticated delete agenda-evidence"
        ON storage.objects FOR DELETE
        USING (bucket_id = 'agenda-evidence')
    $policy$;
END $$;

-- 5. Hapus helper/function Stage 5 yang tidak lagi dipakai.
DROP FUNCTION IF EXISTS agenda.lock_substitution_identity();
DROP FUNCTION IF EXISTS agenda.lock_evidence_identity();
DROP FUNCTION IF EXISTS agenda.lock_agenda_teacher_identity();
DROP FUNCTION IF EXISTS agenda.can_create_agenda_for_slot(UUID, DATE);
DROP FUNCTION IF EXISTS agenda.can_manage_agenda(UUID);
DROP FUNCTION IF EXISTS agenda.can_access_agenda(UUID);
DROP FUNCTION IF EXISTS agenda.is_admin();
DROP FUNCTION IF EXISTS agenda.current_guru_name();
DROP FUNCTION IF EXISTS agenda.current_guru_id();

-- 6. Kembalikan hak akses anon untuk frontend PIN.
GRANT USAGE ON SCHEMA agenda TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA agenda TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA agenda TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT ALL ON SEQUENCES TO anon, authenticated;

-- Verifikasi setelah dijalankan:
-- 1. Granted role anon pada tabel agenda harus kembali ada.
-- 2. Tidak boleh ada policy Stage 5 (master_*, schedule_*, agenda_*, substitutions_*, saran_*).
-- 3. Login frontend harus menggunakan PIN, bukan Supabase Auth.
