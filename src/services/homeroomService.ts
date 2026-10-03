import { supabase } from '../lib/supabase';
import type { HomeroomAssignment } from '../types';
import { resolveKelasId } from './classService';

const LOCAL_HOMEROOM_KEY = 'siajar_homeroom_assignments_cache';

/**
 * Kelas disimpan di database sebagai `kelas_id`; layar bekerja dengan labelnya
 * (mis. '1A'). Terjemahannya dikurung di sini.
 */
function mapHomeroomRow(row: any): HomeroomAssignment {
  return { ...row, kelas: row?.kelas?.label ?? '' } as HomeroomAssignment;
}

function getLocalHomeroom(): HomeroomAssignment[] {
  try {
    const raw = localStorage.getItem(LOCAL_HOMEROOM_KEY);
    if (!raw) return [];
    // Cache dari versi sebelum Fase 2 menyimpan `class_id`.
    return (JSON.parse(raw) as any[]).map((h) => ({
      ...h,
      kelas: h.kelas ?? h.class_id ?? '',
    }));
  } catch {
    return [];
  }
}

function saveLocalHomeroom(list: HomeroomAssignment[]) {
  try {
    localStorage.setItem(LOCAL_HOMEROOM_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to cache homeroom assignments:', e);
  }
}

/**
 * Mendapatkan daftar penugasan wali kelas berdasarkan tahun ajaran
 */
export async function getHomeroomAssignments(academicYearId: string): Promise<HomeroomAssignment[]> {
  if (!academicYearId) return [];

  try {
    const { data, error } = await supabase
      .from('homeroom_assignment')
      .select('*, kelas:kelas_id (label)')
      .eq('academic_year_id', academicYearId);

    if (error) {
      console.warn('Tabel homeroom_assignment belum siap di DB, fallback ke local storage:', error.message);
      const local = getLocalHomeroom();
      return local.filter((h) => h.academic_year_id === academicYearId);
    }

    if (data) {
      const rows = (data as any[])
        .map(mapHomeroomRow)
        // Urut di sini, bukan lewat `.order('class_id')`: yang diurut sekarang
        // adalah label hasil join, bukan kolom tabel.
        .sort((a, b) => a.kelas.localeCompare(b.kelas, 'id'));

      // Sync local storage cache
      const local = getLocalHomeroom().filter((h) => h.academic_year_id !== academicYearId);
      saveLocalHomeroom([...local, ...rows]);
      return rows;
    }

    return [];
  } catch (err) {
    console.warn('Fallback local storage for homeroom assignments:', err);
    const local = getLocalHomeroom();
    return local.filter((h) => h.academic_year_id === academicYearId);
  }
}

/**
 * Menyimpan / memperbarui penugasan wali kelas untuk suatu kelas dan tahun ajaran
 */
export async function upsertHomeroomAssignment(payload: {
  academicYearId: string;
  classId: string;
  teacherId?: string | null;
  teacherName: string;
}): Promise<HomeroomAssignment> {
  // Terjemahan label → kelas_id di luar try: kelas yang tidak ada di master data
  // harus melempar, bukan diam-diam tersimpan sebagai cache lokal.
  const kelasId = await resolveKelasId(payload.classId);

  const row = {
    academic_year_id: payload.academicYearId,
    kelas_id: kelasId,
    teacher_id: payload.teacherId || null,
    teacher_name: payload.teacherName.trim(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('homeroom_assignment')
      .upsert(row, { onConflict: 'academic_year_id,kelas_id' })
      .select('*, kelas:kelas_id (label)')
      .single();

    if (error) {
      throw error;
    }

    const saved = mapHomeroomRow(data);

    // Update local cache
    const local = getLocalHomeroom().filter(
      (h) => !(h.academic_year_id === payload.academicYearId && h.kelas === payload.classId)
    );
    local.push(saved);
    saveLocalHomeroom(local);

    return saved;
  } catch (err: any) {
    console.warn('Upsert homeroom_assignment fallback to local storage:', err?.message);
    const local = getLocalHomeroom().filter(
      (h) => !(h.academic_year_id === payload.academicYearId && h.kelas === payload.classId)
    );
    const mockItem: HomeroomAssignment = {
      id: 'local-' + Date.now(),
      academic_year_id: payload.academicYearId,
      kelas: payload.classId,
      teacher_id: payload.teacherId || null,
      teacher_name: payload.teacherName.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    local.push(mockItem);
    saveLocalHomeroom(local);
    return mockItem;
  }
}

/**
 * Menghapus penugasan wali kelas
 */
export async function deleteHomeroomAssignment(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('homeroom_assignment').delete().eq('id', id);
    if (error) throw error;
  } catch (err: any) {
    console.warn('Delete homeroom_assignment error, removing from local:', err?.message);
  } finally {
    const local = getLocalHomeroom().filter((h) => h.id !== id);
    saveLocalHomeroom(local);
  }
}
