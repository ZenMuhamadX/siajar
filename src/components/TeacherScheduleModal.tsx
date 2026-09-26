import React, { useState, useEffect, useId } from 'react';
import {
  type ScheduleItem,
  type AcademicYear,
  SCHEDULE_DAYS,
  DAY_TRANSLATION_MAP,
} from '../types';
import { getAcademicYears, getSchedules } from '../services/scheduleService';
import { Calendar, X, Loader2 } from 'lucide-react';
import { ModalShell } from './common/ModalShell';
import { ScrollArea } from './common/ScrollArea';

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
  const titleId = useId();
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

  // Sebelumnya modal ini tidak punya `role="dialog"`, tidak menangani ESC, dan
  // fokus bisa keluar ke halaman di belakangnya. Semua itu kini dari `ModalShell`.
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      ariaLabelledBy={titleId}
      backdropClassName="bg-black/50 backdrop-blur-xs"
      maxHeightClassName="max-h-[85vh]"
      cardClassName="rounded-xl shadow-2xl"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-600" aria-hidden="true" />
            <h3 id={titleId} className="font-bold text-slate-800 text-sm sm:text-base">
              Jadwal Mengajar Saya
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            {teacherName} {activeAY ? `\u2022 TA ${activeAY.name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup jadwal mengajar"
          title="Tutup"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Day Filter */}
      <div className="shrink-0 px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setSelectedDay('ALL')}
          aria-pressed={selectedDay === 'ALL'}
          className={`px-3 py-1.5 rounded-md font-semibold transition ${
            selectedDay === 'ALL'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-200'
          }`}
        >
          Semua Hari
        </button>
        {SCHEDULE_DAYS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setSelectedDay(d.key)}
            aria-pressed={selectedDay === d.key}
            className={`px-3 py-1.5 rounded-md font-semibold transition whitespace-nowrap ${
              selectedDay === d.key
                ? 'bg-primary-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Content Table */}
      <div className="p-0 flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="py-12 text-center space-y-2" role="status" aria-live="polite">
            <Loader2 className="w-6 h-6 text-primary-600 animate-spin mx-auto" aria-hidden="true" />
            <p className="text-xs text-slate-600">Memuat jadwal mengajar...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-600 italic space-y-1">
            <p className="text-sm font-semibold text-slate-600">
              Belum ada jadwal mengajar aktif untuk Anda.
            </p>
            <p className="text-xs">Hubungi Administrator jika jadwal belum diatur.</p>
          </div>
        ) : (
          <ScrollArea label="Tabel jadwal mengajar">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th scope="col" className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-xs whitespace-nowrap">
                    Hari
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-xs text-center whitespace-nowrap">
                    Waktu
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-xs text-center whitespace-nowrap">
                    JP
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-xs text-center whitespace-nowrap">
                    Kelas
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-xs">
                    Mata Pelajaran
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-primary-900">
                      {DAY_TRANSLATION_MAP[item.day] || item.day}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap font-mono text-slate-700">
                      {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
                        JP {item.period_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {item.class_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.subject_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
        <span className="text-xs text-slate-600">
          Total <strong className="text-slate-800">{filtered.length}</strong> slot mengajar
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition"
        >
          Tutup
        </button>
      </div>
    </ModalShell>
  );
};
