import React from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import { Clock, Edit3, ArrowRight } from 'lucide-react';

interface ActiveScheduleHeroProps {
  slot: TimelineSlot;
  onOpenAgenda: (slot: TimelineSlot) => void;
}

export const ActiveScheduleHero: React.FC<ActiveScheduleHeroProps> = ({
  slot,
  onOpenAgenda,
}) => {
  const { schedule } = slot;
  const startTime = schedule.start_time.slice(0, 5);
  const endTime = schedule.end_time.slice(0, 5);

  return (
    <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 rounded-2xl p-3.5 sm:p-6 text-white shadow-md relative overflow-hidden">
      {/* Background accent glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-700/80 border border-emerald-500/30 rounded-full text-2xs font-bold text-emerald-100 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping inline-block" aria-hidden="true" />
            <span>Sedang Berlangsung</span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-emerald-100 text-xs font-medium tabular-nums">
              <Clock className="w-3.5 h-3.5 text-emerald-200 shrink-0" aria-hidden="true" />
              <span>
                {startTime}–{endTime}
              </span>
              <span aria-hidden="true">&bull;</span>
              <span>Jam ke-{schedule.period_number}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white mt-0.5">
              {schedule.subject_name}
            </h2>
            <p className="text-sm text-emerald-50/90">
              <strong className="text-white">{schedule.class_id}</strong>
              <span aria-hidden="true"> &bull; </span>
              {schedule.teacher_name}
            </p>
          </div>
        </div>

        <div className="shrink-0 space-y-1.5 sm:text-right">
          <button
            type="button"
            onClick={() => onOpenAgenda(slot)}
            className="w-full sm:w-auto px-5 py-3 min-h-12 bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition"
          >
            <Edit3 className="w-5 h-5 text-emerald-700" aria-hidden="true" />
            <span>Isi Agenda Sekarang</span>
            <ArrowRight className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          </button>
          {/* Petunjuk durasi disembunyikan di HP: tombolnya sudah jelas, dan
              satu baris ini menggeser daftar jadwal turun tanpa menambah aksi. */}
          <p className="hidden sm:block text-xs text-emerald-100/80">
            Foto, materi, dan kehadiran — sekitar satu menit.
          </p>
        </div>
      </div>
    </div>
  );
};
