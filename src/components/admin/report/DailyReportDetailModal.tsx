import React, { useId } from 'react';
import { X, Clock, User, BookOpen, Camera, ExternalLink, AlertCircle } from 'lucide-react';
import { ModalShell } from '../../common/ModalShell';
import type { DailyReportItem } from '../../../services/reportService';

interface DailyReportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DailyReportItem | null;
  onOpenPhotoLightbox?: (photoData: {
    url: string;
    title: string;
    uploadedAt?: string;
    capturedAt?: string;
    actualTeacherName?: string;
    agendaId: string;
    storagePath?: string;
  }) => void;
}

export const DailyReportDetailModal: React.FC<DailyReportDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  onOpenPhotoLightbox,
}) => {
  const titleId = useId();

  if (!isOpen || !item) return null;

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

  const formatDateTimeIndo = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const getStatusBadge = (status: DailyReportItem['status']) => {
    switch (status) {
      case 'SELESAI':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Selesai
          </span>
        );
      case 'BADAL':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Badal
          </span>
        );
      case 'SEDANG_BERLANGSUNG':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            Sedang Berlangsung
          </span>
        );
      case 'BELUM_DIMULAI':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Belum Dimulai
          </span>
        );
      case 'BELUM_TEREALISASI':
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            Belum Terealisasi
          </span>
        );
    }
  };

  const agenda = item.agenda;
  const kbm = agenda?.kbm || [];
  const absensi = agenda?.absensi || [];
  const evidence = agenda?.evidence;

  // Sebelumnya modal ini punya markup portal sendiri tanpa `role="dialog"`,
  // tanpa ESC, dan tanpa perangkap fokus. Sekarang dari `ModalShell`.
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      ariaLabelledBy={titleId}
      backdropClassName="bg-black/60 backdrop-blur-2xs"
      cardClassName="shadow-2xl"
    >
        {/* Modal Header */}
        <div className="shrink-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                {item.classId}
              </span>
              <h2 id={titleId} className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {item.subjectName}
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">{formatDateIndo(item.date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail laporan"
            title="Tutup"
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        {/* min-h-0 supaya max-h-[90vh] benar-benar berlaku; overscroll-contain
            supaya scroll di dalam tidak diteruskan ke halaman report. */}
        <div className="flex-1 min-h-0 p-5 overflow-y-auto overscroll-contain space-y-5 text-xs sm:text-sm">
          {/* Status & Jadwal Ringkas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div>
              <span className="text-xs font-medium text-slate-600 block">Waktu</span>
              {item.startTime && item.endTime ? (
                <>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {item.startTime} - {item.endTime}
                  </span>
                  <span className="text-xs text-slate-600">({item.durationMinutes} menit)</span>
                </>
              ) : (
                <span className="font-semibold text-slate-500 italic text-xs">
                  Di luar jadwal (tanpa slot)
                </span>
              )}
            </div>

            <div>
              <span className="text-xs font-medium text-slate-600 block">Status</span>
              <div className="mt-1">{getStatusBadge(item.status)}</div>
            </div>

            <div className="col-span-2 sm:col-span-2 space-y-1">
              <span className="text-xs font-medium text-slate-600 block">Penugasan Guru</span>
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-1 text-slate-600">
                  <span className="text-slate-600 text-xs w-14">Terjadwal:</span>
                  <span className="font-semibold text-slate-800">{item.scheduledTeacherName}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-600">
                  <span className="text-slate-600 text-xs w-14">Aktual:</span>
                  <span
                    className={`font-semibold ${
                      item.isBadal ? 'text-amber-700 bg-amber-50 px-1 rounded' : 'text-slate-800'
                    }`}
                  >
                    {item.actualTeacherName}
                    {item.isBadal && ' (Guru Pengganti)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Badal jika ada */}
          {item.isBadal && item.substitution && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Keterangan Badal (Guru Pengganti)</span>
              </div>
              <p>
                Alasan: <span className="font-semibold">{item.substitution.reason}</span>
                {item.substitution.reason_detail ? ` (${item.substitution.reason_detail})` : ''}
              </p>
              <p className="text-xs text-amber-700">
                Dibuat oleh: {item.substitution.created_by} pada{' '}
                {formatDateTimeIndo(item.substitution.created_at)}
              </p>
            </div>
          )}

          {/* Materi Pembelajaran */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-slate-600" />
              Materi Pembelajaran
            </h3>
            {kbm.length > 0 ? (
              <div className="space-y-2">
                {kbm.map((k, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        {k.mapel} {k.jam_ke ? `(Jam ${k.jam_ke})` : ''}
                      </span>
                      <span className="text-xs text-slate-600 font-medium">
                        Pengampu: {k.nama_guru}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{k.materi}</p>
                    {k.tugas_pr && (
                      <p className="text-xs text-primary-700 bg-primary-50 p-1.5 rounded">
                        Tugas/PR: {k.tugas_pr}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-600 text-xs">
                {item.status === 'BELUM_TEREALISASI'
                  ? 'Agenda pembelajaran belum diisi oleh guru.'
                  : 'Tidak ada rincian materi.'}
              </div>
            )}
          </div>

          {/* Kehadiran Siswa (Absensi) */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-600" />
              Ketidakhadiran Siswa ({absensi.length} siswa)
            </h3>
            {absensi.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                    <tr>
                      <th className="py-2 px-3">Nama Siswa</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {absensi.map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-slate-800">
                          {a.nama_siswa || a.siswa?.nama_siswa || 'Siswa'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {a.status === 'S' && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                              Sakit
                            </span>
                          )}
                          {a.status === 'I' && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                              Izin
                            </span>
                          )}
                          {a.status === 'A' && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                              Alpha
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                Semua siswa hadir (atau belum ada data ketidakhadiran tercatat).
              </p>
            )}
          </div>

          {/* Bukti Foto Dokumentasi */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-slate-600" />
              Dokumentasi Foto Mengajar
            </h3>
            {item.evidenceUrl ? (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div
                  onClick={() => {
                    if (onOpenPhotoLightbox && item.evidenceUrl) {
                      onOpenPhotoLightbox({
                        url: item.evidenceUrl,
                        title: `${item.classId} - ${item.subjectName} (${item.date})`,
                        uploadedAt: evidence?.uploaded_at,
                        capturedAt: evidence?.captured_at,
                        actualTeacherName: item.actualTeacherName,
                        agendaId: agenda?.header.id || '',
                        storagePath: evidence?.storage_path,
                      });
                    }
                  }}
                  className="cursor-pointer group relative rounded-lg overflow-hidden border border-slate-300 w-36 h-28 bg-slate-200 shrink-0"
                >
                  <img
                    src={item.evidenceUrl}
                    alt="Bukti Dokumentasi"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <ExternalLink className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="text-xs space-y-1 text-slate-600">
                  <p>
                    <span className="text-slate-600">Pengambil Foto:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {evidence?.actual_teacher_name || item.actualTeacherName}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-600">Waktu Capture:</span>{' '}
                    <span className="font-medium text-slate-700">
                      {formatDateTimeIndo(evidence?.captured_at || evidence?.uploaded_at)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Klik foto untuk memperbesar dan melihat metadata lengkap.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-600 text-xs">
                Tidak ada dokumentasi foto untuk jadwal/agenda ini.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Tutup
          </button>
        </div>
    </ModalShell>
  );
};
