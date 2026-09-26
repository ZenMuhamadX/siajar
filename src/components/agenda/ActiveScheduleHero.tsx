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
    <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 rounded-2xl p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
      {/* Background accent glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-700/80 border border-emerald-500/30 rounded-full text-[13px] font-bold text-emerald-100 tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping inline-block" />
            <span>Jadwal Sedang Berlangsung</span>
          </div>

          <div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs font-mono font-medium">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span>{startTime} – {endTime}</span>
              <span>&bull;</span>
              <span>Jam {schedule.period_number}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white mt-0.5">
              {schedule.subject_name}
            </h2>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              <strong className="text-white">{schedule.class_id}</strong> &bull; {schedule.teacher_name}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenAgenda(slot)}
          className="px-5 py-3 bg-white hover:bg-emerald-50 active:scale-98 text-emerald-900 font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition shrink-0"
        >
          <Edit3 className="w-4 h-4 text-emerald-700" />
          <span>Isi Agenda Sekarang</span>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
        </button>
      </div>
    </div>
  );
};
