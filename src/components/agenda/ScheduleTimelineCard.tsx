import React from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import type { Substitution } from '../../types';
import {
  Clock,
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

  return (
    <div
      className={`relative rounded-xl border transition-all p-3.5 ${
        isInProgress
          ? 'bg-white border-slate-300 shadow-xs'
          : isCompleted
          ? 'bg-white border-slate-200'
          : isOverdue
          ? 'bg-white border-slate-200'
          : 'bg-slate-50/60 border-slate-200 opacity-75'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Schedule Information */}
        <div className="space-y-1.5 flex-1">
          {/* Time + Period + Status */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 font-mono text-slate-600 font-semibold">
              <Clock className="w-3 h-3 text-slate-400" />
              {startTime} – {endTime}
            </span>

            <span className="text-slate-400 text-[11px]">Jam {schedule.period_number}</span>

            {/* Status badge — minimal */}
            {isInProgress && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                <Play className="w-2.5 h-2.5 fill-current" />
                Berlangsung
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-slate-500" />
                Sudah Diisi
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-amber-700 rounded-full border border-amber-100">
                <AlertCircle className="w-3 h-3" />
                Belum Diisi
              </span>
            )}
            {isUpcoming && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">
                <Lock className="w-3 h-3" />
                Belum Dimulai
              </span>
            )}
          </div>

          {/* Subject + Class */}
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-bold text-slate-900">{schedule.subject_name}</h3>
            <span className="text-xs text-slate-500 font-medium">{schedule.class_id}</span>
          </div>

          {/* Teacher */}
          <p className="text-xs text-slate-500">
            {schedule.teacher_name}
          </p>

          {/* Badal badge */}
          {substitution && (
            <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-700">
              <Users className="w-3 h-3 shrink-0" />
              Pengganti: {substitution.substitute_teacher_name}
            </div>
          )}

          {/* Completed summary */}
          {isCompleted && existingAgenda && materiSummary && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
              <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="italic line-clamp-1">{materiSummary}</span>
            </div>
          )}
          {isCompleted && existingAgenda && (
            <p className="text-[11px] text-slate-400">
              Kehadiran: <span className="font-medium text-slate-600">{absentCount === 0 ? 'Nihil' : `${absentCount} tidak hadir`}</span>
            </p>
          )}
        </div>

        {/* Right: Action — NO button for IN_PROGRESS (handled by hero card) */}
        <div className="sm:self-center shrink-0">
          {isOverdue && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="w-full sm:w-auto px-3.5 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Isi Terlewat
            </button>
          )}

          {isCompleted && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="w-full sm:w-auto px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              Lihat / Edit
            </button>
          )}

          {isUpcoming && (
            <div className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 rounded-lg cursor-not-allowed">
              <Lock className="w-3.5 h-3.5" />
            </div>
          )}

          {/* IN_PROGRESS: no button here — hero card handles it */}
        </div>
      </div>
    </div>
  );
};
