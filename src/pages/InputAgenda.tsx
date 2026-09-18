import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { FullAgenda, Substitution } from '../types';
import {
  getTeacherDailyTimeline,
  getAllClassesTimelineForDate,
  recomputeTimelineSlotStatuses,
  type TimelineSlot,
  type TeacherDailyTimelineResult,
} from '../services/scheduleDetectionService';
import {
  getSubstitutionsForDate,
  createSubstitution,
} from '../services/substitutionService';
import { getDaftarGuru } from '../services/agendaService';
import { getAcademicYears } from '../services/scheduleService';
import { ScheduleTimelineCard } from '../components/agenda/ScheduleTimelineCard';
import { ActiveScheduleHero } from '../components/agenda/ActiveScheduleHero';
import { AgendaDetailForm } from '../components/agenda/AgendaDetailForm';
import { SubstitutionConfirmModal } from '../components/agenda/SubstitutionConfirmModal';
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
  Users,
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

  // Timeline Data (own schedules)
  const [timelineData, setTimelineData] = useState<TeacherDailyTimelineResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedSlotForForm, setSelectedSlotForForm] = useState<TimelineSlot | null>(null);
  const [isFormViewActive, setIsFormViewActive] = useState<boolean>(Boolean(editData));

  // Substitution state
  const [otherSlots, setOtherSlots] = useState<TimelineSlot[]>([]);
  const [substitutionsMap, setSubstitutionsMap] = useState<Record<string, Substitution>>({});
  const [isLoadingOther, setIsLoadingOther] = useState(false);
  const [substitutionTarget, setSubstitutionTarget] = useState<TimelineSlot | null>(null);
  const [substitutionLoading, setSubstitutionLoading] = useState(false);
  const [substitutionError, setSubstitutionError] = useState<string | undefined>();
  // Track the confirmed substitution to pass to AgendaDetailForm
  const [activeSubstitution, setActiveSubstitution] = useState<Substitution | null>(null);
  const [isSubstituteMode, setIsSubstituteMode] = useState(false);
  // UX gate: panel kandidat badal hanya muncul saat diklik
  const [showBadalPanel, setShowBadalPanel] = useState(false);

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

  // Fetch other classes slots (for substitute flow) — only on weekdays
  const fetchOtherSlots = useCallback(async () => {
    if (!activeTeacherName || activeTeacherName === 'Administrator') return;

    const dayOfWeek = new Date(selectedDate + 'T00:00:00').getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setOtherSlots([]);
      return;
    }

    setIsLoadingOther(true);
    try {
      const [slots, subs] = await Promise.all([
        getAllClassesTimelineForDate(selectedDate, activeTeacherName, new Date()),
        getSubstitutionsForDate(selectedDate),
      ]);

      // Build substitutions map: scheduleId -> Substitution
      const map: Record<string, Substitution> = {};
      for (const sub of subs) {
        map[sub.schedule_id] = sub;
      }
      setSubstitutionsMap(map);

      // Only keep slots that are CURRENTLY IN PROGRESS (by current time)
      // OVERDUE and UPCOMING are intentionally excluded:
      //   - OVERDUE: historical slots already passed, not actionable for real-time badal
      //   - UPCOMING: not started yet, not time-relevant
      const relevant = slots.filter((s) => s.status === 'IN_PROGRESS');
      setOtherSlots(relevant);
    } catch (err) {
      console.warn('Gagal memuat slot kelas lain:', err);
    } finally {
      setIsLoadingOther(false);
    }
  }, [activeTeacherName, selectedDate]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  useEffect(() => {
    fetchOtherSlots();
  }, [fetchOtherSlots]);

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
        fetchOtherSlots();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedDate, fetchTimeline, fetchOtherSlots]);

  // Date Navigation Helpers
  const handleSetDate = (newDate: string) => {
    setSelectedDate(newDate);
    setShowBadalPanel(false);
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    handleSetDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    handleSetDate(d.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    handleSetDate(todayStr);
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

  // Open slot for filling or editing (own schedule)
  const handleOpenSlot = (slot: TimelineSlot) => {
    setActiveSubstitution(null);
    setIsSubstituteMode(false);
    setSelectedSlotForForm(slot);
    setIsFormViewActive(true);
  };

  const handleBackToTimeline = () => {
    setIsFormViewActive(false);
    setSelectedSlotForForm(null);
    setActiveSubstitution(null);
    setIsSubstituteMode(false);
    if (editData && onCancelEdit) {
      onCancelEdit();
    }
  };

  const handleSuccessSave = () => {
    fetchTimeline();
    fetchOtherSlots();
    setIsFormViewActive(false);
    setSelectedSlotForForm(null);
    setActiveSubstitution(null);
    setIsSubstituteMode(false);
    onSuccess();
  };

  // Open substitution modal for a slot from another class
  const handleOpenSubstitutionTarget = (slot: TimelineSlot) => {
    setSubstitutionError(undefined);
    setSubstitutionTarget(slot);
  };

  // Handle confirmation from SubstitutionConfirmModal
  const handleSubstitutionConfirm = async (reason: string, reasonDetail: string) => {
    if (!substitutionTarget || !activeTeacherName) return;

    setSubstitutionLoading(true);
    setSubstitutionError(undefined);

    try {
      // Get academic year for overlap validation
      const academicYears = await getAcademicYears();
      const activeAY = academicYears.find((ay: any) => ay.status === 'ACTIVE') || academicYears[0];

      // Lookup guru ID for substitute teacher (best effort)
      let substituteTeacherId: string | null = null;
      try {
        const guruList = await getDaftarGuru();
        const found = guruList.find(
          (g) => g.nama_guru.trim().toLowerCase() === activeTeacherName.trim().toLowerCase()
        );
        if (found) substituteTeacherId = found.id;
      } catch {
        // non-fatal
      }

      const sub = await createSubstitution({
        scheduleId: substitutionTarget.schedule.id,
        date: selectedDate,
        originalTeacherName: substitutionTarget.schedule.teacher_name,
        originalTeacherId: substitutionTarget.schedule.teacher_id || null,
        substituteTeacherName: activeTeacherName,
        substituteTeacherId,
        reason,
        reasonDetail,
        createdBy: activeTeacherName,
        academicYearId: activeAY?.id || substitutionTarget.schedule.academic_year_id,
      });

      setSubstitutionTarget(null);
      setActiveSubstitution(sub);
      setIsSubstituteMode(true);
      setSelectedSlotForForm(substitutionTarget);
      setIsFormViewActive(true);

      // Update map
      setSubstitutionsMap((prev) => ({
        ...prev,
        [substitutionTarget.schedule.id]: sub,
      }));
    } catch (err: any) {
      setSubstitutionError(err?.message || 'Gagal membuat data guru pengganti.');
    } finally {
      setSubstitutionLoading(false);
    }
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
          isSubstitute={isSubstituteMode}
          substitution={activeSubstitution}
        />
      </div>
    );
  }

  // DEFAULT VIEW: SCHEDULE TIMELINE
  const completedSlotsCount =
    timelineData?.slots.filter((s) => s.status === 'COMPLETED').length || 0;
  const totalSlotsCount = timelineData?.slots.length || 0;

  // Own slots that are currently IN_PROGRESS (guru login sedang mengajar)
  const ownActiveSlots = timelineData?.slots.filter((s) => s.status === 'IN_PROGRESS') || [];

  // Derive available badal candidates:
  // 1. Must be IN_PROGRESS (already filtered by fetchOtherSlots)
  // 2. No existing agenda final
  // 3. No existing substitution from anyone (slot already taken)
  // 4. No time-overlap with teacher's own ACTIVE schedule
  const availableOtherSlots = otherSlots.filter((s) => {
    // Exclude if already has a substitution (taken by anyone)
    const sub = substitutionsMap[s.schedule.id];
    if (sub) return false;

    // Exclude if already has an agenda final
    if (s.existingAgenda) return false;

    // Exclude if teacher's own schedule overlaps in time with this candidate
    const candStart = s.schedule.start_time.slice(0, 5);
    const candEnd = s.schedule.end_time.slice(0, 5);
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const candStartMin = toMin(candStart);
    const candEndMin = toMin(candEnd);

    const hasOwnOverlap = ownActiveSlots.some((own) => {
      const ownStart = toMin(own.schedule.start_time.slice(0, 5));
      const ownEnd = toMin(own.schedule.end_time.slice(0, 5));
      return Math.max(candStartMin, ownStart) < Math.min(candEndMin, ownEnd);
    });
    if (hasOwnOverlap) return false;

    return true;
  });

  // Teacher is currently in their own active slot
  const hasOwnActiveSlot = ownActiveSlots.length > 0;

  // Badal button/panel is relevant only when:
  // - viewing today (real-time relevance)
  // - teacher is NOT in their own active slot right now
  // - there are candidates available
  // - not weekend / no academic year
  const isBadalRelevant =
    isViewingToday &&
    !hasOwnActiveSlot &&
    activeTeacherName !== 'Administrator' &&
    timelineData?.reason !== 'WEEKEND' &&
    timelineData?.reason !== 'NO_ACTIVE_ACADEMIC_YEAR';

  const hasBadalCandidates = availableOtherSlots.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 md:pb-6">
      {/* Substitution Confirm Modal */}
      {substitutionTarget && (
        <SubstitutionConfirmModal
          slot={substitutionTarget}
          substituteTeacherName={activeTeacherName || ''}
          onConfirm={handleSubstitutionConfirm}
          onCancel={() => {
            setSubstitutionTarget(null);
            setSubstitutionError(undefined);
          }}
          isLoading={substitutionLoading}
          errorMessage={substitutionError}
        />
      )}

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
                  onChange={(e) => handleSetDate(e.target.value)}
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
            /* CASE: No Schedule on this day — still show substitute section below */
            <div className="py-6 text-center space-y-2">
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
                      substitution={substitutionsMap[slot.schedule.id] || null}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: GURU PENGGANTI / BADAL
              Rules:
              - Only relevant when viewing TODAY
              - Only when teacher has NO active slot of their own right now
              - Only available candidates (IN_PROGRESS, no agenda, no substitution, no overlap)
              - Panel hidden by default behind a button
          */}
          {isBadalRelevant && (
            <div className="mt-2">
              {!showBadalPanel ? (
                /* Collapsed: show trigger button with count hint */
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setShowBadalPanel(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                      hasBadalCandidates
                        ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                        : 'bg-slate-50 border-slate-200 text-slate-500 cursor-default'
                    }`}
                    disabled={!hasBadalCandidates}
                    title={hasBadalCandidates ? 'Lihat jadwal yang dapat dibadal' : 'Tidak ada jadwal yang tersedia untuk badal saat ini'}
                  >
                    <Users className="w-3.5 h-3.5" />
                    {hasBadalCandidates
                      ? `Menjadi Guru Pengganti (${availableOtherSlots.length} slot tersedia)`
                      : 'Tidak ada jadwal yang bisa dibadal saat ini'}
                  </button>
                </div>
              ) : (
                /* Expanded: show candidate list */
                <div className="border border-amber-200 rounded-2xl overflow-hidden">
                  {/* Panel header */}
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-700 shrink-0" />
                      <div>
                        <h2 className="text-xs font-bold text-amber-900">
                          Jadwal yang Tersedia untuk Badal
                        </h2>
                        <p className="text-[11px] text-amber-700">
                          Pilih jadwal yang akan Anda gantikan sekarang.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBadalPanel(false)}
                      className="text-[11px] text-amber-600 hover:text-amber-900 font-semibold px-2 py-1 hover:bg-amber-100 rounded-lg transition"
                    >
                      Tutup
                    </button>
                  </div>

                  <div className="p-3 space-y-2.5 bg-amber-50/20">
                    {isLoadingOther ? (
                      <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memuat...</span>
                      </div>
                    ) : availableOtherSlots.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-500">
                        Tidak ada jadwal yang tersedia untuk dibadal saat ini.
                      </p>
                    ) : (
                      availableOtherSlots.map((slot) => (
                        <div
                          key={slot.schedule.id}
                          className="bg-white border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900">{slot.schedule.class_id}</span>
                              <span className="text-slate-400">&bull;</span>
                              <span className="font-semibold text-slate-800">{slot.schedule.subject_name}</span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-mono">
                                {slot.schedule.start_time.slice(0, 5)} – {slot.schedule.end_time.slice(0, 5)}
                              </span>
                            </div>
                            <p className="text-slate-500">
                              Guru terjadwal:{' '}
                              <span className="font-medium text-slate-700">{slot.schedule.teacher_name}</span>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenSubstitutionTarget(slot)}
                            className="shrink-0 px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition"
                          >
                            Saya yang Gantikan
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
