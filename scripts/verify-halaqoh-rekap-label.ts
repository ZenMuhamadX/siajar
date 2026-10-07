/**
 * Uji label "kelompok" pada baris rekap.
 *
 * Masalah yang dipecahkan: dua guru Ummi di kelas + jam yang sama muncul di
 * rekap sebagai dua baris yang IDENTIK (kelas sama, mapel sama, jam sama) —
 * pembaca tidak bisa tahu siapa mengajar kelompok mana. Rekap karena itu harus
 * menampilkan nama halaqoh di samping nama kelas.
 *
 * Uji ini meniru `kelompokRingkas()` (dipakai rekap/riwayat) dan aturan
 * "cadangan agenda harus membandingkan halaqoh" (dipakai `reportViewModel`).
 * Keduanya murni — tidak menyentuh React/DOM/DB.
 *
 * Jalankan: bun scripts/verify-halaqoh-rekap-label.ts
 */

// ---------------------------------------------------------------------------
// Salinan rumus murni
// ---------------------------------------------------------------------------

/** Aturan 1: nama kelompok yang layak ditampilkan di samping kelas. */
function kelompokRingkas(nama?: string | null): string | null {
  const trimmed = (nama || '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Aturan 2: apakah `nama` hanya mengulang angka kelas (mis. "1A" untuk kelas "1A")? */
function hanyaMengulangKelas(namaHalaqoh: string, kelas: string): boolean {
  return namaHalaqoh.trim().toLowerCase() === kelas.trim().toLowerCase();
}

/** Gabungan label kelas + kelompok untuk satu baris rekap. */
function labelKelas(kelas: string, nama?: string | null): string {
  const h = kelompokRingkas(nama);
  if (!h) return kelas;
  return `${kelas} · ${h}`;
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

interface Fixture {
  id: string;
  kelas: string;
  halaqoh: string | null;
  teacher: string;
}

/** Dua halaqoh di kelas 1A, jam yang sama — inti kasus Ummi. */
const UMMI: Fixture[] = [
  { id: 'S-H1', kelas: '1A', halaqoh: 'Kelompok A', teacher: 'Ust. Ahmad' },
  { id: 'S-H2', kelas: '1A', halaqoh: 'Kelompok B', teacher: 'Ust. Budi' },
];

let lulus = 0;
let gagal = 0;

function cek(judul: string, kenyataan: unknown, harapan: unknown) {
  const ok = kenyataan === harapan;
  if (ok) lulus++;
  else gagal++;
  console.log(
    `${ok ? 'OK  ' : 'GAGAL'} | ${judul}\n        harap: ${JSON.stringify(harapan)} | dapat: ${JSON.stringify(kenyataan)}`
  );
}

// ---------------------------------------------------------------------------
// UJI
// ---------------------------------------------------------------------------

console.log('\n===== UJI 1 (INTI): dua halaqoh sekelas & sejamm harus BEDA label =====');
const labelH1 = labelKelas(UMMI[0].kelas, UMMI[0].halaqoh);
const labelH2 = labelKelas(UMMI[1].kelas, UMMI[1].halaqoh);
console.log(`        H1 -> ${labelH1}`);
console.log(`        H2 -> ${labelH2}`);
cek('label H1 = "1A · Kelompok A"', labelH1, '1A · Kelompok A');
cek('label H2 = "1A · Kelompok B"', labelH2, '1A · Kelompok B');
cek('dua baris TIDAK lagi identik', labelH1 !== labelH2, true);

console.log('\n===== UJI 2: mapel seluruh kelas (halaqoh null) tetap bersih =====');
cek('kelas tanpa halaqoh tidak dapat akhiran', labelKelas('3B', null), '3B');
cek('string kosong diperlakukan sama dengan null', labelKelas('3B', ''), '3B');
cek('spasi saja juga dianggap kosong', labelKelas('3B', '   '), '3B');

console.log('\n===== UJI 3: halaqoh bernama sama dengan kelas tidak diulang =====');
// Kelas 1A punya satu halaqoh bernama "1A" (kelas kecil = 1 halaqoh, penamaan
// default). "1A · 1A" hanya menambah kebisingan tanpa menambah informasi.
cek('halaqoh "1A" untuk kelas "1A" = cukup "1A"', hanyaMengulangKelas('1A', '1A'), true);
cek('beda huruf besar/kecil tetap terdeteksi', hanyaMengulangKelas('1a', '1A'), true);
cek('halaqoh bernama lain tidak dianggap duplikat', hanyaMengulangKelas('Kelompok A', '1A'), false);

console.log('\n===== UJI 4: label tidak pernah kosong =====');
cek('kelas terisi selalu menghasilkan label', labelKelas('2B', undefined), '2B');
cek('nama halaqoh hanya spasi tidak memecah label', labelKelas('2B', '  '), '2B');

console.log('\n===== UJI 5 (KRITIS): cadangan agenda harus membandingkan halaqoh =====');
/**
 * Meniru `findAgenda` di `reportViewModel`:
 *   1. kunci utama `schedule_id` (harus menang),
 *   2. cadangan lama: kelas + tanggal + guru + mapel + **halaqoh**.
 * Tanpa perbandingan halaqoh, agenda H1 akan diklaim baris H2 juga → satu
 * agenda tampil dua kali di rekap (dan gurunya tertukar).
 */
type Agenda = {
  id: string;
  schedule_id: string | null;
  kelas: string;
  tanggal: string;
  kbm: { nama_guru: string; mapel: string; halaqoh_id: string | null }[];
};
type Schedule = {
  id: string;
  kelas: string;
  subject_name: string;
  teacher_name: string;
  halaqoh_id: string | null;
};

const norm = (s: string) => s.trim().toLowerCase();

function findAgendaTanpaHalaqoh(sch: Schedule, tanggal: string, semua: Agenda[]): Agenda | null {
  const byId = semua.find((a) => a.schedule_id === sch.id);
  if (byId) return byId;
  return (
    semua.find(
      (a) =>
        !a.schedule_id &&
        a.kelas === sch.kelas &&
        a.tanggal === tanggal &&
        a.kbm.some(
          (k) => norm(k.nama_guru) === norm(sch.teacher_name) && norm(k.mapel) === norm(sch.subject_name)
        )
    ) ?? null
  );
}

function findAgendaDenganHalaqoh(sch: Schedule, tanggal: string, semua: Agenda[]): Agenda | null {
  const byId = semua.find((a) => a.schedule_id === sch.id);
  if (byId) return byId;
  return (
    semua.find(
      (a) =>
        !a.schedule_id &&
        a.kelas === sch.kelas &&
        a.tanggal === tanggal &&
        a.kbm.some(
          (k) =>
            norm(k.nama_guru) === norm(sch.teacher_name) &&
            norm(k.mapel) === norm(sch.subject_name) &&
            (k.halaqoh_id ?? null) === (sch.halaqoh_id ?? null)
        )
    ) ?? null
  );
}

const TANGGAL = '2026-10-06';
const MAPEL = 'Ummi';

/**
 * Kondisi nyata yang memicu bug: agenda LAMA (dibuat sebelum kolom `halaqoh_id`
 * dipakai, jadi `halaqoh_id` barisnya NULL) di kelas + mapel + tanggal yang
 * sama. Guru terjadwal di baris H1 dan H2 KEBETULAN sama-sama tercatat di
 * baris KBM agenda lama itu (data sebelum halaqoh dipisah). Tanpa membandingkan
 * halaqoh, baris H2 ikut "menemukan" agenda lama tersebut.
 */
const agendaLamaTanpaHalaqoh: Agenda = {
  id: 'AG-LAMA',
  schedule_id: null,
  kelas: '1A',
  tanggal: TANGGAL,
  kbm: [{ nama_guru: 'Ust. Ahmad', mapel: MAPEL, halaqoh_id: null }],
};

const schH1: Schedule = {
  id: 'S-H1',
  kelas: '1A',
  subject_name: MAPEL,
  teacher_name: 'Ust. Ahmad',
  halaqoh_id: 'H1',
};
const schH2: Schedule = {
  id: 'S-H2',
  kelas: '1A',
  subject_name: MAPEL,
  teacher_name: 'Ust. Ahmad', // guru SAMA pada data lama — inilah jebakannya
  halaqoh_id: 'H2',
};

const semuaAgenda = [agendaLamaTanpaHalaqoh]; // hanya agenda lama yang ada

const h2Lama = findAgendaTanpaHalaqoh(schH2, TANGGAL, semuaAgenda);
console.log(`        tanpa cek halaqoh -> baris H2 mengambil: ${h2Lama?.id ?? 'null'}`);
cek('BUKTI BUG: tanpa cek halaqoh, baris H2 ikut mengklaim agenda lama', h2Lama?.id, 'AG-LAMA');

const h1Baru = findAgendaDenganHalaqoh(schH1, TANGGAL, semuaAgenda);
const h2Baru = findAgendaDenganHalaqoh(schH2, TANGGAL, semuaAgenda);
console.log(`        dengan cek halaqoh -> H1: ${h1Baru?.id ?? 'null'} | H2: ${h2Baru?.id ?? 'null'}`);
cek('dengan cek halaqoh: baris H1 (halaqoh_id H1) tidak mengambil agenda NULL', h1Baru, null);
cek('dengan cek halaqoh: baris H2 (halaqoh_id H2) tidak mengambil agenda NULL', h2Baru, null);

/** Agenda lama tanpa `halaqoh_id` tetap boleh dilaporkan lewat baris seluruh kelas. */
const schSeluruhKelas: Schedule = {
  id: 'S-WHOLE',
  kelas: '1A',
  subject_name: MAPEL,
  teacher_name: 'Ust. Ahmad',
  halaqoh_id: null,
};
cek(
  'agenda lama tanpa halaqoh tetap ditemukan baris seluruh kelas',
  findAgendaDenganHalaqoh(schSeluruhKelas, TANGGAL, semuaAgenda)?.id,
  'AG-LAMA'
);

console.log('\n===== UJI 6: kunci utama schedule_id tetap menang =====');
const agendaBaruH2: Agenda = {
  id: 'AG-H2-BARU',
  schedule_id: 'S-H2',
  kelas: '1A',
  tanggal: TANGGAL,
  kbm: [{ nama_guru: 'Ust. Budi', mapel: MAPEL, halaqoh_id: 'H2' }],
};
const denganDua = [agendaLamaTanpaHalaqoh, agendaBaruH2];
cek(
  'baris H2 mengambil agenda ber-schedule_id, bukan agenda lama',
  findAgendaDenganHalaqoh(schH2, TANGGAL, denganDua)?.id,
  'AG-H2-BARU'
);
cek(
  'agenda ber-schedule_id menang walau agenda lama muncul lebih dulu',
  findAgendaTanpaHalaqoh(schH2, TANGGAL, [agendaBaruH2, agendaLamaTanpaHalaqoh])?.id,
  'AG-H2-BARU'
);

console.log('\n===== UJI 7: mapel biasa tidak terpengaruh =====');
const agendaMatematika: Agenda = {
  id: 'AG-MTK',
  schedule_id: null,
  kelas: '1A',
  tanggal: TANGGAL,
  kbm: [{ nama_guru: 'Ust. Cici', mapel: 'Matematika', halaqoh_id: null }],
};
const schMatematika: Schedule = {
  id: 'S-MTK',
  kelas: '1A',
  subject_name: 'Matematika',
  teacher_name: 'Ust. Cici',
  halaqoh_id: null,
};
cek(
  'mapel seluruh kelas tetap menemukan agendanya',
  findAgendaDenganHalaqoh(schMatematika, TANGGAL, [agendaMatematika])?.id,
  'AG-MTK'
);
cek(
  'baris Ummi TIDAK mengambil agenda Matematika',
  findAgendaDenganHalaqoh(schH1, TANGGAL, [agendaMatematika]),
  null
);

console.log(`\n===== HASIL: ${lulus} lulus, ${gagal} gagal (dari ${lulus + gagal}) =====\n`);
if (gagal > 0) process.exit(1);
