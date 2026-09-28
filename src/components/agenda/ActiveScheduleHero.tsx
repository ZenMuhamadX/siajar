import React from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import { Clock, Edit3, ArrowRight } from 'lucide-react';

interface ActiveScheduleHeroProps {
  slot: TimelineSlot;
  onOpenAgenda: (slot: TimelineSlot) => void;
}

/**
 * Kartu "sedang berlangsung" — satu-satunya elemen yang boleh menuntut
 * perhatian guru saat halaman dibuka.
 *
 * Warnanya BIRU, bukan emerald.
 *
 * Sebelumnya kartu ini memakai gradien emerald sementara lencana pada kartu
 * jadwal di bawahnya memakai biru untuk keadaan yang sama — dan emerald sudah
 * dipakai untuk "Sudah Diisi". Artinya status "sedang mengajar" dan "sudah
 * selesai" tampil dengan warna keluarga yang sama, padahal keduanya menuntut
 * tindakan yang berbeda (yang satu harus diisi sekarang, yang satu tidak).
 * Kini biru berarti "sedang berlangsung" di seluruh aplikasi — hero, lencana
 * kartu, garis kiri kartu, dan `StatusBadge` — sehingga warna itu benar-benar
 * membawa satu makna.
 */
export const ActiveScheduleHero: React.FC<ActiveScheduleHeroProps> = ({
  slot,
  onOpenAgenda,
}) => {
  const { schedule } = slot;
  const startTime = schedule.start_time.slice(0, 5);
  const endTime = schedule.end_time.slice(0, 5);

  return (
    <div className="bg-gradient-to-r from-blue-800 to-blue-900 rounded-2xl p-3.5 sm:p-6 text-white shadow-md relative overflow-hidden">
      {/* Background accent glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-700/80 border border-blue-500/30 rounded-full text-2xs font-bold text-blue-100 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-ping inline-block" aria-hidden="true" />
            <span>Sedang Berlangsung</span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-blue-100 text-xs font-medium tabular-nums">
              <Clock className="w-3.5 h-3.5 text-blue-200 shrink-0" aria-hidden="true" />
              <span>
                {startTime}–{endTime}
              </span>
              <span aria-hidden="true">&bull;</span>
              <span>Jam ke-{schedule.period_number}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white mt-0.5">
              {schedule.subject_name}
            </h2>
            <p className="text-sm text-blue-50/90">
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
            className="w-full sm:w-auto px-5 py-3 min-h-12 bg-white hover:bg-blue-50 text-blue-900 font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition"
          >
            <Edit3 className="w-5 h-5 text-blue-700" aria-hidden="true" />
            <span>Isi Agenda Sekarang</span>
            <ArrowRight className="w-4 h-4 text-blue-700" aria-hidden="true" />
          </button>
          {/* Petunjuk durasi disembunyikan di HP: tombolnya sudah jelas, dan
              satu baris ini menggeser daftar jadwal turun tanpa menambah aksi. */}
          <p className="hidden sm:block text-xs text-blue-100/80">
            Foto, materi, dan kehadiran — sekitar satu menit.
          </p>
        </div>
      </div>
    </div>
  );
};
