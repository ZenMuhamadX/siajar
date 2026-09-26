-- =============================================================================
-- SIAJAR — BOOTSTRAP LENGKAP (SATU FILE, IDEMPOTEN)
-- =============================================================================
-- Jalankan SATU file ini untuk instalasi baru. Setelah itu:
--   1. deploy Edge Function `manage-users`
--   2. buka aplikasi, layar setup akan meminta pembuatan admin pertama
--   3. admin menambahkan guru + kode mereka dari panel Data Guru
--
-- Tidak ada lagi urutan "jalankan file ini, lalu file itu". File migrasi lama
-- dipindahkan ke supabase/legacy/ dan hanya diperlukan untuk database yang
-- sudah berjalan sebelumnya.
--
-- File ini aman dijalankan berulang kali (idempoten):
--   CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
--   CREATE OR REPLACE FUNCTION / DROP POLICY IF EXISTS lalu CREATE POLICY /
--   ON CONFLICT DO NOTHING.
--
-- -----------------------------------------------------------------------------
-- MODEL KEAMANAN
-- -----------------------------------------------------------------------------
-- Autentikasi memakai Supabase Auth. Peran ('guru' | 'admin') dan identitas
-- guru disimpan di app_metadata JWT. app_metadata HANYA bisa ditulis lewat
-- service_role (Edge Function manage-users) — pengguna tidak bisa memalsukannya.
-- JANGAN memakai user_metadata untuk otorisasi: itu bisa ditulis sendiri.
--
-- Otorisasi ditegakkan di sini (RLS), bukan di browser. Tanpa sesi login yang
-- sah, role anon hanya boleh membaca kolom id + nama_guru (daftar nama di
-- halaman login). Anon tidak punya grant ke tabel lain sama sekali.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS agenda;

SET search_path TO agenda, public;

-- =============================================================================
-- 1. TABEL
-- =============================================================================

-- --- Master data -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agenda.siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_siswa TEXT NOT NULL,
    kelas TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.mapel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_mapel TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- Tahun ajaran, jam pelajaran, jadwal -------------------------------------

CREATE TABLE IF NOT EXISTS agenda.academic_year (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.period_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL
        REFERENCES agenda.academic_year(id) ON DELETE RESTRICT,
    period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 20),
    label TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_period_template_ay_number
        UNIQUE (academic_year_id, period_number),
    CONSTRAINT chk_period_template_time CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS agenda.schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL
        REFERENCES agenda.academic_year(id) ON DELETE RESTRICT,
    day TEXT NOT NULL
        CHECK (day IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY')),
    period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 20),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    class_id TEXT NOT NULL,
    subject_id UUID REFERENCES agenda.mapel(id) ON DELETE SET NULL,
    subject_name TEXT NOT NULL,
    teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    teacher_name TEXT NOT NULL,
    period_template_id UUID REFERENCES agenda.period_templates(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL DEFAULT 'KBM'
        CHECK (activity_type IN ('KBM', 'EXTRACURRICULAR', 'LIFESKILL', 'SPECIAL')),
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_schedule_time_range CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS agenda.homeroom_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL
        REFERENCES agenda.academic_year(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL,
    teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    teacher_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_homeroom_class_ay UNIQUE (academic_year_id, class_id)
);

-- --- Agenda, absensi, kejadian, kotak saran ----------------------------------

CREATE TABLE IF NOT EXISTS agenda.agenda_header (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sekolah TEXT DEFAULT 'SDIT AS-SYIFA',
    kelas TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    schedule_id UUID REFERENCES agenda.schedule(id) ON DELETE SET NULL,
    actual_teacher_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS agenda.agenda_absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    siswa_id UUID REFERENCES agenda.siswa(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('S', 'I', 'A')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.agenda_kejadian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    uraian_kejadian TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.kotak_saran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    kategori TEXT NOT NULL
        CHECK (kategori IN ('Fasilitas', 'Kurikulum', 'Aplikasi', 'Lainnya')),
    isi_saran TEXT NOT NULL,
    is_anonim BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- Badal dan bukti foto ----------------------------------------------------

CREATE TABLE IF NOT EXISTS agenda.substitutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES agenda.schedule(id) ON DELETE RESTRICT,
    substitution_date DATE NOT NULL,
    original_teacher_name TEXT NOT NULL,
    original_teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    substitute_teacher_name TEXT NOT NULL,
    substitute_teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    reason TEXT NOT NULL DEFAULT 'Guru berhalangan',
    reason_detail TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS agenda.agenda_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID NOT NULL REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'image/webp',
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    actual_teacher_name TEXT,
    actual_teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_agenda_evidence UNIQUE (agenda_id)
);

-- --- Pengaturan aplikasi (singleton) -----------------------------------------

CREATE TABLE IF NOT EXISTS agenda.app_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    CONSTRAINT chk_app_settings_singleton CHECK (id = 1),

    school_name TEXT NOT NULL DEFAULT 'SDIT AS-SYIFA',

    excel_font_family       TEXT     NOT NULL DEFAULT 'Bookman Old Style',
    excel_base_font_size    SMALLINT NOT NULL DEFAULT 11,
    excel_title_font_size   SMALLINT NOT NULL DEFAULT 20,
    excel_orientation       TEXT     NOT NULL DEFAULT 'landscape',
    excel_header_color      TEXT     NOT NULL DEFAULT '1F3864',
    excel_band_color        TEXT     NOT NULL DEFAULT 'D9E2F3',
    excel_title_color       TEXT     NOT NULL DEFAULT '1F3864',
    excel_border_color      TEXT     NOT NULL DEFAULT '9CA3AF',
    excel_show_borders      BOOLEAN  NOT NULL DEFAULT true,
    excel_show_teacher_name BOOLEAN  NOT NULL DEFAULT true,
    excel_time_separator    TEXT     NOT NULL DEFAULT 'en-dash',
    excel_include_draft     BOOLEAN  NOT NULL DEFAULT true,
    excel_repeat_header     BOOLEAN  NOT NULL DEFAULT true,
    excel_fit_to_width      BOOLEAN  NOT NULL DEFAULT true,

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by TEXT,

    CONSTRAINT chk_app_settings_orientation CHECK (
        excel_orientation IN ('landscape', 'portrait')
    ),
    CONSTRAINT chk_app_settings_separator CHECK (
        excel_time_separator IN ('en-dash', 'hyphen')
    ),
    CONSTRAINT chk_app_settings_font_size CHECK (
        excel_base_font_size BETWEEN 6 AND 24
        AND excel_title_font_size BETWEEN 10 AND 40
    ),
    CONSTRAINT chk_app_settings_colors CHECK (
        excel_header_color ~ '^[0-9A-Fa-f]{6}$'
        AND excel_band_color   ~ '^[0-9A-Fa-f]{6}$'
        AND excel_title_color  ~ '^[0-9A-Fa-f]{6}$'
        AND excel_border_color ~ '^[0-9A-Fa-f]{6}$'
    )
);

INSERT INTO agenda.app_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. INDEX
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_siswa_kelas
    ON agenda.siswa(kelas);
CREATE INDEX IF NOT EXISTS idx_mapel_nama
    ON agenda.mapel(nama_mapel);

CREATE INDEX IF NOT EXISTS idx_academic_year_status
    ON agenda.academic_year(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_academic_year
    ON agenda.academic_year(status)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_period_templates_ay
    ON agenda.period_templates(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_period_templates_active
    ON agenda.period_templates(academic_year_id, is_active);

CREATE INDEX IF NOT EXISTS idx_schedule_academic_year
    ON agenda.schedule(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_schedule_day
    ON agenda.schedule(day);
CREATE INDEX IF NOT EXISTS idx_schedule_teacher
    ON agenda.schedule(teacher_name);
CREATE INDEX IF NOT EXISTS idx_schedule_teacher_id
    ON agenda.schedule(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedule_class
    ON agenda.schedule(class_id);
CREATE INDEX IF NOT EXISTS idx_schedule_status
    ON agenda.schedule(status);
CREATE INDEX IF NOT EXISTS idx_schedule_composite_conflict
    ON agenda.schedule(academic_year_id, day, status);
CREATE INDEX IF NOT EXISTS idx_schedule_period_template
    ON agenda.schedule(period_template_id);

CREATE INDEX IF NOT EXISTS idx_homeroom_ay_class
    ON agenda.homeroom_assignment(academic_year_id, class_id);
CREATE INDEX IF NOT EXISTS idx_homeroom_teacher
    ON agenda.homeroom_assignment(teacher_id, teacher_name);

CREATE INDEX IF NOT EXISTS idx_agenda_header_kelas_tgl
    ON agenda.agenda_header(kelas, tanggal);
CREATE INDEX IF NOT EXISTS idx_agenda_header_schedule_id
    ON agenda.agenda_header(schedule_id);
CREATE INDEX IF NOT EXISTS idx_agenda_header_schedule_date
    ON agenda.agenda_header(schedule_id, tanggal);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_schedule_date
    ON agenda.agenda_header(schedule_id, tanggal)
    WHERE schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_kbm_agenda
    ON agenda.agenda_kbm(agenda_id);
CREATE INDEX IF NOT EXISTS idx_agenda_kbm_guru
    ON agenda.agenda_kbm(nama_guru);

CREATE INDEX IF NOT EXISTS idx_agenda_absensi_agenda
    ON agenda.agenda_absensi(agenda_id);
CREATE INDEX IF NOT EXISTS idx_agenda_absensi_siswa
    ON agenda.agenda_absensi(siswa_id);

CREATE INDEX IF NOT EXISTS idx_substitution_unique_active
    ON agenda.substitutions(schedule_id, substitution_date)
    WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_substitutions_date
    ON agenda.substitutions(substitution_date);
CREATE INDEX IF NOT EXISTS idx_substitutions_schedule
    ON agenda.substitutions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_substitute
    ON agenda.substitutions(substitute_teacher_name);
CREATE INDEX IF NOT EXISTS idx_substitutions_original
    ON agenda.substitutions(original_teacher_name);

CREATE INDEX IF NOT EXISTS idx_agenda_evidence_agenda
    ON agenda.agenda_evidence(agenda_id);
CREATE INDEX IF NOT EXISTS idx_agenda_evidence_actual_teacher
    ON agenda.agenda_evidence(actual_teacher_name);
CREATE INDEX IF NOT EXISTS idx_agenda_evidence_captured_at
    ON agenda.agenda_evidence(captured_at);
CREATE INDEX IF NOT EXISTS idx_agenda_evidence_uploaded_at
    ON agenda.agenda_evidence(uploaded_at);

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================
-- Diaktifkan untuk SEMUA tabel. Setiap tabel baru WAJIB ditambahkan di sini,
-- karena grant default memberi `authenticated` hak penuh — tanpa RLS, tabel
-- baru langsung terbuka untuk semua user yang login.

ALTER TABLE agenda.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.academic_year ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.period_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.homeroom_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_kbm ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_kejadian ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.kotak_saran ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.app_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. FUNGSI OTORISASI
-- =============================================================================
-- Semua membaca klaim JWT. STABLE supaya efisien dipakai di policy.

CREATE OR REPLACE FUNCTION agenda.jwt_meta()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(auth.jwt() -> 'app_metadata', '{}'::jsonb);
$$;

-- Anggota sekolah yang sudah login (peran 'guru' atau 'admin').
CREATE OR REPLACE FUNCTION agenda.is_member()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT auth.uid() IS NOT NULL
       AND COALESCE(agenda.jwt_meta() ->> 'role', '') IN ('guru', 'admin');
$$;

CREATE OR REPLACE FUNCTION agenda.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(agenda.jwt_meta() ->> 'role', '') = 'admin';
$$;

CREATE OR REPLACE FUNCTION agenda.current_guru_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(agenda.jwt_meta() ->> 'guru_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION agenda.current_guru_name()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT agenda.jwt_meta() ->> 'guru_name';
$$;

-- Admin selalu boleh. Guru boleh bila ia pengampu slot jadwal tersebut, atau
-- bila ia tercatat sebagai guru pengganti (badal) pada slot & tanggal itu.
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

-- Sisa signature lama (bila pernah dibuat) agar file ini tetap idempoten.
DROP FUNCTION IF EXISTS agenda.can_manage_schedule(uuid);

-- Admin selalu boleh. Guru boleh bila ia pengampu jadwal agenda tersebut, atau
-- ia tercatat sebagai guru pengganti pada agenda itu.
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
-- 5. POLICY
-- =============================================================================

-- --- Bersihkan policy lama (nama publik + sisa stage) ------------------------

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
DROP POLICY IF EXISTS "Allow public read-write app_settings" ON agenda.app_settings;

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
DROP POLICY IF EXISTS app_settings_read ON agenda.app_settings;
DROP POLICY IF EXISTS app_settings_write ON agenda.app_settings;

-- Policy dari file ini (idempotensi).
DROP POLICY IF EXISTS guru_directory_read ON agenda.guru;
DROP POLICY IF EXISTS member_read_siswa ON agenda.siswa;
DROP POLICY IF EXISTS admin_write_siswa ON agenda.siswa;
DROP POLICY IF EXISTS member_read_guru ON agenda.guru;
DROP POLICY IF EXISTS admin_write_guru ON agenda.guru;
DROP POLICY IF EXISTS member_read_mapel ON agenda.mapel;
DROP POLICY IF EXISTS admin_write_mapel ON agenda.mapel;
DROP POLICY IF EXISTS member_read_academic_year ON agenda.academic_year;
DROP POLICY IF EXISTS admin_write_academic_year ON agenda.academic_year;
DROP POLICY IF EXISTS member_read_period_templates ON agenda.period_templates;
DROP POLICY IF EXISTS admin_write_period_templates ON agenda.period_templates;
DROP POLICY IF EXISTS member_read_schedule ON agenda.schedule;
DROP POLICY IF EXISTS admin_write_schedule ON agenda.schedule;
DROP POLICY IF EXISTS member_read_homeroom_assignment ON agenda.homeroom_assignment;
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

-- --- Direktori guru: satu-satunya data yang boleh dibaca sebelum login -------
-- Hanya kolom id + nama_guru yang di-grant ke anon (lihat bagian 6), sehingga
-- halaman login tetap bisa menampilkan daftar nama tanpa membocorkan apa pun.
CREATE POLICY guru_directory_read
    ON agenda.guru FOR SELECT TO anon
    USING (true);

-- --- Master data: baca untuk anggota, tulis hanya admin ----------------------

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

-- --- Agenda: baca untuk anggota, tulis untuk pengampu slot / admin -----------

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

-- --- Badal: dibaca anggota, dikelola admin -----------------------------------

CREATE POLICY member_read_substitutions ON agenda.substitutions
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_substitutions ON agenda.substitutions
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

-- --- Kotak saran: guru boleh kirim, hanya admin yang boleh membaca -----------

CREATE POLICY member_insert_kotak_saran ON agenda.kotak_saran
    FOR INSERT TO authenticated WITH CHECK (agenda.is_member());
CREATE POLICY admin_read_kotak_saran ON agenda.kotak_saran
    FOR SELECT TO authenticated USING (agenda.is_admin());
CREATE POLICY admin_update_kotak_saran ON agenda.kotak_saran
    FOR UPDATE TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());
CREATE POLICY admin_delete_kotak_saran ON agenda.kotak_saran
    FOR DELETE TO authenticated USING (agenda.is_admin());

-- --- Pengaturan aplikasi: dibaca anggota, diubah hanya admin -----------------
-- Mengubah nama sekolah ikut mengubah kop laporan resmi, jadi ini admin-only.

CREATE POLICY app_settings_read ON agenda.app_settings
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY app_settings_write ON agenda.app_settings
    FOR ALL TO authenticated
    USING (agenda.is_admin()) WITH CHECK (agenda.is_admin());

-- =============================================================================
-- 6. GRANT
-- =============================================================================
-- anon tidak mendapat apa pun kecuali satu pengecualian sempit di bawah.

REVOKE ALL ON ALL TABLES IN SCHEMA agenda FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA agenda FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda REVOKE ALL ON SEQUENCES FROM anon;

GRANT USAGE ON SCHEMA agenda TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA agenda TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA agenda TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT ALL ON SEQUENCES TO authenticated;

-- Pengecualian tunggal: halaman login perlu daftar nama guru. Dibatasi ke kolom
-- id + nama_guru saja lewat grant tingkat kolom.
GRANT SELECT (id, nama_guru) ON agenda.guru TO anon;

-- =============================================================================
-- 7. STORAGE — BUKTI FOTO
-- =============================================================================

DO $$
BEGIN
    IF to_regclass('storage.buckets') IS NULL THEN
        RAISE NOTICE 'storage.buckets tidak tersedia; setup Storage dilewati.';
    ELSE
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'agenda-evidence',
            'agenda-evidence',
            false,
            10485760,
            ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']
        )
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 10485760,
            allowed_mime_types = ARRAY[
                'image/webp', 'image/jpeg', 'image/png', 'image/jpg'
            ];
    END IF;
END $$;

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
-- 8. JEJAK PELAKU
-- =============================================================================
-- created_by diambil dari token yang sedang login, bukan dari yang dikirim
-- browser. Dengan begitu catatan badal tidak bisa diatasnamakan orang lain.

CREATE OR REPLACE FUNCTION agenda.force_created_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF agenda.current_guru_name() IS NOT NULL THEN
        NEW.created_by := agenda.current_guru_name();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_substitutions_created_by ON agenda.substitutions;
CREATE TRIGGER trg_substitutions_created_by
    BEFORE INSERT OR UPDATE ON agenda.substitutions
    FOR EACH ROW EXECUTE FUNCTION agenda.force_created_by();

-- =============================================================================
-- 9. VERIFIKASI
-- =============================================================================
-- 1. Semua tabel harus punya RLS aktif:
--      SELECT relname, relrowsecurity FROM pg_class
--      WHERE relnamespace = 'agenda'::regnamespace AND relkind = 'r'
--      ORDER BY relname;
--
-- 2. anon hanya boleh punya kolom guru(id, nama_guru):
--      SELECT table_name, privilege_type, column_name
--      FROM information_schema.column_privileges
--      WHERE grantee = 'anon' AND table_schema = 'agenda';
--
-- 3. Tidak boleh ada policy bernama "Allow public read-write %":
--      SELECT policyname, tablename FROM pg_policies
--      WHERE schemaname = 'agenda' ORDER BY tablename, policyname;
-- =============================================================================
