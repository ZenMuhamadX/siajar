-- =============================================================================
-- stage_10_0_verify_jurnal_halaqoh.sql  (FASE 4 — BACA-SAJA)
--
-- Memastikan jurnal (agenda) sudah benar-benar terhubung ke halaqoh.
-- JANGAN mengubah apa pun — seluruh pertanyaan di bawah hanya membaca.
--
-- Dijalankan SESUDAH kode Fase 4 di-deploy, oleh pemilik di Supabase SQL Editor.
-- Hasilnya HARUS dalam bentuk SATU tabel (aturan §8 MEMORY: editor pengguna
-- hanya menampilkan tabel hasil terakhir, dan tidak punya tab Messages).
--
-- Jalankan SELURUH berkas sekaligus, lalu baca kolom `kesimpulan` di tabel hasil.
-- =============================================================================

DROP TABLE IF EXISTS public.hasil_uji_fase4;
CREATE TABLE public.hasil_uji_fase4 (
    urut      INT,
    uji       TEXT,
    kenyataan TEXT,
    kesimpulan TEXT
);

-- ---------------------------------------------------------------------------
-- 1. Kolom yang dibutuhkan Fase 4 benar-benar ada
-- ---------------------------------------------------------------------------
INSERT INTO public.hasil_uji_fase4
SELECT 1, 'Kolom agenda_kbm.halaqoh_id ada',
       COALESCE((SELECT 'ADA' FROM information_schema.columns
                 WHERE table_schema='agenda' AND table_name='agenda_kbm'
                   AND column_name='halaqoh_id' LIMIT 1), 'TIDAK ADA'),
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='agenda' AND table_name='agenda_kbm'
                   AND column_name='halaqoh_id')
            THEN 'OK' ELSE 'MASALAH' END;

INSERT INTO public.hasil_uji_fase4
SELECT 2, 'Kolom schedule.halaqoh_id ada',
       COALESCE((SELECT 'ADA' FROM information_schema.columns
                 WHERE table_schema='agenda' AND table_name='schedule'
                   AND column_name='halaqoh_id' LIMIT 1), 'TIDAK ADA'),
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='agenda' AND table_name='schedule'
                   AND column_name='halaqoh_id')
            THEN 'OK' ELSE 'MASALAH' END;

-- ---------------------------------------------------------------------------
-- 2. Relasi agenda_kbm -> halaqoh ada (dibutuhkan join PostgREST `halaqoh:`)
--    Tanpa FK ini, `.select('agenda_kbm (*, halaqoh:halaqoh_id (nama))')`
--    akan GAGAL — dan seluruh halaman agenda ikut kosong.
-- ---------------------------------------------------------------------------
INSERT INTO public.hasil_uji_fase4
SELECT 3, 'Relasi FK agenda_kbm.halaqoh_id -> halaqoh(id) ada',
       COALESCE((SELECT 'ADA' FROM information_schema.table_constraints tc
                 JOIN information_schema.key_column_usage kcu
                   ON tc.constraint_name = kcu.constraint_name
                 JOIN information_schema.constraint_column_usage ccu
                   ON tc.constraint_name = ccu.constraint_name
                 WHERE tc.constraint_type='FOREIGN KEY'
                   AND tc.table_schema='agenda' AND tc.table_name='agenda_kbm'
                   AND kcu.column_name='halaqoh_id' LIMIT 1), 'TIDAK ADA'),
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.table_constraints tc
                 JOIN information_schema.key_column_usage kcu
                   ON tc.constraint_name = kcu.constraint_name
                 WHERE tc.constraint_type='FOREIGN KEY'
                   AND tc.table_schema='agenda' AND tc.table_name='agenda_kbm'
                   AND kcu.column_name='halaqoh_id')
            THEN 'OK' ELSE 'MASALAH' END;

-- ---------------------------------------------------------------------------
-- 3. Hitungan: berapa baris jurnal yang sudah punya halaqoh_id
-- ---------------------------------------------------------------------------
INSERT INTO public.hasil_uji_fase4
SELECT 4, 'Baris agenda_kbm dengan halaqoh_id terisi',
       (SELECT COUNT(*)::text FROM agenda.agenda_kbm WHERE halaqoh_id IS NOT NULL),
       'INFO';

INSERT INTO public.hasil_uji_fase4
SELECT 5, 'Baris agenda_kbm tanpa halaqoh_id (mapel biasa)',
       (SELECT COUNT(*)::text FROM agenda.agenda_kbm WHERE halaqoh_id IS NULL),
       'INFO';

-- ---------------------------------------------------------------------------
-- 4. Berapa baris jadwal berkelompok yang JUSTRU masih NULL halaqoh_id
--    (artinya jadwal Ummi lama belum ditunjuk kelompoknya — perlu diisi
--    lewat menu Jadwal)
-- ---------------------------------------------------------------------------
INSERT INTO public.hasil_uji_fase4
SELECT 6, 'Baris jadwal Ummi yang halaqoh_id-nya MASIH kosong',
       (SELECT COUNT(*)::text
          FROM agenda.schedule s
          JOIN agenda.mapel m ON m.nama_mapel = s.subject_name
         WHERE COALESCE(m.is_halaqoh, false)
           AND s.halaqoh_id IS NULL),
       'INFO (isi lewat menu Jadwal bila > 0)';

-- ---------------------------------------------------------------------------
-- 5. Apakah `mapel.is_halaqoh` sudah ada (prasyarat Fase 3)
-- ---------------------------------------------------------------------------
INSERT INTO public.hasil_uji_fase4
SELECT 7, 'Kolom mapel.is_halaqoh ada',
       COALESCE((SELECT 'ADA' FROM information_schema.columns
                 WHERE table_schema='agenda' AND table_name='mapel'
                   AND column_name='is_halaqoh' LIMIT 1), 'TIDAK ADA'),
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='agenda' AND table_name='mapel'
                   AND column_name='is_halaqoh')
            THEN 'OK (jalankan stage_9_1 bila TIDAK ADA)' ELSE 'MASALAH' END;

-- ---------------------------------------------------------------------------
-- 6. Guru boleh MEMBACA halaqoh? Tanpa policy ini, absensi per kelompok
--    akan kosong untuk akun guru (RLS menolak diam-diam).
-- ---------------------------------------------------------------------------
INSERT INTO public.hasil_uji_fase4
SELECT 8, 'Policy SELECT halaqoh untuk member ada',
       COALESCE((SELECT 'ADA' FROM pg_policies
                 WHERE schemaname='agenda' AND tablename='halaqoh'
                   AND cmd='SELECT' LIMIT 1), 'TIDAK ADA'),
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='agenda' AND tablename='halaqoh'
                   AND cmd='SELECT')
            THEN 'OK' ELSE 'MASALAH' END;

INSERT INTO public.hasil_uji_fase4
SELECT 9, 'Policy SELECT siswa_halaqoh untuk member ada',
       COALESCE((SELECT 'ADA' FROM pg_policies
                 WHERE schemaname='agenda' AND tablename='siswa_halaqoh'
                   AND cmd='SELECT' LIMIT 1), 'TIDAK ADA'),
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='agenda' AND tablename='siswa_halaqoh'
                   AND cmd='SELECT')
            THEN 'OK' ELSE 'MASALAH' END;

-- ---------------------------------------------------------------------------
-- 7. Contoh nyata: jurnal halaqoh yang sudah terisi, bila ada
--    (memperlihatkan pemisahan bagian antar kelompok bekerja)
-- ---------------------------------------------------------------------------
INSERT INTO public.hasil_uji_fase4
SELECT 10, 'Contoh: jurnal per kelompok pada tanggal yang sama',
       COALESCE((
         SELECT string_agg(
                  format('%s %s [%s]: %s',
                         h.tanggal, h.kelas_id, COALESCE(hal.nama, '-'),
                         k.nama_guru),
                  ' | ' ORDER BY hal.nama)
           FROM agenda.agenda_kbm k
           JOIN agenda.agenda_header h ON h.id = k.agenda_id
           JOIN agenda.halaqoh hal ON hal.id = k.halaqoh_id
          WHERE k.halaqoh_id IS NOT NULL
       ), 'BELUM ADA — normal bila jurnal halaqoh belum pernah diisi'),
       'INFO';

-- =============================================================================
-- HASIL — satu tabel, dibaca sekali
-- =============================================================================
SELECT urut, uji, kenyataan, kesimpulan
  FROM public.hasil_uji_fase4
 ORDER BY urut;

-- =============================================================================
-- BERSIHKAN (jalankan TERPISAH setelah membaca hasil di atas)
-- =============================================================================
-- DROP TABLE IF EXISTS public.hasil_uji_fase4;
