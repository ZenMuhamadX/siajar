-- =============================================================================
-- STAGE 7 — RLS + AUTH BERBASIS SUPABASE AUTH
-- =============================================================================
-- Tujuan: menutup celah fatal akses anon terbuka. Setelah file ini dijalankan,
-- database HANYA menerima permintaan dari sesi Supabase Auth yang sah, dan
-- otorisasi ditegakkan di server (RLS), bukan di browser.
--
-- Model login yang dipakai aplikasi:
--   - Guru memilih namanya lalu memasukkan KODE SEKOLAH bersama.
--   - Di balik layar, tiap guru punya akun Supabase Auth sendiri
--     (email sintetis dari guru.id) sehingga tetap punya auth.uid() unik.
--   - Kode sekolah diverifikasi oleh server Supabase Auth, bukan di bundle.
--   - Peran (role) dan identitas guru disimpan di app_metadata JWT.
--     app_metadata HANYA bisa ditulis lewat service_role (script provisioning),
--     tidak bisa dipalsukan oleh pengguna. Jangan pernah memakai user_metadata
--     untuk otorisasi.
--
-- Jalankan file ini setelah backup. File ini idempoten (aman dijalankan ulang).
-- Prasyarat: sudah menjalankan supabase/schema.sql.
-- =============================================================================

SET search_path TO agenda, public;

-- =============================================================================
-- 1. FUNGSI HELPER OTORISASI
-- =============================================================================
-- Semua fungsi membaca klaim JWT. STABLE agar bisa dipakai efisien di policy.

CREATE OR REPLACE FUNCTION agenda.jwt_meta()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(auth.jwt() -> 'app_metadata', '{}'::jsonb);
$$;

-- True bila permintaan berasal dari anggota sekolah yang sudah login
-- (peran 'guru' atau 'admin').
CREATE OR REPLACE FUNCTION agenda.is_member()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT auth.uid() IS NOT NULL
       AND COALESCE(agenda.jwt_meta() ->> 'role', '') IN ('guru', 'admin');
$$;

-- True bila permintaan berasal dari admin / superuser.
CREATE OR REPLACE FUNCTION agenda.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(agenda.jwt_meta() ->> 'role', '') = 'admin';
$$;

-- UUID guru yang sedang login, atau NULL.
CREATE OR REPLACE FUNCTION agenda.current_guru_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(agenda.jwt_meta() ->> 'guru_id', '')::uuid;
$$;

-- Nama guru yang sedang login, atau NULL.
CREATE OR REPLACE FUNCTION agenda.current_guru_name()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT agenda.jwt_meta() ->> 'guru_name';
$$;

-- Admin selalu boleh. Guru boleh bila ia guru pengampu slot jadwal tersebut,
-- atau bila ia tercatat sebagai guru pengganti (badal) pada slot & tanggal itu.
CREATE OR REPLACE FUNCTION agenda.can_manage_schedule(p_schedule_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT agenda.is_admin()
        OR EXISTS (
            SELECT 1
            FROM agenda.schedule s
            WHERE s.id = p_schedule_id
              AND agenda.current_guru_id() IS NOT NULL
              AND s.teacher_id = agenda.current_guru_id()
        )
        OR EXISTS (
            SELECT 1
            FROM agenda.substitutions sub
            WHERE sub.schedule_id = p_schedule_id
              AND sub.substitution_date = p_date
              AND sub.cancelled_at IS NULL
              AND agenda.current_guru_name() IS NOT NULL
              AND sub.substitute_teacher_name = agenda.current_guru_name()
        );
$$;

-- Sisa signature lama (bila pernah dibuat) agar migrasi tetap idempoten.
DROP FUNCTION IF EXISTS agenda.can_manage_schedule(uuid);

-- Admin selalu boleh. Guru boleh bila ia pengampu jadwal agenda tersebut, atau
-- ia tercatat sebagai guru pengganti (actual_teacher_name) pada agenda itu.
CREATE OR REPLACE FUNCTION agenda.can_manage_agenda(p_agenda_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT agenda.is_admin()
        OR EXISTS (
            SELECT 1
            FROM agenda.agenda_header h
            LEFT JOIN agenda.schedule s ON s.id = h.schedule_id
            WHERE h.id = p_agenda_id
              AND (
                    (agenda.current_guru_id() IS NOT NULL AND s.teacher_id = agenda.current_guru_id())
                 OR (agenda.current_guru_name() IS NOT NULL AND h.actual_teacher_name = agenda.current_guru_name())
              )
        );
$$;

-- =============================================================================
-- 2. HAPUS POLICY LAMA (publik + sisa Stage 5)
-- =============================================================================

DROP POLICY IF EXISTS "Allow public read-write siswa" ON agenda.siswa;
DROP POLICY IF EXISTS "Allow public read-write guru" ON agenda.guru;
DROP POLICY IF EXISTS "Allow public read-write mapel" ON agenda.mapel;
DROP POLICY IF EXISTS "Allow public read-write academic_year" ON agenda.academic_year;
DROP POLICY IF EXISTS "Allow public read-write period_templates" ON agenda.period_templates;
DROP POLICY IF EXISTS "Allow public read-write schedule" ON agenda.schedule;
DROP POLICY IF EXISTS "Allow public read-write homeroom_assignment" ON agenda.homeroom_assignment;
DROP POLICY IF EXISTS "Allow public read-write agenda_header" ON agenda.agenda_header;
DROP POLICY IF EXISTS "Allow public read-write agenda_kbm" ON agenda.agenda_kbm;
DROP POLICY IF EXISTS "Allow public read-write agenda_absensi" ON agenda.agenda_absensi;
DROP POLICY IF EXISTS "Allow public read-write agenda_kejadian" ON agenda.agenda_kejadian;
DROP POLICY IF EXISTS "Allow public read-write kotak_saran" ON agenda.kotak_saran;
DROP POLICY IF EXISTS "Allow public read-write substitutions" ON agenda.substitutions;
DROP POLICY IF EXISTS "Allow public read-write agenda_evidence" ON agenda.agenda_evidence;

-- Nama policy Stage 5 (agar migrasi ini juga bersih pada DB yang pernah aman).
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

-- Nama policy Stage 7 (idempotensi).
DROP POLICY IF EXISTS guru_directory_read ON agenda.guru;
DROP POLICY IF EXISTS member_read_siswa ON agenda.siswa;
DROP POLICY IF EXISTS member_read_guru ON agenda.guru;
DROP POLICY IF EXISTS member_read_mapel ON agenda.mapel;
DROP POLICY IF EXISTS member_read_academic_year ON agenda.academic_year;
DROP POLICY IF EXISTS member_read_period_templates ON agenda.period_templates;
DROP POLICY IF EXISTS member_read_schedule ON agenda.schedule;
DROP POLICY IF EXISTS member_read_homeroom_assignment ON agenda.homeroom_assignment;
DROP POLICY IF EXISTS admin_write_siswa ON agenda.siswa;
DROP POLICY IF EXISTS admin_write_guru ON agenda.guru;
DROP POLICY IF EXISTS admin_write_mapel ON agenda.mapel;
DROP POLICY IF EXISTS admin_write_academic_year ON agenda.academic_year;
DROP POLICY IF EXISTS admin_write_period_templates ON agenda.period_templates;
DROP POLICY IF EXISTS admin_write_schedule ON agenda.schedule;
DROP POLICY IF EXISTS admin_write_homeroom_assignment ON agenda.homeroom_assignment;
DROP POLICY IF EXISTS member_read_agenda_header ON agenda.agenda_header;
DROP POLICY IF EXISTS member_insert_agenda_header ON agenda.agenda_header;
DROP POLICY IF EXISTS owner_update_agenda_header ON agenda.agenda_header;
DROP POLICY IF EXISTS owner_delete_agenda_header ON agenda.agenda_header;
DROP POLICY IF EXISTS member_read_agenda_kbm ON agenda.agenda_kbm;
DROP POLICY IF EXISTS owner_write_agenda_kbm ON agenda.agenda_kbm;
DROP POLICY IF EXISTS member_read_agenda_absensi ON agenda.agenda_absensi;
DROP POLICY IF EXISTS owner_write_agenda_absensi ON agenda.agenda_absensi;
DROP POLICY IF EXISTS member_read_agenda_kejadian ON agenda.agenda_kejadian;
DROP POLICY IF EXISTS owner_write_agenda_kejadian ON agenda.agenda_kejadian;
DROP POLICY IF EXISTS member_read_agenda_evidence ON agenda.agenda_evidence;
DROP POLICY IF EXISTS owner_write_agenda_evidence ON agenda.agenda_evidence;
DROP POLICY IF EXISTS member_read_substitutions ON agenda.substitutions;
DROP POLICY IF EXISTS admin_write_substitutions ON agenda.substitutions;
DROP POLICY IF EXISTS member_insert_kotak_saran ON agenda.kotak_saran;
DROP POLICY IF EXISTS admin_read_kotak_saran ON agenda.kotak_saran;
DROP POLICY IF EXISTS admin_update_kotak_saran ON agenda.kotak_saran;
DROP POLICY IF EXISTS admin_delete_kotak_saran ON agenda.kotak_saran;

-- =============================================================================
-- 3. POLICY BARU
-- =============================================================================

-- --- Direktori guru: satu-satunya data yang boleh dibaca sebelum login. ------
-- Hanya kolom id + nama_guru yang di-grant ke anon (lihat bagian 4), sehingga
-- halaman login tetap bisa menampilkan daftar nama tanpa membocorkan apa pun.
CREATE POLICY guru_directory_read
    ON agenda.guru FOR SELECT
    TO anon
    USING (true);

-- --- Master data: baca untuk semua anggota, tulis hanya admin. ---------------
CREATE POLICY member_read_siswa ON agenda.siswa
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_siswa ON agenda.siswa
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

CREATE POLICY member_read_guru ON agenda.guru
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_guru ON agenda.guru
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

CREATE POLICY member_read_mapel ON agenda.mapel
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_mapel ON agenda.mapel
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

CREATE POLICY member_read_academic_year ON agenda.academic_year
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_academic_year ON agenda.academic_year
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

CREATE POLICY member_read_period_templates ON agenda.period_templates
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_period_templates ON agenda.period_templates
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

CREATE POLICY member_read_schedule ON agenda.schedule
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_schedule ON agenda.schedule
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

CREATE POLICY member_read_homeroom_assignment ON agenda.homeroom_assignment
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_homeroom_assignment ON agenda.homeroom_assignment
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

-- --- Agenda: baca untuk anggota, tulis untuk pengampu slot / admin. ----------
CREATE POLICY member_read_agenda_header ON agenda.agenda_header
    FOR SELECT TO authenticated USING (agenda.is_member());

-- Guru boleh membuat agenda bila ia pengampu slot jadwal tersebut, atau bila
-- ia guru pengganti (badal) untuk slot pada tanggal itu. Agenda tanpa jadwal
-- (di luar jam pelajaran) boleh dibuat oleh anggota mana pun.
CREATE POLICY member_insert_agenda_header ON agenda.agenda_header
    FOR INSERT TO authenticated
    WITH CHECK (
        agenda.is_admin()
        OR (
            agenda.is_member()
            AND (schedule_id IS NULL OR agenda.can_manage_schedule(schedule_id, tanggal))
        )
    );

CREATE POLICY owner_update_agenda_header ON agenda.agenda_header
    FOR UPDATE TO authenticated
    USING (agenda.can_manage_agenda(id))
    WITH CHECK (agenda.can_manage_agenda(id));

CREATE POLICY owner_delete_agenda_header ON agenda.agenda_header
    FOR DELETE TO authenticated
    USING (agenda.can_manage_agenda(id));

-- Anak agenda mengikuti hak induknya.
CREATE POLICY member_read_agenda_kbm ON agenda.agenda_kbm
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY owner_write_agenda_kbm ON agenda.agenda_kbm
    FOR ALL TO authenticated
    USING (agenda.can_manage_agenda(agenda_id))
    WITH CHECK (agenda.can_manage_agenda(agenda_id));

CREATE POLICY member_read_agenda_absensi ON agenda.agenda_absensi
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY owner_write_agenda_absensi ON agenda.agenda_absensi
    FOR ALL TO authenticated
    USING (agenda.can_manage_agenda(agenda_id))
    WITH CHECK (agenda.can_manage_agenda(agenda_id));

CREATE POLICY member_read_agenda_kejadian ON agenda.agenda_kejadian
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY owner_write_agenda_kejadian ON agenda.agenda_kejadian
    FOR ALL TO authenticated
    USING (agenda.can_manage_agenda(agenda_id))
    WITH CHECK (agenda.can_manage_agenda(agenda_id));

CREATE POLICY member_read_agenda_evidence ON agenda.agenda_evidence
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY owner_write_agenda_evidence ON agenda.agenda_evidence
    FOR ALL TO authenticated
    USING (agenda.can_manage_agenda(agenda_id))
    WITH CHECK (agenda.can_manage_agenda(agenda_id));

-- --- Badal: dibaca anggota, dikelola admin. ---------------------------------
CREATE POLICY member_read_substitutions ON agenda.substitutions
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_substitutions ON agenda.substitutions
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

-- --- Kotak saran: guru boleh kirim, hanya admin yang boleh membaca. ----------
CREATE POLICY member_insert_kotak_saran ON agenda.kotak_saran
    FOR INSERT TO authenticated WITH CHECK (agenda.is_member());
CREATE POLICY admin_read_kotak_saran ON agenda.kotak_saran
    FOR SELECT TO authenticated USING (agenda.is_admin());
CREATE POLICY admin_update_kotak_saran ON agenda.kotak_saran
    FOR UPDATE TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());
CREATE POLICY admin_delete_kotak_saran ON agenda.kotak_saran
    FOR DELETE TO authenticated USING (agenda.is_admin());

-- =============================================================================
-- 4. GRANT — CABUT AKSES ANON, SISAKAN DIREKTORI GURU
-- =============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA agenda FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA agenda FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda REVOKE ALL ON SEQUENCES FROM anon;

GRANT USAGE ON SCHEMA agenda TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA agenda TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA agenda TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT ALL ON SEQUENCES TO authenticated;

-- Pengecualian tunggal: halaman login perlu daftar nama guru. Batasi ke kolom
-- id + nama_guru saja lewat grant tingkat kolom, agar kolom lain tetap tertutup.
GRANT SELECT (id, nama_guru) ON agenda.guru TO anon;

-- =============================================================================
-- 5. STORAGE — BUKTI FOTO HANYA UNTUK ANGGOTA YANG LOGIN
-- =============================================================================

DO $$
BEGIN
    IF to_regclass('storage.objects') IS NULL THEN
        RAISE NOTICE 'storage.objects tidak tersedia; policy Storage dilewati.';
        RETURN;
    END IF;

    EXECUTE 'DROP POLICY IF EXISTS "Allow anon & authenticated read agenda-evidence" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon & authenticated upload agenda-evidence" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon & authenticated update agenda-evidence" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon & authenticated delete agenda-evidence" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_read ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_insert ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_update ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_delete ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_member_read ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_member_insert ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_member_update ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS evidence_member_delete ON storage.objects';

    EXECUTE $policy$
        CREATE POLICY evidence_member_read
        ON storage.objects FOR SELECT TO authenticated
        USING (bucket_id = 'agenda-evidence' AND agenda.is_member())
    $policy$;

    EXECUTE $policy$
        CREATE POLICY evidence_member_insert
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'agenda-evidence' AND agenda.is_member())
    $policy$;

    EXECUTE $policy$
        CREATE POLICY evidence_member_update
        ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id = 'agenda-evidence' AND agenda.is_member())
        WITH CHECK (bucket_id = 'agenda-evidence' AND agenda.is_member())
    $policy$;

    EXECUTE $policy$
        CREATE POLICY evidence_member_delete
        ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'agenda-evidence' AND agenda.is_member())
    $policy$;
END $$;

-- =============================================================================
-- 6. VERIFIKASI
-- =============================================================================
-- 1. Grant anon pada tabel agenda harus tinggal kolom guru(id, nama_guru):
--      SELECT grantee, table_name, privilege_type, column_name
--      FROM information_schema.column_privileges
--      WHERE grantee = 'anon' AND table_schema = 'agenda';
--
-- 2. Tidak boleh ada policy dengan nama "Allow public read-write %":
--      SELECT policyname, tablename FROM pg_policies
--      WHERE schemaname = 'agenda' ORDER BY tablename, policyname;
--
-- 3. Uji tanpa login harus gagal:
--      SELECT count(*) FROM agenda.siswa;   -- harus error / 0 baris
--      SELECT count(*) FROM agenda.guru;    -- boleh, tapi hanya id + nama_guru
-- =============================================================================
