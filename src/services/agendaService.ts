import { supabase } from '../lib/supabase';
import { getSettingsSync } from './settings/settingsService';
import { findKelasId, resolveKelasId } from './classService';
import type {
  Siswa,
  SiswaStatus,
  SiswaTerdaftar,
  StatusPenempatan,
  Guru,
  MataPelajaran,
  FullAgenda,
  AgendaKBM,
  KotakSaran,
} from '../types';

// ----------------- SISWA SERVICES -----------------

/**
 * Tahun ajaran yang dipakai untuk membaca dan menulis penempatan siswa.
 *
 * Prioritas: yang berstatus ACTIVE. Kalau belum ada yang diaktifkan, dipakai
 * yang `start_date`-nya paling akhir — supaya aplikasi tetap jalan di sekolah
 * yang belum menandai tahun ajarannya sebagai aktif.
 *
 * Diekspor karena keanggotaan halaqoh juga per tahun ajaran dan harus memakai
 * tahun yang SAMA dengan penempatan kelas. Kalau keduanya punya logika sendiri,
 * suatu saat keduanya bisa menjawab berbeda — dan pembagian halaqoh akan
 * menempel di tahun yang salah tanpa error apa pun.
 */
export async function resolveAcademicYearId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('academic_year')
    .select('id, status, start_date')
    .order('start_date', { ascending: false })
    .limit(20);
  if (error) throw error;

  const rows = data ?? [];
  const aktif = rows.find((r) => r.status === 'ACTIVE');
  return (aktif ?? rows[0])?.id ?? null;
}

/**
 * Tahun ajaran yang mencakup sebuah tanggal.
 *
 * Dipakai form agenda. Daftar siswa di sana harus mengikuti tahun ajaran
 * AGENDANYA, bukan tahun ajaran yang sedang aktif — kalau tidak, membuka agenda
 * tahun lalu sementara tahun ajaran baru sudah aktif akan menampilkan roster
 * tahun yang salah. Kalau tidak ada tahun ajaran yang mencakup tanggal itu,
 * jatuh kembali ke tahun ajaran aktif supaya form tetap bisa dipakai.
 */
export async function resolveAcademicYearIdForDate(tanggal: string): Promise<string | null> {
  if (!tanggal) return resolveAcademicYearId();

  const { data, error } = await supabase
    .from('academic_year')
    .select('id')
    .lte('start_date', tanggal)
    .gte('end_date', tanggal)
    .order('start_date', { ascending: false })
    .limit(1);
  if (error) throw error;

  return (data?.[0]?.id as string | undefined) ?? (await resolveAcademicYearId());
}

/** Siswa yang punya penempatan pada tahun ajaran tersebut. */
async function ambilSiswaTerdaftar(academicYearId: string): Promise<SiswaTerdaftar[]> {
  const { data, error } = await supabase
    .from('siswa_kelas')
    .select(
      'kelas_id, academic_year_id, status, ' +
        'siswa:siswa_id (id, nama_siswa, nis, status, created_at), ' +
        'kelas:kelas_id (label)',
    )
    .eq('academic_year_id', academicYearId);
  if (error) throw error;

  return (data ?? [])
    .map((row: any): SiswaTerdaftar | null => {
      const siswa = row.siswa;
      if (!siswa) return null;
      return {
        id: siswa.id,
        nama_siswa: siswa.nama_siswa,
        nis: siswa.nis ?? null,
        // Status PENEMPATAN, bukan status global — inilah yang membuat tahun
        // lama tetap terbaca sebagaimana adanya.
        status: statusSiswaPadaTahun(row, siswa.status),
        created_at: siswa.created_at,
        kelas: row.kelas?.label ?? '',
        kelas_id: row.kelas_id,
        academic_year_id: row.academic_year_id,
      };
    })
    .filter((s): s is SiswaTerdaftar => s !== null)
    .sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa, 'id'));
}

/**
 * Seluruh siswa, termasuk yang tidak punya penempatan pada tahun ajaran itu.
 *
 * Dipakai halaman Data Siswa. Tanpa ini, siswa yang sudah lulus atau pindah
 * akan hilang dari daftar begitu ia tidak lagi punya penempatan — padahal justru
 * merekalah yang statusnya perlu diubah.
 */
async function ambilSemuaSiswa(academicYearId: string | null): Promise<SiswaTerdaftar[]> {
  const { data, error } = await supabase
    .from('siswa')
    .select(
      'id, nama_siswa, nis, status, created_at, ' +
        'penempatan:siswa_kelas (kelas_id, academic_year_id, status, kelas:kelas_id (label))',
    );
  if (error) throw error;

  return (data ?? [])
    .map((row: any): SiswaTerdaftar => {
      const cocok = (row.penempatan ?? []).find(
        (p: any) => p.academic_year_id === academicYearId,
      );
      return {
        id: row.id,
        nama_siswa: row.nama_siswa,
        nis: row.nis ?? null,
        // Punya penempatan tahun itu → status pada tahun itu. Tidak punya →
        // status sekarang, yang menjelaskan kenapa ia tidak ditempatkan.
        status: statusSiswaPadaTahun(cocok, row.status),
        created_at: row.created_at,
        // Kelas kosong = belum/tidak ditempatkan pada tahun ajaran berjalan.
        kelas: cocok?.kelas?.label ?? '',
        kelas_id: cocok?.kelas_id ?? '',
        academic_year_id: academicYearId ?? '',
      };
    })
    .sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa, 'id'));
}

/**
 * Daftar siswa beserta kelasnya pada satu tahun ajaran.
 *
 * Kelas siswa tidak lagi disimpan di tabel `siswa` — penempatannya ada di
 * `siswa_kelas`. Karena itu daftar ini terikat tahun ajaran: yang belum
 * ditempatkan pada tahun tersebut tidak muncul, kecuali diminta lewat
 * `sertakanTanpaKelas`.
 *
 * `kelas` diisi label (mis. '1A'), bukan id — pemanggil lama membandingkan
 * kelas sebagai teks, dan penyaringan dilakukan di sini supaya mereka tidak
 * perlu tahu soal `kelas_id`.
 */
export async function getDaftarSiswa(options?: {
  kelas?: string;
  academicYearId?: string;
  /** Ikut sertakan siswa tanpa penempatan di tahun itu (mis. sudah lulus). */
  sertakanTanpaKelas?: boolean;
  /**
   * Hanya siswa yang masih AKTIF pada tahun itu.
   *
   * Dipakai daftar absensi: siswa yang sudah pindah atau dinonaktifkan tidak
   * boleh muncul lagi sebagai pilihan kehadiran.
   */
  hanyaAktif?: boolean;
}): Promise<SiswaTerdaftar[]> {
  const academicYearId = options?.academicYearId ?? (await resolveAcademicYearId());

  const daftar = options?.sertakanTanpaKelas
    ? await ambilSemuaSiswa(academicYearId)
    : academicYearId
      ? await ambilSiswaTerdaftar(academicYearId)
      : [];

  const tersaring = options?.kelas
    ? daftar.filter((s) => s.kelas === options.kelas)
    : daftar;

  return options?.hanyaAktif ? tersaring.filter((s) => s.status === 'AKTIF') : tersaring;
}

/**
 * Anggota satu halaqoh, dalam bentuk yang SAMA dengan `getDaftarSiswa`.
 *
 * Dibuat seragam dengan sengaja: layar absensi tidak perlu tahu apakah yang
 * ditampilkan itu seluruh kelas atau satu kelompok. Ia meminta "daftar siswa
 * untuk penempatan ini" dan mendapatkannya — perbedaan halaqoh selesai di
 * batas service ini.
 *
 * Dipakai saat baris jadwal menunjuk sebuah halaqoh: guru Ummi hanya boleh
 * mengabsen kelompoknya sendiri. Menampilkan seluruh kelas akan membuat guru
 * menandai anak yang bukan tanggung jawabnya, dan absensi kelas penuh jadi
 * bolong karena setiap guru mengisi bagian yang berbeda.
 *
 * PENTING (halaqoh lintas kelas): kelas tiap siswa dibaca dari `siswa_kelas`
 * pada tahun ajaran berjalan, BUKAN dari halaqoh. Satu halaqoh boleh mencakup
 * beberapa kelas, jadi halaqoh tidak lagi menunjuk kelas mana pun.
 */
export async function getSiswaHalaqoh(
  halaqohId: string,
  options?: { kelas?: string; academicYearId?: string; hanyaAktif?: boolean },
): Promise<SiswaTerdaftar[]> {
  const academicYearId = options?.academicYearId ?? (await resolveAcademicYearId());
  if (!academicYearId) return [];

  const { data, error } = await supabase
    .from('siswa_halaqoh')
    .select(
      'siswa_id, ' +
        'siswa:siswa_id (id, nama_siswa, nis, status, ' +
        'siswa_kelas (kelas_id, academic_year_id, kelas:kelas_id (label)))',
    )
    .eq('halaqoh_id', halaqohId)
    .eq('academic_year_id', academicYearId);
  if (error) throw error;

  type Row = {
    siswa_id: string;
    siswa?: {
      id?: string;
      nama_siswa?: string;
      nis?: string | null;
      status?: string;
      siswa_kelas?: {
        kelas_id?: string;
        academic_year_id?: string;
        kelas?: { label?: string } | null;
      }[] | null;
    } | null;
  };

  const hasil: SiswaTerdaftar[] = [];
  for (const row of (data ?? []) as unknown as Row[]) {
    const s = row.siswa;
    if (!s?.id) continue;
    // Penempatan tahun berjalan — satu siswa punya satu baris per tahun.
    const penempatan = (s.siswa_kelas ?? []).find(
      (sk) => sk.academic_year_id === academicYearId,
    );
    hasil.push({
      id: s.id,
      nama_siswa: s.nama_siswa ?? '',
      nis: s.nis ?? null,
      status: (s.status ?? 'AKTIF') as SiswaTerdaftar['status'],
      kelas: penempatan?.kelas?.label ?? '',
      kelas_id: penempatan?.kelas_id ?? '',
      academic_year_id: academicYearId,
    });
  }

  const tersaring = options?.kelas ? hasil.filter((s) => s.kelas === options.kelas) : hasil;
  const akhir = options?.hanyaAktif
    ? tersaring.filter((s) => s.status === 'AKTIF')
    : tersaring;

  akhir.sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa, 'id'));
  return akhir;
}

/**
 * Status yang ditampilkan untuk seorang siswa pada satu tahun ajaran.
 *
 * Aturannya sengaja hanya satu kalimat, dan dipakai di semua tempat:
 *   - punya penempatan tahun itu → status PADA tahun itu;
 *   - tidak punya penempatan     → status global, yang menjelaskan kenapa.
 *
 * Inilah yang mencegah "Lulus" berlaku surut. Siswa yang lulus tetap punya
 * penempatan di tahun terakhirnya, dan di sana statusnya AKTIF — tahun itu memang
 * dijalaninya penuh. `LULUS` hanya muncul saat membuka tahun yang tidak lagi
 * punya kelas untuknya.
 *
 * Murni supaya bisa diuji tanpa database.
 */
export function statusSiswaPadaTahun(
  penempatan: { status?: string | null } | null | undefined,
  statusGlobal?: string | null,
): SiswaStatus {
  if (penempatan) return (penempatan.status ?? 'AKTIF') as SiswaStatus;
  return (statusGlobal ?? 'AKTIF') as SiswaStatus;
}

/**
 * `LULUS` tidak pernah ditulis ke penempatan — kolomnya memang tidak menerimanya,
 * karena yang lulus tidak lagi punya kelas.
 */
function statusPenempatanDari(status?: SiswaStatus): StatusPenempatan {
  return status && status !== 'LULUS' ? status : 'AKTIF';
}

async function tempatkanSiswa(
  siswaId: string,
  kelasLabel: string,
  status: StatusPenempatan = 'AKTIF',
): Promise<void> {
  const academicYearId = await resolveAcademicYearId();
  if (!academicYearId) {
    throw new Error(
      'Belum ada tahun ajaran. Buat dulu di menu Tahun Ajaran sebelum menambah siswa.',
    );
  }

  const { data: kelasRow, error: kelasErr } = await supabase
    .from('kelas')
    .select('id')
    .eq('label', kelasLabel)
    .maybeSingle();
  if (kelasErr) throw kelasErr;
  if (!kelasRow) {
    throw new Error(`Kelas "${kelasLabel}" tidak ada di master kelas.`);
  }

  const { error } = await supabase.from('siswa_kelas').upsert(
    {
      siswa_id: siswaId,
      academic_year_id: academicYearId,
      kelas_id: kelasRow.id,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'siswa_id,academic_year_id' },
  );
  if (error) throw error;
}

/**
 * Tandai status siswa pada tahun ajaran berjalan.
 *
 * Terpisah dari `siswa.status` yang global: kolom itu menjawab "status sekarang",
 * sedangkan yang ini menjawab "apa yang terjadi pada tahun ini". Keduanya perlu,
 * dan hanya di sini keduanya ditulis bersamaan supaya tidak saling menyimpang.
 */
async function tandaiStatusPenempatan(
  siswaId: string,
  status: StatusPenempatan,
): Promise<void> {
  const academicYearId = await resolveAcademicYearId();
  if (!academicYearId) return;

  const { error } = await supabase
    .from('siswa_kelas')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('siswa_id', siswaId)
    .eq('academic_year_id', academicYearId);
  if (error) throw error;
}

export async function addSiswa(input: {
  nama: string;
  kelas: string;
  nis?: string;
  status?: SiswaStatus;
}): Promise<Siswa> {
  const { data, error } = await supabase
    .from('siswa')
    .insert([
      {
        nama_siswa: input.nama.trim(),
        nis: input.nis?.trim() || null,
        status: input.status ?? 'AKTIF',
      },
    ])
    .select()
    .single();
  if (error) throw error;

  await tempatkanSiswa(data.id, input.kelas, statusPenempatanDari(input.status));
  return data as Siswa;
}

/**
 * Perbarui identitas siswa, dan penempatan kelasnya kalau `kelas` diisi.
 *
 * `kelas` kosong berarti hanya identitas yang diubah — berguna saat siswa sudah
 * lulus atau pindah, sehingga tidak punya penempatan di tahun ajaran berjalan.
 */
export async function updateSiswa(
  id: string,
  patch: { nama: string; kelas?: string; nis?: string | null; status?: SiswaStatus },
): Promise<void> {
  const row: Record<string, unknown> = { nama_siswa: patch.nama.trim() };
  if (patch.nis !== undefined) row.nis = patch.nis?.trim() || null;
  if (patch.status !== undefined) row.status = patch.status;

  const { error } = await supabase.from('siswa').update(row).eq('id', id);
  if (error) throw error;

  if (patch.kelas) {
    await tempatkanSiswa(id, patch.kelas, statusPenempatanDari(patch.status));
  } else if (patch.status !== undefined && patch.status !== 'LULUS') {
    // Tanpa kelas pun status tahun berjalan tetap perlu diselaraskan, supaya
    // siswa yang dinonaktifkan langsung hilang dari daftar absensi.
    await tandaiStatusPenempatan(id, patch.status);
  }
}

export async function deleteSiswa(id: string): Promise<void> {
  const { error } = await supabase.from('siswa').delete().eq('id', id);
  if (error) throw error;
}

// ----------------- GURU SERVICES -----------------
export async function getDaftarGuru(): Promise<Guru[]> {
  const { data, error } = await supabase
    .from('guru')
    .select('id, nama_guru, created_at')
    .order('nama_guru', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Direktori guru untuk halaman LOGIN (dipakai sebelum ada sesi).
 *
 * Hanya kolom id + nama_guru yang di-grant ke role anon (lihat bagian 4
 * supabase/stage_7_rls_auth.sql). Query ini sengaja TIDAK menyentuh kolom lain,
 * karena kolom lain akan ditolak server. Jangan tambahkan kolom di sini tanpa
 * menyesuaikan grant-nya.
 */
export async function getGuruDirectory(): Promise<Pick<Guru, 'id' | 'nama_guru'>[]> {
  const { data, error } = await supabase
    .from('guru')
    .select('id, nama_guru')
    .order('nama_guru', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addGuru(nama: string): Promise<Guru> {
  const { data, error } = await supabase
    .from('guru')
    .insert([{ nama_guru: nama.trim() }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGuru(id: string, namaBaru: string): Promise<void> {
  const { error } = await supabase
    .from('guru')
    .update({ nama_guru: namaBaru.trim() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteGuru(id: string): Promise<void> {
  const { error } = await supabase.from('guru').delete().eq('id', id);
  if (error) throw error;
}

// ----------------- MATA PELAJARAN SERVICES -----------------
export async function getDaftarMapel(): Promise<MataPelajaran[]> {
  try {
    const { data, error } = await supabase
      .from('mapel')
      .select('*')
      .order('nama_mapel', { ascending: true });
    if (error) {
      console.warn('Gagal ambil data mapel (fallback):', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
}

/**
 * Warna kosong disimpan sebagai NULL, bukan string kosong.
 *
 * Keduanya sama-sama berarti "otomatis" bagi aplikasi, tapi NULL lebih jujur:
 * satu nilai untuk satu makna, sehingga query `WHERE warna IS NULL` di masa
 * depan tidak perlu tahu soal konvensi string kosong.
 */
function warnaOrNull(warna?: string | null): string | null {
  const trimmed = (warna ?? '').trim().replace(/^#/, '').toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * `is_halaqoh` menentukan apakah mapel diajarkan berkelompok (halaqoh).
 *
 * Sengaja ikut dikirim eksplisit (bukan hanya saat nilainya `true`) supaya
 * mematikan penanda juga bisa dilakukan dari formulir yang sama. Kalau
 * parameternya opsional dan hanya ditulis saat bernilai benar, tidak akan ada
 * cara untuk membatalkan penanda selain lewat SQL langsung.
 */
export async function addMapel(
  namaMapel: string,
  warna?: string | null,
  isHalaqoh?: boolean,
): Promise<MataPelajaran> {
  const { data, error } = await supabase
    .from('mapel')
    .insert([
      {
        nama_mapel: namaMapel.trim(),
        warna: warnaOrNull(warna),
        is_halaqoh: Boolean(isHalaqoh),
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMapel(
  id: string,
  namaMapel: string,
  warna?: string | null,
  isHalaqoh?: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('mapel')
    .update({
      nama_mapel: namaMapel.trim(),
      warna: warnaOrNull(warna),
      is_halaqoh: Boolean(isHalaqoh),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMapel(id: string): Promise<void> {
  const { error } = await supabase.from('mapel').delete().eq('id', id);
  if (error) throw error;
}

// ----------------- AGENDA SERVICES -----------------
export interface SimpanAgendaPayload {
  agendaId?: string;
  schedule_id?: string | null;
  actual_teacher_name?: string | null;
  sekolah?: string;
  kelas: string;
  tanggal: string;
  kbm: AgendaKBM[];
  absensi: { siswa_id: string; status: 'S' | 'I' | 'A' }[];
  uraian_kejadian?: string;
}

export async function simpanAgenda(payload: SimpanAgendaPayload): Promise<{ id: string }> {
  const {
    agendaId,
    schedule_id,
    actual_teacher_name,
    // Nama sekolah dari Pengaturan. Agenda lama tetap memakai nilai yang
    // tersimpan saat itu — itu memang benar untuk jejak audit.
    sekolah = getSettingsSync().schoolName,
    kelas,
    tanggal,
    kbm,
    absensi,
    uraian_kejadian,
  } = payload;

  let currentAgendaId = agendaId;

  // Terjemahan label → kelas_id di luar try mana pun: kelas yang tidak ada di
  // master data harus melempar, bukan tersimpan sebagai agenda tanpa kelas.
  const headerPayload: any = {
    sekolah,
    kelas_id: await resolveKelasId(kelas),
    tanggal,
  };
  if (schedule_id !== undefined) headerPayload.schedule_id = schedule_id;
  if (actual_teacher_name !== undefined) headerPayload.actual_teacher_name = actual_teacher_name;

  if (currentAgendaId) {
    const { error: headerErr } = await supabase
      .from('agenda_header')
      .update(headerPayload)
      .eq('id', currentAgendaId);
    if (headerErr) throw headerErr;

    await supabase.from('agenda_kbm').delete().eq('agenda_id', currentAgendaId);
    await supabase.from('agenda_absensi').delete().eq('agenda_id', currentAgendaId);
    await supabase.from('agenda_kejadian').delete().eq('agenda_id', currentAgendaId);
  } else {
    const { data: headerData, error: headerErr } = await supabase
      .from('agenda_header')
      .insert([headerPayload])
      .select()
      .single();
    if (headerErr) throw headerErr;
    currentAgendaId = headerData.id;
  }

  if (kbm.length > 0 && currentAgendaId) {
    const kbmRows = kbm.map((item) => ({
      agenda_id: currentAgendaId,
      jam_ke: item.jam_ke,
      nama_guru: item.nama_guru,
      mapel: item.mapel,
      materi: item.materi,
      tugas_pr: item.tugas_pr || null,
      is_badal: Boolean(item.is_badal),
      // Mapel biasa → NULL (berlaku seluruh kelas). Disalurkan apa adanya,
      // bukan disimpulkan dari nama mapel: hanya baris jadwal yang tahu
      // kelompok mana yang diajar.
      halaqoh_id: item.halaqoh_id ?? null,
    }));
    const { error: kbmErr } = await supabase.from('agenda_kbm').insert(kbmRows);
    if (kbmErr) throw kbmErr;
  }

  if (absensi.length > 0 && currentAgendaId) {
    const absensiRows = absensi.map((a) => ({
      agenda_id: currentAgendaId,
      siswa_id: a.siswa_id,
      status: a.status,
    }));
    const { error: absensiErr } = await supabase.from('agenda_absensi').insert(absensiRows);
    if (absensiErr) throw absensiErr;
  }

  if (uraian_kejadian && uraian_kejadian.trim() && currentAgendaId) {
    const { error: kejadianErr } = await supabase
      .from('agenda_kejadian')
      .insert([{ agenda_id: currentAgendaId, uraian_kejadian: uraian_kejadian.trim() }]);
    if (kejadianErr) throw kejadianErr;
  }

  return { id: currentAgendaId! };
}

/** Kolom + relasi agenda yang dibutuhkan untuk membangun `FullAgenda`. */
const AGENDA_DETAIL_SELECT = `
      *,
      kelas:kelas_id (label),
      agenda_kbm (*, halaqoh:halaqoh_id (nama)),
      agenda_absensi (
        *,
        siswa:siswa_id (*)
      ),
      agenda_kejadian (*),
      agenda_evidence (*)
    `;

/**
 * Varian select untuk "agenda milik satu guru".
 *
 * `agenda_kbm` di-join secara `!inner` supaya penyaringan nama guru terjadi di
 * server. Tanpa `!inner`, filter pada relasi hanya menyaring baris relasinya —
 * baris `agenda_header` tetap terkirim semua.
 *
 * Efek sampingnya disengaja: `kbm` yang dikembalikan hanya baris milik guru
 * tersebut, sehingga halaman "Riwayat Agenda Saya" tidak lagi menampilkan jam
 * mengajar guru lain pada agenda yang sama.
 */
const AGENDA_DETAIL_SELECT_BY_TEACHER = `
      *,
      kelas:kelas_id (label),
      agenda_kbm!inner (*, halaqoh:halaqoh_id (nama)),
      agenda_absensi (
        *,
        siswa:siswa_id (*)
      ),
      agenda_kejadian (*),
      agenda_evidence (*)
    `;

/** Ubah satu baris `agenda_header` (dengan relasinya) menjadi bentuk `FullAgenda`. */
function mapAgendaRow(item: any): FullAgenda {
  const rawEvidence = Array.isArray(item.agenda_evidence)
    ? item.agenda_evidence[0]
    : item.agenda_evidence;

  return {
    header: {
      id: item.id,
      sekolah: item.sekolah,
      // Database menyimpan `kelas_id`; `AgendaHeader.kelas` adalah labelnya.
      // Semua layar, pencarian, dan filter laporan memakai label ini.
      kelas: item.kelas?.label ?? '',
      tanggal: item.tanggal,
      schedule_id: item.schedule_id || null,
      actual_teacher_name: item.actual_teacher_name || null,
      created_at: item.created_at,
    },
    kbm: (item.agenda_kbm || [])
      .map((k: any) => ({
        ...k,
        // `halaqoh:halaqoh_id (nama)` mengembalikan OBJEK BERSARANG, bukan
        // string. Kalau objeknya bocor ke komponen, React melempar
        // "Objects are not valid as a React child". Perataan WAJIB di sini,
        // sama seperti pola `kelas:kelas_id (label)`.
        halaqoh: k?.halaqoh?.nama ?? undefined,
      }))
      .sort((a: any, b: any) =>
        a.jam_ke.localeCompare(b.jam_ke, undefined, { numeric: true })
      ),
    absensi: (item.agenda_absensi || []).map((ab: any) => ({
      id: ab.id,
      agenda_id: ab.agenda_id,
      siswa_id: ab.siswa_id,
      status: ab.status,
      siswa: ab.siswa,
      nama_siswa: ab.siswa?.nama_siswa || '',
    })),
    kejadian: item.agenda_kejadian || [],
    evidence: rawEvidence
      ? {
          id: rawEvidence.id,
          agenda_id: rawEvidence.agenda_id,
          storage_path: rawEvidence.storage_path,
          file_name: rawEvidence.file_name,
          file_size: rawEvidence.file_size,
          mime_type: rawEvidence.mime_type,
          captured_at: rawEvidence.captured_at,
          uploaded_at: rawEvidence.uploaded_at,
          actual_teacher_name: rawEvidence.actual_teacher_name,
          actual_teacher_id: rawEvidence.actual_teacher_id,
          created_at: rawEvidence.created_at,
        }
      : null,
  };
}

export async function getRekapAgenda(filters?: {
  kelas?: string;
  tanggal?: string;
  startDate?: string;
  endDate?: string;
  nama_guru?: string;
  /** Batasi jumlah baris (untuk "terbaru" / dashboard) — opsional. */
  limit?: number;
  /**
   * Lewati `offset` baris pertama. Dipakai halaman riwayat untuk meminta
   * halaman berikutnya ("muat lebih banyak"). Hanya berpengaruh bila `limit`
   * juga diberikan.
   */
  offset?: number;
}): Promise<FullAgenda[]> {
  // Guru "Administrator" bukan guru sungguhan — jangan disaring sebagai nama.
  const teacherName =
    filters?.nama_guru && filters.nama_guru !== 'Administrator'
      ? filters.nama_guru.trim()
      : null;

  let query = supabase
    .from('agenda_header')
    .select(teacherName ? AGENDA_DETAIL_SELECT_BY_TEACHER : AGENDA_DETAIL_SELECT)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false });

  // Penyaringan guru di sisi server. Sebelumnya filter ini dijalankan di
  // browser setelah SELURUH riwayat sekolah terunduh — halaman "Riwayat Saya"
  // jadi mengunduh data semua guru, sepanjang waktu, hanya untuk menampilkan
  // beberapa baris milik sendiri.
  if (teacherName) {
    query = query.eq('agenda_kbm.nama_guru', teacherName);
  }

  if (filters?.kelas && filters.kelas !== 'SEMUA') {
    const kelasId = await findKelasId(filters.kelas);
    // Label yang tidak ada di master kelas berarti tidak ada agenda yang cocok.
    if (!kelasId) return [];
    query = query.eq('kelas_id', kelasId);
  }
  if (filters?.tanggal) {
    query = query.eq('tanggal', filters.tanggal);
  }
  if (filters?.startDate) {
    query = query.gte('tanggal', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('tanggal', filters.endDate);
  }
  if (filters?.limit && filters.limit > 0) {
    // `.range`, bukan `.limit`: tanpa `offset` keduanya sama saja
    // (`range(0, limit-1)`), tetapi `.range` memungkinkan permintaan halaman
    // berikutnya — sedangkan `.limit` selalu mengembalikan baris yang sama.
    const from = Math.max(0, filters.offset ?? 0);
    query = query.range(from, from + filters.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapAgendaRow);
}

/**
 * Ambil satu agenda lengkap berdasarkan id — dipakai untuk handoff edit via URL
 * (`?edit=<id>`). Mengembalikan `null` bila id tidak ditemukan (link basi /
 * agenda sudah dihapus), sehingga pemanggil bisa menampilkan pesan + membersihkan query.
 */
export async function getAgendaById(agendaId: string): Promise<FullAgenda | null> {
  const { data, error } = await supabase
    .from('agenda_header')
    .select(AGENDA_DETAIL_SELECT)
    .eq('id', agendaId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAgendaRow(data) : null;
}

export async function deleteAgenda(agendaId: string): Promise<void> {
  // Cek jika ada bukti foto terkait, hapus file dari Supabase Storage
  try {
    const { data: evidence } = await supabase
      .from('agenda_evidence')
      .select('storage_path')
      .eq('agenda_id', agendaId)
      .maybeSingle();

    if (evidence?.storage_path) {
      await supabase.storage.from('agenda-evidence').remove([evidence.storage_path]);
      console.log(`[Evidence] Cleaned up storage on agenda delete: ${evidence.storage_path}`);
    }
  } catch (cleanErr: any) {
    console.warn('Gagal membersihkan evidence storage saat delete agenda:', cleanErr?.message);
  }

  const { error } = await supabase.from('agenda_header').delete().eq('id', agendaId);
  if (error) throw error;
}

// ----------------- KOTAK SARAN SERVICES -----------------
export async function kirimKotakSaran(saran: Omit<KotakSaran, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('kotak_saran').insert([
    {
      nama_guru: saran.is_anonim ? 'Anonim' : saran.nama_guru,
      kategori: saran.kategori,
      isi_saran: saran.isi_saran.trim(),
      is_anonim: saran.is_anonim,
    },
  ]);
  if (error) throw error;
}

export async function getDaftarKotakSaran(): Promise<KotakSaran[]> {
  const { data, error } = await supabase
    .from('kotak_saran')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteKotakSaran(id: string): Promise<void> {
  const { error } = await supabase.from('kotak_saran').delete().eq('id', id);
  if (error) throw error;
}
