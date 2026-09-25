-- =============================================================================
-- STAGE 6: HAPUS TABEL LEGACY agenda.guru_kelas
-- =============================================================================
-- Jalankan setelah rollback_5_auth.sql dan setelah backup database.
-- Tabel ini tidak lagi dipakai frontend. Data yang masih ada dipindahkan ke
-- homeroom_assignment untuk tahun ajaran aktif sebelum tabel dihapus.
-- Jika ada konflik penugasan atau tidak ada tahun ajaran aktif, script berhenti
-- dan TIDAK menghapus data.
-- =============================================================================

SET search_path TO agenda, public;

DO $$
DECLARE
    legacy_count INTEGER;
    active_ay_id UUID;
    conflicting_classes INTEGER;
BEGIN
    IF to_regclass('agenda.guru_kelas') IS NULL THEN
        RAISE NOTICE 'agenda.guru_kelas sudah tidak ada; tidak ada yang perlu dibersihkan.';
        RETURN;
    END IF;

    SELECT count(*) INTO legacy_count FROM agenda.guru_kelas;

    IF legacy_count = 0 THEN
        RAISE NOTICE 'agenda.guru_kelas kosong; aman dihapus.';
    ELSE
        IF to_regclass('agenda.homeroom_assignment') IS NULL THEN
            RAISE EXCEPTION
                'Migrasi dihentikan: agenda.homeroom_assignment belum ada, sehingga data guru_kelas tidak dapat dipindahkan dengan aman.';
        END IF;

        SELECT id INTO active_ay_id
        FROM agenda.academic_year
        WHERE status = 'ACTIVE'
        LIMIT 1;

        IF active_ay_id IS NULL THEN
            RAISE EXCEPTION
                'Migrasi dihentikan: ada % baris di guru_kelas, tetapi tidak ada tahun ajaran ACTIVE. Aktifkan tahun ajaran terlebih dahulu.',
                legacy_count;
        END IF;

        SELECT count(*) INTO conflicting_classes
        FROM (
            SELECT gk.kelas
            FROM agenda.guru_kelas gk
            GROUP BY gk.kelas
            HAVING count(DISTINCT lower(trim(gk.nama_guru))) > 1
        ) conflicts;

        IF conflicting_classes > 0 THEN
            RAISE EXCEPTION
                'Migrasi dihentikan: % kelas memiliki lebih dari satu guru pada guru_kelas. Tentukan wali kelas yang benar di homeroom_assignment sebelum menghapus tabel.',
                conflicting_classes;
        END IF;

        -- Backfill hanya kelas yang belum memiliki penugasan pada tahun aktif.
        INSERT INTO agenda.homeroom_assignment (
            academic_year_id,
            class_id,
            teacher_id,
            teacher_name
        )
        SELECT DISTINCT ON (gk.kelas)
            active_ay_id,
            gk.kelas,
            g.id,
            gk.nama_guru
        FROM agenda.guru_kelas gk
        LEFT JOIN agenda.guru g
            ON lower(trim(g.nama_guru)) = lower(trim(gk.nama_guru))
        WHERE NOT EXISTS (
            SELECT 1
            FROM agenda.homeroom_assignment ha
            WHERE ha.academic_year_id = active_ay_id
              AND ha.class_id = gk.kelas
        )
        ORDER BY gk.kelas, gk.nama_guru;

        IF EXISTS (
            SELECT 1
            FROM agenda.guru_kelas gk
            WHERE NOT EXISTS (
                SELECT 1
                FROM agenda.homeroom_assignment ha
                WHERE ha.academic_year_id = active_ay_id
                  AND ha.class_id = gk.kelas
            )
        ) THEN
            RAISE EXCEPTION
                'Migrasi dihentikan: masih ada kelas di guru_kelas yang belum tersimpan di homeroom_assignment.';
        END IF;

        RAISE NOTICE 'Sebanyak % penugasan legacy dipindahkan ke homeroom_assignment.', legacy_count;
    END IF;
END $$;

DROP TABLE IF EXISTS agenda.guru_kelas;

-- Verifikasi:
-- SELECT to_regclass('agenda.guru_kelas'); -- harus NULL
-- SELECT academic_year_id, class_id, teacher_name
-- FROM agenda.homeroom_assignment
-- ORDER BY academic_year_id, class_id;
