import React, { useEffect, useRef, useState } from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import type { Substitution } from '../../types';
import { CheckCircle2, ChevronDown, ChevronRight, Lock, Play, AlertCircle } from 'lucide-react';

interface ScheduleTimelineCardProps {
  slot: TimelineSlot;
  onSelectSlot: (slot: TimelineSlot) => void;
  substitution?: Substitution | null;
  /**
   * Urutan kartu di daftar — hanya untuk menjeda animasi masuknya.
   * Dibatasi 6 langkah supaya daftar delapan jam tidak membuat guru menunggu.
   */
  index?: number;
}

/** Tinggi satu baris topik saat terlipat (line-height `text-xs` = 20px). */
const TOPIC_COLLAPSED_PX = 20;
/** Batas tinggi saat terbuka — cukup untuk materi terpanjang, tetap ada batas. */
const TOPIC_EXPANDED_PX = 160;

/**
 * Kartu satu slot jadwal.
 *
 * Susunannya mengikuti spesifikasi desain: satu pita horizontal per jenis
 * informasi, dibaca atas→bawah, bukan zigzag kiri→tengah→bawah.
 *
 *   08:05 — 08:40                    [Sudah Diisi]
 *   PENJAS
 *   Kelas 1 · JP 1                              ›
 *   Kolase dan mozaik dengan teknik…  1 tidak hadir
 *
 * Catatan penting tentang jam: sebelumnya jam mulai dan jam selesai ditumpuk
 * vertikal dengan bobot berbeda (mulai tebal hitam, selesai kecil abu) sehingga
 * guru sering melewatkan jam selesai. Sekarang keduanya SATU baris, satu
 * ukuran, satu bobot, satu warna, dipisah en-dash (—).
 */
export const ScheduleTimelineCard: React.FC<ScheduleTimelineCardProps> = ({
  slot,
  onSelectSlot,
  substitution,
  index = 0,
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

  // Semua status selain UPCOMING bisa dibuka — termasuk yang sedang berlangsung.
  const isActionable = !isUpcoming;

  // ── Topik yang bisa dibuka-tutup ───────────────────────────────────────
  const [topicExpanded, setTopicExpanded] = useState(false);
  const [topicOverflows, setTopicOverflows] = useState(false);
  const topicRef = useRef<HTMLParagraphElement>(null);

  /**
   * Apakah materi benar-benar terpotong saat terlipat?
   *
   * Diukur dari DOM, bukan ditebak dari panjang teks: lebar kartu berbeda-beda
   * dan `-webkit-line-clamp` tetap menyimpan tinggi teks penuh di
   * `scrollHeight`, sementara `clientHeight` hanya setinggi satu baris.
   * Hanya diukur saat terlipat — saat terbuka keduanya sama tinggi dan
   * hasilnya akan selalu "tidak terpotong", sehingga tombolnya hilang sendiri.
   */
  useEffect(() => {
    if (topicExpanded) return;
    const el = topicRef.current;
    if (el) setTopicOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [materiSummary, topicExpanded]);

  /**
   * Lencana status — sengaja TANPA border dan tanpa huruf tebal.
   *
   * Sebelumnya lencana ini berborder + `font-bold`, sehingga bobot visualnya
   * bersaing dengan nama mata pelajaran padahal status hanyalah keterangan.
   * Warna latar lembut + teks medium sudah cukup, dan maknanya tidak
   * bergantung pada warna saja — teksnya berbunyi jelas.
   */
  const statusBadge = isInProgress ? (
    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
      <Play className="w-3 h-3 fill-current shrink-0" aria-hidden="true" />
      Berlangsung
    </span>
  ) : isCompleted ? (
    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Sudah Diisi
    </span>
  ) : isOverdue ? (
    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 whitespace-nowrap">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Belum Diisi
    </span>
  ) : (
    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
      <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Terkunci
    </span>
  );

  /**
   * Baris 1–3 — satu pita per informasi, sama untuk semua keadaan.
   * Dipakai dua kali (di dalam tombol dan di luar tombol) supaya isinya tidak
   * ditulis dua kali dengan risiko salah satunya tertinggal saat diubah.
   */
  const summaryRows = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800 tabular-nums whitespace-nowrap">
          {startTime} <span aria-hidden="true">—</span> {endTime}
        </span>
        {statusBadge}
      </div>

      <h3 className="mt-2 text-base font-bold text-slate-900 truncate">
        {schedule.subject_name}
      </h3>

      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-slate-500">
          {schedule.class_id}
          <span aria-hidden="true"> · </span>
          JP {schedule.period_number}
          {substitution && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="text-amber-800">
                Pengganti: {substitution.substitute_teacher_name}
              </span>
            </>
          )}
        </p>
        {isActionable && (
          <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
        )}
      </div>
    </>
  );

  const showTopicRow = isCompleted && Boolean(existingAgenda);

  return (
    <div
      style={{ animationDelay: `${60 + Math.min(index, 6) * 30}ms` }}
      className={`card-press stagger-in relative rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-md ${
        isInProgress
          ? 'bg-white border-slate-300 border-l-4 border-l-emerald-500'
          : isCompleted
          ? 'bg-white border-slate-200'
          : isOverdue
          ? 'bg-white border-slate-200'
          : 'bg-slate-50/60 border-slate-200 opacity-75'
      }`}
    >
      {/* Baris 1–3: area tekan utama.
          Topik sengaja DI LUAR tombol ini karena ia punya aksinya sendiri
          (buka/tutup) — menyarangkan tombol di dalam tombol bukan HTML sah. */}
      {isActionable ? (
        <button
          type="button"
          onClick={() => onSelectSlot(slot)}
          aria-label={`${isCompleted ? 'Lihat atau edit' : 'Isi'} agenda ${
            schedule.subject_name
          } kelas ${schedule.class_id} pukul ${startTime}`}
          className="card-hit block w-full text-left rounded-lg focus-visible:outline-none"
        >
          {summaryRows}
        </button>
      ) : (
        <div className="rounded-lg">{summaryRows}</div>
      )}

      {/* Baris 4 — materi dan jumlah tidak hadir, DUA elemen terpisah.
          Sebelumnya keduanya digabung dengan titik ("materi · 2 tidak hadir")
          sehingga keduanya berebut ruang dan yang terpotong justru materi. */}
      {showTopicRow && (
        <div className="mt-2 flex items-start justify-between gap-3">
          {materiSummary ? (
            <button
              type="button"
              onClick={() => setTopicExpanded((v) => !v)}
              aria-expanded={topicExpanded}
              disabled={!topicOverflows && !topicExpanded}
              title={topicOverflows || topicExpanded ? 'Buka/tutup materi lengkap' : undefined}
              className={`min-w-0 flex-1 flex items-start gap-1 text-left rounded ${
                topicOverflows || topicExpanded ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <p
                ref={topicRef}
                style={{
                  maxHeight: `${topicExpanded ? TOPIC_EXPANDED_PX : TOPIC_COLLAPSED_PX}px`,
                }}
                className={`min-w-0 flex-1 overflow-hidden text-xs text-slate-600 transition-[max-height] duration-200 ease-out ${
                  topicExpanded ? '' : 'line-clamp-1'
                }`}
              >
                {materiSummary}
              </p>
              {(topicOverflows || topicExpanded) && (
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 mt-1 text-slate-400 transition-transform duration-200 ${
                    topicExpanded ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              )}
            </button>
          ) : (
            <span className="min-w-0 flex-1" />
          )}

          {/* Jumlah tidak hadir — merah HANYA bila ada yang tidak hadir. */}
          <span
            className={`shrink-0 text-2xs font-medium whitespace-nowrap ${
              absentCount > 0 ? 'text-rose-600' : 'text-slate-500'
            }`}
          >
            {absentCount > 0 ? `${absentCount} tidak hadir` : 'Semua hadir'}
          </span>
        </div>
      )}
    </div>
  );
};
