import { supabase } from '../lib/supabase';
import type { Kelas } from '../types';

/**
 * Master kelas.
 *
 * Kelas disimpan sebagai entitas ber-`id`, bukan teks. `tingkat` + `rombel`
 * adalah kunci bisnis, `label` ('1A', '1B', '2A', …) hanya tampilan sehingga
 * boleh diubah kapan saja tanpa memutus relasi apa pun.
 *
 * Tidak di-scope per tahun ajaran: kelas bertahan, yang berganti tiap tahun
 * adalah penempatan siswa dan wali kelasnya.
 */

/**
 * Daftar kelas, terurut tingkat lalu rombel.
 *
 * `includeInactive` dipakai halaman Data Kelas (agar rombel yang ditutup tetap
 * terlihat). Pemakai lain — dropdown, filter, export — cukup memakai yang aktif.
 */
export async function getKelas(options?: { includeInactive?: boolean }): Promise<Kelas[]> {
  let query = supabase
    .from('kelas')
    .select('*')
    .order('tingkat', { ascending: true })
    .order('rombel', { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Kelas[];
}

/**
 * Cari `id` kelas dari labelnya. `null` kalau tidak ada.
 *
 * Dipakai saat MENULIS data yang menyimpan kelas sebagai referensi — jadwal,
 * wali kelas, agenda. Satu query kecil per penulisan; penulisan jarang terjadi,
 * jadi tidak perlu cache yang bisa basi.
 */
export async function findKelasId(label: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('kelas')
    .select('id')
    .eq('label', label)
    .maybeSingle();

  if (error) throw error;
  return (data?.id as string) ?? null;
}

/**
 * Sama seperti `findKelasId`, tetapi melempar kalau kelasnya tidak ada.
 * Untuk jalur penulisan, kelas yang tidak ditemukan adalah kesalahan — bukan
 * kondisi yang boleh lewat diam-diam.
 */
export async function resolveKelasId(label: string): Promise<string> {
  const id = await findKelasId(label);
  if (!id) throw new Error(`Kelas "${label}" tidak ada di master kelas.`);
  return id;
}

/** Tambah rombel baru, mis. tingkat 1 + rombel 'B' → label '1B'. */
export async function addKelas(input: {
  tingkat: number;
  rombel: string;
  label: string;
}): Promise<Kelas> {
  const { data, error } = await supabase
    .from('kelas')
    .insert([
      {
        tingkat: input.tingkat,
        rombel: input.rombel.trim().toUpperCase(),
        label: input.label.trim(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as Kelas;
}

/**
 * Ubah label dan/atau rombel.
 *
 * `tingkat` sengaja tidak bisa diubah: mengubah tingkat berarti mengubah
 * identitas kelas, bukan sekadar namanya.
 */
export async function updateKelas(
  id: string,
  patch: { label?: string; rombel?: string },
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) row.label = patch.label.trim();
  if (patch.rombel !== undefined) row.rombel = patch.rombel.trim().toUpperCase();

  const { error } = await supabase.from('kelas').update(row).eq('id', id);
  if (error) throw error;
}

/**
 * Aktif/nonaktifkan kelas.
 *
 * Kelas yang ditutup TIDAK dihapus — barisnya masih dirujuk riwayat agenda dan
 * jadwal tahun-tahun sebelumnya. Nonaktifkan saja supaya tidak muncul lagi di
 * pilihan, tetapi riwayat lama tetap utuh.
 */
export async function setKelasActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('kelas')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
