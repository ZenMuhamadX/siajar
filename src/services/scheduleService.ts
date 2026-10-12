import { supabase } from '../lib/supabase';
import type {
  AcademicYear,
  AcademicYearStatus,
  ScheduleItem,
  ScheduleStatus,
  ScheduleDay,
} from '../types/schedule';
import { checkScheduleConflict } from '../utils/scheduleValidation';
import { findKelasId, resolveKelasId } from './classService';
import { getHalaqohIdsByKelas, getKelasSumberMap } from './halaqohService';

/**
 * Kelas disimpan di database sebagai `kelas_id` (referensi ke master kelas),
 * tetapi seluruh layar, validasi bentrok, dan export bekerja dengan LABEL-nya
 * (mis. '1A'). Terjemahannya dikurung di dua helper di bawah supaya pemakai
 * tidak perlu tahu soal `kelas_id` sama sekali.
 *
 * Halaqoh ikut dibaca bersama jadwal supaya daftar bisa menyebut NAMA kelompok
 * ('Halaqoh 1'), bukan sekadar id-nya. Sama seperti `kelas`, bentuk bersarang
 * dari join diratakan di `mapScheduleRow` dan TIDAK boleh ikut ditulis kembali.
 *
 * Kelas sumber halaqoh ikut diambil (`kelas_sumber`) karena baris halaqoh tidak
 * punya `kelas_id`: tanpa itu, `kelas`-nya kosong dan barisnya terbuang di setiap
 * penyaringan kelas. Lihat `kelasDariJadwal`.
 */
const SCHEDULE_SELECT =
  '*, kelas:kelas_id (label), ' +
  'halaqoh_ref:halaqoh_id (nama, kelas_sumber:halaqoh_kelas (kelas:kelas_id (label)))';

/** Kolom hasil join yang TIDAK boleh ikut dikirim kembali ke database. */
const KOLOM_TURUNAN = ['kelas', 'halaqoh', 'kelasList', 'halaqoh_ref'] as const;

/**
 * Label kelas yang dicakup sebuah baris jadwal.
 *
 * Baris halaqoh lintas kelas tidak punya satu kelas: `kelasList`-nya diisi
 * seluruh kelas sumbernya. Baris biasa memakai `kelas` tunggalnya. Helper ini
 * dipakai penyaring supaya baris halaqoh tidak ikut terbuang saat difilter kelas.
 */
export function kelasDariJadwal(
  item: Pick<ScheduleItem, 'kelas' | 'kelasList'>,
): string[] {
  if (item.kelasList && item.kelasList.length > 0) return item.kelasList;
  return item.kelas ? [item.kelas] : [];
}

/** Apakah baris jadwal ini mencakup kelas berlabel `label`. */
export function jadwalMencakupKelas(
  item: Pick<ScheduleItem, 'kelas' | 'kelasList'>,
  label: string,
): boolean {
  return kelasDariJadwal(item).includes(label);
}

/**
 * Ratakan satu baris hasil join `schedule` menjadi `ScheduleItem`.
 *
 * Diekspor supaya bisa diuji tanpa database (bentuknya murni): invarian
 * "baris halaqoh tetap ber-`kelas` kosong tetapi `kelasList`-nya terisi" itu
 * yang menjaga pencocokan data lama tetap jalan.
 */
export function mapScheduleRow(row: any): ScheduleItem {
  const kelasLabel = row?.kelas?.label ?? '';

  // Kelas sumber halaqoh (bisa beberapa). Untuk baris biasa, daftarnya satu
  // kelas saja — sehingga pemakai bisa selalu memakai `kelasList` tanpa cabang.
  const sumber: string[] = (row?.halaqoh_ref?.kelas_sumber ?? [])
    .map((s: any) => s?.kelas?.label)
    .filter((label: unknown): label is string => Boolean(label));

  const kelasList = row?.halaqoh_id ? sumber : kelasLabel ? [kelasLabel] : [];

  // `...row` dibuang lebih dulu supaya bentuk bersarang hasil join
  // (`kelas`, `halaqoh_ref`) tidak bocor ke komponen React.
  const { kelas: _kelas, halaqoh_ref: _ref, ...sisa } = row ?? {};

  return {
    ...sisa,
    kelas: kelasLabel,
    halaqoh: row?.halaqoh_ref?.nama ?? undefined,
    kelasList,
  } as ScheduleItem;
}

/** Susun baris database dari `ScheduleItem` — label diterjemahkan ke `kelas_id`. */
async function toScheduleRow(
  item: Partial<Omit<ScheduleItem, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = { ...item };
  // `kelas`, `halaqoh`, `kelasList`, dan `halaqoh_ref` adalah hasil turunan saat
  // membaca, bukan kolom. Mengirimnya akan ditolak database.
  for (const kolom of KOLOM_TURUNAN) delete row[kolom];
  if (item.halaqoh_id) {
    // Baris halaqoh lintas kelas TIDAK punya satu kelas: kelasnya diturunkan
    // dari `halaqoh_kelas` (bisa beberapa kelas). `kelas_id` dibiarkan NULL —
    // CHECK di database mewajibkan salah satu dari kelas_id/halaqoh_id terisi.
    row.kelas_id = null;
  } else if (item.kelas !== undefined) {
    row.kelas_id = await resolveKelasId(item.kelas);
  }
  return row;
}

// Local storage fallback keys for development / offline resilience
const LOCAL_AY_KEY = 'siajar_academic_years_cache';
const LOCAL_SCH_KEY = 'siajar_schedules_cache';

function getLocalAcademicYears(): AcademicYear[] {
  try {
    const raw = localStorage.getItem(LOCAL_AY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAcademicYears(list: AcademicYear[]) {
  try {
    localStorage.setItem(LOCAL_AY_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to cache academic years:', e);
  }
}

function getLocalSchedules(): ScheduleItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_SCH_KEY);
    if (!raw) return [];
    // Cache dari versi sebelum Fase 2 menyimpan `class_id`. Bentuk lamanya
    // disamakan di sini supaya kelas tidak tampil kosong saat jatuh ke jalur
    // offline. `kelasList` lama belum ada, jadi diturunkan dari `kelas`.
    return (JSON.parse(raw) as any[]).map((s) => {
      const kelas = s.kelas ?? s.class_id ?? '';
      return {
        ...s,
        kelas,
        kelasList: Array.isArray(s.kelasList) ? s.kelasList : kelas ? [kelas] : [],
      };
    });
  } catch {
    return [];
  }
}

function saveLocalSchedules(list: ScheduleItem[]) {
  try {
    localStorage.setItem(LOCAL_SCH_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to cache schedules:', e);
  }
}

// ---------------------------------------------------------------------------
// ACADEMIC YEAR SERVICES
// ---------------------------------------------------------------------------

export async function getAcademicYears(): Promise<AcademicYear[]> {
  try {
    const { data, error } = await supabase
      .from('academic_year')
      .select('*')
      .order('name', { ascending: false });

    if (error) {
      console.warn('academic_year Supabase table missing/error, fallback to local storage:', error.message);
      return getLocalAcademicYears();
    }

    if (data && data.length > 0) {
      saveLocalAcademicYears(data as AcademicYear[]);
      return data as AcademicYear[];
    }

    return getLocalAcademicYears();
  } catch (e) {
    console.warn('Network error fetching academic_year, fallback to local:', e);
    return getLocalAcademicYears();
  }
}

export async function createAcademicYear(payload: {
  name: string;
  start_date: string;
  end_date: string;
  status: AcademicYearStatus;
}): Promise<AcademicYear> {
  const newRecord: AcademicYear = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ay-${Date.now()}`,
    name: payload.name.trim(),
    start_date: payload.start_date,
    end_date: payload.end_date,
    status: payload.status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    // If activating, ensure other ACTIVE years become ARCHIVED first
    if (payload.status === 'ACTIVE') {
      await supabase
        .from('academic_year')
        .update({ status: 'ARCHIVED' })
        .eq('status', 'ACTIVE');
    }

    const { data, error } = await supabase
      .from('academic_year')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert academic_year error, saving locally:', error.message);
      const local = getLocalAcademicYears();
      if (payload.status === 'ACTIVE') {
        local.forEach((y) => {
          if (y.status === 'ACTIVE') y.status = 'ARCHIVED';
        });
      }
      local.unshift(newRecord);
      saveLocalAcademicYears(local);
      return newRecord;
    }

    return data as AcademicYear;
  } catch (e) {
    const local = getLocalAcademicYears();
    if (payload.status === 'ACTIVE') {
      local.forEach((y) => {
        if (y.status === 'ACTIVE') y.status = 'ARCHIVED';
      });
    }
    local.unshift(newRecord);
    saveLocalAcademicYears(local);
    return newRecord;
  }
}

export async function setActiveAcademicYear(id: string): Promise<void> {
  try {
    // 1. Set all existing ACTIVE to ARCHIVED
    await supabase
      .from('academic_year')
      .update({ status: 'ARCHIVED' })
      .eq('status', 'ACTIVE');

    // 2. Set this ID to ACTIVE
    const { error } = await supabase
      .from('academic_year')
      .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  } catch (e) {
    console.warn('Supabase update active academic_year failed, updating local state:', e);
  }

  // Always update local cache
  const local = getLocalAcademicYears();
  local.forEach((y) => {
    if (y.id === id) {
      y.status = 'ACTIVE';
      y.updated_at = new Date().toISOString();
    } else if (y.status === 'ACTIVE') {
      y.status = 'ARCHIVED';
    }
  });
  saveLocalAcademicYears(local);
}

export async function archiveAcademicYear(id: string): Promise<void> {
  try {
    await supabase
      .from('academic_year')
      .update({ status: 'ARCHIVED', updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (e) {
    console.warn('Supabase archive academic_year failed, updating local:', e);
  }

  const local = getLocalAcademicYears();
  const target = local.find((y) => y.id === id);
  if (target) {
    target.status = 'ARCHIVED';
    saveLocalAcademicYears(local);
  }
}

export interface IsiTahunAjaran {
  kosong: boolean;
  rincian: { label: string; jumlah: number }[];
}

/**
 * Isi sebuah tahun ajaran — dipakai untuk menjelaskan kenapa ia belum bisa dihapus.
 *
 * Pemeriksaan ini hanya untuk pengalaman pengguna. Penjaga sebenarnya ada di
 * fungsi `agenda.hapus_tahun_ajaran` di server, supaya tidak bisa dilewati dari
 * klien: `schedule`, `siswa_kelas`, dan `period_templates` memakai
 * ON DELETE RESTRICT, jadi penghapusan yang dipaksakan akan gagal dengan pesan
 * kunci asing yang tidak bisa dibaca guru.
 */
export async function cekIsiTahunAjaran(id: string): Promise<IsiTahunAjaran> {
  const [jadwal, siswa, wali, slot, kenaikan] = await Promise.all([
    supabase
      .from('schedule')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', id),
    supabase
      .from('siswa_kelas')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', id),
    supabase
      .from('homeroom_assignment')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', id),
    supabase
      .from('period_templates')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', id),
    supabase
      .from('promotion_log')
      .select('id', { count: 'exact', head: true })
      .or(`academic_year_to.eq.${id},academic_year_from.eq.${id}`),
  ]);

  for (const r of [jadwal, siswa, wali, slot, kenaikan]) {
    if (r.error) throw r.error;
  }

  const rincian = [
    { label: 'jadwal', jumlah: jadwal.count ?? 0 },
    { label: 'penempatan siswa', jumlah: siswa.count ?? 0 },
    { label: 'penugasan wali kelas', jumlah: wali.count ?? 0 },
    { label: 'template jam', jumlah: slot.count ?? 0 },
    { label: 'catatan kenaikan kelas', jumlah: kenaikan.count ?? 0 },
  ].filter((r) => r.jumlah > 0);

  return { kosong: rincian.length === 0, rincian };
}

/**
 * Hapus tahun ajaran — hanya berhasil kalau benar-benar kosong.
 *
 * Dipakai saat salah memasukkan tanggal lalu ingin membuatnya ulang. Tahun ajaran
 * yang sudah terisi tidak dihapus melainkan diarsipkan; itulah yang menjaga
 * riwayat agenda, absensi, dan laporan tetap utuh.
 */
export async function hapusTahunAjaran(id: string): Promise<void> {
  const { error } = await supabase.rpc('hapus_tahun_ajaran', { p_id: id });
  if (error) throw new Error(error.message || 'Gagal menghapus tahun ajaran.');

  const local = getLocalAcademicYears().filter((y) => y.id !== id);
  saveLocalAcademicYears(local);
}

// ---------------------------------------------------------------------------
// SCHEDULE SERVICES
// ---------------------------------------------------------------------------

export interface GetScheduleFilters {
  academicYearId?: string;
  day?: ScheduleDay;
  teacherName?: string;
  classId?: string;
  status?: ScheduleStatus;
}

export async function getSchedules(filters?: GetScheduleFilters): Promise<ScheduleItem[]> {
  try {
    let query = supabase
      .from('schedule')
      .select(SCHEDULE_SELECT)
      .order('period_number', { ascending: true });

    if (filters?.academicYearId) {
      query = query.eq('academic_year_id', filters.academicYearId);
    }
    if (filters?.day) {
      query = query.eq('day', filters.day);
    }
    if (filters?.teacherName) {
      query = query.eq('teacher_name', filters.teacherName);
    }
    if (filters?.classId) {
      const kelasId = await findKelasId(filters.classId);
      // Label yang tidak ada di master kelas berarti tidak ada jadwal yang cocok.
      if (!kelasId) return [];
      // Sesi halaqoh lintas kelas tidak punya `kelas_id`; ia harus ikut muncul
      // saat difilter ke salah satu kelas sumbernya. Karena itu penyaringnya
      // menyertakan halaqoh yang mencakup kelas ini, bukan hanya `kelas_id`.
      const halaqohIds = await getHalaqohIdsByKelas(kelasId);
      query =
        halaqohIds.length > 0
          ? query.or(`kelas_id.eq.${kelasId},halaqoh_id.in.(${halaqohIds.join(',')})`)
          : query.eq('kelas_id', kelasId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase schedule table error/missing, fallback to local:', error.message);
      return filterLocalSchedules(filters);
    }

    if (data && data.length > 0) {
      const rows = (data as any[]).map(mapScheduleRow);
      // Sync local cache
      const local = getLocalSchedules();
      const nonMatching = local.filter((l) => !rows.some((d) => d.id === l.id));
      saveLocalSchedules([...rows, ...nonMatching]);
      return rows;
    }

    return filterLocalSchedules(filters);
  } catch (e) {
    console.warn('Network error getSchedules, fallback local:', e);
    return filterLocalSchedules(filters);
  }
}

function filterLocalSchedules(filters?: GetScheduleFilters): ScheduleItem[] {
  let list = getLocalSchedules();
  if (!filters) return list;

  if (filters.academicYearId) {
    list = list.filter((s) => s.academic_year_id === filters.academicYearId);
  }
  if (filters.day) {
    list = list.filter((s) => s.day === filters.day);
  }
  if (filters.teacherName) {
    list = list.filter((s) => s.teacher_name === filters.teacherName);
  }
  if (filters.classId) {
    // Baris halaqoh lintas kelas tidak punya satu `kelas`; penyaring harus
    // memakai daftar kelasnya, kalau tidak baris itu ikut terbuang.
    list = list.filter((s) => jadwalMencakupKelas(s, filters.classId!));
  }
  if (filters.status) {
    list = list.filter((s) => s.status === filters.status);
  }
  return list.sort((a, b) => a.period_number - b.period_number);
}

export async function createSchedule(
  payload: Omit<ScheduleItem, 'id' | 'created_at' | 'updated_at'>
): Promise<ScheduleItem> {
  // 1. Conflict Validation against existing schedules
  const existing = await getSchedules({ academicYearId: payload.academic_year_id });
  // Peta kelas sumber halaqoh diperlukan agar sesi halaqoh lintas kelas
  // terdeteksi bentrok dengan jadwal seluruh kelas anggotanya.
  const halaqohKelas = await getKelasSumberMap();
  const conflict = checkScheduleConflict(payload, existing, halaqohKelas);
  if (conflict.hasConflict) {
    throw new Error(conflict.message || 'Bentrok jadwal terdeteksi.');
  }

  const newRecord: ScheduleItem = {
    ...payload,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Terjemahan label → kelas_id sengaja di LUAR try: kelas yang tidak ada di
  // master data harus melempar, bukan diam-diam jatuh ke penyimpanan lokal.
  const row = await toScheduleRow(payload);

  try {
    const { data, error } = await supabase
      .from('schedule')
      .insert([row])
      .select(SCHEDULE_SELECT)
      .single();

    if (error) {
      console.warn('Supabase insert schedule error, storing locally:', error.message);
      const local = getLocalSchedules();
      local.push(newRecord);
      saveLocalSchedules(local);
      return newRecord;
    }

    // Update local cache
    const saved = mapScheduleRow(data);
    const local = getLocalSchedules();
    local.push(saved);
    saveLocalSchedules(local);
    return saved;
  } catch (e) {
    const local = getLocalSchedules();
    local.push(newRecord);
    saveLocalSchedules(local);
    return newRecord;
  }
}

export async function updateSchedule(
  id: string,
  payload: Partial<Omit<ScheduleItem, 'id' | 'created_at' | 'updated_at'>>
): Promise<ScheduleItem> {
  // Fetch existing target item to combine for conflict check
  const allSchedules = await getSchedules({ academicYearId: payload.academic_year_id });
  const current = allSchedules.find((s) => s.id === id);
  if (!current) {
    throw new Error('Jadwal tidak ditemukan.');
  }

  const merged = {
    ...current,
    ...payload,
    id,
  };

  // Conflict validation
  const halaqohKelas = await getKelasSumberMap();
  const conflict = checkScheduleConflict(merged, allSchedules, halaqohKelas);
  if (conflict.hasConflict) {
    throw new Error(conflict.message || 'Bentrok jadwal terdeteksi.');
  }

  const updatedRecord: ScheduleItem = {
    ...merged,
    updated_at: new Date().toISOString(),
  };

  // Sama seperti createSchedule: terjemahan label → kelas_id di luar try.
  const row = await toScheduleRow(payload);

  try {
    const { data, error } = await supabase
      .from('schedule')
      .update({
        ...row,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(SCHEDULE_SELECT)
      .single();

    if (error) {
      console.warn('Supabase update schedule error, updating local:', error.message);
      const local = getLocalSchedules();
      const idx = local.findIndex((s) => s.id === id);
      if (idx >= 0) local[idx] = updatedRecord;
      saveLocalSchedules(local);
      return updatedRecord;
    }

    const saved = mapScheduleRow(data);
    const local = getLocalSchedules();
    const idx = local.findIndex((s) => s.id === id);
    if (idx >= 0) local[idx] = saved;
    saveLocalSchedules(local);
    return saved;
  } catch (e) {
    const local = getLocalSchedules();
    const idx = local.findIndex((s) => s.id === id);
    if (idx >= 0) local[idx] = updatedRecord;
    saveLocalSchedules(local);
    return updatedRecord;
  }
}

export async function setScheduleStatus(id: string, status: ScheduleStatus): Promise<void> {
  try {
    const { error } = await supabase
      .from('schedule')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  } catch (e) {
    console.warn('Supabase setScheduleStatus failed, updating local:', e);
  }

  const local = getLocalSchedules();
  const target = local.find((s) => s.id === id);
  if (target) {
    target.status = status;
    target.updated_at = new Date().toISOString();
    saveLocalSchedules(local);
  }
}

export async function deleteSchedule(id: string): Promise<void> {
  // Check if safe or soft-archive if necessary
  try {
    const { error } = await supabase.from('schedule').delete().eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.warn('Supabase deleteSchedule error, removing from local:', e);
  }

  const local = getLocalSchedules().filter((s) => s.id !== id);
  saveLocalSchedules(local);
}

// // ---------------------------------------------------------------------------
// // REFERENCE SEEDING (2026/2027)
// // ---------------------------------------------------------------------------

// export async function seedAcademicYearAndReferenceSchedule(
//   teachers: string[],
//   academicYearId?: string
// ): Promise<{ academicYear: AcademicYear; createdCount: number }> {
//   // 1. Ensure Academic Year exists
//   let ay: AcademicYear;
//   const existingAYs = await getAcademicYears();
//   let found = existingAYs.find((y) => y.name === '2026/2027');

//   if (!found) {
//     ay = await createAcademicYear({
//       name: '2026/2027',
//       start_date: '2026-07-15',
//       end_date: '2027-06-25',
//       status: 'ACTIVE',
//     });
//   } else {
//     ay = found;
//     if (ay.status !== 'ACTIVE') {
//       await setActiveAcademicYear(ay.id);
//       ay.status = 'ACTIVE';
//     }
//   }

//   const targetAyId = academicYearId || ay.id;
//   const existingSchedules = await getSchedules({ academicYearId: targetAyId });

//   // Standard bell schedule Monday - Thursday
//   const standardPeriodsSeninKamis = [
//     { period: 1, start: '07:30', end: '08:05' },
//     { period: 2, start: '08:05', end: '08:40' },
//     { period: 3, start: '08:40', end: '09:15' },
//     { period: 4, start: '09:35', end: '10:10' },
//     { period: 5, start: '10:10', end: '10:45' },
//     { period: 6, start: '10:45', end: '11:20' },
//     { period: 7, start: '11:20', end: '11:55' },
//     { period: 8, start: '12:35', end: '13:05' },
//     { period: 9, start: '13:05', end: '13:35' },
//     { period: 10, start: '13:35', end: '14:10' },
//   ];

//   const classes = ['KELAS 1', 'KELAS 2', 'KELAS 3', 'KELAS 4', 'KELAS 5', 'KELAS 6'];

//   const defaultTeacherForClass: Record<string, string> = {
//     'KELAS 1': 'Ikfina Khoirun Nisa, S.Pd.',
//     'KELAS 2': 'Dian Kusumawati, S.Pd.',
//     'KELAS 3': 'Eva Trisnawati, S.Pd.',
//     'KELAS 4': 'Siti Nur Arafah, S.Pd.',
//     'KELAS 5': 'Nur Ajizah Romadi, S.Pd.',
//     'KELAS 6': 'Ela Siti Nurlalela, S.Pd.',
//   };

//   let count = 0;

//   // Build a standard seed matrix for Monday
//   for (const cls of classes) {
//     const defaultTeacher = defaultTeacherForClass[cls] || teachers[0] || 'Guru SDIT';
//     for (const p of standardPeriodsSeninKamis.slice(0, 5)) {
//       // Check if row exists
//       const exists = existingSchedules.some(
//         (s) => s.day === 'MONDAY' && s.class_id === cls && s.period_number === p.period
//       );

//       if (!exists) {
//         const item: Omit<ScheduleItem, 'id' | 'created_at' | 'updated_at'> = {
//           academic_year_id: targetAyId,
//           day: 'MONDAY',
//           period_number: p.period,
//           start_time: p.start,
//           end_time: p.end,
//           class_id: cls,
//           subject_name: p.period % 2 === 0 ? 'Matematika' : 'Bahasa Indonesia',
//           teacher_name: defaultTeacher,
//           status: 'ACTIVE',
//           activity_type: 'KBM',
//         };

//         try {
//           await createSchedule(item);
//           count++;
//         } catch (err) {
//           console.warn(`Skipping seed collision for ${cls} period ${p.period}:`, err);
//         }
//       }
//     }
//   }

//   return { academicYear: ay, createdCount: count };
// }
