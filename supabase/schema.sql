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

-- Identitas siswa saja. Kelas TIDAK disimpan di sini — penempatan kelas per
-- tahun ajaran ada di `agenda.siswa_kelas`, karena siswa naik kelas sementara
-- kelasnya sendiri tetap.
CREATE TABLE IF NOT EXISTS agenda.siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_siswa TEXT NOT NULL,
    -- NIS opsional: kolomnya ada dan unik bila diisi, tetapi UI tidak
    -- mewajibkannya. Berguna agar pencocokan siswa antar tahun tidak bergantung
    -- pada nama (rawan salah kalau ada nama kembar).
    nis TEXT,
    -- Status keanggotaan sepanjang waktu, berbeda dari penempatan kelas.
    status TEXT NOT NULL DEFAULT 'AKTIF'
        CONSTRAINT chk_siswa_status
        CHECK (status IN ('AKTIF', 'LULUS', 'PINDAH_KELUAR', 'NONAKTIF')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- `CREATE TABLE IF NOT EXISTS` tidak menyentuh tabel yang sudah ada, jadi kolom
-- yang ditambahkan belakangan perlu di-ALTER terpisah. Bagian ini harus berada
-- sebelum bagian 2 (index), karena index di bawah merujuk kolom-kolom ini.
ALTER TABLE agenda.siswa ADD COLUMN IF NOT EXISTS nis TEXT;
ALTER TABLE agenda.siswa ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AKTIF';

-- Batasan status ditambahkan terpisah supaya database yang sudah berjalan juga
-- mendapatkannya (ALTER ... ADD COLUMN di atas tidak membawa CHECK).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_siswa_status'
          AND conrelid = 'agenda.siswa'::regclass
    ) THEN
        ALTER TABLE agenda.siswa
            ADD CONSTRAINT chk_siswa_status
            CHECK (status IN ('AKTIF', 'LULUS', 'PINDAH_KELUAR', 'NONAKTIF'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS agenda.guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.mapel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_mapel TEXT NOT NULL,
    -- Warna latar sel mapel pada export Excel. NULL / kosong = otomatis dari
    -- palet aplikasi (Stage 8). Bila diisi: 6 digit hex tanpa '#'.
    warna TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_mapel_warna CHECK (
        warna IS NULL OR warna = '' OR warna ~ '^[0-9A-Fa-f]{6}$'
    )
);

-- Kelas adalah entitas tersendiri, bukan sekadar teks. Identitasnya `id`;
-- `tingkat` + `rombel` adalah kunci bisnis, sedangkan `label` hanya tampilan
-- ('1A', '1B', '2A', …) sehingga boleh diubah tanpa memutus relasi apa pun.
-- Tidak di-scope per tahun ajaran: kelas bertahan, yang berganti tiap tahun
-- adalah penempatan siswa dan wali kelasnya.
CREATE TABLE IF NOT EXISTS agenda.kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tingkat INTEGER NOT NULL CHECK (tingkat BETWEEN 1 AND 6),
    rombel TEXT NOT NULL DEFAULT 'A',
    label TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_kelas_tingkat_rombel UNIQUE (tingkat, rombel)
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
    kelas_id UUID NOT NULL REFERENCES agenda.kelas(id) ON DELETE RESTRICT,
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
    kelas_id UUID NOT NULL REFERENCES agenda.kelas(id) ON DELETE RESTRICT,
    teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    teacher_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_homeroom_class_ay UNIQUE (academic_year_id, kelas_id)
);

-- Penempatan kelas siswa per tahun ajaran.
--
-- Inilah yang membuat kenaikan kelas bisa dilakukan sekali jalan: pindah tahun
-- ajaran = menambah baris baru, bukan menimpa nilai lama. Riwayat "tahun lalu
-- anak ini kelas berapa" jadi bisa dijawab.
--
-- Satu siswa satu kelas per tahun ajaran. Tanpa kolom status: "tinggal kelas"
-- bukan status, melainkan fakta yang bisa diturunkan (tingkatnya tidak naik).
-- `status` di sini adalah status siswa PADA tahun ajaran itu, bukan status
-- sekarang. Dipisah dari `siswa.status` karena status bersifat per tahun: anak
-- yang lulus tahun ini tetap AKTIF di tahun-tahun sebelumnya. Satu kolom global
-- membuat "Lulus" berlaku surut ke tahun-tahun lama.
--
-- LULUS sengaja TIDAK boleh ada di sini. Lulus berarti tahun itu sudah selesai
-- dan tidak ada kelas lagi, jadi "punya kelas berstatus lulus" tidak mungkin —
-- keadaan itu yang dulu membingungkan saat membuka tahun ajaran lama.
CREATE TABLE IF NOT EXISTS agenda.siswa_kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES agenda.siswa(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES agenda.academic_year(id) ON DELETE RESTRICT,
    kelas_id UUID NOT NULL REFERENCES agenda.kelas(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'AKTIF'
        CONSTRAINT chk_siswa_kelas_status
        CHECK (status IN ('AKTIF', 'PINDAH_KELUAR', 'NONAKTIF')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_siswa_kelas_per_ay UNIQUE (siswa_id, academic_year_id)
);

-- --- Agenda, absensi, kejadian, kotak saran ----------------------------------

CREATE TABLE IF NOT EXISTS agenda.agenda_header (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sekolah TEXT DEFAULT 'SDIT AS-SYIFA',
    kelas_id UUID NOT NULL REFERENCES agenda.kelas(id) ON DELETE RESTRICT,
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

-- --- Jejak kenaikan kelas ----------------------------------------------------
-- Satu baris per siswa per batch kenaikan kelas. Ini sekaligus riwayat ("tahun
-- ini anak ini naik dari mana ke mana") dan satu-satunya sumber untuk rollback.
--
-- `hasil = 'DILEWATI'` bukan kegagalan: itu siswa yang tidak ikut naik karena
-- statusnya bukan AKTIF. Mencatatnya membuat ringkasan bisa menjelaskan diri —
-- "3 siswa dilewati karena nonaktif" — bukan sekadar menghilang dari hitungan.
CREATE TABLE IF NOT EXISTS agenda.promotion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    siswa_id UUID NOT NULL REFERENCES agenda.siswa(id) ON DELETE CASCADE,
    academic_year_from UUID REFERENCES agenda.academic_year(id) ON DELETE SET NULL,
    academic_year_to UUID REFERENCES agenda.academic_year(id) ON DELETE SET NULL,
    kelas_from_id UUID REFERENCES agenda.kelas(id) ON DELETE SET NULL,
    -- Kelas tujuan. NULL untuk yang LULUS atau DILEWATI.
    kelas_to_id UUID REFERENCES agenda.kelas(id) ON DELETE SET NULL,
    hasil TEXT NOT NULL CHECK (hasil IN ('NAIK', 'LULUS', 'DILEWATI')),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Kolom baru untuk database yang sudah berjalan ---------------------------
-- Sama seperti `siswa.nis` di atas: `CREATE TABLE IF NOT EXISTS` tidak menyentuh
-- tabel yang sudah ada. Blok ini harus berada SEBELUM bagian 2, karena index di
-- bawah merujuk kolom-kolom ini.
--
-- Kolomnya sengaja dibuat nullable di sini. Isinya di-backfill dari teks lama di
-- bagian 11, dan baru setelah tidak ada sisa NULL kolomnya dijadikan NOT NULL.

ALTER TABLE agenda.schedule
    ADD COLUMN IF NOT EXISTS kelas_id UUID REFERENCES agenda.kelas(id) ON DELETE RESTRICT;
ALTER TABLE agenda.homeroom_assignment
    ADD COLUMN IF NOT EXISTS kelas_id UUID REFERENCES agenda.kelas(id) ON DELETE RESTRICT;
ALTER TABLE agenda.agenda_header
    ADD COLUMN IF NOT EXISTS kelas_id UUID REFERENCES agenda.kelas(id) ON DELETE RESTRICT;

-- `siswa_kelas.status` — lihat penjelasan di definisi tabelnya. Ditambahkan
-- terpisah, dan backfill-nya hanya dijalankan SEKALI (saat kolomnya benar-benar
-- baru) supaya menjalankan ulang file ini tidak menimpa perubahan yang sudah
-- dikerjakan admin.
DO $$
DECLARE
    v_baru BOOLEAN;
BEGIN
    SELECT NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'agenda' AND table_name = 'siswa_kelas'
          AND column_name = 'status'
    ) INTO v_baru;

    IF NOT v_baru THEN
        RAISE NOTICE 'Kolom siswa_kelas.status sudah ada; backfill dilewati.';
        RETURN;
    END IF;

    ALTER TABLE agenda.siswa_kelas
        ADD COLUMN status TEXT NOT NULL DEFAULT 'AKTIF';

    ALTER TABLE agenda.siswa_kelas
        ADD CONSTRAINT chk_siswa_kelas_status
        CHECK (status IN ('AKTIF', 'PINDAH_KELUAR', 'NONAKTIF'));

    -- Backfill: hanya penempatan TERAKHIR milik siswa yang status globalnya
    -- PINDAH_KELUAR / NONAKTIF yang ikut ditandai — di situlah kejadiannya
    -- berlangsung. Tahun-tahun sebelumnya tetap AKTIF; justru itu inti
    -- perbaikannya. Siswa berstatus LULUS sengaja dibiarkan AKTIF di tahun
    -- terakhirnya, karena tahun itu memang dijalaninya penuh.
    UPDATE agenda.siswa_kelas sk
    SET status = s.status
    FROM agenda.siswa s
    WHERE sk.siswa_id = s.id
      AND s.status IN ('PINDAH_KELUAR', 'NONAKTIF')
      AND sk.academic_year_id = (
          SELECT sk2.academic_year_id
          FROM agenda.siswa_kelas sk2
          JOIN agenda.academic_year ay2 ON ay2.id = sk2.academic_year_id
          WHERE sk2.siswa_id = s.id
          ORDER BY ay2.start_date DESC
          LIMIT 1
      );

    RAISE NOTICE 'Kolom siswa_kelas.status dibuat; % penempatan ditandai keluar.',
        (SELECT COUNT(*) FROM agenda.siswa_kelas WHERE status <> 'AKTIF');
END $$;

-- =============================================================================
-- 2. INDEX
-- =============================================================================

-- NIS unik bila diisi, tetapi boleh kosong untuk banyak baris sekaligus.
-- Karena itu index parsial, bukan UNIQUE biasa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_siswa_nis
    ON agenda.siswa(nis) WHERE nis IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_siswa_kelas_ay_kelas
    ON agenda.siswa_kelas(academic_year_id, kelas_id);
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_siswa
    ON agenda.siswa_kelas(siswa_id);
CREATE INDEX IF NOT EXISTS idx_mapel_nama
    ON agenda.mapel(nama_mapel);
CREATE INDEX IF NOT EXISTS idx_kelas_label
    ON agenda.kelas(label);

CREATE INDEX IF NOT EXISTS idx_promotion_log_batch
    ON agenda.promotion_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_promotion_log_siswa
    ON agenda.promotion_log(siswa_id);

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
-- Nama index sengaja BARU (bukan `idx_schedule_class`). Pada database lama nama
-- lama masih dipakai index di kolom teks yang belum dihapus, sehingga
-- `IF NOT EXISTS` akan melewatinya dan index-nya hilang bersama kolomnya tanpa
-- pernah dibuat ulang.
CREATE INDEX IF NOT EXISTS idx_schedule_kelas
    ON agenda.schedule(kelas_id);
CREATE INDEX IF NOT EXISTS idx_schedule_status
    ON agenda.schedule(status);
CREATE INDEX IF NOT EXISTS idx_schedule_composite_conflict
    ON agenda.schedule(academic_year_id, day, status);
CREATE INDEX IF NOT EXISTS idx_schedule_period_template
    ON agenda.schedule(period_template_id);

CREATE INDEX IF NOT EXISTS idx_homeroom_ay_kelas
    ON agenda.homeroom_assignment(academic_year_id, kelas_id);
CREATE INDEX IF NOT EXISTS idx_homeroom_teacher
    ON agenda.homeroom_assignment(teacher_id, teacher_name);

CREATE INDEX IF NOT EXISTS idx_agenda_header_kelas_id_tgl
    ON agenda.agenda_header(kelas_id, tanggal);
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
ALTER TABLE agenda.kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.academic_year ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.period_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.homeroom_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.siswa_kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.promotion_log ENABLE ROW LEVEL SECURITY;
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

-- Anggota sekolah yang sudah login (peran 'guru', 'admin', atau 'kurikulum').
CREATE OR REPLACE FUNCTION agenda.is_member()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT auth.uid() IS NOT NULL
       AND COALESCE(agenda.jwt_meta() ->> 'role', '') IN ('guru', 'admin', 'kurikulum');
$$;

-- Superadmin: mengelola SEMUANYA, termasuk pengaturan sekolah dan akun guru.
CREATE OR REPLACE FUNCTION agenda.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(agenda.jwt_meta() ->> 'role', '') = 'admin';
$$;

-- Kurikulum: pengelola MASTER DATA + PENUGASAN (siswa, guru, mapel, kelas,
-- slot waktu, jadwal, wali kelas, badal) — tetapi TIDAK menyentuh pengaturan
-- sekolah, kotak saran, maupun hapus agenda milik guru.
CREATE OR REPLACE FUNCTION agenda.is_kurikulum()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(agenda.jwt_meta() ->> 'role', '') = 'kurikulum';
$$;

-- Staf pengelola data (superadmin ATAU kurikulum).
--
-- Inilah fungsi yang dipakai policy tulis pada area MASTER DATA + PENUGASAN.
-- Nama sengaja bukan "is_admin" supaya jelas bahwa ini BUKAN hak penuh:
-- memakainya pada tabel pengaturan/akun akan memberi kurikulum wewenang yang
-- tidak seharusnya.
CREATE OR REPLACE FUNCTION agenda.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(agenda.jwt_meta() ->> 'role', '') IN ('admin', 'kurikulum');
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
DROP POLICY IF EXISTS member_read_kelas ON agenda.kelas;
DROP POLICY IF EXISTS admin_write_kelas ON agenda.kelas;
DROP POLICY IF EXISTS member_read_academic_year ON agenda.academic_year;
DROP POLICY IF EXISTS admin_write_academic_year ON agenda.academic_year;
DROP POLICY IF EXISTS member_read_period_templates ON agenda.period_templates;
DROP POLICY IF EXISTS admin_write_period_templates ON agenda.period_templates;
DROP POLICY IF EXISTS member_read_schedule ON agenda.schedule;
DROP POLICY IF EXISTS admin_write_schedule ON agenda.schedule;
DROP POLICY IF EXISTS member_read_homeroom_assignment ON agenda.homeroom_assignment;
DROP POLICY IF EXISTS admin_write_homeroom_assignment ON agenda.homeroom_assignment;
DROP POLICY IF EXISTS member_read_siswa_kelas ON agenda.siswa_kelas;
DROP POLICY IF EXISTS admin_write_siswa_kelas ON agenda.siswa_kelas;
DROP POLICY IF EXISTS member_read_promotion_log ON agenda.promotion_log;
DROP POLICY IF EXISTS admin_write_promotion_log ON agenda.promotion_log;
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

-- --- Master data: baca untuk anggota, tulis untuk staf (admin + kurikulum) ---
-- Peran kurikulum memegang area ini; lihat `agenda.is_staff()`.

CREATE POLICY member_read_siswa ON agenda.siswa
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_siswa ON agenda.siswa
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

CREATE POLICY member_read_guru ON agenda.guru
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_guru ON agenda.guru
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

CREATE POLICY member_read_mapel ON agenda.mapel
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_mapel ON agenda.mapel
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

CREATE POLICY member_read_kelas ON agenda.kelas
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_kelas ON agenda.kelas
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

CREATE POLICY member_read_academic_year ON agenda.academic_year
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_academic_year ON agenda.academic_year
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

CREATE POLICY member_read_period_templates ON agenda.period_templates
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_period_templates ON agenda.period_templates
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

CREATE POLICY member_read_schedule ON agenda.schedule
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_schedule ON agenda.schedule
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

CREATE POLICY member_read_homeroom_assignment ON agenda.homeroom_assignment
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_homeroom_assignment ON agenda.homeroom_assignment
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

CREATE POLICY member_read_siswa_kelas ON agenda.siswa_kelas
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_siswa_kelas ON agenda.siswa_kelas
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

-- Jejak kenaikan kelas boleh dibaca anggota (transparan), diubah hanya staf.
CREATE POLICY member_read_promotion_log ON agenda.promotion_log
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_promotion_log ON agenda.promotion_log
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

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

-- --- Badal: dibaca anggota, dikelola staf (admin + kurikulum) ---------------

CREATE POLICY member_read_substitutions ON agenda.substitutions
    FOR SELECT TO authenticated USING (agenda.is_member());
CREATE POLICY admin_write_substitutions ON agenda.substitutions
    FOR ALL TO authenticated
    USING (agenda.is_staff()) WITH CHECK (agenda.is_staff());

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
-- 9. SEED & SERAGAMKAN LABEL KELAS
-- =============================================================================
-- Enam kelas bawaan: satu rombel per tingkat, label '1A' … '6A'.
-- Rombel berikutnya (1B, 2B, …) ditambahkan admin dari halaman Data Kelas.
--
-- Bagian ini hanya menyentuh `agenda.kelas` — tabel master yang selalu ada, baik
-- di instalasi baru maupun database lama. Perapian nilai teks pada tabel lain
-- berada di bagian 10 dan 11, di dalam blok penjaganya masing-masing, karena
-- kolomnya dihapus di sana.
--
-- PERHATIAN — URUTAN DEPLOY
-- Bagian 9 bersama bagian 10 dan 11 mengubah nilai teks kelas dan bentuk kolomnya.
-- Jalankan file ini BERDEKATAN dengan pengunggahan frontend baru (yang membaca
-- kelas dari tabel `kelas`, bukan konstanta hardcoded). Kalau SQL ini jalan
-- sementara bundle lama masih terpasang, pilihan filter kelas akan kosong sampai
-- bundle baru naik. Lakukan di luar jam sekolah.

-- 9.1 Master kelas.
-- ON CONFLICT DO NOTHING supaya menjalankan ulang file ini tidak menghapus
-- rombel tambahan yang sudah dibuat admin.
INSERT INTO agenda.kelas (tingkat, rombel, label)
SELECT n, 'A', n || 'A'
FROM generate_series(1, 6) AS n
ON CONFLICT (tingkat, rombel) DO NOTHING;

-- 9.2 Rapikan label yang masih berbentuk lama ('KELAS 1' → '1A').
-- Menjaga database yang sudah pernah menjalankan versi sebelumnya.
UPDATE agenda.kelas
SET label = tingkat || rombel,
    updated_at = NOW()
WHERE label IS DISTINCT FROM tingkat || rombel;

-- 9.3 Backfill nilai teks lama ('KELAS 1' → '1A') pada kolom kelas yang masih
-- berupa teks.
--
-- TIDAK ADA DI SINI — semuanya pindah ke bagian 10 dan 11.
--
-- Alasannya penting: `schedule.class_id`, `homeroom_assignment.class_id`, dan
-- `agenda_header.kelas` DIHAPUS oleh bagian 11. Kalau UPDATE-nya ditulis di sini
-- tanpa penjaga, menjalankan ulang file ini akan gagal dengan
-- "column s.class_id does not exist" — persis jebakan yang sama seperti nama
-- index. Setiap kolom warisan kini dirapikan di dalam blok penjaganya sendiri,
-- tepat sebelum kolomnya dihapus:
--   - `siswa.kelas`            → bagian 10
--   - `schedule.class_id`      → bagian 11.1
--   - `homeroom_assignment`    → bagian 11.2
--   - `agenda_header.kelas`    → bagian 11.3
--
-- Aturannya: setiap kali ada `DROP COLUMN` di file ini, perapian datanya harus
-- berada di blok yang sama-sama dijaga oleh pengecekan keberadaan kolom itu.

-- =============================================================================
-- 10. MIGRASI PENEMPATAN SISWA
-- =============================================================================
-- Memindahkan kelas siswa dari kolom teks `siswa.kelas` ke tabel penempatan
-- `siswa_kelas`. Seluruh blok hanya berjalan kalau kolom `siswa.kelas` masih ada
-- — instalasi baru (yang sejak awal tanpa kolom itu) melewatinya, dan menjalankan
-- ulang file ini tidak melakukan apa-apa.
--
-- Tahun ajaran yang dipakai: yang berstatus ACTIVE; kalau belum ada, yang
-- start_date-nya paling akhir. Siswa lama tidak mungkin ditempatkan ke tahun
-- ajaran yang belum dibuat.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'agenda'
          AND table_name = 'siswa'
          AND column_name = 'kelas'
    ) THEN
        RAISE NOTICE 'Kolom siswa.kelas sudah tidak ada; migrasi penempatan dilewati.';
        RETURN;
    END IF;

    -- 10.1 Rapikan label lama ('KELAS 1' → '1A') sebelum dipakai sebagai kunci
    -- pencocokan ke tabel `kelas`.
    UPDATE agenda.siswa s
    SET kelas = k.label
    FROM agenda.kelas k
    WHERE s.kelas ~* '^KELAS\s*[1-6]$'
      AND k.tingkat = substring(s.kelas from '[1-6]')::integer
      AND k.rombel = 'A';

    -- 10.2 Satu baris penempatan untuk setiap siswa pada tahun ajaran terpilih.
    INSERT INTO agenda.siswa_kelas (siswa_id, academic_year_id, kelas_id)
    SELECT s.id, ay.id, k.id
    FROM agenda.siswa s
    JOIN agenda.kelas k ON k.label = s.kelas
    CROSS JOIN (
        SELECT id FROM agenda.academic_year
        ORDER BY (status = 'ACTIVE') DESC, start_date DESC
        LIMIT 1
    ) AS ay
    WHERE NOT EXISTS (
        SELECT 1 FROM agenda.siswa_kelas sk
        WHERE sk.siswa_id = s.id AND sk.academic_year_id = ay.id
    );

    -- 10.3 Kolomnya sudah tidak dipakai. Identitas kelas kini hanya hidup di
    -- `agenda.kelas`, dan penempatan siswa di `agenda.siswa_kelas`.
    ALTER TABLE agenda.siswa DROP COLUMN kelas;

    RAISE NOTICE 'Siswa tanpa penempatan setelah migrasi: %',
        (SELECT COUNT(*) FROM agenda.siswa s
         WHERE NOT EXISTS (
             SELECT 1 FROM agenda.siswa_kelas sk WHERE sk.siswa_id = s.id
         ));
END $$;

-- =============================================================================
-- 11. KOLOM KELAS MENJADI REFERENSI
-- =============================================================================
-- `schedule.class_id`, `homeroom_assignment.class_id`, dan `agenda_header.kelas`
-- berhenti menyimpan teks dan mulai menunjuk `agenda.kelas.id`. Identitas kelas
-- kini `id`; `label` hanya tampilan, sehingga mengganti nama kelas tidak lagi
-- menuntut backfill teks di banyak tempat.
--
-- Seperti bagian 10: hanya berjalan kalau kolom lamanya masih ada, jadi instalasi
-- baru melewatinya dan menjalankan ulang file ini tidak melakukan apa-apa.
--
-- Baris yang teksnya tidak cocok dengan label kelas mana pun TIDAK ditebak —
-- dilaporkan lewat NOTICE dan kolomnya dibiarkan NULL, supaya bisa diperiksa
-- manusia. Karena itu SET NOT NULL hanya dijalankan kalau tidak ada sisa NULL.

DO $$
DECLARE
    v_sisa INTEGER;
BEGIN
    -- 11.1 Jadwal ------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'agenda' AND table_name = 'schedule'
                 AND column_name = 'class_id') THEN

        -- 11.1a Rapikan label lama ('KELAS 1' → '1A') lebih dulu supaya cocok
        --       dengan master `agenda.kelas`. Di dalam penjaga ini karena
        --       kolomnya dihapus di akhir blok yang sama.
        UPDATE agenda.schedule s
        SET class_id = k.label,
            updated_at = NOW()
        FROM agenda.kelas k
        WHERE s.class_id ~* '^KELAS\s*[1-6]$'
          AND k.tingkat = substring(s.class_id from '[1-6]')::integer
          AND k.rombel = 'A';

        UPDATE agenda.schedule s
        SET kelas_id = k.id
        FROM agenda.kelas k
        WHERE s.kelas_id IS NULL AND k.label = s.class_id;

        SELECT COUNT(*) INTO v_sisa FROM agenda.schedule WHERE kelas_id IS NULL;
        IF v_sisa > 0 THEN
            RAISE NOTICE 'Jadwal tanpa kelas yang cocok: % baris (kelas_id dibiarkan NULL).', v_sisa;
        END IF;

        ALTER TABLE agenda.schedule DROP COLUMN class_id;

        IF v_sisa = 0 THEN
            ALTER TABLE agenda.schedule ALTER COLUMN kelas_id SET NOT NULL;
        END IF;
    END IF;

    -- 11.2 Wali kelas --------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'agenda' AND table_name = 'homeroom_assignment'
                 AND column_name = 'class_id') THEN

        -- 11.2a Rapikan label lama lebih dulu, sama seperti 11.1a.
        UPDATE agenda.homeroom_assignment h
        SET class_id = k.label,
            updated_at = NOW()
        FROM agenda.kelas k
        WHERE h.class_id ~* '^KELAS\s*[1-6]$'
          AND k.tingkat = substring(h.class_id from '[1-6]')::integer
          AND k.rombel = 'A';

        UPDATE agenda.homeroom_assignment h
        SET kelas_id = k.id
        FROM agenda.kelas k
        WHERE h.kelas_id IS NULL AND k.label = h.class_id;

        SELECT COUNT(*) INTO v_sisa FROM agenda.homeroom_assignment WHERE kelas_id IS NULL;
        IF v_sisa > 0 THEN
            RAISE NOTICE 'Penugasan wali kelas tanpa kelas yang cocok: % baris.', v_sisa;
        END IF;

        -- Constraint lama menunjuk `class_id`; dibuang lalu dipasang ulang di
        -- `kelas_id`, karena `CREATE TABLE IF NOT EXISTS` tidak menyentuh tabel
        -- yang sudah ada.
        ALTER TABLE agenda.homeroom_assignment DROP CONSTRAINT IF EXISTS uq_homeroom_class_ay;
        ALTER TABLE agenda.homeroom_assignment DROP COLUMN class_id;
        ALTER TABLE agenda.homeroom_assignment
            ADD CONSTRAINT uq_homeroom_class_ay UNIQUE (academic_year_id, kelas_id);

        IF v_sisa = 0 THEN
            ALTER TABLE agenda.homeroom_assignment ALTER COLUMN kelas_id SET NOT NULL;
        END IF;
    END IF;

    -- 11.3 Agenda ------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'agenda' AND table_name = 'agenda_header'
                 AND column_name = 'kelas') THEN

        -- 11.3a Rapikan label lama lebih dulu, sama seperti 11.1a.
        UPDATE agenda.agenda_header a
        SET kelas = k.label
        FROM agenda.kelas k
        WHERE a.kelas ~* '^KELAS\s*[1-6]$'
          AND k.tingkat = substring(a.kelas from '[1-6]')::integer
          AND k.rombel = 'A';

        UPDATE agenda.agenda_header a
        SET kelas_id = k.id
        FROM agenda.kelas k
        WHERE a.kelas_id IS NULL AND k.label = a.kelas;

        SELECT COUNT(*) INTO v_sisa FROM agenda.agenda_header WHERE kelas_id IS NULL;
        IF v_sisa > 0 THEN
            RAISE NOTICE 'Agenda tanpa kelas yang cocok: % baris.', v_sisa;
        END IF;

        ALTER TABLE agenda.agenda_header DROP COLUMN kelas;

        IF v_sisa = 0 THEN
            ALTER TABLE agenda.agenda_header ALTER COLUMN kelas_id SET NOT NULL;
        END IF;
    END IF;
END $$;

-- =============================================================================
-- 12. KENAIKAN KELAS
-- =============================================================================
-- Seluruh proses berjalan sebagai SATU fungsi, bukan rangkaian panggilan dari
-- browser. Kalau koneksi putus di tengah, tidak ada keadaan setengah jadi —
-- semuanya ikut dibatalkan.
--
-- Aturan (lihat docs/DESAIN_KENAIKAN_KELAS.md):
--   - hanya siswa yang berstatus AKTIF **pada tahun ajaran asal** yang dibuatkan
--     penempatan di tahun ajaran baru;
--   - siswa tingkat 6 yang masih AKTIF ditandai LULUS, tanpa penempatan baru;
--   - siswa NONAKTIF / PINDAH_KELUAR dilewati, tetapi tetap dicatat;
--   - wali kelas disalin dari kelas yang sama di tahun ajaran asal.
--
-- Status yang dibaca adalah `siswa_kelas.status` (per tahun), bukan
-- `siswa.status` (global) — lihat komentar di definisi tabel `siswa_kelas`.
--
-- Tahun ajaran tujuan wajib BERSIH — belum punya penempatan maupun wali kelas.
-- Syarat itu yang membuat pembatalan bisa menghapus tanpa menebak mana baris
-- buatan batch ini dan mana yang dibuat manual oleh admin.

CREATE OR REPLACE FUNCTION agenda.kenaikan_kelas(
    p_from UUID,
    p_to UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_batch UUID := gen_random_uuid();
    v_ada INTEGER;
    v_naik INTEGER;
    v_lulus INTEGER;
    v_lewat INTEGER;
    v_wali INTEGER;
BEGIN
    IF NOT agenda.is_admin() THEN
        RAISE EXCEPTION 'Hanya admin yang boleh menjalankan kenaikan kelas.';
    END IF;
    IF p_from IS NULL OR p_to IS NULL THEN
        RAISE EXCEPTION 'Tahun ajaran asal dan tujuan wajib dipilih.';
    END IF;
    IF p_from = p_to THEN
        RAISE EXCEPTION 'Tahun ajaran asal dan tujuan tidak boleh sama.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM agenda.academic_year WHERE id = p_to) THEN
        RAISE EXCEPTION 'Tahun ajaran tujuan tidak ditemukan.';
    END IF;

    SELECT
        (SELECT COUNT(*) FROM agenda.siswa_kelas WHERE academic_year_id = p_to)
      + (SELECT COUNT(*) FROM agenda.homeroom_assignment WHERE academic_year_id = p_to)
    INTO v_ada;

    IF v_ada > 0 THEN
        RAISE EXCEPTION
            'Tahun ajaran tujuan belum bersih (% baris penempatan/wali kelas). Batalkan kenaikan sebelumnya dulu.',
            v_ada;
    END IF;

    -- 1. Jejak ditulis lebih dulu.
    --
    --    Yang dibaca adalah `siswa_kelas.status` — status siswa PADA tahun ajaran
    --    asal — bukan `siswa.status` yang global. Pertanyaannya memang "apakah
    --    anak ini aktif di tahun itu", dan jawabannya hanya ada di penempatannya.
    --    Fungsi ini tidak pernah mengubah `siswa_kelas.status`, jadi urutannya
    --    tidak lagi rawan seperti ketika status masih satu kolom global.
    INSERT INTO agenda.promotion_log (
        batch_id, siswa_id, academic_year_from, academic_year_to,
        kelas_from_id, kelas_to_id, hasil, created_by
    )
    SELECT
        v_batch,
        sk.siswa_id,
        p_from,
        p_to,
        sk.kelas_id,
        kt.id,
        CASE
            WHEN sk.status <> 'AKTIF' THEN 'DILEWATI'
            WHEN k.tingkat >= 6       THEN 'LULUS'
            ELSE 'NAIK'
        END,
        agenda.current_guru_name()
    FROM agenda.siswa_kelas sk
    JOIN agenda.kelas k ON k.id = sk.kelas_id
    -- Hanya kelas tujuan yang masih AKTIF: jangan menaikkan siswa ke rombel yang
    -- sudah ditutup.
    LEFT JOIN agenda.kelas kt
           ON kt.tingkat = k.tingkat + 1 AND kt.rombel = k.rombel AND kt.is_active
    WHERE sk.academic_year_id = p_from;

    -- 1b. Siswa yang harus naik tetapi kelas tujuannya belum ada di master data.
    --     Diperiksa di sini supaya pesannya jelas, bukan meledak sebagai
    --     pelanggaran NOT NULL di tengah penulisan penempatan.
    SELECT COUNT(*) INTO v_ada
    FROM agenda.promotion_log
    WHERE batch_id = v_batch AND hasil = 'NAIK' AND kelas_to_id IS NULL;

    IF v_ada > 0 THEN
        RAISE EXCEPTION
            'Ada % siswa tanpa kelas tujuan. Periksa master Data Kelas — mungkin kelas tingkat berikutnya belum dibuat.',
            v_ada;
    END IF;

    -- 2. Penempatan baru — hanya yang tercatat NAIK.
    INSERT INTO agenda.siswa_kelas (siswa_id, academic_year_id, kelas_id)
    SELECT pl.siswa_id, p_to, pl.kelas_to_id
    FROM agenda.promotion_log pl
    WHERE pl.batch_id = v_batch AND pl.hasil = 'NAIK';

    -- 3. Tingkat 6 menjadi LULUS.
    UPDATE agenda.siswa s
    SET status = 'LULUS'
    FROM agenda.promotion_log pl
    WHERE pl.batch_id = v_batch
      AND pl.hasil = 'LULUS'
      AND s.id = pl.siswa_id;

    -- 4. Wali kelas disalin dari kelas yang sama di tahun ajaran asal.
    INSERT INTO agenda.homeroom_assignment (
        academic_year_id, kelas_id, teacher_id, teacher_name
    )
    SELECT p_to, h.kelas_id, h.teacher_id, h.teacher_name
    FROM agenda.homeroom_assignment h
    WHERE h.academic_year_id = p_from;
    GET DIAGNOSTICS v_wali = ROW_COUNT;

    SELECT
        COUNT(*) FILTER (WHERE hasil = 'NAIK'),
        COUNT(*) FILTER (WHERE hasil = 'LULUS'),
        COUNT(*) FILTER (WHERE hasil = 'DILEWATI')
    INTO v_naik, v_lulus, v_lewat
    FROM agenda.promotion_log
    WHERE batch_id = v_batch;

    RETURN jsonb_build_object(
        'batch_id', v_batch,
        'naik', v_naik,
        'lulus', v_lulus,
        'dilewati', v_lewat,
        'wali_kelas', v_wali
    );
END;
$$;

-- Membatalkan satu batch kenaikan kelas.
--
-- Boleh selama tahun ajaran tujuan TIDAK SEDANG AKTIF — jadi DRAFT maupun
-- ARCHIVED. Semula penjaganya hanya DRAFT, dan itu keliru: tahun ajaran menjadi
-- ARCHIVED secara otomatis begitu admin mengaktifkan tahun ajaran lain. Akibatnya
-- jendela pembatalan tertutup oleh tindakan yang tidak ada hubungannya dengan
-- kenaikan kelas, dan tahun ajaran yang salah dibuat menjadi tidak bisa
-- dibersihkan sama sekali — terkunci antara "tidak bisa dibatalkan" dan
-- "tidak bisa dihapus karena masih berisi".
--
-- Yang benar-benar berbahaya hanyalah tahun ajaran yang SEDANG AKTIF: hanya di
-- situ sekolah sedang memakai datanya. DRAFT belum dipakai, ARCHIVED sudah lewat.
CREATE OR REPLACE FUNCTION agenda.batalkan_kenaikan_kelas(p_batch UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_to UUID;
    v_status TEXT;
    v_penempatan INTEGER;
    v_wali INTEGER;
    v_status_kembali INTEGER;
BEGIN
    IF NOT agenda.is_admin() THEN
        RAISE EXCEPTION 'Hanya admin yang boleh membatalkan kenaikan kelas.';
    END IF;

    SELECT academic_year_to INTO v_to
    FROM agenda.promotion_log
    WHERE batch_id = p_batch
    LIMIT 1;

    IF v_to IS NULL THEN
        RAISE EXCEPTION 'Batch kenaikan kelas tidak ditemukan.';
    END IF;

    SELECT status INTO v_status FROM agenda.academic_year WHERE id = v_to;
    IF v_status = 'ACTIVE' THEN
        RAISE EXCEPTION
            'Tahun ajaran tujuan sedang AKTIF, jadi datanya mungkin sudah dipakai. Aktifkan tahun ajaran lain dulu — tahun ini akan otomatis diarsipkan — baru batalkan kenaikan kelasnya.';
    END IF;

    -- Hapus penempatan yang dibuat batch ini.
    DELETE FROM agenda.siswa_kelas sk
    USING agenda.promotion_log pl
    WHERE pl.batch_id = p_batch
      AND pl.hasil = 'NAIK'
      AND sk.siswa_id = pl.siswa_id
      AND sk.academic_year_id = pl.academic_year_to;
    GET DIAGNOSTICS v_penempatan = ROW_COUNT;

    -- Kembalikan status yang tadi dijadikan LULUS. Syarat `status = 'LULUS'`
    -- mencegah menimpa perubahan status yang dikerjakan admin sesudahnya.
    UPDATE agenda.siswa s
    SET status = 'AKTIF'
    FROM agenda.promotion_log pl
    WHERE pl.batch_id = p_batch
      AND pl.hasil = 'LULUS'
      AND s.id = pl.siswa_id
      AND s.status = 'LULUS';
    GET DIAGNOSTICS v_status_kembali = ROW_COUNT;

    -- Seluruh wali kelas di TA tujuan buatan batch ini — TA tujuan wajib bersih
    -- sebelum kenaikan dijalankan — jadi aman dihapus semua.
    DELETE FROM agenda.homeroom_assignment WHERE academic_year_id = v_to;
    GET DIAGNOSTICS v_wali = ROW_COUNT;

    DELETE FROM agenda.promotion_log WHERE batch_id = p_batch;

    RETURN jsonb_build_object(
        'penempatan_dihapus', v_penempatan,
        'status_dikembalikan', v_status_kembali,
        'wali_dihapus', v_wali
    );
END;
$$;

-- Hak eksekusi: hanya anggota yang login. anon tidak boleh sama sekali.
REVOKE EXECUTE ON FUNCTION agenda.kenaikan_kelas(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION agenda.batalkan_kenaikan_kelas(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION agenda.kenaikan_kelas(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION agenda.batalkan_kenaikan_kelas(UUID) TO authenticated;

-- =============================================================================
-- 13. PENGHAPUSAN TAHUN AJARAN
-- =============================================================================
-- Hanya untuk tahun ajaran yang BENAR-BENAR KOSONG — dipakai saat salah memasukkan
-- tanggal lalu ingin membuatnya ulang.
--
-- Alasannya bukan kehati-hatian berlebihan: `schedule`, `siswa_kelas`, dan
-- `period_templates` memakai ON DELETE RESTRICT, jadi menghapus tahun ajaran yang
-- sudah dipakai akan gagal dengan pesan kunci asing yang tidak bisa dibaca guru.
-- Fungsi ini menggantinya dengan pesan yang menyebutkan APA yang menghalangi.
--
-- Tahun ajaran yang sudah terisi TIDAK dihapus melainkan diarsipkan. Itulah yang
-- menjaga riwayat agenda, absensi, dan laporan tetap utuh.

CREATE OR REPLACE FUNCTION agenda.hapus_tahun_ajaran(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_nama TEXT;
    v_status TEXT;
    v_jadwal INTEGER;
    v_siswa INTEGER;
    v_wali INTEGER;
    v_slot INTEGER;
    v_kenaikan INTEGER;
BEGIN
    IF NOT agenda.is_admin() THEN
        RAISE EXCEPTION 'Hanya admin yang boleh menghapus tahun ajaran.';
    END IF;

    SELECT name, status INTO v_nama, v_status
    FROM agenda.academic_year
    WHERE id = p_id;

    IF v_nama IS NULL THEN
        RAISE EXCEPTION 'Tahun ajaran tidak ditemukan.';
    END IF;

    IF v_status = 'ACTIVE' THEN
        RAISE EXCEPTION
            'Tahun ajaran % sedang AKTIF. Aktifkan tahun ajaran lain dulu sebelum menghapusnya.',
            v_nama;
    END IF;

    SELECT
        (SELECT COUNT(*) FROM agenda.schedule            WHERE academic_year_id = p_id),
        (SELECT COUNT(*) FROM agenda.siswa_kelas         WHERE academic_year_id = p_id),
        (SELECT COUNT(*) FROM agenda.homeroom_assignment WHERE academic_year_id = p_id),
        (SELECT COUNT(*) FROM agenda.period_templates    WHERE academic_year_id = p_id),
        (SELECT COUNT(*) FROM agenda.promotion_log
          WHERE academic_year_from = p_id OR academic_year_to = p_id)
    INTO v_jadwal, v_siswa, v_wali, v_slot, v_kenaikan;

    IF v_jadwal + v_siswa + v_wali + v_slot + v_kenaikan > 0 THEN
        RAISE EXCEPTION
            'Tahun ajaran % belum kosong: % jadwal, % penempatan siswa, % wali kelas, % template jam, % catatan kenaikan. Batalkan kenaikan kelas dan kosongkan isinya dulu, atau arsipkan saja.',
            v_nama, v_jadwal, v_siswa, v_wali, v_slot, v_kenaikan;
    END IF;

    DELETE FROM agenda.academic_year WHERE id = p_id;

    RETURN jsonb_build_object('nama', v_nama);
END;
$$;

REVOKE EXECUTE ON FUNCTION agenda.hapus_tahun_ajaran(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION agenda.hapus_tahun_ajaran(UUID) TO authenticated;

-- =============================================================================
-- 14. VERIFIKASI
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
--
-- 4. Master kelas terisi 6 baris, label sudah berbentuk '1A' … '6A':
--      SELECT tingkat, rombel, label, is_active FROM agenda.kelas ORDER BY tingkat, rombel;
--
-- 5. Tidak ada lagi kolom kelas berbasis teks di mana pun:
--      SELECT table_name, column_name FROM information_schema.columns
--      WHERE table_schema = 'agenda' AND column_name IN ('kelas', 'class_id')
--      ORDER BY table_name;
--      -- harus KOSONG
--
-- 6. Setiap baris punya kelas_id:
--      SELECT COUNT(*) FROM agenda.schedule            WHERE kelas_id IS NULL;
--      SELECT COUNT(*) FROM agenda.homeroom_assignment WHERE kelas_id IS NULL;
--      SELECT COUNT(*) FROM agenda.agenda_header       WHERE kelas_id IS NULL;
--      -- ketiganya harus 0
--
-- 7. Setiap siswa punya penempatan:
--      SELECT COUNT(*) FROM agenda.siswa s
--      WHERE NOT EXISTS (SELECT 1 FROM agenda.siswa_kelas sk WHERE sk.siswa_id = s.id);
--      -- harus 0
--
-- 8. Sebaran siswa per kelas pada tahun ajaran aktif:
--      SELECT k.label, COUNT(sk.id)
--      FROM agenda.kelas k
--      LEFT JOIN agenda.siswa_kelas sk ON sk.kelas_id = k.id
--      GROUP BY k.label ORDER BY k.label;
--
-- 9. Kedua fungsi kenaikan kelas ada, dan tidak bisa dipanggil anon:
--      SELECT proname, prosecdef FROM pg_proc
--      WHERE pronamespace = 'agenda'::regnamespace
--        AND proname IN ('kenaikan_kelas', 'batalkan_kenaikan_kelas');
--      SELECT has_function_privilege('anon', 'agenda.kenaikan_kelas(uuid,uuid)', 'EXECUTE');
--      -- harus false
--
-- 10. Riwayat kenaikan kelas terakhir:
--      SELECT hasil, COUNT(*) FROM agenda.promotion_log
--      GROUP BY hasil ORDER BY hasil;
--
-- 11. Status per tahun ajaran ada di penempatan, dan LULUS tidak boleh masuk ke sana:
--      SELECT status, COUNT(*) FROM agenda.siswa_kelas GROUP BY status ORDER BY status;
--      SELECT conname FROM pg_constraint WHERE conname = 'chk_siswa_kelas_status';
--
-- 12. Fungsi penghapusan tahun ajaran ada, dan tidak bisa dipanggil anon:
--      SELECT has_function_privilege('anon', 'agenda.hapus_tahun_ajaran(uuid)', 'EXECUTE');
--      -- harus false
--
-- 13. Bukti bahwa "Lulus" tidak berlaku surut — siswa yang lulus tetap AKTIF di
--     tahun terakhirnya. Baris di bawah harus KOSONG:
--      SELECT s.nama_siswa, ay.name, sk.status
--      FROM agenda.siswa_kelas sk
--      JOIN agenda.siswa s ON s.id = sk.siswa_id
--      JOIN agenda.academic_year ay ON ay.id = sk.academic_year_id
--      WHERE s.status = 'LULUS' AND sk.status <> 'AKTIF' AND ay.status = 'ACTIVE';
-- =============================================================================
