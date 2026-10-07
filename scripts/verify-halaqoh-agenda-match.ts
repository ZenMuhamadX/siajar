/**
 * Verifikasi pencocokan agenda ↔ slot jadwal untuk mapel berkelompok (halaqoh).
 *
 * Menguji LOGIKA PENCARIAN YANG DIPAKAI `scheduleDetectionService`: diberikan
 * seorang guru dan daftar agenda pada satu tanggal, agenda mana yang menjadi
 * miliknya.
 *
 * Kenapa ini penting: dua guru Ummi mengajar KELAS + MAPEL + TANGGAL yang sama,
 * pada JAM yang sama. Hanya `schedule_id` (dan `halaqoh_id` sebagai cadangan)
 * yang membedakan mereka. Kalau pencocokan salah, guru kedua akan membuka
 * catatan guru pertama — lalu menimpanya saat menyimpan. Kehilangan data nyata,
 * bukan sekadar tampilan keliru.
 *
 * Jalankan:  bun scripts/verify-halaqoh-agenda-match.ts
 */

interface ScheduleRow {
  id: string;
  kelas: string;
  subject_name: string;
  teacher_name: string;
  halaqoh_id: string | null;
}

interface KbmRow {
  nama_guru: string;
  mapel: string;
  halaqoh_id: string | null;
}

interface AgendaRow {
  schedule_id: string | null;
  kelas: string;
  tanggal: string;
  kbm: KbmRow[];
}

/**
 * Cerminan persis dari pencocokan di `scheduleDetectionService.ts`.
 *
 * Dua pencarian TERPISAH, bukan satu `find` gabungan: kalau digabung, agenda
 * lama yang muncul lebih dulu di array akan menang atas agenda ber-`schedule_id`.
 */
function cariAgenda(params: {
  sch: ScheduleRow;
  agendasOnDate: AgendaRow[];
  targetDateStr: string;
  teacherName: string;
}): AgendaRow | null {
  const { sch, agendasOnDate, targetDateStr, teacherName } = params;

  const byId = agendasOnDate.find((a) => a.schedule_id === sch.id);

  const byFallback =
    agendasOnDate.find(
      (a) =>
        !a.schedule_id &&
        a.kelas === sch.kelas &&
        a.tanggal === targetDateStr &&
        a.kbm.some(
          (k) =>
            k.nama_guru.trim().toLowerCase() === teacherName.trim().toLowerCase() &&
            k.mapel.trim().toLowerCase() === sch.subject_name.trim().toLowerCase() &&
            (k.halaqoh_id ?? null) === (sch.halaqoh_id ?? null)
        )
    ) ?? null;

  return byId ?? byFallback;
}

let lulus = 0;
let gagal = 0;

function uji(nama: string, dapat: AgendaRow | null, harap: AgendaRow | null) {
  const id = (a: AgendaRow | null) => (a ? `[${a.kbm[0]?.nama_guru ?? '?'}|${a.schedule_id ?? 'no-sid'}]` : 'null');
  if (id(dapat) === id(harap)) {
    lulus++;
    console.log(`  OK    ${nama}  ->  ${id(dapat)}`);
  } else {
    gagal++;
    console.log(`  GAGAL ${nama}\n        harap ${id(harap)}  dapat ${id(dapat)}`);
  }
}

const sch = (
  id: string,
  kelas: string,
  subject: string,
  teacher: string,
  halaqoh: string | null,
): ScheduleRow => ({ id, kelas, subject_name: subject, teacher_name: teacher, halaqoh_id: halaqoh });

const ag = (
  sid: string | null,
  kelas: string,
  tanggal: string,
  kbm: KbmRow[],
): AgendaRow => ({ schedule_id: sid, kelas, tanggal, kbm });

const TGL = '2026-10-06';

console.log('\n===== UJI 1: kunci utama — schedule_id cocok persis =====');
uji(
  'agenda ber-schedule_id S-A hanya milik guru A',
  cariAgenda({
    sch: sch('S-A', '1A', 'Ummi', 'Ust. Ahmad', 'H1'),
    agendasOnDate: [
      ag('S-A', '1A', TGL, [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: 'H1' }]),
      ag('S-B', '1A', TGL, [{ nama_guru: 'Ust. Budi', mapel: 'Ummi', halaqoh_id: 'H2' }]),
    ],
    targetDateStr: TGL,
    teacherName: 'Ust. Ahmad',
  }),
  ag('S-A', '1A', TGL, [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: 'H1' }]),
);

console.log('\n===== UJI 2: cadangan TANPA schedule_id — halaqoh memisahkan =====');
uji(
  'guru A (H1) TIDAK mengambil agenda guru B (H2) meski kelas & mapel sama',
  cariAgenda({
    sch: sch('S-A', '1A', 'Ummi', 'Ust. Ahmad', 'H1'),
    agendasOnDate: [
      // Agenda lama tanpa schedule_id milik guru B
      ag(null, '1A', TGL, [{ nama_guru: 'Ust. Budi', mapel: 'Ummi', halaqoh_id: 'H2' }]),
    ],
    targetDateStr: TGL,
    teacherName: 'Ust. Ahmad',
  }),
  null,
);

console.log('\n===== UJI 3: cadangan — halaqoh sama, guru sama =====');
uji(
  'agenda lama H1 guru A diambil oleh guru A (H1)',
  cariAgenda({
    sch: sch('S-A', '1A', 'Ummi', 'Ust. Ahmad', 'H1'),
    agendasOnDate: [
      ag(null, '1A', TGL, [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: 'H1' }]),
    ],
    targetDateStr: TGL,
    teacherName: 'Ust. Ahmad',
  }),
  ag(null, '1A', TGL, [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: 'H1' }]),
);

console.log('\n===== UJI 4 (KRITIS): kedua agenda lama H1 & H2 ada — masing-masing dapat miliknya =====');
const duaAgenda = [
  ag(null, '1A', TGL, [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: 'H1' }]),
  ag(null, '1A', TGL, [{ nama_guru: 'Ust. Budi', mapel: 'Ummi', halaqoh_id: 'H2' }]),
];
uji(
  'guru A (H1) -> agenda H1, bukan H2',
  cariAgenda({
    sch: sch('S-A', '1A', 'Ummi', 'Ust. Ahmad', 'H1'),
    agendasOnDate: duaAgenda,
    targetDateStr: TGL,
    teacherName: 'Ust. Ahmad',
  }),
  duaAgenda[0],
);
uji(
  'guru B (H2) -> agenda H2, bukan H1',
  cariAgenda({
    sch: sch('S-B', '1A', 'Ummi', 'Ust. Budi', 'H2'),
    agendasOnDate: duaAgenda,
    targetDateStr: TGL,
    teacherName: 'Ust. Budi',
  }),
  duaAgenda[1],
);

console.log('\n===== UJI 5: mapel biasa (halaqoh_id null) tetap seperti dulu =====');
uji(
  'Matematika seluruh kelas, agenda lama tanpa schedule_id — tetap ditemukan',
  cariAgenda({
    sch: sch('S-M', '1A', 'Matematika', 'Ust. Budi', null),
    agendasOnDate: [
      ag(null, '1A', TGL, [{ nama_guru: 'Ust. Budi', mapel: 'Matematika', halaqoh_id: null }]),
    ],
    targetDateStr: TGL,
    teacherName: 'Ust. Budi',
  }),
  ag(null, '1A', TGL, [{ nama_guru: 'Ust. Budi', mapel: 'Matematika', halaqoh_id: null }]),
);

console.log('\n===== UJI 6 (KRITIS): mapel biasa TIDAK mengambil agenda halaqoh =====');
uji(
  'jadwal Matematika (null) tidak boleh mengklaim agenda Ummi H1',
  cariAgenda({
    sch: sch('S-M', '1A', 'Matematika', 'Ust. Budi', null),
    agendasOnDate: [
      ag(null, '1A', TGL, [{ nama_guru: 'Ust. Budi', mapel: 'Ummi', halaqoh_id: 'H1' }]),
    ],
    targetDateStr: TGL,
    teacherName: 'Ust. Budi',
  }),
  null,
);

console.log('\n===== UJI 7: mapel halaqoh TIDAK mengambil agenda seluruh kelas =====');
uji(
  'jadwal Ummi (H1) tidak boleh mengklaim agenda Matematika (null)',
  cariAgenda({
    sch: sch('S-A', '1A', 'Ummi', 'Ust. Ahmad', 'H1'),
    agendasOnDate: [
      ag(null, '1A', TGL, [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: null }]),
    ],
    targetDateStr: TGL,
    teacherName: 'Ust. Ahmad',
  }),
  null,
);

console.log('\n===== UJI 8: tanggal berbeda tidak tercampur =====');
uji(
  'agenda tanggal lain tidak diambil',
  cariAgenda({
    sch: sch('S-A', '1A', 'Ummi', 'Ust. Ahmad', 'H1'),
    agendasOnDate: [
      ag(null, '1A', '2026-10-05', [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: 'H1' }]),
    ],
    targetDateStr: TGL,
    teacherName: 'Ust. Ahmad',
  }),
  null,
);

console.log('\n===== UJI 9: schedule_id menang atas cadangan =====');
uji(
  'ada dua agenda: satu ber-sid cocok, satu cadangan cocok -> yang dipakai ber-sid',
  cariAgenda({
    sch: sch('S-A', '1A', 'Ummi', 'Ust. Ahmad', 'H1'),
    agendasOnDate: [
      ag(null, '1A', TGL, [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: 'H1' }]),
      ag('S-A', '1A', TGL, [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: 'H1' }]),
    ],
    targetDateStr: TGL,
    teacherName: 'Ust. Ahmad',
  }),
  ag('S-A', '1A', TGL, [{ nama_guru: 'Ust. Ahmad', mapel: 'Ummi', halaqoh_id: 'H1' }]),
);

console.log(`\n===== HASIL: ${lulus} lulus, ${gagal} gagal (dari ${lulus + gagal}) =====\n`);
process.exit(gagal === 0 ? 0 : 1);
