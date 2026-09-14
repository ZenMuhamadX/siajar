import React from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import {
  Clock,
  CheckCircle2,
  Lock,
  Play,
  AlertCircle,
  BookOpen,
  Edit3,
  Eye,
} from 'lucide-react';

interface ScheduleTimelineCardProps {
  slot: TimelineSlot;
  onSelectSlot: (slot: TimelineSlot) => void;
}

export const ScheduleTimelineCard: React.FC<ScheduleTimelineCardProps> = ({
  slot,
  onSelectSlot,
}) => {
  const { schedule, status, existingAgenda } = slot;
  const startTime = schedule.start_time.slice(0, 5);
  const endTime = schedule.end_time.slice(0, 5);

  const isCompleted = status === 'COMPLETED';
  const isInProgress = status === 'IN_PROGRESS';
  const isUpcoming = status === 'UPCOMING';
  const isOverdue = status === 'OVERDUE';

  // Get summary of completed agenda
  const materiSummary = existingAgenda?.kbm?.[0]?.materi || '';
  const absentCount = existingAgenda?.absensi?.length || 0;
  const hasPhoto = Boolean(existingAgenda?.evidence?.storage_path);

  return (
    <div
      className={`relative rounded-xl border transition-all p-3.5 sm:p-4 ${
        isInProgress
          ? 'bg-emerald-50/70 border-emerald-300 shadow-sm ring-1 ring-emerald-400/40'
          : isCompleted
          ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          : isOverdue
          ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
          : 'bg-slate-50/80 border-slate-200 opacity-80'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Schedule Information */}
        <div className="space-y-1.5 flex-1">
          {/* Top meta: Time and Period */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-md ${
                isInProgress
                  ? 'bg-emerald-700 text-white'
                  : isCompleted
                  ? 'bg-slate-100 text-slate-700'
                  : isOverdue
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              <Clock className="w-3 h-3 shrink-0" />
              {startTime} – {endTime}
            </span>

            <span className="text-[11px] font-semibold text-slate-500">
              Jam {schedule.period_number}
            </span>

            {/* Status Badge */}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Sudah Diisi
              </span>
            )}

            {isInProgress && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-600 text-white rounded-full animate-pulse">
                <Play className="w-2.5 h-2.5 fill-current" />
                Sedang Berlangsung
              </span>
            )}

            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Belum Diisi
              </span>
            )}

            {isUpcoming && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                <Lock className="w-3 h-3 text-slate-500" />
                Belum Dimulai
              </span>
            )}
          </div>

          {/* Main Title: Subject & Class */}
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              {schedule.subject_name}
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
              {schedule.class_id}
            </span>
          </div>

          {/* Teacher Name */}
          <p className="text-xs text-slate-500">
            Guru Pengampu: <span className="font-medium text-slate-700">{schedule.teacher_name}</span>
          </p>

          {/* If Completed: Brief agenda summary */}
          {isCompleted && existingAgenda && (
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-xs">
              {materiSummary && (
                <div className="flex items-start gap-1.5 text-slate-600 line-clamp-2">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="italic">{materiSummary}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-0.5">
                <span>
                  Kehadiran: <strong>{absentCount === 0 ? 'Lengkap (Nihil)' : `${absentCount} Tidak Hadir`}</strong>
                </span>
                {hasPhoto && (
                  <span className="text-emerald-700 font-medium">&bull; Foto Tersedia</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="sm:self-center shrink-0">
          {isInProgress && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Isi Agenda</span>
            </button>
          )}

          {isOverdue && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="w-full sm:w-auto px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Isi Agenda Terlewat</span>
            </button>
          )}

          {isCompleted && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="w-full sm:w-auto px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Lihat / Edit</span>
            </button>
          )}

          {isUpcoming && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 bg-slate-100 rounded-lg border border-slate-200 cursor-not-allowed">
              <Lock className="w-3.5 h-3.5" />
              <span>Terkunci</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
