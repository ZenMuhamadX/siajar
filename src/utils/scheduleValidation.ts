import type { ScheduleItem, ScheduleConflictCheckResult } from '../types/schedule';

/**
 * Converts a time string (HH:mm or HH:mm:ss) to minutes from start of day.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Checks if two time ranges [startA, endA) and [startB, endB) overlap.
 * Note: Back-to-back periods (e.g. 08:00 - 08:35 and 08:35 - 09:10) do NOT overlap.
 */
export function isTimeOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

  // Strict interval overlap: max(aStart, bStart) < min(aEnd, bEnd)
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

/**
 * Validates a target schedule against a list of existing schedules.
 * Checks for:
 * 1. Invalid time range (start >= end)
 * 2. Teacher conflict (same day, same teacher, overlapping time)
 * 3. Halaqoh conflict (same day, same halaqoh, overlapping time)
 * 4. Class conflict (same day, same class, overlapping time) — hanya untuk
 *    baris yang berlaku untuk SELURUH kelas
 *
 * Rules:
 * - Only checks items in same academic year
 * - Ignores ARCHIVED items (archived schedules do not cause conflicts)
 * - Ignores self (by id) when updating an existing schedule
 *
 * ---------------------------------------------------------------------------
 * ATURAN INTI HALAQOH UMMI
 * ---------------------------------------------------------------------------
 * Yang dianggap "ruang" yang tidak boleh terisi dua kali adalah HALAQOH, bukan
 * KELAS. Konsekuensinya, dua baris Ummi di kelas yang sama pada jam yang sama
 * adalah SAH — justru itulah bentuk pengajarannya (dua kelompok, dua guru,
 * jam yang sama).
 *
 * Karena itu bentrok kelas hanya diperiksa bila KEDUA baris berlaku untuk
 * seluruh kelas (`halaqoh_id` kosong di kedua sisi). Begitu salah satunya
 * punya halaqoh, pemeriksaan kelas dilewati dan digantikan pemeriksaan halaqoh.
 *
 * Sejak "halaqoh lintas kelas", satu halaqoh boleh mencakup BEBERAPA kelas.
 * Aturannya menjadi:
 *   - dua halaqoh berbeda TIDAK pernah bentrok satu sama lain — anggotanya
 *     tidak tumpang-tindih (satu siswa satu halaqoh per tahun), jadi kelas
 *     yang sama boleh punya dua halaqoh pada jam yang sama. Itulah bentuk
 *     pengajaran Ummi;
 *   - halaqoh BENTROK dengan sesi SELURUH KELAS dari kelas mana pun yang
 *     menyuplai halaqoh itu — sebab siswa kelas tersebut ada di dua tempat.
 *     Inilah aturan (4) di bawah, dan ia butuh peta kelas sumber halaqoh
 *     (`halaqohKelas`) yang diteruskan pemanggil.
 */
export function checkScheduleConflict(
  target: {
    id?: string;
    academic_year_id: string;
    day: string;
    start_time: string;
    end_time: string;
    /** Label kelas, mis. '1A'. */
    kelas: string;
    teacher_name: string;
    /**
     * `teacher_id` — kunci sebenarnya untuk mendeteksi bentrok guru.
     *
     * Perbandingan lewat nama pernah dipakai dan itu keliru: dua guru bernama
     * sama ("Ust. Ahmad") dianggap satu orang, sehingga muncul bentrok palsu
     * yang tidak bisa dijelaskan pengguna. Nama hanya dipakai sebagai cadangan
     * untuk baris lama yang belum punya `teacher_id`.
     */
    teacher_id?: string | null;
    /** Halaqoh baris ini; kosong berarti berlaku seluruh kelas. */
    halaqoh_id?: string | null;
    halaqoh?: string;
    status?: string;
  },
  existingSchedules: ScheduleItem[],
  /**
   * Peta halaqoh → label kelas sumbernya. Dipakai aturan (4). Kosong berarti
   * pemeriksaan halaqoh-vs-kelas dilewati (perilaku sebelum fitur ini).
   */
  halaqohKelas: Record<string, string[]> = {}
): ScheduleConflictCheckResult {
  const startMin = timeToMinutes(target.start_time);
  const endMin = timeToMinutes(target.end_time);

  if (startMin >= endMin) {
    return {
      hasConflict: true,
      message: `Jam mulai (${target.start_time}) harus lebih awal dari jam selesai (${target.end_time}).`,
    };
  }

  // Target being archived never creates conflict
  if (target.status === 'ARCHIVED') {
    return { hasConflict: false };
  }

  const normalizedTeacher = target.teacher_name.trim().toLowerCase();
  const targetTeacherId = target.teacher_id ?? null;
  const targetHalaqohId = target.halaqoh_id ?? null;
  // Kelas di kedua sisi berasal dari master data yang sama, jadi perbandingannya
  // bisa langsung. Normalisasi `.trim().toUpperCase()` yang dulu dipakai sudah
  // tidak perlu — itu justru gejala pencocokan berbasis teks bebas.
  const targetKelas = target.kelas;

  for (const item of existingSchedules) {
    // Skip self
    if (target.id && item.id === target.id) continue;
    // Skip different academic year
    if (item.academic_year_id !== target.academic_year_id) continue;
    // Skip archived schedules
    if (item.status === 'ARCHIVED') continue;
    // Skip different day
    if (item.day !== target.day) continue;

    // Check time overlap
    const overlaps = isTimeOverlapping(
      target.start_time,
      target.end_time,
      item.start_time,
      item.end_time
    );

    if (!overlaps) continue;

    // 1. Teacher conflict — dibandingkan lewat ID, bukan nama.
    //
    // `teacher_name` tetap dipakai sebagai cadangan HANYA bila salah satu sisi
    // tidak punya id (baris lama). Tanpa cadangan itu, baris lama yang belum
    // ber-`teacher_id` tidak akan pernah terdeteksi bentrok.
    const sameTeacher = targetTeacherId
      ? item.teacher_id === targetTeacherId
      : item.teacher_name.trim().toLowerCase() === normalizedTeacher;

    if (sameTeacher) {
      return {
        hasConflict: true,
        type: 'TEACHER_CONFLICT',
        conflictingItem: item,
        message: `Bentrok Guru: ${item.teacher_name} sudah memiliki jadwal di ${item.kelas} (${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}) pada hari yang sama.`,
      };
    }

    // 2. Halaqoh conflict — halaqoh yang sama tidak boleh di dua tempat.
    //
    // Diperiksa SEBELUM bentrok kelas, karena sifatnya lebih spesifik: dua baris
    // dengan halaqoh sama jelas-jelas memperebutkan kelompok siswa yang sama.
    if (targetHalaqohId && item.halaqoh_id === targetHalaqohId) {
      const namaHalaqoh = target.halaqoh || item.halaqoh || 'halaqoh ini';
      return {
        hasConflict: true,
        type: 'HALAQOH_CONFLICT',
        conflictingItem: item,
        message: `Bentrok Halaqoh: ${namaHalaqoh} sudah punya jadwal "${item.subject_name}" (${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}) pada hari yang sama.`,
      };
    }

    // 3. Class conflict — HANYA bila kedua baris berlaku untuk seluruh kelas.
    //
    // Kalau salah satunya punya halaqoh, keduanya memang boleh berdampingan:
    // mereka mengajar kelompok siswa yang berbeda. Ini yang membuat Bentuk B
    // (dua halaqoh, jam sama) bisa disimpan.
    const bothWholeClass = !targetHalaqohId && !item.halaqoh_id;
    if (bothWholeClass && item.kelas === targetKelas) {
      return {
        hasConflict: true,
        type: 'CLASS_CONFLICT',
        conflictingItem: item,
        message: `Bentrok Kelas: ${item.kelas} sudah memiliki jadwal mata pelajaran "${item.subject_name}" dengan ${item.teacher_name} (${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}).`,
      };
    }

    // 4. Halaqoh vs seluruh kelas.
    //
    // Sesi halaqoh dan sesi SELURUH-KELAS dari kelas yang menyuplai halaqoh itu
    // tidak boleh bertumpuk: siswa kelas tersebut akan berada di dua tempat.
    // Dua halaqoh berbeda sengaja TIDAK diperiksa di sini — mereka memang boleh
    // berdampingan (satu kelas dipecah jadi beberapa kelompok).
    const satuHalaqohSaja = Boolean(targetHalaqohId) !== Boolean(item.halaqoh_id);
    if (satuHalaqohSaja) {
      const targetKelasSet = targetHalaqohId
        ? halaqohKelas[targetHalaqohId] ?? []
        : [targetKelas];
      const itemKelasSet = item.halaqoh_id ? halaqohKelas[item.halaqoh_id] ?? [] : [item.kelas];
      if (targetKelasSet.some((k) => itemKelasSet.includes(k))) {
        return {
          hasConflict: true,
          type: 'CLASS_CONFLICT',
          conflictingItem: item,
          message: `Bentrok Kelas: sesi halaqoh dan jadwal seluruh kelas (${item.kelas}) bertumpuk — sebagian siswa akan masuk dua tempat. Sesuaikan jam atau kelas sumbernya.`,
        };
      }
    }
  }

  return { hasConflict: false };
}
