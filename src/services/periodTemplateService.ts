import { supabase } from '../lib/supabase';
import type { PeriodTemplate } from '../types/schedule';

const LOCAL_KEY = 'siajar_period_templates_cache';

function getLocal(): PeriodTemplate[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(list: PeriodTemplate[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to cache period_templates:', e);
  }
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function getPeriodTemplates(
  academicYearId: string,
  onlyActive = false
): Promise<PeriodTemplate[]> {
  try {
    let query = supabase
      .from('period_templates')
      .select('*')
      .eq('academic_year_id', academicYearId)
      .order('period_number', { ascending: true });

    if (onlyActive) query = query.eq('is_active', true);

    const { data, error } = await query;

    if (error) {
      console.warn('period_templates Supabase error, fallback to local:', error.message);
      return filterLocal(academicYearId, onlyActive);
    }

    const result = (data as PeriodTemplate[]) || [];
    // Merge into local cache
    const local = getLocal().filter((l) => l.academic_year_id !== academicYearId);
    saveLocal([...local, ...result]);
    return result;
  } catch (e) {
    console.warn('Network error getPeriodTemplates, fallback local:', e);
    return filterLocal(academicYearId, onlyActive);
  }
}

function filterLocal(academicYearId: string, onlyActive: boolean): PeriodTemplate[] {
  let list = getLocal().filter((t) => t.academic_year_id === academicYearId);
  if (onlyActive) list = list.filter((t) => t.is_active);
  return list.sort((a, b) => a.period_number - b.period_number);
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createPeriodTemplate(
  payload: Omit<PeriodTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<PeriodTemplate> {
  const newRecord: PeriodTemplate = {
    ...payload,
    id: crypto.randomUUID ? crypto.randomUUID() : `pt-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('period_templates')
      .insert([payload])
      .select()
      .single();

    if (error) {
      // Duplicate period_number in same AY
      if (error.code === '23505') {
        throw new Error(`JP ${payload.period_number} sudah ada untuk tahun ajaran ini.`);
      }
      console.warn('Supabase insert period_template error, storing locally:', error.message);
      const local = getLocal();
      local.push(newRecord);
      saveLocal(local);
      return newRecord;
    }

    const local = getLocal();
    local.push(data as PeriodTemplate);
    saveLocal(local);
    return data as PeriodTemplate;
  } catch (e: any) {
    if (e?.message?.includes('JP')) throw e; // Re-throw validation errors
    const local = getLocal();
    local.push(newRecord);
    saveLocal(local);
    return newRecord;
  }
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updatePeriodTemplate(
  id: string,
  payload: Partial<Omit<PeriodTemplate, 'id' | 'academic_year_id' | 'created_at'>>
): Promise<PeriodTemplate> {
  const updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('period_templates')
      .update({ ...payload, updated_at })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Nomor JP tersebut sudah digunakan untuk tahun ajaran ini.`);
      }
      console.warn('Supabase update period_template error, updating local:', error.message);
      const local = getLocal();
      const idx = local.findIndex((t) => t.id === id);
      if (idx >= 0) local[idx] = { ...local[idx], ...payload, updated_at };
      saveLocal(local);
      return local[idx];
    }

    const local = getLocal();
    const idx = local.findIndex((t) => t.id === id);
    if (idx >= 0) local[idx] = data as PeriodTemplate;
    saveLocal(local);
    return data as PeriodTemplate;
  } catch (e: any) {
    if (e?.message) throw e;
    const local = getLocal();
    const idx = local.findIndex((t) => t.id === id);
    if (idx >= 0) local[idx] = { ...local[idx], ...payload, updated_at };
    saveLocal(local);
    return local[idx];
  }
}

// ---------------------------------------------------------------------------
// TOGGLE ACTIVE
// ---------------------------------------------------------------------------

export async function togglePeriodTemplateActive(
  id: string,
  isActive: boolean
): Promise<void> {
  try {
    const { error } = await supabase
      .from('period_templates')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.warn('Supabase togglePeriodTemplateActive error, updating local:', e);
  }
  const local = getLocal();
  const target = local.find((t) => t.id === id);
  if (target) {
    target.is_active = isActive;
    saveLocal(local);
  }
}

// ---------------------------------------------------------------------------
// DELETE — blocked if used by any schedule
// ---------------------------------------------------------------------------

export async function deletePeriodTemplate(id: string): Promise<void> {
  // Check if this JP is referenced by any schedule
  const used = await isPeriodTemplateUsed(id);
  if (used) {
    throw new Error(
      'JP ini sudah digunakan pada jadwal dan tidak dapat dihapus. Nonaktifkan JP jika tidak ingin digunakan lagi.'
    );
  }

  try {
    const { error } = await supabase.from('period_templates').delete().eq('id', id);
    if (error) throw error;
  } catch (e: any) {
    if (e?.message?.includes('digunakan')) throw e;
    console.warn('Supabase delete period_template error, removing from local:', e);
  }

  const local = getLocal().filter((t) => t.id !== id);
  saveLocal(local);
}

// ---------------------------------------------------------------------------
// HELPER: check if a period_template is referenced by any schedule
// ---------------------------------------------------------------------------

export async function isPeriodTemplateUsed(id: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('schedule')
      .select('id', { count: 'exact', head: true })
      .eq('period_template_id', id);

    if (error) {
      // If column doesn't exist yet (migration not run), treat as safe
      console.warn('isPeriodTemplateUsed check error:', error.message);
      return false;
    }
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}
