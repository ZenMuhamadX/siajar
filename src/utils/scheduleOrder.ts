/**
 * Util urutan baris jadwal untuk penyusunan tabel admin (murni, tanpa
 * React/DOM/jaringan).
 *
 * Masalah yang dipecahkan: sortir bawaan & sortir per-kolom harus selalu
 * berakhir pada urutan CHRONOLOGIS yang koheren, bukan "mengacak hari".
 * Karena itu tiap comparator di sini memuat rantai sekunder TETAP
 * (hari → JP → jam → rank kelas → urutan halaqah → mapel → guru → id);
 * hanya kunci primernya yang berganti sesuai kolom yang diklik.
 *
 * Sengaja murni supaya bisa diuji tanpa render dan dipakai ulang dari mana
 * pun (mis. export) tanpa menarik dependensi React.
 */
import type { ScheduleItem } from '../types/schedule';
// `buildClassRank` tak diimpor di sini: konteks sudah membawa `kelasRank`
// jadi, dan `noUnusedLocals` menolak impor yang tak terpakai. Pembangunan
// rank-nya ada di pemanggil (halaman Jadwal) saat menyusun konteks.
import { sessionClassRank } from './classOrder';

export interface ScheduleSortContext {
  /** Urutan hari: MONDAY=1 … FRIDAY=5; hari tak dikenal = 99. */
  dayOrder: Record<string, number>;
  /** Rank label kelas dari master (tingkat → rombel). */
  kelasRank: Map<string, number>;
  /** Peta halaqoh id → urutan. */
  halaqohUrutan: Record<string, number>;
  /** Label kelas yang dicakup sebuah baris; halaqah = seluruh kelas sumbernya. */
  labelsOf: (item: ScheduleItem) => string[];
}

/** Urutan STATUS: aktif dulu, lalu draft, lalu arsip. */
const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, DRAFT: 1, ARCHIVED: 2 };

type Cmp = (a: ScheduleItem, b: ScheduleItem) => number;

/**
 * Gabungkan beberapa comparator menjadi satu: yang pertama menentukan, dan
 * hanya bila hasilnya 0 barulah comparator berikutnya bicara. Pemakaian
 * rest-parameter mempertahankan urutan rantai secara eksplisit di tiap kunci.
 */
function chain(...cmps: Cmp[]): Cmp {
  return (a, b) => {
    for (const cmp of cmps) {
      const r = cmp(a, b);
      if (r !== 0) return r;
    }
    return 0;
  };
}

/**
 * Perbandingan baris jadwal per kolom; tiap comparator SUDAH memuat rantai
 * sekunder tetap (hari → JP → jam → rank kelas → urutan halaqah → mapel →
 * guru → id) supaya hasil sortir tetap koheren, bukan mengacak hari.
 * Nilai selalu naik (asc); arah menurun dinegasikan pemanggil.
 */
export function scheduleColumnComparators(
  ctx: ScheduleSortContext,
): Record<string, (a: ScheduleItem, b: ScheduleItem) => number> {
  const day: Cmp = (a, b) => (ctx.dayOrder[a.day] || 99) - (ctx.dayOrder[b.day] || 99);
  const period: Cmp = (a, b) => a.period_number - b.period_number;
  const time: Cmp = (a, b) => a.start_time.localeCompare(b.start_time);
  /**
   * Rank kelas memakai daftar label baris, bukan `item.kelas` mentah: baris
   * halaqah lintas kelas berkelas KOSONG (`kelas === ''`) sehingga bila dipakai
   * mentah ia "meloncat" ke atas 1A. Dengan label sumbernya, halaqah duduk di
   * kelas sumbernya yang paling kecil — persis seperti urutan bawaan.
   */
  const kelas: Cmp = (a, b) =>
    sessionClassRank(ctx.labelsOf(a), ctx.kelasRank) -
    sessionClassRank(ctx.labelsOf(b), ctx.kelasRank);
  /**
   * Baris halaqah pada jam yang sama diurutkan menurut `urutan` kelompoknya
   * agar susunan kelompok Ummi stabil antar-muat. Baris non-halaqah (tanpa
   * `halaqoh_id`) dianggap "lebih dulu" sehingga mapel umum tidak terdorong
   * ke bawah hanya karena kebetulan punya id.
   */
  const halaqoh: Cmp = (a, b) => {
    const ua = a.halaqoh_id ? ctx.halaqohUrutan[a.halaqoh_id] : undefined;
    const ub = b.halaqoh_id ? ctx.halaqohUrutan[b.halaqoh_id] : undefined;
    if (ua !== undefined && ub !== undefined) return ua - ub;
    if (ua !== undefined) return -1;
    if (ub !== undefined) return 1;
    return 0;
  };
  const subject: Cmp = (a, b) => a.subject_name.localeCompare(b.subject_name, 'id');
  const teacher: Cmp = (a, b) => a.teacher_name.localeCompare(b.teacher_name, 'id');
  const status: Cmp = (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
  /** Tie-break akhir: id baris supaya hasil sortir selalu deterministik. */
  const id: Cmp = (a, b) => a.id.localeCompare(b.id);

  return {
    day: chain(day, period, time, kelas, halaqoh, subject, teacher, id),
    time: chain(time, day, period, kelas, halaqoh, subject, teacher, id),
    period_number: chain(period, day, time, kelas, halaqoh, subject, teacher, id),
    kelas: chain(kelas, day, period, time, halaqoh, subject, teacher, id),
    subject_name: chain(subject, day, period, time, kelas, halaqoh, teacher, id),
    teacher_name: chain(teacher, day, period, time, kelas, halaqoh, subject, id),
    status: chain(status, day, period, time, kelas, halaqoh, subject, teacher, id),
  };
}

/**
 * Cache rantai default per `ctx`. Sortir memanggil comparator berkali-kali
 * (≈ n·log n); membangun ulang seluruh peta setiap pemanggilan hanya
 * membuang-buang alokasi closure. `ctx` dari halaman di-`useMemo` sehingga
 * referensinya stabil dan aman dipakai sebagai kunci WeakMap.
 */
const defaultCmpCache = new WeakMap<ScheduleSortContext, Cmp>();

/**
 * Urutan bawaan halaman jadwal: kronologis (hari → JP → jam) lalu seluruh
 * rantai sekunder, sehingga baris halaqah tidak lagi meloncat ke atas 1A
 * hanya karena `kelas`-nya kosong.
 */
export function compareSchedulesDefault(
  a: ScheduleItem,
  b: ScheduleItem,
  ctx: ScheduleSortContext,
): number {
  let cmp = defaultCmpCache.get(ctx);
  if (!cmp) {
    cmp = scheduleColumnComparators(ctx).day;
    defaultCmpCache.set(ctx, cmp);
  }
  return cmp(a, b);
}
