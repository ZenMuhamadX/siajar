import React from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import type { Substitution } from '../../types';
import {
  CheckCircle2,
  Lock,
  Play,
  AlertCircle,
  BookOpen,
  Edit3,
  Eye,
  Users,
} from 'lucide-react';

interface ScheduleTimelineCardProps {
  slot: TimelineSlot;
  onSelectSlot: (slot: TimelineSlot) => void;
  substitution?: Substitution | null;
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

  const info = (
    <div className="space-y-1.5">
      {/* Jam lebih dulu: pertanyaan pertama guru adalah "jam berapa saya mengajar?" */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-base font-bold text-slate-900 tabular-nums leading-none">
          {startTime}–{endTime}
        </span>
        <span className="text-xs font-medium text-slate-600">Jam ke-{schedule.period_number}</span>
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-800">{schedule.subject_name}</h3>
        <span className="text-xs text-slate-600 font-medium">{schedule.class_id}</span>
      </div>

      <p className="text-xs text-slate-600">{schedule.teacher_name}</p>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {isInProgress && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            <Play className="w-3 h-3 fill-current" aria-hidden="true" />
            Berlangsung
          </span>
        )}
        {isCompleted && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            Sudah Diisi
          </span>
        )}
        {isOverdue && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            Belum Diisi
          </span>
        )}
        {isUpcoming && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
            <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            Belum Dimulai
          </span>
        )}

        {substitution && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-800">
            <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Pengganti: {substitution.substitute_teacher_name}
          </span>
        )}
      </div>

      {isCompleted && existingAgenda && materiSummary && (
        <div className="flex items-start gap-1.5 text-xs text-slate-600">
          <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="italic line-clamp-1">{materiSummary}</span>
        </div>
      )}
      {isCompleted && existingAgenda && (
        <p className="text-xs text-slate-600">
          Kehadiran:{' '}
          <span className="font-medium text-slate-700">
            {absentCount === 0 ? 'Semua hadir' : `${absentCount} tidak hadir`}
          </span>
        </p>
      )}
    </div>
  );

  return (
    <div
      className={`relative rounded-xl border p-3.5 transition-all ${
        isInProgress
          ? 'bg-white border-slate-300 border-l-4 border-l-emerald-500 shadow-xs'
          : isCompleted
          ? 'bg-white border-slate-200'
          : isOverdue
          ? 'bg-white border-slate-200'
          : 'bg-slate-50/60 border-slate-200 opacity-75'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {isActionable ? (
          <button
            type="button"
            onClick={() => onSelectSlot(slot)}
            aria-label={`${isCompleted ? 'Lihat atau edit' : 'Isi'} agenda ${
              schedule.subject_name
            } kelas ${schedule.class_id} pukul ${startTime}`}
            className="flex-1 min-w-0 text-left rounded-lg transition hover:opacity-90 focus-visible:outline-none"
          >
            {info}
          </button>
        ) : (
          <div className="flex-1 min-w-0">{info}</div>
        )}

        <div className="sm:self-center shrink-0">
          {isOverdue && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="w-full sm:w-auto px-3.5 py-2.5 min-h-11 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Edit3 className="w-4 h-4" aria-hidden="true" />
              Isi Terlewat
            </button>
          )}

          {isCompleted && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="w-full sm:w-auto px-3 py-2.5 min-h-11 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
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
