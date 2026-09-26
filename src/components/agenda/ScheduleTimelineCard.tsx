import React from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import type { Substitution } from '../../types';
import {
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
        {/* Kiri: informasi jadwal */}
        <div className="space-y-1.5 flex-1">
          {/* JAM DULU.
              Pertanyaan pertama guru saat membuka layar ini adalah "jam berapa
              saya mengajar?" — tetapi sebelumnya jam justru elemen terkecil dan
              paling pudar di kartu (`text-xs text-slate-600`), sementara nama
              mapel mendapat `text-sm font-bold`. Hierarkinya kini mengikuti
              urutan pertanyaan guru: jam → mapel/kelas → status. */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-base font-bold text-slate-900 tabular-nums leading-none">
              {startTime}–{endTime}
            </span>
            <span className="text-xs font-medium text-slate-600">
              Jam ke-{schedule.period_number}
            </span>
          </div>

          {/* Mapel + kelas */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-800">{schedule.subject_name}</h3>
            <span className="text-xs text-slate-600 font-medium">{schedule.class_id}</span>
          </div>

          <p className="text-xs text-slate-600">{schedule.teacher_name}</p>

          {/* STATUS.
              Peta warna mengikuti kesepakatan di `index.css`: emerald =
              selesai/berhasil, amber = perlu tindakan. Sebelumnya "Sudah Diisi"
              (keadaan yang ditunggu guru) memakai abu netral, sedangkan "Belum
              Diisi" memakai latar abu dengan aksen amber tipis sehingga keduanya
              nyaris tidak bisa dibedakan saat memindai. */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {isInProgress && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                Berlangsung
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                Sudah Diisi
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full border border-amber-300">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                Belum Diisi
              </span>
            )}
            {isUpcoming && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                Belum Dimulai
              </span>
            )}

            {/* Badal */}
            {substitution && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-800">
                <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Pengganti: {substitution.substitute_teacher_name}
              </span>
            )}
          </div>

          {/* Ringkasan agenda yang sudah diisi */}
          {isCompleted && existingAgenda && materiSummary && (
            <div className="mt-0.5 flex items-start gap-1.5 text-xs text-slate-600">
              <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="italic line-clamp-1">{materiSummary}</span>
            </div>
          )}
          {isCompleted && existingAgenda && (
            <p className="text-xs text-slate-600">
              Kehadiran:{' '}
              <span className="font-medium text-slate-700">
                {absentCount === 0 ? 'Semua hadir' : `${absentCount} tidak hadir`}
              </span>
            </p>
          )}
        </div>

        {/* Kanan: aksi — tanpa tombol untuk IN_PROGRESS (kartu hero yang menangani) */}
        <div className="sm:self-center shrink-0">
          {isOverdue && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="w-full sm:w-auto px-3.5 py-2 min-h-10 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
              Isi Terlewat
            </button>
          )}

          {isCompleted && (
            <button
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="w-full sm:w-auto px-3 py-2 min-h-10 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Eye className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
              Lihat / Edit
            </button>
          )}

          {/* Sebelumnya hanya ikon gembok tanpa kata apa pun — guru tidak tahu
              apakah itu "terkunci", "sedang memuat", atau tombol mati. Sekarang
              keterangannya menyebut jam mulai, jadi jelas ini soal waktu. */}
          {isUpcoming && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Dibuka pukul {startTime}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
