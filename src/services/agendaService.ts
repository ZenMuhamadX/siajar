import { supabase } from '../lib/supabase';
import type { Siswa, Guru, GuruKelas, FullAgenda, AgendaKBM, KotakSaran } from '../types';

// ----------------- SISWA SERVICES -----------------
export async function getDaftarSiswa(kelas?: string): Promise<Siswa[]> {
  let query = supabase.from('siswa').select('*').order('nama_siswa', { ascending: true });
  if (kelas) {
    query = query.eq('kelas', kelas);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function addSiswa(nama: string, kelas: string): Promise<Siswa> {
  const { data, error } = await supabase
    .from('siswa')
    .insert([{ nama_siswa: nama.trim(), kelas }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSiswa(id: string, nama: string, kelas: string): Promise<void> {
  const { error } = await supabase
    .from('siswa')
    .update({ nama_siswa: nama.trim(), kelas })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSiswa(id: string): Promise<void> {
  const { error } = await supabase.from('siswa').delete().eq('id', id);
  if (error) throw error;
}

// ----------------- GURU SERVICES -----------------
export async function getDaftarGuru(): Promise<Guru[]> {
  const { data, error } = await supabase
    .from('guru')
    .select('*')
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

export async function updateGuru(id: string, nama: string): Promise<void> {
  const { error } = await supabase
    .from('guru')
    .update({ nama_guru: nama.trim() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteGuru(id: string): Promise<void> {
  const { error } = await supabase.from('guru').delete().eq('id', id);
  if (error) throw error;
}

// ----------------- GURU KELAS SERVICES (PENUGASAN) -----------------
export async function getDaftarGuruKelas(): Promise<GuruKelas[]> {
  const { data, error } = await supabase
    .from('guru_kelas')
    .select('*')
    .order('kelas', { ascending: true });
  if (error) {
    // If table doesn't exist yet, return empty list gracefully
    console.warn('guru_kelas check fallback:', error.message);
    return [];
  }
  return data || [];
}

export async function checkGuruKelas(namaGuru: string, kelas: string): Promise<boolean> {
  if (!namaGuru || !kelas) return false;
  try {
    const { data, error } = await supabase
      .from('guru_kelas')
      .select('id')
      .eq('nama_guru', namaGuru.trim())
      .eq('kelas', kelas.trim())
      .limit(1);

    if (error) {
      console.warn('Gagal cek guru_kelas:', error.message);
      return true; // Fallback allow if table not yet populated/created
    }

    // Check if there are any assignments recorded in the table at all
    const { count } = await supabase.from('guru_kelas').select('*', { count: 'exact', head: true });
    if (count === 0 || count === null) {
      // If table is empty, allow all as normal assignment
      return true;
    }

    return (data && data.length > 0) || false;
  } catch (e) {
    return true;
  }
}

// ----------------- AGENDA SERVICES -----------------
export interface SimpanAgendaPayload {
  agendaId?: string; // Optional for update
  sekolah?: string;
  kelas: string;
  tanggal: string;
  kbm: AgendaKBM[];
  absensi: { siswa_id: string; status: 'S' | 'I' | 'A' }[];
  uraian_kejadian?: string;
}

export async function simpanAgenda(payload: SimpanAgendaPayload): Promise<{ id: string }> {
  const { agendaId, sekolah = 'SDIT AS-SYIFA', kelas, tanggal, kbm, absensi, uraian_kejadian } = payload;

  let currentAgendaId = agendaId;

  if (currentAgendaId) {
    // 1. Update existing header
    const { error: headerErr } = await supabase
      .from('agenda_header')
      .update({ sekolah, kelas, tanggal })
      .eq('id', currentAgendaId);
    if (headerErr) throw headerErr;

    // 2. Delete existing child records
    await supabase.from('agenda_kbm').delete().eq('agenda_id', currentAgendaId);
    await supabase.from('agenda_absensi').delete().eq('agenda_id', currentAgendaId);
    await supabase.from('agenda_kejadian').delete().eq('agenda_id', currentAgendaId);
  } else {
    // 1. Insert header
    const { data: headerData, error: headerErr } = await supabase
      .from('agenda_header')
      .insert([{ sekolah, kelas, tanggal }])
      .select()
      .single();
    if (headerErr) throw headerErr;
    currentAgendaId = headerData.id;
  }

  // 2. Insert KBM rows
  if (kbm.length > 0 && currentAgendaId) {
    const kbmRows = kbm.map((item) => ({
      agenda_id: currentAgendaId,
      jam_ke: item.jam_ke,
      nama_guru: item.nama_guru,
      mapel: item.mapel,
      materi: item.materi,
      tugas_pr: item.tugas_pr || null,
      is_badal: Boolean(item.is_badal),
    }));
    const { error: kbmErr } = await supabase.from('agenda_kbm').insert(kbmRows);
    if (kbmErr) throw kbmErr;
  }

  // 3. Insert Absensi rows
  if (absensi.length > 0 && currentAgendaId) {
    const absensiRows = absensi.map((a) => ({
      agenda_id: currentAgendaId,
      siswa_id: a.siswa_id,
      status: a.status,
    }));
    const { error: absensiErr } = await supabase.from('agenda_absensi').insert(absensiRows);
    if (absensiErr) throw absensiErr;
  }

  // 4. Insert Kejadian if present
  if (uraian_kejadian && uraian_kejadian.trim() && currentAgendaId) {
    const { error: kejadianErr } = await supabase
      .from('agenda_kejadian')
      .insert([{ agenda_id: currentAgendaId, uraian_kejadian: uraian_kejadian.trim() }]);
    if (kejadianErr) throw kejadianErr;
  }

  return { id: currentAgendaId! };
}

export async function getRekapAgenda(filters?: {
  kelas?: string;
  tanggal?: string;
  nama_guru?: string;
}): Promise<FullAgenda[]> {
  let query = supabase
    .from('agenda_header')
    .select(`
      *,
      agenda_kbm (*),
      agenda_absensi (
        *,
        siswa:siswa_id (*)
      ),
      agenda_kejadian (*)
    `)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.kelas && filters.kelas !== 'SEMUA') {
    query = query.eq('kelas', filters.kelas);
  }
  if (filters?.tanggal) {
    query = query.eq('tanggal', filters.tanggal);
  }

  const { data, error } = await query;
  if (error) throw error;

  let results: FullAgenda[] = (data || []).map((item: any) => ({
    header: {
      id: item.id,
      sekolah: item.sekolah,
      kelas: item.kelas,
      tanggal: item.tanggal,
      created_at: item.created_at,
    },
    kbm: (item.agenda_kbm || []).sort((a: any, b: any) =>
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
  }));

  // Filter based on nama_guru if specified (only include agendas that have KBM rows for this teacher)
  if (filters?.nama_guru && filters.nama_guru !== 'Administrator') {
    const teacherName = filters.nama_guru.trim();
    results = results.filter((agenda) =>
      agenda.kbm.some((k) => k.nama_guru === teacherName)
    );
  }

  return results;
}

export async function deleteAgenda(agendaId: string): Promise<void> {
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
