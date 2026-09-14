import { supabase } from '../lib/supabase';
import type {
  Siswa,
  Guru,
  MataPelajaran,
  GuruKelas,
  FullAgenda,
  AgendaKBM,
  KotakSaran,
} from '../types';

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

export async function addGuru(nama: string, kelasList?: string[]): Promise<Guru> {
  const { data, error } = await supabase
    .from('guru')
    .insert([{ nama_guru: nama.trim() }])
    .select()
    .single();
  if (error) throw error;

  if (kelasList && kelasList.length > 0) {
    const rows = kelasList.map((k) => ({
      nama_guru: nama.trim(),
      kelas: k,
    }));
    await supabase.from('guru_kelas').insert(rows);
  }

  return data;
}

export async function updateGuru(
  id: string,
  namaLama: string,
  namaBaru: string,
  kelasList?: string[]
): Promise<void> {
  const { error } = await supabase
    .from('guru')
    .update({ nama_guru: namaBaru.trim() })
    .eq('id', id);
  if (error) throw error;

  // Sync guru_kelas
  await supabase.from('guru_kelas').delete().eq('nama_guru', namaLama.trim());
  if (kelasList && kelasList.length > 0) {
    const rows = kelasList.map((k) => ({
      nama_guru: namaBaru.trim(),
      kelas: k,
    }));
    await supabase.from('guru_kelas').insert(rows);
  }
}

export async function deleteGuru(id: string, nama: string): Promise<void> {
  const { error } = await supabase.from('guru').delete().eq('id', id);
  if (error) throw error;

  // Hapus relasi kelas
  await supabase.from('guru_kelas').delete().eq('nama_guru', nama.trim());
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

export async function addMapel(namaMapel: string): Promise<MataPelajaran> {
  const { data, error } = await supabase
    .from('mapel')
    .insert([{ nama_mapel: namaMapel.trim() }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMapel(id: string, namaMapel: string): Promise<void> {
  const { error } = await supabase
    .from('mapel')
    .update({ nama_mapel: namaMapel.trim() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMapel(id: string): Promise<void> {
  const { error } = await supabase.from('mapel').delete().eq('id', id);
  if (error) throw error;
}

// ----------------- GURU KELAS SERVICES (PENUGASAN) -----------------
export async function getDaftarGuruKelas(): Promise<GuruKelas[]> {
  const { data, error } = await supabase
    .from('guru_kelas')
    .select('*')
    .order('kelas', { ascending: true });
  if (error) {
    console.warn('guru_kelas check fallback:', error.message);
    return [];
  }
  return data || [];
}

export async function getKelasByGuru(namaGuru: string): Promise<string[]> {
  if (!namaGuru) return [];
  try {
    const { data, error } = await supabase
      .from('guru_kelas')
      .select('kelas')
      .eq('nama_guru', namaGuru.trim());
    if (error) return [];
    return (data || []).map((d) => d.kelas);
  } catch (e) {
    return [];
  }
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
      return true;
    }

    const { count } = await supabase.from('guru_kelas').select('*', { count: 'exact', head: true });
    if (count === 0 || count === null) {
      return true;
    }

    return (data && data.length > 0) || false;
  } catch (e) {
    return true;
  }
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
    sekolah = 'SDIT AS-SYIFA',
    kelas,
    tanggal,
    kbm,
    absensi,
    uraian_kejadian,
  } = payload;

  let currentAgendaId = agendaId;

  const headerPayload: any = { sekolah, kelas, tanggal };
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

export async function getRekapAgenda(filters?: {
  kelas?: string;
  tanggal?: string;
  startDate?: string;
  endDate?: string;
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
      agenda_kejadian (*),
      agenda_evidence (*)
    `)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.kelas && filters.kelas !== 'SEMUA') {
    query = query.eq('kelas', filters.kelas);
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

  const { data, error } = await query;
  if (error) throw error;

  let results: FullAgenda[] = (data || []).map((item: any) => {
    const rawEvidence = Array.isArray(item.agenda_evidence)
      ? item.agenda_evidence[0]
      : item.agenda_evidence;

    return {
      header: {
        id: item.id,
        sekolah: item.sekolah,
        kelas: item.kelas,
        tanggal: item.tanggal,
        schedule_id: item.schedule_id || null,
        actual_teacher_name: item.actual_teacher_name || null,
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
      evidence: rawEvidence
        ? {
            id: rawEvidence.id,
            agenda_id: rawEvidence.agenda_id,
            storage_path: rawEvidence.storage_path,
            file_name: rawEvidence.file_name,
            file_size: rawEvidence.file_size,
            mime_type: rawEvidence.mime_type,
            uploaded_at: rawEvidence.uploaded_at,
            created_at: rawEvidence.created_at,
          }
        : null,
    };
  });

  if (filters?.nama_guru && filters.nama_guru !== 'Administrator') {
    const teacherName = filters.nama_guru.trim();
    results = results.filter((agenda) =>
      agenda.kbm.some((k) => k.nama_guru === teacherName)
    );
  }

  return results;
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
