import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { FullAgenda } from '../types';
import {
  getTeacherDailyTimeline,
  recomputeTimelineSlotStatuses,
  type TimelineSlot,
  type TeacherDailyTimelineResult,
} from '../services/scheduleDetectionService';
import { ScheduleTimelineCard } from '../components/agenda/ScheduleTimelineCard';
import { ActiveScheduleHero } from '../components/agenda/ActiveScheduleHero';
import { AgendaDetailForm } from '../components/agenda/AgendaDetailForm';
import {
  Calendar,
  Clock,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  Coffee,
} from 'lucide-react';

interface InputAgendaProps {
  editData?: FullAgenda | null;
  onCancelEdit?: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const InputAgenda: React.FC<InputAgendaProps> = ({
  editData,
  onCancelEdit,
  onSuccess,
  showToast,
}) => {
  const { activeTeacherName } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  // Selected date for viewing schedule timeline
  const [selectedDate, setSelectedDate] = useState<string>(
    editData?.header.tanggal || todayStr
  );

  // Timeline Data
  const [timelineData, setTimelineData] = useState<TeacherDailyTimelineResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedSlotForForm, setSelectedSlotForForm] = useState<TimelineSlot | null>(null);
  const [isFormViewActive, setIsFormViewActive] = useState<boolean>(Boolean(editData));

  // If editData is provided from Riwayat/App, activate form view directly
  useEffect(() => {
    if (editData) {
      setIsFormViewActive(true);
      if (editData.header.tanggal) {
        setSelectedDate(editData.header.tanggal);
      }
    }
  }, [editData]);

  // Fetch Teacher Timeline for selected date
  const fetchTimeline = useCallback(async () => {
    if (!activeTeacherName) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await getTeacherDailyTimeline(activeTeacherName, selectedDate, new Date());
      setTimelineData(result);
    } catch (err) {
      console.error('Error fetching teacher timeline:', err);
      showToast('error', 'Gagal memuat timeline jadwal mengajar.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTeacherName, selectedDate, showToast]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Lightweight 30s auto-refresh timer to update slot statuses in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setTimelineData((prev) => {
        if (!prev || prev.slots.length === 0) return prev;
        const recomputed = recomputeTimelineSlotStatuses(prev.slots, selectedDate, new Date());
        return {
          ...prev,
          slots: recomputed.slots,
          activeSlot: recomputed.activeSlot,
        };
      });
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTimeline();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedDate, fetchTimeline]);

  // Date Navigation Helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
  };

  // Format date display (e.g. "Senin, 14 September 2026")
  const formatDateIndo = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isViewingToday = selectedDate === todayStr;

  // Open slot for filling or editing
  const handleOpenSlot = (slot: TimelineSlot) => {
    setSelectedSlotForForm(slot);
    setIsFormViewActive(true);
  };

  const handleBackToTimeline = () => {
    setIsFormViewActive(false);
    setSelectedSlotForForm(null);
    if (editData && onCancelEdit) {
      onCancelEdit();
    }
  };

  const handleSuccessSave = () => {
    fetchTimeline();
    setIsFormViewActive(false);
    setSelectedSlotForForm(null);
    onSuccess();
  };

  // IF FORM VIEW IS ACTIVE -> Render Full Page / Embedded AgendaDetailForm
  if (isFormViewActive) {
    return (
      <div className="max-w-5xl mx-auto">
        {/* Edit Mode Alert Banner (if opened via direct editData) */}
        {editData && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Mode <strong>Koreksi / Edit Agenda</strong> ({editData.header.kelas} &bull;{' '}
                {editData.header.tanggal})
              </span>
            </div>
            {onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-2.5 py-1 bg-white border border-amber-300 rounded-md font-semibold text-amber-800 hover:bg-amber-100 transition"
              >
                Batal Koreksi
              </button>
            )}
          </div>
        )}

        <AgendaDetailForm
          onBack={handleBackToTimeline}
          slot={selectedSlotForForm}
          targetDate={selectedDate}
          activeTeacherName={activeTeacherName || ''}
          onSuccessSave={handleSuccessSave}
          showToast={showToast}
          directEditData={editData}
        />
      </div>
    );
  }

  // DEFAULT VIEW: SCHEDULE TIMELINE
  const completedSlotsCount =
    timelineData?.slots.filter((s) => s.status === 'COMPLETED').length || 0;
  const totalSlotsCount = timelineData?.slots.length || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 md:pb-6">
      {/* Main Container Card */}
      <div className="bg-white border border-slate-200 sm:border-slate-300 rounded-2xl shadow-xs overflow-hidden">
        {/* TOP BAR: Navigation & Date Picker */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Isi Agenda Mengajar
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Guru: <strong className="text-slate-700">{activeTeacherName || 'Guru'}</strong>
              </p>
            </div>

            {/* Date Navigation Bar */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                title="Hari Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={handleNextDay}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                title="Hari Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {!isViewingToday && (
                <button
                  type="button"
                  onClick={handleSetToday}
                  className="ml-1 px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
                >
                  Hari Ini
                </button>
              )}
            </div>
          </div>

          {/* Subheader: Selected Date in Indonesian & Summary */}
          <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              {formatDateIndo(selectedDate)}
            </span>

            {totalSlotsCount > 0 && (
              <span className="text-[11px] text-slate-500">
                Progress Agenda:{' '}
                <strong className="text-emerald-700 font-bold">
                  {completedSlotsCount} dari {totalSlotsCount} Selesai
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* BODY CONTENT: Timeline & Hero */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Loading State */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span>Memuat timeline jadwal mengajar...</span>
            </div>
          ) : timelineData?.conflictDetected ? (
            /* CASE: Conflict Detected */
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                    Jadwal Bertabrakan (Konflik)
                  </h3>
                  <p className="text-xs text-rose-800 mt-1">
                    {timelineData.conflictMessage ||
                      'Terdapat jadwal yang bertabrakan pada waktu ini. Hubungi administrator.'}
                  </p>
                </div>
              </div>
            </div>
          ) : timelineData?.reason === 'WEEKEND' ? (
            /* CASE: Weekend */
            <div className="py-10 text-center space-y-2">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <Coffee className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Akhir Pekan (Sabtu / Minggu)
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tidak ada jadwal pembelajaran reguler pada hari akhir pekan.
              </p>
            </div>
          ) : timelineData?.reason === 'NO_ACTIVE_ACADEMIC_YEAR' ? (
            /* CASE: No Active Academic Year */
            <div className="py-10 text-center space-y-2">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Tidak Ada Tahun Ajaran Aktif
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tahun ajaran belum diaktifkan oleh administrator.
              </p>
            </div>
          ) : !timelineData || timelineData.slots.length === 0 ? (
            /* CASE: No Schedule on this day */
            <div className="py-10 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Tidak Ada Jadwal Mengajar
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Anda tidak memiliki jadwal mengajar pada tanggal {formatDateIndo(selectedDate)}.
              </p>
            </div>
          ) : (
            /* NORMAL TIMELINE VIEW */
            <div className="space-y-6">
              {/* SECTION 1: PROMINENT ACTIVE HERO CARD (If viewing today & has active slot) */}
              {isViewingToday &&
                timelineData.activeSlot &&
                timelineData.activeSlot.status === 'IN_PROGRESS' && (
                  <ActiveScheduleHero
                    slot={timelineData.activeSlot}
                    onOpenAgenda={handleOpenSlot}
                  />
                )}

              {/* SECTION 2: JADWAL HARI INI / TIMELINE LIST */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      {isViewingToday ? 'Jadwal Hari Ini' : `Jadwal (${timelineData.dayName})`}
                    </span>
                  </h2>

                  <span className="text-[11px] text-slate-400">
                    {timelineData.slots.length} Slot Pembelajaran
                  </span>
                </div>

                <div className="space-y-2.5">
                  {timelineData.slots.map((slot) => (
                    <ScheduleTimelineCard
                      key={slot.schedule.id}
                      slot={slot}
                      onSelectSlot={handleOpenSlot}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
