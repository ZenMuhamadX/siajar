import React, { useState, useEffect, useId } from 'react';
import {
  type ScheduleItem,
  type ScheduleDay,
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

/**
 * Hari yang dipilih saat modal dibuka.
 *
 * Sejak tombol "Semua Hari" dihapus, daftar selalu menampilkan SATU hari.
 * Menebak hari ini lebih berguna daripada selalu membuka Senin: guru membuka
 * modal ini justru untuk tahu "saya mengajar apa sekarang/selanjutnya".
 * Akhir pekan tidak punya jadwal, jadi jatuh ke Senin.
 */
function defaultSelectedDay(): ScheduleDay {
  const jsDay = new Date().getDay(); // 0 = Minggu … 6 = Sabtu
  return jsDay >= 1 && jsDay <= 5 ? SCHEDULE_DAYS[jsDay - 1].key : 'MONDAY';
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
  const [selectedDay, setSelectedDay] = useState<ScheduleDay>(defaultSelectedDay);

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

  // Satu hari per tampilan, jadi urutannya cukup jam pelajaran lalu jam mulai
  // — tidak perlu lagi urut per hari.
  const filtered = mySchedules
    .filter((s) => s.day === selectedDay)
    .sort((a, b) => {
      if (a.period_number !== b.period_number) return a.period_number - b.period_number;
      return a.start_time.localeCompare(b.start_time);
    });

  const selectedDayLabel = DAY_TRANSLATION_MAP[selectedDay];

  // Sebelumnya modal ini tidak punya `role="dialog"`, tidak menangani ESC, dan
  // fokus bisa keluar ke halaman di belakangnya. Semua itu kini dari `ModalShell`.
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      ariaLabelledBy={titleId}
      backdropClassName="bg-black/50 backdrop-blur-xs"
      /* Di HP modal ini nyaris memenuhi layar — tabelnya memang butuh ruang.
         85vh menyisakan 127px kosong di layar 844px yang tidak dipakai apa pun. */
      maxHeightClassName="max-h-[92vh] sm:max-h-[85vh]"
      cardClassName="rounded-xl shadow-2xl"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-4 border-b border-slate-200 bg-slate-50">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
            <h3 id={titleId} className="font-bold text-slate-800 text-sm sm:text-base truncate">
              Jadwal Mengajar Saya
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-0.5 truncate">
            {teacherName} {activeAY ? `\u2022 TA ${activeAY.name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup jadwal mengajar"
          title="Tutup"
          className="p-2 min-w-10 min-h-10 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Pemilih hari — LIMA hari, bukan enam.
          "Semua Hari" dihapus: sejak daftar menampilkan satu hari, tombol itu
          hanya menggandakan pekerjaan memilih hari. Dengan lima tombol, satu
          baris penuh terbagi rata tanpa perlu digeser horizontal — sebelumnya
          enam chip meluber dan menyisakan potongan yang harus di-scroll.
          Grid (bukan flex) yang menjamin lebarnya sama rata. */}
      <div className="shrink-0 px-2 py-2.5 sm:px-5 sm:py-2.5 bg-slate-100/70 border-b border-slate-200">
        <div
          role="group"
          aria-label="Pilih hari"
          className="grid grid-cols-5 gap-1"
        >
          {SCHEDULE_DAYS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelectedDay(d.key)}
              aria-pressed={selectedDay === d.key}
              className={`px-1 py-2.5 min-h-10 rounded-md text-2xs sm:text-xs font-bold transition whitespace-nowrap ${
                selectedDay === d.key
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Table */}
      <div className="p-0 flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="py-12 text-center space-y-2" role="status" aria-live="polite">
            <Loader2 className="w-6 h-6 text-primary-600 animate-spin mx-auto" aria-hidden="true" />
            <p className="text-xs text-slate-600">Memuat jadwal…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-600 italic space-y-1">
            <p className="text-sm font-semibold text-slate-600">
              Tidak ada jadwal mengajar pada hari {selectedDayLabel}.
            </p>
            <p className="text-xs">
              Pilih hari lain, atau hubungi administrator bila jadwal belum diatur.
            </p>
          </div>
        ) : (
          <ScrollArea label="Tabel jadwal mengajar">
            {/* Tabel untuk layar sempit.
                Dua kolom dihilangkan di HP:
                - "Hari" — daftarnya kini selalu satu hari, jadi seluruh kolom
                  hanya akan berisi kata yang sama berulang-ulang.
                - "JP" — pindah ke bawah jam sebagai baris kecil, sehingga
                  informasinya tetap ada tanpa memakan satu kolom penuh.
                Mulai `sm` semuanya kembali seperti semula.

                Lebar kolom tetap (`table-fixed`) supaya tidak ada kejutan saat
                nama mapel panjang. Angka di bawah ini SEMUANYA hasil ukur,
                bukan tebakan — dua kali revisi sebelumnya salah karena ditebak:

                - Jam: "07:00–07:45" pada 14px monospace = 84.7px; + padding
                  12px kiri-kanan = 108.7px. Diambil 7.75rem (124px) → sisa 15px.
                - Kelas: labelnya kini berbentuk "3A" (dulu "KELAS 3" sebelum
                  kelas dipindah ke master data). Angka 92px di bawah diukur
                  untuk bentuk LAMA yang lebih panjang, jadi masih aman — label
                  baru selalu lebih pendek, tidak pernah lebih panjang.
                  Sebelumnya: badge "KELAS 3" 65.6px termasuk padding badge; +
                  padding sel 16px = 81.6px. Diambil 5.75rem (92px) → sisa 10px.
                  Dengan 3.5rem, badge meluber 13.6px ke kolom Mapel — persis
                  yang membuat "KELAS 3" menempel ke "UMMI".
                - Mapel: menerima sisanya (118px di 360px). */}
            <table className="w-full text-xs text-left table-fixed sm:table-auto">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th
                    scope="col"
                    className="hidden sm:table-cell px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-2xs whitespace-nowrap"
                  >
                    Hari
                  </th>
                  <th
                    scope="col"
                    className="w-[7.75rem] sm:w-auto px-3 sm:px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-2xs sm:text-xs whitespace-nowrap"
                  >
                    Jam
                  </th>
                  <th
                    scope="col"
                    className="hidden sm:table-cell px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-xs text-center whitespace-nowrap"
                  >
                    JP
                  </th>
                  <th
                    scope="col"
                    className="w-[5.75rem] sm:w-auto px-2 sm:px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-2xs sm:text-xs text-center whitespace-nowrap"
                  >
                    Kelas
                  </th>
                  <th
                    scope="col"
                    className="px-3 sm:px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-2xs sm:text-xs"
                  >
                    Mapel
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="hidden sm:table-cell px-3 py-3 whitespace-nowrap font-bold text-primary-900">
                      {DAY_TRANSLATION_MAP[item.day] || item.day}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-slate-700">
                      <span className="font-mono tabular-nums">
                        {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}
                      </span>
                      <span className="sm:hidden block font-sans font-bold text-primary-700 mt-1">
                        JP {item.period_number}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
                        JP {item.period_number}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap">
                      <span className="inline-block font-bold text-slate-900 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded text-xs">
                        {item.kelas}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 font-medium text-slate-800 break-words">
                      {item.subject_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-600">
          <strong className="text-slate-800">{filtered.length}</strong> JP &bull;{' '}
          <strong className="text-slate-800">{selectedDayLabel}</strong>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 min-h-10 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition"
        >
          Tutup
        </button>
      </div>
    </ModalShell>
  );
};
