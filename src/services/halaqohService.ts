import { supabase } from '../lib/supabase';
import type {
  Halaqoh,
  HalaqohTerdaftar,
  AnggotaHalaqoh,
  SiswaTerdaftar,
} from '../types';

/**
 * Halaqoh — pembagian siswa di dalam satu kelas untuk mapel berkelompok (Ummi).
 *
 * Tiga hal yang membentuk berkas ini:
 *
 * 1. HALAQOH MILIK KELAS, bukan tahun ajaran. Baris `halaqoh` (nama + urutan)
 *    bertahan antar tahun; yang berganti tiap tahun adalah SIAPA yang ada di
 *    dalamnya (tabel `siswa_halaqoh`). Sama persis dengan pola `kelas` vs
 *    `siswa_kelas`. Karena itu `getHalaqohByKelas` tidak butuh tahun ajaran,
 *    sedangkan `getAnggota` butuh.
 *
 * 2. KENGGOTAAN PER TAHUN AJARAN. Satu siswa hanya boleh ada di SATU halaqoh
 *    per tahun ajaran (ditegakkan UNIQUE `uq_siswa_halaqoh_per_ay`). Berpindah
 *    halaqoh = update barisnya, bukan insert baru — kalau tidak, unique
 *    constraint yang menolak dan pesannya membingungkan pengguna.
 *
 * 3. KELENGKAPAN ITU PENTING. Kalau seorang siswa kelas belum masuk halaqoh
 *    mana pun, absensi dan jurnalnya akan bolong di mapel Ummi. Karena itu ada
 *    `getSiswaBelumBerhalaqoh` sebagai penjaga, bukan sekadar laporan.
 */

// ----------------- HALAQOH (daftar kelompok) -----------------

/**
 * Daftar halaqoh milik satu kelas, terurut.
 *
 * Tanpa tahun ajaran: halaqoh-nya memang milik kelas, bukan tahun. Yang
 * berubah tiap tahun hanya anggotanya.
 */
export async function getHalaqohByKelas(kelasId: string): Promise<Halaqoh[]> {
  const { data, error } = await supabase
    .from('halaqoh')
    .select('*')
    .eq('kelas_id', kelasId)
    .order('urutan', { ascending: true })
    .order('nama', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Halaqoh[];
}

/**
 * Semua halaqoh beserta label kelasnya — untuk ringkasan lintas kelas.
 *
 * Label kelas diratakan ke string di batas service ini. Query Supabase
 * `.select('kelas:kelas_id (label)')` mengembalikan OBJEK BERSARANG
 * (`{ label }`), bukan string. Kalau objek itu bocor ke komponen, React
 * melempar "Objects are not valid as a React child". Jadi perataan terjadi di
 * sini dan tidak boleh dilewati.
 */
export async function getSemuaHalaqoh(): Promise<HalaqohTerdaftar[]> {
  const { data, error } = await supabase
    .from('halaqoh')
    .select('*, kelas:kelas_id (label)')
    .order('kelas_id', { ascending: true })
    .order('urutan', { ascending: true });

  if (error) throw error;

  type Row = Halaqoh & { kelas?: { label?: string } | null };
  return ((data ?? []) as Row[]).map((row) => ({
    ...row,
    kelas: row.kelas?.label ?? '',
  }));
}

/**
 * Buat halaqoh baru di sebuah kelas.
 *
 * `urutan` dihitung otomatis (setelah yang terakhir), bukan diminta ke pengguna:
 * nomor urut bukan keputusan yang perlu diambil, dan menanyakan hanya menambah
 * satu isian yang bisa salah. Nama tetap dari pengguna karena itulah yang
 * dikenali guru di lapangan ('Halaqoh 1', 'Kelompok A', nama guru pengampu…).
 */
export async function addHalaqoh(input: {
  kelasId: string;
  nama: string;
}): Promise<Halaqoh> {
  const nama = input.nama.trim();
  if (!nama) throw new Error('Nama halaqoh tidak boleh kosong.');

  const { data: existing, error: readErr } = await supabase
    .from('halaqoh')
    .select('urutan')
    .eq('kelas_id', input.kelasId)
    .order('urutan', { ascending: false })
    .limit(1);
  if (readErr) throw readErr;

  const urutan = ((existing?.[0]?.urutan as number | undefined) ?? 0) + 1;

  const { data, error } = await supabase
    .from('halaqoh')
    .insert([{ kelas_id: input.kelasId, nama, urutan }])
    .select()
    .single();

  if (error) {
    // 23505 = unique violation. Satu-satunya unique di tabel ini adalah
    // (kelas_id, nama), jadi pesannya bisa langsung ditulis untuk pengguna.
    if (error.code === '23505') {
      throw new Error(`Halaqoh "${nama}" sudah ada di kelas ini.`);
    }
    throw error;
  }
  return data as Halaqoh;
}

/** Ubah nama dan/atau urutan halaqoh. */
export async function updateHalaqoh(
  id: string,
  patch: { nama?: string; urutan?: number },
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nama !== undefined) {
    const nama = patch.nama.trim();
    if (!nama) throw new Error('Nama halaqoh tidak boleh kosong.');
    row.nama = nama;
  }
  if (patch.urutan !== undefined) row.urutan = patch.urutan;

  const { error } = await supabase.from('halaqoh').update(row).eq('id', id);
  if (error) {
    if (error.code === '23505') {
      throw new Error('Sudah ada halaqoh bernama sama di kelas ini.');
    }
    throw error;
  }
}

/**
 * Hapus halaqoh.
 *
 * PERINGATAN: `schedule.halaqoh_id` dan `agenda_kbm.halaqoh_id` memakai
 * ON DELETE CASCADE. Menghapus halaqoh ikut menghapus baris JADWAL yang
 * menunjuknya, dan bagian jurnal yang sudah tertulis untuk halaqoh itu.
 *
 * Itu sebabnya pemanggil WAJIB memeriksa `countJadwalHalaqoh` lebih dulu dan
 * meminta konfirmasi yang menyebut jumlah baris jadwal yang akan ikut hilang —
 * bukan sekadar "hapus kelompok ini?". Kehilangan jadwal tanpa disadari jauh
 * lebih mahal daripada satu dialog tambahan.
 */
export async function deleteHalaqoh(id: string): Promise<void> {
  const { error } = await supabase.from('halaqoh').delete().eq('id', id);
  if (error) throw error;
}

/** Berapa baris jadwal yang menunjuk halaqoh ini (ikut terhapus bila di-CASCADE). */
export async function countJadwalHalaqoh(halaqohId: string): Promise<number> {
  const { count, error } = await supabase
    .from('schedule')
    .select('id', { count: 'exact', head: true })
    .eq('halaqoh_id', halaqohId);

  if (error) throw error;
  return count ?? 0;
}

// ----------------- KEANGGOTAAN (siapa ada di halaqoh mana) -----------------

/**
 * Anggota satu halaqoh pada satu tahun ajaran.
 *
 * Nama dan NIS siswa dibaca lewat join, lalu diratakan ke bentuk datar. Sama
 * seperti pola `kelas:kelas_id (label)` di service lain — join Supabase
 * mengembalikan objek bersarang, dan bentuk bersarang itu tidak boleh sampai
 * ke komponen.
 */
export async function getAnggotaHalaqoh(
  halaqohId: string,
  academicYearId: string,
): Promise<AnggotaHalaqoh[]> {
  const { data, error } = await supabase
    .from('siswa_halaqoh')
    .select('id, siswa_id, halaqoh_id, siswa:siswa_id (nama_siswa, nis)')
    .eq('halaqoh_id', halaqohId)
    .eq('academic_year_id', academicYearId);

  if (error) throw error;

  type Row = {
    id: string;
    siswa_id: string;
    halaqoh_id: string;
    siswa?: { nama_siswa?: string; nis?: string | null } | null;
  };

  const anggota = ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    siswa_id: row.siswa_id,
    halaqoh_id: row.halaqoh_id,
    nama_siswa: row.siswa?.nama_siswa ?? '',
    nis: row.siswa?.nis ?? null,
  }));

  anggota.sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa, 'id'));
  return anggota;
}

/**
 * Semua siswa dari beberapa halaqoh sekaligus, dikelompokkan per halaqoh.
 *
 * Dipakai halaman Halaqoh agar cukup SATU query untuk seluruh kelas, bukan satu
 * query per kelompok. Kelas dengan 6 halaqoh berarti 6 perjalanan bolak-balik ke
 * server yang tidak perlu — dan pada koneksi sekolah itu terasa.
 */
export async function getAnggotaSemuaHalaqoh(
  halaqohIds: string[],
  academicYearId: string,
): Promise<Record<string, AnggotaHalaqoh[]>> {
  if (halaqohIds.length === 0) return {};

  const { data, error } = await supabase
    .from('siswa_halaqoh')
    .select('id, siswa_id, halaqoh_id, siswa:siswa_id (nama_siswa, nis)')
    .in('halaqoh_id', halaqohIds)
    .eq('academic_year_id', academicYearId);

  if (error) throw error;

  type Row = {
    id: string;
    siswa_id: string;
    halaqoh_id: string;
    siswa?: { nama_siswa?: string; nis?: string | null } | null;
  };

  const hasil: Record<string, AnggotaHalaqoh[]> = {};
  for (const id of halaqohIds) hasil[id] = [];

  for (const row of (data ?? []) as Row[]) {
    (hasil[row.halaqoh_id] ??= []).push({
      id: row.id,
      siswa_id: row.siswa_id,
      halaqoh_id: row.halaqoh_id,
      nama_siswa: row.siswa?.nama_siswa ?? '',
      nis: row.siswa?.nis ?? null,
    });
  }

  for (const id of halaqohIds) {
    hasil[id].sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa, 'id'));
  }
  return hasil;
}

/**
 * Siswa sebuah kelas yang BELUM masuk halaqoh mana pun tahun ini.
 *
 * Ini penjaga kelengkapan, bukan laporan. Siswa yang tidak masuk kelompok mana
 * pun tidak akan muncul di absensi mapel Ummi dan jurnalnya bolong. Halaman
 * Halaqoh menampilkan daftar ini menonjol supaya ketahuan sebelum jadwal
 * dipakai mengajar.
 *
 * Siswa yang berstatus bukan AKTIF tahun itu (pindah/nonaktif) sengaja
 * DIBUANG: mereka memang tidak perlu dibagi ke halaqoh.
 */
export async function getSiswaBelumBerhalaqoh(
  kelasId: string,
  academicYearId: string,
): Promise<SiswaTerdaftar[]> {
  const { data: penempatan, error: pErr } = await supabase
    .from('siswa_kelas')
    .select(
      'kelas_id, academic_year_id, status, ' +
        'siswa:siswa_id (id, nama_siswa, nis, status), ' +
        'kelas:kelas_id (label)',
    )
    .eq('kelas_id', kelasId)
    .eq('academic_year_id', academicYearId);
  if (pErr) throw pErr;

  // Keanggotaan dibatasi ke halaqoh MILIK KELAS INI.
  //
  // Mengambil seluruh keanggotaan sekolah akan tetap benar hasilnya (siswa kelas
  // ini hanya bisa ada di halaqoh kelasnya sendiri), tetapi biayanya tumbuh
  // seiring jumlah halaqoh di seluruh sekolah — dan daftar ini dijalankan setiap
  // kali halaman dibuka. Satu filter `in` jauh lebih murah.
  const { data: halaqohKelas, error: hErr } = await supabase
    .from('halaqoh')
    .select('id')
    .eq('kelas_id', kelasId);
  if (hErr) throw hErr;

  const halaqohIds = ((halaqohKelas ?? []) as { id: string }[]).map((h) => h.id);

  const sudahTerdaftar = new Set<string>();
  if (halaqohIds.length > 0) {
    const { data: anggota, error: aErr } = await supabase
      .from('siswa_halaqoh')
      .select('siswa_id')
      .in('halaqoh_id', halaqohIds)
      .eq('academic_year_id', academicYearId);
    if (aErr) throw aErr;

    for (const r of (anggota ?? []) as { siswa_id: string }[]) {
      sudahTerdaftar.add(r.siswa_id);
    }
  }

  type Row = {
    status: string;
    kelas?: { label?: string } | null;
    siswa?: {
      id?: string;
      nama_siswa?: string;
      nis?: string | null;
      status?: string;
    } | null;
  };

  const hasil: SiswaTerdaftar[] = [];
  for (const row of (penempatan ?? []) as unknown as Row[]) {
    const s = row.siswa;
    if (!s?.id) continue;
    // Bukan AKTIF tahun ini → tidak perlu dibagi ke halaqoh.
    if (row.status !== 'AKTIF') continue;
    if (sudahTerdaftar.has(s.id)) continue;

    hasil.push({
      id: s.id,
      nama_siswa: s.nama_siswa ?? '',
      nis: s.nis ?? null,
      status: (s.status ?? 'AKTIF') as SiswaTerdaftar['status'],
      kelas: row.kelas?.label ?? '',
      kelas_id: kelasId,
      academic_year_id: academicYearId,
    });
  }

  hasil.sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa, 'id'));
  return hasil;
}

/**
 * Masukkan / pindahkan satu siswa ke sebuah halaqoh.
 *
 * Memakai UPSERT pada `(siswa_id, academic_year_id)`, bukan INSERT biasa.
 * Alasannya penting: memindahkan siswa dari Halaqoh 1 ke Halaqoh 2 BUKAN
 * penambahan baris baru — unique constraint menolak baris kedua, dan pengguna
 * akan melihat error yang membingungkan padahal yang ia lakukan wajar. Dengan
 * upsert, "pindah" dan "masuk" menjadi satu operasi yang sama.
 */
export async function setSiswaHalaqoh(input: {
  siswaId: string;
  halaqohId: string;
  academicYearId: string;
}): Promise<void> {
  const { error } = await supabase.from('siswa_halaqoh').upsert(
    {
      siswa_id: input.siswaId,
      halaqoh_id: input.halaqohId,
      academic_year_id: input.academicYearId,
    },
    { onConflict: 'siswa_id,academic_year_id' },
  );
  if (error) throw error;
}

/**
 * Pindahkan beberapa siswa sekaligus ke satu halaqoh.
 *
 * Satu upsert berisi banyak baris, bukan perulangan: kalau salah satu gagal,
 * tidak ada yang setengah jadi. Dipakai tombol "pindahkan terpilih" di halaman.
 */
export async function setBanyakSiswaHalaqoh(
  siswaIds: string[],
  halaqohId: string,
  academicYearId: string,
): Promise<void> {
  if (siswaIds.length === 0) return;

  const rows = siswaIds.map((siswaId) => ({
    siswa_id: siswaId,
    halaqoh_id: halaqohId,
    academic_year_id: academicYearId,
  }));

  const { error } = await supabase
    .from('siswa_halaqoh')
    .upsert(rows, { onConflict: 'siswa_id,academic_year_id' });
  if (error) throw error;
}

/**
 * Keluarkan siswa dari halaqohnya (tanpa memasukkannya ke kelompok lain).
 *
 * Berbeda dari `setSiswaHalaqoh`: yang ini MENGHAPUS baris keanggotaannya,
 * sehingga siswa kembali muncul di daftar "belum berhalaqoh". Dipakai saat
 * pembagian diulang atau seorang siswa salah masuk kelompok.
 */
export async function keluarkanSiswaDariHalaqoh(
  siswaId: string,
  academicYearId: string,
): Promise<void> {
  const { error } = await supabase
    .from('siswa_halaqoh')
    .delete()
    .eq('siswa_id', siswaId)
    .eq('academic_year_id', academicYearId);
  if (error) throw error;
}

/**
 * Berapa anggota tiap halaqoh — untuk lencana jumlah di daftar kelompok.
 *
 * Dipisah dari `getAnggotaSemuaHalaqoh` karena halaman daftar hanya butuh
 * angkanya, bukan seluruh daftar nama.
 */
export async function countAnggotaPerHalaqoh(
  halaqohIds: string[],
  academicYearId: string,
): Promise<Record<string, number>> {
  const hasil: Record<string, number> = {};
  for (const id of halaqohIds) hasil[id] = 0;
  if (halaqohIds.length === 0) return hasil;

  const { data, error } = await supabase
    .from('siswa_halaqoh')
    .select('halaqoh_id')
    .in('halaqoh_id', halaqohIds)
    .eq('academic_year_id', academicYearId);
  if (error) throw error;

  for (const row of (data ?? []) as { halaqoh_id: string }[]) {
    hasil[row.halaqoh_id] = (hasil[row.halaqoh_id] ?? 0) + 1;
  }
  return hasil;
}
