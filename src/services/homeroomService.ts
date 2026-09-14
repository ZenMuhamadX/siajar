import { supabase } from '../lib/supabase';
import type { HomeroomAssignment } from '../types';

const LOCAL_HOMEROOM_KEY = 'siajar_homeroom_assignments_cache';

function getLocalHomeroom(): HomeroomAssignment[] {
  try {
    const raw = localStorage.getItem(LOCAL_HOMEROOM_KEY);
    return raw ? JSON.parse(raw) : [];
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
      .select('*')
      .eq('academic_year_id', academicYearId)
      .order('class_id', { ascending: true });

    if (error) {
      console.warn('Tabel homeroom_assignment belum siap di DB, fallback ke local storage:', error.message);
      const local = getLocalHomeroom();
      return local.filter((h) => h.academic_year_id === academicYearId);
    }

    if (data) {
      // Sync local storage cache
      const local = getLocalHomeroom().filter((h) => h.academic_year_id !== academicYearId);
      saveLocalHomeroom([...local, ...(data as HomeroomAssignment[])]);
      return data as HomeroomAssignment[];
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
  const row = {
    academic_year_id: payload.academicYearId,
    class_id: payload.classId,
    teacher_id: payload.teacherId || null,
    teacher_name: payload.teacherName.trim(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('homeroom_assignment')
      .upsert(row, { onConflict: 'academic_year_id,class_id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update local cache
    const local = getLocalHomeroom().filter(
      (h) => !(h.academic_year_id === payload.academicYearId && h.class_id === payload.classId)
    );
    local.push(data as HomeroomAssignment);
    saveLocalHomeroom(local);

    return data as HomeroomAssignment;
  } catch (err: any) {
    console.warn('Upsert homeroom_assignment fallback to local storage:', err?.message);
    const local = getLocalHomeroom().filter(
      (h) => !(h.academic_year_id === payload.academicYearId && h.class_id === payload.classId)
    );
    const mockItem: HomeroomAssignment = {
      id: 'local-' + Date.now(),
      academic_year_id: payload.academicYearId,
      class_id: payload.classId,
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
