/**
 * Verifikasi keputusan baris jadwal untuk mapel berkelompok (halaqoh).
 *
 * Menguji LOGIKA PEMILIHAN BARIS yang dipakai `handleSaveSchedule`:
 * baris mana yang dibuat, diperbarui, dan dihapus — tanpa menyentuh jaringan.
 *
 * Yang paling penting dibuktikan di sini: menyimpan ulang jadwal berkelompok
 * untuk satu mapel TIDAK boleh menghapus baris mapel lain yang kebetulan
 * berada di kelas dan jam yang sama. Kesalahan di sini bersifat merusak data
 * dan tidak kelihatan sampai ada guru yang kehilangan jadwalnya.
 *
 * Jalankan:  bun scripts/verify-halaqoh-rowset.ts
 */

interface Row {
  id: string;
  kelas: string;
  day: string;
  period_number: number;
  subject_name: string;
  halaqoh_id: string | null;
}

interface Rencana {
  update: string[];
  create: string[];
  delete: string[];
}

/**
 * Cerminan persis dari logika di `handleSaveSchedule` untuk cabang halaqoh.
 */
function rencanaSimpan(params: {
  existing: Row[];
  targetHalaqohIds: string[];
  formKelas: string;
  formDay: string;
  formPeriod: number;
  formSubject: string;
  editingItem?: Row | null;
}): Rencana {
  const { existing, targetHalaqohIds } = params;

  const existingRows = existing.filter(
    (s) =>
      s.kelas === params.formKelas &&
      s.day === params.formDay &&
      s.period_number === params.formPeriod &&
      Boolean(s.halaqoh_id),
  );
  const milikMapelIni = existingRows.filter(
    (s) => s.subject_name === params.formSubject,
  );

  const update: string[] = [];
  const create: string[] = [];

  for (const hid of targetHalaqohIds) {
    const sudahAda = milikMapelIni.find((s) => s.halaqoh_id === hid);
    if (sudahAda) update.push(sudahAda.id);
    else create.push(hid);
  }

  const deleteIds: string[] = [];
  const idDipakai = new Set(targetHalaqohIds);
  for (const s of milikMapelIni) {
    if (s.halaqoh_id && !idDipakai.has(s.halaqoh_id)) deleteIds.push(s.id);
  }

  const ed = params.editingItem;
  if (ed?.halaqoh_id) {
    const masihDipakai =
      targetHalaqohIds.includes(ed.halaqoh_id) &&
      ed.kelas === params.formKelas &&
      ed.day === params.formDay &&
      ed.period_number === params.formPeriod;
    const barisLamaMasihAda = milikMapelIni.some((s) => s.id === ed.id);
    if (!masihDipakai && !barisLamaMasihAda) deleteIds.push(ed.id);
  }

  return { update, create, delete: deleteIds };
}

let lulus = 0;
let gagal = 0;

function uji(nama: string, dapat: Rencana, harap: Partial<Rencana>) {
  const bekas: string[] = [];
  const norm = (a?: string[]) => [...(a ?? [])].sort().join(',');
  for (const k of ['update', 'create', 'delete'] as const) {
    if (harap[k] !== undefined && norm(dapat[k]) !== norm(harap[k])) {
      bekas.push(`${k}: harap [${norm(harap[k])}] dapat [${norm(dapat[k])}]`);
    }
  }
  if (bekas.length === 0) {
    lulus++;
    console.log(`  OK   ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL ${nama}\n        ${bekas.join('\n        ')}`);
  }
}

const baris = (
  id: string,
  kelas: string,
  day: string,
  period: number,
  subject: string,
  halaqoh: string | null,
): Row => ({ id, kelas, day, period_number: period, subject_name: subject, halaqoh_id: halaqoh });

console.log('\n===== UJI 1: buat baru, kelas kosong =====');
uji(
  '3 halaqoh → 3 baris baru, tidak ada yang dihapus',
  rencanaSimpan({
    existing: [],
    targetHalaqohIds: ['H1', 'H2', 'H3'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
  }),
  { update: [], create: ['H1', 'H2', 'H3'], delete: [] },
);

console.log('\n===== UJI 2: simpan ulang tanpa perubahan =====');
uji(
  'semua halaqoh sudah ada → semua di-update, tidak ada insert/hapus',
  rencanaSimpan({
    existing: [
      baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
      baris('S2', '1A', 'MONDAY', 1, 'Ummi', 'H2'),
    ],
    targetHalaqohIds: ['H1', 'H2'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
  }),
  { update: ['S1', 'S2'], create: [], delete: [] },
);

console.log('\n===== UJI 3 (KRITIS): mapel lain di kelas & jam sama tidak boleh terhapus =====');
uji(
  'Ummi 3 halaqoh, di slot sama ada Matematika (seluruh kelas) → Matematika AMAN',
  rencanaSimpan({
    existing: [
      baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
      baris('S2', '1A', 'MONDAY', 1, 'Ummi', 'H2'),
      baris('S9', '1A', 'MONDAY', 1, 'Matematika', null),
    ],
    targetHalaqohIds: ['H1', 'H2'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
  }),
  { update: ['S1', 'S2'], create: [], delete: [] },
);

console.log('\n===== UJI 4: kelompok ditambah =====');
uji(
  'halaqoh ke-3 baru → 2 update + 1 create',
  rencanaSimpan({
    existing: [
      baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
      baris('S2', '1A', 'MONDAY', 1, 'Ummi', 'H2'),
    ],
    targetHalaqohIds: ['H1', 'H2', 'H3'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
  }),
  { update: ['S1', 'S2'], create: ['H3'], delete: [] },
);

console.log('\n===== UJI 5: kelompok dihapus dari master =====');
uji(
  'H3 sudah tidak ada lagi → barisnya dibuang, sisanya tetap',
  rencanaSimpan({
    existing: [
      baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
      baris('S2', '1A', 'MONDAY', 1, 'Ummi', 'H2'),
      baris('S3', '1A', 'MONDAY', 1, 'Ummi', 'H3'),
    ],
    targetHalaqohIds: ['H1', 'H2'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
  }),
  { update: ['S1', 'S2'], create: [], delete: ['S3'] },
);

console.log('\n===== UJI 6 (KRITIS): mapel sama, tapi di JAM LAIN =====');
uji(
  'Ummi jam ke-5 tidak boleh tersentuh saat menyimpan Ummi jam ke-1',
  rencanaSimpan({
    existing: [
      baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
      baris('S7', '1A', 'MONDAY', 5, 'Ummi', 'H1'),
      baris('S8', '1A', 'MONDAY', 5, 'Ummi', 'H2'),
    ],
    targetHalaqohIds: ['H1', 'H2'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
  }),
  { update: ['S1'], create: ['H2'], delete: [] },
);

console.log('\n===== UJI 7 (KRITIS): kelas lain pada jam yang sama =====');
uji(
  'Ummi 2A pada Senin JP1 tidak boleh tersentuh saat menyimpan 1A',
  rencanaSimpan({
    existing: [
      baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
      baris('S4', '2A', 'MONDAY', 1, 'Ummi', 'H9'),
    ],
    targetHalaqohIds: ['H1', 'H2'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
  }),
  { update: ['S1'], create: ['H2'], delete: [] },
);

console.log('\n===== UJI 8 (KRITIS): mengedit baris lalu PINDAH kelas =====');
uji(
  'baris asal S1 di 1A dipindah ke 1B → dibuat baru di 1B, S1 dibuang',
  rencanaSimpan({
    existing: [
      baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
      baris('S2', '1A', 'MONDAY', 1, 'Ummi', 'H2'),
    ],
    targetHalaqohIds: ['H1', 'H2'],
    formKelas: '1B',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
    editingItem: baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
  }),
  { update: [], create: ['H1', 'H2'], delete: ['S1'] },
);

console.log('\n===== UJI 9: mengedit baris, kelas & jam TIDAK berubah =====');
uji(
  'halaqoh masih sama & slot sama → di-update, TIDAK dihapus (jangan sampai terhapus lalu dibuat ulang)',
  rencanaSimpan({
    existing: [baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1')],
    targetHalaqohIds: ['H1'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
    editingItem: baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
  }),
  { update: ['S1'], create: [], delete: [] },
);

console.log('\n===== UJI 10: mengedit baris lalu PINDAM JP =====');
uji(
  'S1 pindah dari JP1 ke JP2 → dibuat baru di JP2, S1 dibuang dari JP1',
  rencanaSimpan({
    existing: [baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1')],
    targetHalaqohIds: ['H1'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 2,
    formSubject: 'Ummi',
    editingItem: baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
  }),
  { update: [], create: ['H1'], delete: ['S1'] },
);

console.log('\n===== UJI 11: baris lama tanpa halaqoh_id tidak ikut terhapus =====');
uji(
  'Ummi lama (halaqoh_id NULL) di slot sama → dibiarkan, hanya dihitung yang berkelompok',
  rencanaSimpan({
    existing: [
      baris('S0', '1A', 'MONDAY', 1, 'Ummi', null),
      baris('S1', '1A', 'MONDAY', 1, 'Ummi', 'H1'),
    ],
    targetHalaqohIds: ['H1', 'H2'],
    formKelas: '1A',
    formDay: 'MONDAY',
    formPeriod: 1,
    formSubject: 'Ummi',
  }),
  { update: ['S1'], create: ['H2'], delete: [] },
);

console.log(`\n===== HASIL: ${lulus} lulus, ${gagal} gagal (dari ${lulus + gagal}) =====\n`);
process.exit(gagal === 0 ? 0 : 1);
