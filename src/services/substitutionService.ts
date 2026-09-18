import { supabase } from '../lib/supabase';
import type { Substitution } from '../types';
import { getSchedules } from './scheduleService';
import { timeToMinutes } from '../utils/scheduleValidation';

// ---------------------------------------------------------------------------
// Get substitution aktif untuk schedule + tanggal tertentu
// ---------------------------------------------------------------------------
export async function getSubstitution(
  scheduleId: string,
  date: string
): Promise<Substitution | null> {
  const { data, error } = await supabase
    .from('substitutions')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('substitution_date', date)
    .is('cancelled_at', null)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

// ---------------------------------------------------------------------------
// Batch get substitutions untuk banyak schedule di 1 tanggal
// ---------------------------------------------------------------------------
export async function getSubstitutionsForDate(
  date: string
): Promise<Substitution[]> {
  const { data, error } = await supabase
    .from('substitutions')
    .select('*')
    .eq('substitution_date', date)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Histori badal untuk admin (dengan filter)
// ---------------------------------------------------------------------------
export async function getSubstitutionHistory(filters?: {
  startDate?: string;
  endDate?: string;
  substituteTeacherName?: string;
  originalTeacherName?: string;
}): Promise<Substitution[]> {
  let query = supabase
    .from('substitutions')
    .select('*, schedule:schedule_id(class_id, subject_name, start_time, end_time, period_number, day)')
    .order('substitution_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.startDate) query = query.gte('substitution_date', filters.startDate);
  if (filters?.endDate) query = query.lte('substitution_date', filters.endDate);
  if (filters?.substituteTeacherName)
    query = query.eq('substitute_teacher_name', filters.substituteTeacherName);
  if (filters?.originalTeacherName)
    query = query.eq('original_teacher_name', filters.originalTeacherName);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as any;
}

// ---------------------------------------------------------------------------
// Payload untuk membuat substitution baru
// ---------------------------------------------------------------------------
export interface CreateSubstitutionPayload {
  scheduleId: string;
  date: string;
  originalTeacherName: string;
  originalTeacherId?: string | null;
  substituteTeacherName: string;    // logged-in teacher (validated server-side)
  substituteTeacherId?: string | null;
  reason: string;
  reasonDetail?: string;
  createdBy: string;
  academicYearId: string;           // dipakai untuk cek overlap
}

// ---------------------------------------------------------------------------
// Buat substitution baru — dengan validasi lengkap
// ---------------------------------------------------------------------------
export async function createSubstitution(
  payload: CreateSubstitutionPayload
): Promise<Substitution> {
  const {
    scheduleId,
    date,
    originalTeacherName,
    originalTeacherId,
    substituteTeacherName,
    substituteTeacherId,
    reason,
    reasonDetail,
    createdBy,
    academicYearId,
  } = payload;

  // VALIDASI 1: Guru pengganti harus berbeda dengan guru asli
  if (substituteTeacherName.trim().toLowerCase() === originalTeacherName.trim().toLowerCase()) {
    throw new Error('Guru pengganti tidak boleh sama dengan guru terjadwal.');
  }

  // VALIDASI 2: Tidak ada substitution duplikat untuk schedule + tanggal ini
  const existing = await getSubstitution(scheduleId, date);
  if (existing) {
    // Kembalikan existing (idempoten) jika substitute-nya sama
    if (
      existing.substitute_teacher_name.trim().toLowerCase() ===
      substituteTeacherName.trim().toLowerCase()
    ) {
      return existing;
    }
    throw new Error(
      `Jadwal ini sudah memiliki guru pengganti (${existing.substitute_teacher_name}) pada tanggal tersebut.`
    );
  }

  // VALIDASI 3: Cek apakah guru pengganti punya jadwal overlapping
  const targetSchedule = await getScheduleById(scheduleId);
  if (!targetSchedule) {
    throw new Error('Jadwal tidak ditemukan atau tidak aktif.');
  }

  if (targetSchedule.status !== 'ACTIVE') {
    throw new Error('Jadwal yang ingin dibadal tidak berstatus aktif.');
  }

  // Ambil jadwal guru pengganti di hari yang sama
  const dayOfDate = getDayFromDateStr(date);
  if (dayOfDate) {
    const substituteSchedules = await getSchedules({
      academicYearId,
      day: dayOfDate,
      teacherName: substituteTeacherName,
      status: 'ACTIVE',
    });

    const targetStart = timeToMinutes(targetSchedule.start_time);
    const targetEnd = timeToMinutes(targetSchedule.end_time);

    for (const sch of substituteSchedules) {
      const schStart = timeToMinutes(sch.start_time);
      const schEnd = timeToMinutes(sch.end_time);
      if (Math.max(targetStart, schStart) < Math.min(targetEnd, schEnd)) {
        throw new Error(
          `Anda memiliki jadwal mengajar pada waktu tersebut (${sch.class_id} - ${sch.subject_name}) sehingga tidak dapat menjadi guru pengganti.`
        );
      }
    }
  }

  // INSERT
  const { data, error } = await supabase
    .from('substitutions')
    .insert([
      {
        schedule_id: scheduleId,
        substitution_date: date,
        original_teacher_name: originalTeacherName,
        original_teacher_id: originalTeacherId || null,
        substitute_teacher_name: substituteTeacherName,
        substitute_teacher_id: substituteTeacherId || null,
        reason,
        reason_detail: reasonDetail || null,
        created_by: createdBy,
      },
    ])
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation gracefully
    if (error.code === '23505') {
      const existing2 = await getSubstitution(scheduleId, date);
      if (existing2) return existing2;
    }
    throw error;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Batalkan substitution (soft cancel)
// ---------------------------------------------------------------------------
export async function cancelSubstitution(id: string): Promise<void> {
  const { error } = await supabase
    .from('substitutions')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .is('cancelled_at', null);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getScheduleById(id: string) {
  const { data, error } = await supabase
    .from('schedule')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

type ScheduleDayKey = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';

function getDayFromDateStr(dateStr: string): ScheduleDayKey | null {
  const d = new Date(dateStr + 'T00:00:00');
  const idx = d.getDay();
  const map: Record<number, ScheduleDayKey> = {
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
  };
  return map[idx] ?? null;
}
