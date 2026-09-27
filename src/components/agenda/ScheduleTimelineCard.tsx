import React from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import type { Substitution } from '../../types';
import {
  CheckCircle2,
  ChevronRight,
  Lock,
  Play,
  AlertCircle,
  Edit3,
  Eye,
  Users,
} from 'lucide-react';

interface ScheduleTimelineCardProps {
  slot: TimelineSlot;
  onSelectSlot: (slot: TimelineSlot) => void;
  substitution?: Substitution | null;
  /**
   * Urutan kartu di daftar — hanya untuk menjeda animasi masuknya.
   * Dibatasi 6 langkah supaya daftar delapan jam tidak membuat guru menunggu.
   */
  index?: number;
}

/**
 * Kartu satu slot jadwal.
 *
 * Perubahan penting dibanding versi sebelumnya: seluruh area informasi kini
 * bisa diketuk, bukan hanya tombol kecil di kanan. Sebelumnya kartu ini
 * terlihat seperti kartu yang bisa ditekan tetapi tidak bereaksi, dan slot yang
 * SEDANG BERLANGSUNG bahkan tidak punya tombol sama sekali di daftar (hanya
 * kartu besar di atas) sehingga kartunya benar-benar mati.
 *
 * Sekarang kartu aktif dan kartu besar di atas sama-sama membuka form yang
 * sama — tidak ada lagi tebak-tebakan mana yang harus ditekan.
 *
 * Tata letaknya sengaja meniru pola `RiwayatCard`: area informasi adalah satu
 * tombol, tombol aksi berdiri terpisah di luarnya, supaya tidak ada tombol
 * bersarang di dalam tombol.
 */
export const ScheduleTimelineCard: React.FC<ScheduleTimelineCardProps> = ({
  slot,
  onSelectSlot,
  substitution,
  index = 0,
}) => {
  const { schedule, status, existingAgenda } = slot;
  const startTime = schedule.start_time.slice(0, 5);
  const endTime = schedule.end_time.slice(0, 5);

  const isCompleted = status === 'COMPLETED';
  const isInProgress = status === 'IN_PROGRESS';
  const isUpcoming = status === 'UPCOMING';
  const isOverdue = status === 'OVERDUE';

  const materiSummary = existingAgenda?.kbm?.[0]?.materi || '';
  const absentCount = existingAgenda?.absensi?.length || 0;

  // Semua status selain UPCOMING bisa dibuka — termasuk yang sedang berlangsung.
  const isActionable = !isUpcoming;

  /**
   * Ringkasan isi agenda yang sudah diisi — satu baris, bukan dua.
   *
   * Sebelumnya materi dan kehadiran masing-masing menempati barisnya sendiri
   * dengan label ("Kehadiran: …"), sehingga kartu yang sudah diisi justru
   * menjadi yang paling tinggi.
   *
   * "Semua hadir" sengaja TIDAK ditulis: itu keadaan normal, dan diukur di
   * 360px kata-kata itu memakan ~80px sehingga ringkasan materi terpotong
   * ("Mengenal huruf hijaiyah · sema…"). Yang perlu terlihat di daftar adalah
   * saat ADA yang tidak hadir — dan itu tetap ditampilkan.
   */
  const detailLine = [materiSummary, absentCount > 0 ? `${absentCount} tidak hadir` : '']
    .filter(Boolean)
    .join(' · ');

  /**
   * Lencana status — satu tempat, supaya keempat keadaan punya bentuk yang
   * sama dan tidak ada dua gaya berbeda untuk hal yang setara.
   */
  const statusPill = isInProgress ? (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-1 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 whitespace-nowrap">
      <Play className="w-3 h-3 fill-current shrink-0" aria-hidden="true" />
      Berlangsung
    </span>
  ) : isCompleted ? (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-1 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Sudah Diisi
    </span>
  ) : isOverdue ? (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-1 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-300 whitespace-nowrap">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Belum Diisi
    </span>
  ) : (
    /* "Belum Dimulai" → "Terkunci": diukur di 320px, label panjang itu
       mendorong kartu melampaui tepinya sejauh 19px karena lencana status
       dan kolom kelas/JP sama-sama tidak boleh mengecil. "Terkunci" dengan
       ikon gembok menyampaikan hal yang sama dan muat di semua lebar. */
    <span className="inline-flex items-center gap-1 text-xs font-medium px-1 py-0.5 bg-slate-100 text-slate-600 rounded whitespace-nowrap">
      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
      Terkunci
    </span>
  );

  /**
   * Susunan kartu — seperti baris tabel, tiga kolom yang selalu sejajar.
   *
   * Sebelumnya isi kartu berupa tumpukan 4–6 baris dengan ukuran huruf campur
   * (16px jam, 14px mapel, 14px nama guru, lencana, materi, kehadiran),
   * sehingga tidak ada satu pun kolom yang sejajar antar-kartu dan daftar
   * delapan jam menjadi sulit dipindai.
   *
   * Sekarang:
   *   09:35   Pendidikan Agama Islam dan Budi Pekerti
   *   10:10   KELAS 6 · JP 2          [Sudah Diisi]
   *           Tajwid hukum nun mati · 2 tidak hadir
   *
   * Keputusan tata letak yang diambil dari pengukuran, bukan selera:
   * - Nama guru DIHAPUS. `getTeacherDailyTimeline` menyaring jadwal menurut
   *   nama guru yang sedang login, jadi seluruh kartu di halaman ini pasti
   *   milik guru itu sendiri — satu baris penuh terbuang delapan kali hanya
   *   untuk mengulang nama yang sama. Nama guru lain tetap muncul sebagai
   *   "Pengganti" bila slot ini dibadal.
   * - Lencana status duduk di baris KEDUA, bukan di samping nama mapel.
   *   Diukur di 360px: menaruhnya di baris pertama menyisakan hanya ~124px
   *   untuk nama mapel, sehingga "Pendidikan Agama Islam dan Budi Pekerti"
   *   terpotong menjadi "Pendidikan Agama Isla…". Di baris kedua nama mapel
   *   mendapat lebar penuh dan tidak ada lagi yang terpotong.
   * - "Jam ke-N" diringkas menjadi "JP N" — sama dengan istilah yang dipakai
   *   tabel di "Jadwal Saya", dan menghemat ~35px di baris yang padat.
   */
  const info = (
    <div className="flex items-start gap-2.5">
      {/* Kolom jam — lebar tetap dan rata kanan, supaya SEMUA kartu sejajar.
          2.75rem cukup untuk "09:35" tabular 14px (≈38px) dan menyisakan lebar
          untuk isi di sebelahnya, yang justru paling sempit di layar 320px. */}
      <div className="w-11 shrink-0 text-right pt-px">
        <div className="text-sm font-bold text-slate-900 tabular-nums leading-tight">
          {startTime}
        </div>
        <div className="text-xs text-slate-500 tabular-nums leading-tight">{endTime}</div>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        {/* Baris 1 — nama mapel, selebar penuh. */}
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
          {schedule.subject_name}
        </h3>

        {/* Baris 2 — kelas & JP di kiri, status di kanan; selalu segaris.
            Sengaja TIDAK memakai `flex-wrap`: dengan lipatan, lencana status
            yang lebar mendorong "· JP 3" turun ke baris berikutnya dan
            menyisakan tanda "·" menggantung di ujung baris — justru terlihat
            lebih berantakan daripada sebelumnya. Ruangnya cukup selama isinya
            hanya kelas dan JP. */}
        <div className="flex items-center justify-between gap-1.5">
          {/* `shrink-0` + `whitespace-nowrap` di sini penting: tanpa keduanya
              lencana "KELAS 3" terhimpit dan terbelah menjadi dua baris
              ("KELAS" / "3") karena lencana status di kanan tidak mau mengecil. */}
          <span className="flex items-center gap-x-1.5 shrink-0 text-xs text-slate-600">
            <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">
              {schedule.class_id}
            </span>
            <span aria-hidden="true">&bull;</span>
            <span className="tabular-nums whitespace-nowrap">JP {schedule.period_number}</span>
          </span>
          <span className="shrink-0">{statusPill}</span>
        </div>

        {/* Baris 3 — pengganti bila slot ini dibadal. Ditaruh di barisnya
            sendiri, bukan disisipkan ke baris 2: nama guru pengganti panjang
            ("Siti Aminah, S.Pd") dan akan memecah baris kelas/JP. */}
        {substitution && (
          <p className="flex items-center gap-1 text-xs text-amber-800 font-medium line-clamp-1">
            <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Pengganti: {substitution.substitute_teacher_name}
          </p>
        )}

        {/* Baris terakhir — hanya untuk agenda yang sudah diisi. */}
        {isCompleted && existingAgenda && detailLine && (
          <p className="text-xs text-slate-500 line-clamp-1">{detailLine}</p>
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{ animationDelay: `${60 + Math.min(index, 6) * 30}ms` }}
      className={`card-press stagger-in relative rounded-xl border p-3 sm:p-3.5 ${
        isInProgress
          ? 'bg-white border-slate-300 border-l-4 border-l-emerald-500 shadow-xs'
          : isCompleted
          ? 'bg-white border-slate-200'
          : isOverdue
          ? 'bg-white border-slate-200'
          : 'bg-slate-50/60 border-slate-200 opacity-75'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {isActionable ? (
          <button
            type="button"
            onClick={() => onSelectSlot(slot)}
            aria-label={`${isCompleted ? 'Lihat atau edit' : 'Isi'} agenda ${
              schedule.subject_name
            } kelas ${schedule.class_id} pukul ${startTime}`}
            className="card-hit flex-1 min-w-0 text-left rounded-lg transition hover:opacity-90 focus-visible:outline-none"
          >
            {info}
          </button>
        ) : (
          <div className="flex-1 min-w-0">{info}</div>
        )}

        {/* Penanda "bisa dibuka" khusus HP.
            Kartunya sendiri sudah bisa diketuk, jadi tombol berlabel selebar
            kartu hanya mengulang status yang sudah tertulis di dalamnya
            ("Sudah Diisi" + "Lihat / Edit", "Belum Diisi" + "Isi Terlewat").
            Satu tanda panah cukup, dan menghemat ±48px per kartu — dengan
            delapan jam mengajar itu nyaris satu layar penuh.
            Slot UPCOMING tidak dapat tanda ini karena memang tidak bisa dibuka;
            info di dalamnya sudah memuat jam dan lencana "Belum Dimulai". */}
        {isActionable && (
          <ChevronRight className="sm:hidden w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
        )}

        {/* Tombol berlabel: hanya dari `sm` ke atas, tempat lebar tidak langka. */}
        <div className="hidden sm:block shrink-0">
          {isOverdue && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="px-3.5 py-2.5 min-h-11 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Edit3 className="w-4 h-4" aria-hidden="true" />
              Isi Terlewat
            </button>
          )}

          {isCompleted && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="px-3 py-2.5 min-h-11 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Eye className="w-4 h-4 text-slate-600" aria-hidden="true" />
              Lihat / Edit
            </button>
          )}

          {/* Slot berlangsung: kartu besar di atas adalah ajakan utama, tetapi
              kartu ini tetap bisa diketuk — dulu kartunya benar-benar mati dan
              guru harus menebak mana yang harus ditekan. */}
          {isInProgress && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg">
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              Ketuk untuk mengisi
            </span>
          )}

          {isUpcoming && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Dibuka pukul {startTime}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
