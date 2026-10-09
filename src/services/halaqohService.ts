import { supabase } from '../lib/supabase';
import type {
  Halaqoh,
  HalaqohTerdaftar,
  AnggotaHalaqoh,
  SiswaTerdaftar,
} from '../types';

/**
 * Halaqoh — kelompok belajar lintas kelas untuk mapel berkelompok (Ummi).
 *
 * Empat hal yang membentuk berkas ini:
 *
 * 1. HALAQOH PUNYA DAFTAR KELAS SUMBER, bukan satu kelas. Daftar itu (tabel
 *    `halaqoh_kelas`) adalah KOLAM KANDIDAT: saat mengisi anggota, siswa yang
 *    ditawarkan hanya yang berasal dari kelas-kelas itu. Satu kelas boleh
 *    menyuplai beberapa halaqoh, dan satu halaqoh boleh menarik dari beberapa
 *    kelas — itulah inti revisi "halaqoh lintas kelas".
 *
 * 2. HALAQOH MILIK SATU TAHUN AJARAN. Komposisinya tidak diwariskan saat naik
 *    kelas (siswa kelas 4 naik ke kelas 5), jadi tiap tahun ajaran halaqoh
 *    disusun ulang. Barisnya bertahan, tetapi hanya di dalam tahun ajarannya.
 *
 * 3. KEANGGOTAAN PER SISWA, PER TAHUN AJARAN. Anggota TIDAK diturunkan otomatis
 *    dari kelas sumber — ia dipilih satu per satu. Satu siswa hanya boleh ada di
 *    SATU halaqoh per tahun ajaran (`uq_siswa_halaqoh_per_ay`). Berpindah halaqoh
 *    = update barisnya, bukan insert baru.
 *
 * 4. KELAS SISWA DIBACA DARI `siswa_kelas`, BUKAN DARI HALAQOH. Karena satu
 *    halaqoh mencakup beberapa kelas, kelas tiap anggota harus dibaca per siswa.
 */

// ----------------- HALAQOH (daftar kelompok) -----------------

/** Bentuk baris hasil join `halaqoh` + kelas sumbernya. */
type RowHalaqoh = Halaqoh & {
  kelas_sumber?: { kelas?: { id?: string; label?: string } | null }[] | null;
};

/**
 * Ratakan baris hasil join ke `HalaqohTerdaftar`.
 *
 * Sama seperti pola lain di proyek ini: join Supabase mengembalikan objek
 * bersarang, dan bentuk bersarang itu tidak boleh sampai ke komponen React.
 */
function mapHalaqoh(row: RowHalaqoh): HalaqohTerdaftar {
  const sumber = (row.kelas_sumber ?? [])
    .map((s) => s.kelas)
    .filter((k): k is { id: string; label: string } => Boolean(k?.id));
  return {
    id: row.id,
    academic_year_id: row.academic_year_id,
    nama: row.nama,
    urutan: row.urutan,
    created_at: row.created_at,
    updated_at: row.updated_at,
    kelas_ids: sumber.map((k) => k.id),
    kelas: sumber.map((k) => k.label),
  };
}

/** Select bersama: halaqoh + kelas sumbernya (id & label). */
const HALAQOH_SELECT = '*, kelas_sumber:halaqoh_kelas (kelas:kelas_id (id, label))';

/**
 * Daftar halaqoh milik satu tahun ajaran, terurut, beserta kelas sumbernya.
 */
export async function getHalaqohByTahunAjaran(
  academicYearId: string,
): Promise<HalaqohTerdaftar[]> {
  const { data, error } = await supabase
    .from('halaqoh')
    .select(HALAQOH_SELECT)
    .eq('academic_year_id', academicYearId)
    .order('urutan', { ascending: true })
    .order('nama', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as RowHalaqoh[]).map(mapHalaqoh);
}

/**
 * Halaqoh yang KELAS SUMBER-nya memuat kelas ini — untuk kolam kandidat.
 *
 * Disaring di aplikasi, bukan lewat query, supaya setiap halaqoh tetap membawa
 * SELURUH kelas sumbernya. Kalau penyaringan dilakukan di query (inner join),
 * `kelas_sumber` hanya berisi kelas yang cocok, dan daftar kelas sumber sebuah
 * halaqoh jadi tidak lengkap.
 */
export async function getHalaqohByKelas(
  kelasId: string,
  academicYearId: string,
): Promise<HalaqohTerdaftar[]> {
  const semua = await getHalaqohByTahunAjaran(academicYearId);
  return semua.filter((h) => h.kelas_ids.includes(kelasId));
}

/** Id kelas sumber sebuah halaqoh (tanpa label). */
export async function getKelasSumberIds(halaqohId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('halaqoh_kelas')
    .select('kelas_id')
    .eq('halaqoh_id', halaqohId);
  if (error) throw error;
  return ((data ?? []) as { kelas_id: string }[]).map((r) => r.kelas_id);
}

/** Kelas sumber sebuah halaqoh, dengan label untuk tampilan. */
export async function getKelasSumberHalaqoh(
  halaqohId: string,
): Promise<{ id: string; label: string }[]> {
  const { data, error } = await supabase
    .from('halaqoh_kelas')
    .select('kelas_id, kelas:kelas_id (id, label)')
    .eq('halaqoh_id', halaqohId);
  if (error) throw error;

  type Row = { kelas_id: string; kelas?: { id?: string; label?: string } | null };
  const hasil = ((data ?? []) as Row[])
    .map((r) => ({ id: r.kelas?.id ?? r.kelas_id, label: r.kelas?.label ?? '' }))
    .filter((k) => k.id);
  hasil.sort((a, b) => a.label.localeCompare(b.label, 'id'));
  return hasil;
}

/**
 * Id semua halaqoh yang KELAS SUMBER-nya memuat kelas ini (semua tahun ajaran).
 *
 * Dipakai filter laporan: sesi halaqoh tidak punya `kelas_id`, jadi agar muncul
 * di rekap kelas X, penyaringan harus menyertakan halaqoh yang mencakup X.
 */
export async function getHalaqohIdsByKelas(kelasId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('halaqoh_kelas')
    .select('halaqoh_id')
    .eq('kelas_id', kelasId);
  if (error) throw error;
  return [...new Set(((data ?? []) as { halaqoh_id: string }[]).map((r) => r.halaqoh_id))];
}

/**
 * Peta halaqoh → label kelas sumbernya, untuk SELURUH halaqoh.
 *
 * Dipakai lapisan rekap: satu sesi halaqoh harus muncul di rekap tiap kelas
 * sumbernya. View-model laporan sengaja murni (tidak menyentuh DB), jadi peta
 * ini disiapkan di sini lalu diteruskan sebagai data.
 */
export async function getKelasSumberMap(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('halaqoh_kelas')
    .select('halaqoh_id, kelas:kelas_id (label)');
  if (error) throw error;

  type Row = { halaqoh_id: string; kelas?: { label?: string } | null };
  const map: Record<string, string[]> = {};
  for (const r of (data ?? []) as Row[]) {
    const label = r.kelas?.label;
    if (!label) continue;
    (map[r.halaqoh_id] ??= []).push(label);
  }
  return map;
}

/**
 * Buat halaqoh baru di sebuah tahun ajaran, beserta kelas sumbernya.
 *
 * `urutan` dihitung otomatis (setelah yang terakhir) — nomor urut bukan
 * keputusan yang perlu diambil pengguna. Nama tetap dari pengguna karena itulah
 * yang dikenali guru di lapangan ('Halaqoh A', 'Kelompok B', …).
 */
export async function addHalaqoh(input: {
  academicYearId: string;
  nama: string;
  kelasIds: string[];
}): Promise<Halaqoh> {
  const nama = input.nama.trim();
  if (!nama) throw new Error('Nama halaqoh tidak boleh kosong.');

  const kelasIds = [...new Set(input.kelasIds)];
  if (kelasIds.length === 0) {
    throw new Error('Pilih minimal satu kelas sumber untuk halaqoh ini.');
  }

  const { data: existing, error: readErr } = await supabase
    .from('halaqoh')
    .select('urutan')
    .eq('academic_year_id', input.academicYearId)
    .order('urutan', { ascending: false })
    .limit(1);
  if (readErr) throw readErr;

  const urutan = ((existing?.[0]?.urutan as number | undefined) ?? 0) + 1;

  const { data, error } = await supabase
    .from('halaqoh')
    .insert([{ academic_year_id: input.academicYearId, nama, urutan }])
    .select()
    .single();

  if (error) {
    // 23505 = unique violation. Satu-satunya unique di tabel ini adalah
    // (academic_year_id, nama), jadi pesannya bisa langsung ditulis untuk pengguna.
    if (error.code === '23505') {
      throw new Error(`Halaqoh "${nama}" sudah ada di tahun ajaran ini.`);
    }
    throw error;
  }

  const halaqoh = data as Halaqoh;
  await setKelasSumberHalaqoh(halaqoh.id, kelasIds);
  return halaqoh;
}

/**
 * Ganti daftar kelas sumber sebuah halaqoh.
 *
 * Hapus-lalu-isi ulang, bukan diff: daftarnya kecil dan operasi ini jarang.
 * Memindahkan kelas keluar dari daftar TIDAK menghapus anggotanya yang sudah
 * terlanjur berasal dari kelas itu — itu keputusan terpisah yang harus dilihat
 * pengguna (mereka akan muncul sebagai anggota yang kelasnya di luar kolam).
 */
export async function setKelasSumberHalaqoh(
  halaqohId: string,
  kelasIds: string[],
): Promise<void> {
  const unik = [...new Set(kelasIds)];

  const { error: delErr } = await supabase
    .from('halaqoh_kelas')
    .delete()
    .eq('halaqoh_id', halaqohId);
  if (delErr) throw delErr;

  if (unik.length === 0) return;

  const rows = unik.map((kelas_id) => ({ halaqoh_id: halaqohId, kelas_id }));
  const { error } = await supabase.from('halaqoh_kelas').insert(rows);
  if (error) throw error;
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
      throw new Error('Sudah ada halaqoh bernama sama di tahun ajaran ini.');
    }
    throw error;
  }
}

/**
 * Hapus halaqoh.
 *
 * PERINGATAN: `schedule.halaqoh_id`, `agenda_header.halaqoh_id`, dan
 * `agenda_kbm.halaqoh_id` memakai ON DELETE CASCADE. Menghapus halaqoh ikut
 * menghapus baris JADWAL yang menunjuknya, dan bagian jurnal yang sudah tertulis
 * untuknya.
 *
 * Itu sebabnya pemanggil WAJIB memeriksa `countJadwalHalaqoh` lebih dulu dan
 * meminta konfirmasi yang menyebut jumlah baris jadwal yang akan ikut hilang.
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

/**
 * Salin kerangka halaqoh dari tahun ajaran lain (biasanya tahun lalu) ke tahun
 * ajaran ini — NAMA + KELAS SUMBERNYA, tanpa anggotanya.
 *
 * Anggota sengaja tidak disalin: roster berubah tiap tahun (siswa naik kelas),
 * jadi pembagiannya memang harus disusun ulang. Yang menghemat waktu hanyalah
 * kerangka kelompoknya — nama kelompok dan kelas sumbernya.
 *
 * Tahun sumber dipilih otomatis: tahun ajaran lain (bukan target) dengan
 * `start_date` paling akhir yang benar-benar punya halaqoh. Nama yang sudah ada
 * di tahun target dilewati supaya tidak menabrak keunikan nama.
 */
export async function salinHalaqohDariTahunLalu(
  targetAcademicYearId: string,
): Promise<{ jumlah: number; dari: string | null }> {
  const { data: years, error: yErr } = await supabase
    .from('academic_year')
    .select('id, name, start_date')
    .neq('id', targetAcademicYearId)
    .order('start_date', { ascending: false });
  if (yErr) throw yErr;

  let sumberId: string | null = null;
  let sumberName: string | null = null;
  for (const y of (years ?? []) as { id: string; name: string }[]) {
    const { count, error } = await supabase
      .from('halaqoh')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', y.id);
    if (error) throw error;
    if ((count ?? 0) > 0) {
      sumberId = y.id;
      sumberName = y.name;
      break;
    }
  }

  if (!sumberId) {
    throw new Error('Tidak ada halaqoh di tahun ajaran lain untuk disalin.');
  }

  const sumber = await getHalaqohByTahunAjaran(sumberId);
  const target = await getHalaqohByTahunAjaran(targetAcademicYearId);
  const namaAda = new Set(target.map((h) => h.nama.trim().toLowerCase()));

  let jumlah = 0;
  for (const h of sumber) {
    if (namaAda.has(h.nama.trim().toLowerCase())) continue;
    await addHalaqoh({
      academicYearId: targetAcademicYearId,
      nama: h.nama,
      kelasIds: h.kelas_ids,
    });
    jumlah++;
  }

  return { jumlah, dari: sumberName };
}

// ----------------- KEANGGOTAAN (siapa ada di halaqoh mana) -----------------

/**
 * Select bersama untuk anggota: nama & NIS siswa, plus penempatan kelasnya pada
 * tahun ajaran berjalan (label + id). `siswa_kelas` diambil lewat siswa karena
 * satu siswa punya banyak penempatan (satu per tahun); baris yang dipakai
 * adalah yang cocok tahun ajarannya, disaring saat memetakan.
 */
const ANGGOTA_SELECT =
  'id, siswa_id, halaqoh_id, ' +
  'siswa:siswa_id (id, nama_siswa, nis, ' +
  'siswa_kelas (kelas_id, academic_year_id, kelas:kelas_id (label)))';

type RowAnggota = {
  id: string;
  siswa_id: string;
  halaqoh_id: string;
  siswa?: {
    id?: string;
    nama_siswa?: string;
    nis?: string | null;
    siswa_kelas?: {
      kelas_id?: string;
      academic_year_id?: string;
      kelas?: { label?: string } | null;
    }[] | null;
  } | null;
};

/** Petakan satu baris anggota; kelas diambil dari penempatan tahun berjalan. */
function mapAnggota(row: RowAnggota, academicYearId: string): AnggotaHalaqoh {
  const s = row.siswa;
  const penempatan = (s?.siswa_kelas ?? []).find(
    (sk) => sk.academic_year_id === academicYearId,
  );
  return {
    id: row.id,
    siswa_id: row.siswa_id,
    halaqoh_id: row.halaqoh_id,
    nama_siswa: s?.nama_siswa ?? '',
    nis: s?.nis ?? null,
    kelas: penempatan?.kelas?.label ?? '',
    kelas_id: penempatan?.kelas_id ?? '',
  };
}

/** Anggota satu halaqoh pada satu tahun ajaran. */
export async function getAnggotaHalaqoh(
  halaqohId: string,
  academicYearId: string,
): Promise<AnggotaHalaqoh[]> {
  const { data, error } = await supabase
    .from('siswa_halaqoh')
    .select(ANGGOTA_SELECT)
    .eq('halaqoh_id', halaqohId)
    .eq('academic_year_id', academicYearId);

  if (error) throw error;

  const anggota = ((data ?? []) as unknown as RowAnggota[]).map((r) => mapAnggota(r, academicYearId));
  anggota.sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa, 'id'));
  return anggota;
}

/**
 * Semua anggota beberapa halaqoh sekaligus, dikelompokkan per halaqoh.
 *
 * Dipakai halaman Halaqoh agar cukup SATU query untuk seluruh daftar, bukan satu
 * query per kelompok.
 */
export async function getAnggotaSemuaHalaqoh(
  halaqohIds: string[],
  academicYearId: string,
): Promise<Record<string, AnggotaHalaqoh[]>> {
  if (halaqohIds.length === 0) return {};

  const { data, error } = await supabase
    .from('siswa_halaqoh')
    .select(ANGGOTA_SELECT)
    .in('halaqoh_id', halaqohIds)
    .eq('academic_year_id', academicYearId);

  if (error) throw error;

  const hasil: Record<string, AnggotaHalaqoh[]> = {};
  for (const id of halaqohIds) hasil[id] = [];

  for (const row of (data ?? []) as unknown as RowAnggota[]) {
    (hasil[row.halaqoh_id] ??= []).push(mapAnggota(row, academicYearId));
  }

  for (const id of halaqohIds) {
    hasil[id].sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa, 'id'));
  }
  return hasil;
}

/**
 * Siswa kelas sumber sebuah halaqoh yang BELUM masuk halaqoh mana pun tahun ini.
 *
 * Ini penjaga kelengkapan, bukan sekadar laporan. Siswa yang tidak masuk
 * kelompok mana pun tidak akan muncul di absensi mapel Ummi dan jurnalnya
 * bolong. Daftarnya dibatasi ke KELAS SUMBER halaqoh (kolam), supaya yang
 * ditawarkan memang calon yang masuk akal untuk kelompok ini.
 *
 * Siswa yang berstatus bukan AKTIF tahun itu (pindah/nonaktif) sengaja
 * DIBUANG: mereka memang tidak perlu dibagi ke halaqoh.
 */
export async function getKandidatAnggota(
  halaqohId: string,
  academicYearId: string,
): Promise<SiswaTerdaftar[]> {
  const kelasIds = await getKelasSumberIds(halaqohId);
  if (kelasIds.length === 0) return [];

  const { data: penempatan, error: pErr } = await supabase
    .from('siswa_kelas')
    .select(
      'kelas_id, academic_year_id, status, ' +
        'siswa:siswa_id (id, nama_siswa, nis, status), ' +
        'kelas:kelas_id (label)',
    )
    .in('kelas_id', kelasIds)
    .eq('academic_year_id', academicYearId);
  if (pErr) throw pErr;

  // Keanggotaan diambil untuk SELURUH halaqoh tahun ini: aturannya "satu halaqoh
  // per siswa per tahun", jadi kandidat harus bebas dari halaqoh mana pun —
  // bukan hanya dari halaqoh ini.
  const { data: anggota, error: aErr } = await supabase
    .from('siswa_halaqoh')
    .select('siswa_id')
    .eq('academic_year_id', academicYearId);
  if (aErr) throw aErr;

  const sudahTerdaftar = new Set(
    ((anggota ?? []) as { siswa_id: string }[]).map((r) => r.siswa_id),
  );

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
    if (row.status !== 'AKTIF') continue;
    if (sudahTerdaftar.has(s.id)) continue;

    hasil.push({
      id: s.id,
      nama_siswa: s.nama_siswa ?? '',
      nis: s.nis ?? null,
      status: (s.status ?? 'AKTIF') as SiswaTerdaftar['status'],
      kelas: row.kelas?.label ?? '',
      kelas_id: '',
      academic_year_id: academicYearId,
    });
  }

  hasil.sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa, 'id'));
  return hasil;
}

/**
 * Pastikan setiap siswa berasal dari kelas sumber halaqoh ini.
 *
 * Ditegakkan di service, bukan hanya di UI: kandidat sudah disaring lewat
 * `getKandidatAnggota`, tetapi pemanggil lain (impor, API langsung) bisa
 * melewatinya. Siswa tanpa penempatan tahun itu dilewati — ia tidak akan
 * muncul sebagai kandidat, jadi tidak masuk akal memblokirnya di sini.
 */
async function pastikanKelasSumber(
  halaqohId: string,
  siswaIds: string[],
  academicYearId: string,
): Promise<void> {
  const kelasSumber = await getKelasSumberIds(halaqohId);
  if (kelasSumber.length === 0) return;

  const { data, error } = await supabase
    .from('siswa_kelas')
    .select('siswa_id, kelas_id')
    .in('siswa_id', siswaIds)
    .eq('academic_year_id', academicYearId);
  if (error) throw error;

  const kelasSiswa = new Map(
    ((data ?? []) as { siswa_id: string; kelas_id: string }[]).map((r) => [
      r.siswa_id,
      r.kelas_id,
    ]),
  );

  for (const sid of siswaIds) {
    const kid = kelasSiswa.get(sid);
    if (kid && !kelasSumber.includes(kid)) {
      throw new Error(
        'Ada siswa yang berasal dari kelas di luar kelas sumber halaqoh ini. ' +
          'Periksa kembali pilihan anggotanya.',
      );
    }
  }
}

/**
 * Masukkan / pindahkan satu siswa ke sebuah halaqoh.
 *
 * Memakai UPSERT pada `(siswa_id, academic_year_id)`, bukan INSERT biasa:
 * memindahkan siswa dari Halaqoh A ke Halaqoh B BUKAN penambahan baris baru —
 * unique constraint menolak baris kedua. Dengan upsert, "pindah" dan "masuk"
 * menjadi satu operasi yang sama.
 */
export async function setSiswaHalaqoh(input: {
  siswaId: string;
  halaqohId: string;
  academicYearId: string;
}): Promise<void> {
  await pastikanKelasSumber(input.halaqohId, [input.siswaId], input.academicYearId);

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
 * tidak ada yang setengah jadi.
 */
export async function setBanyakSiswaHalaqoh(
  siswaIds: string[],
  halaqohId: string,
  academicYearId: string,
): Promise<void> {
  if (siswaIds.length === 0) return;

  await pastikanKelasSumber(halaqohId, siswaIds, academicYearId);

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
 * sehingga siswa kembali muncul di daftar kandidat.
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
