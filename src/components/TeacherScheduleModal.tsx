import React, { useState, useEffect } from 'react';
import {
  type ScheduleItem,
  type AcademicYear,
  SCHEDULE_DAYS,
  DAY_TRANSLATION_MAP,
} from '../types';
import { getAcademicYears, getSchedules } from '../services/scheduleService';
import { Calendar, Clock, BookOpen, Building2, X, Loader2 } from 'lucide-react';

interface TeacherScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherName: string;
}

export const TeacherScheduleModal: React.FC<TeacherScheduleModalProps> = ({
  isOpen,
  onClose,
  teacherName,
}) => {
  const [activeAY, setActiveAY] = useState<AcademicYear | null>(null);
  const [mySchedules, setMySchedules] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('ALL');

  useEffect(() => {
    if (!isOpen || !teacherName) return;

    async function fetchTeacherSchedule() {
      setIsLoading(true);
      try {
        const ays = await getAcademicYears();
        const active = ays.find((y) => y.status === 'ACTIVE') || ays[0];
        setActiveAY(active || null);

        if (active) {
          const all = await getSchedules({
            academicYearId: active.id,
            teacherName,
            status: 'ACTIVE',
          });
          setMySchedules(all);
        } else {
          setMySchedules([]);
        }
      } catch (e) {
        console.error('Error fetching teacher schedule:', e);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeacherSchedule();
  }, [isOpen, teacherName]);

  if (!isOpen) return null;

  const DAY_ORDER: Record<string, number> = {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
  };

  const filtered = mySchedules
    .filter((s) => selectedDay === 'ALL' || s.day === selectedDay)
    .sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
      if (dayDiff !== 0) return dayDiff;
      if (a.period_number !== b.period_number) return a.period_number - b.period_number;
      return a.start_time.localeCompare(b.start_time);
    });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Jadwal Mengajar Saya
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {teacherName} {activeAY ? `\u2022 TA ${activeAY.name}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Day Filter */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setSelectedDay('ALL')}
            className={`px-3 py-1 rounded-md font-semibold transition ${
              selectedDay === 'ALL'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Hari
          </button>
          {SCHEDULE_DAYS.map((d) => (
            <button
              key={d.key}
              onClick={() => setSelectedDay(d.key)}
              className={`px-3 py-1 rounded-md font-semibold transition whitespace-nowrap ${
                selectedDay === d.key
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Memuat jadwal mengajar...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic space-y-1">
              <p className="text-sm">Belum ada jadwal mengajar aktif untuk Anda.</p>
              <p className="text-xs">Hubungi Administrator jika jadwal belum diatur.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 hover:border-purple-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-800 text-xs uppercase tracking-wide">
                      {DAY_TRANSLATION_MAP[item.day]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                      JP {item.period_number}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      {item.subject_name}
                    </h4>
                    <p className="text-xs text-slate-600 font-semibold flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {item.class_id}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
