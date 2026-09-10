import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRekapAgenda, deleteAgenda } from '../services/agendaService';
import { getEvidenceSignedUrl } from '../services/evidenceService';
import { PhotoLightboxModal } from '../components/PhotoLightboxModal';
import type { FullAgenda } from '../types';
import { Edit2, Trash2, RefreshCw, Camera, Eye } from 'lucide-react';

interface RiwayatAgendaProps {
  onEditAgenda: (agenda: FullAgenda) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const RiwayatAgenda: React.FC<RiwayatAgendaProps> = ({
  onEditAgenda,
  showToast,
}) => {
  const { activeTeacherName, isAdmin } = useAuth();
  const [agendas, setAgendas] = useState<FullAgenda[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Lightbox Modal State
  const [activePhoto, setActivePhoto] = useState<{
    url: string;
    uploadedAt?: string;
    title: string;
  } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchRiwayat = async () => {
    setIsLoading(true);
    try {
      const data = await getRekapAgenda({
        nama_guru: activeTeacherName || undefined,
      });

      // Load signed URL untuk agenda yang memiliki bukti foto
      const withSignedUrls = await Promise.all(
        data.map(async (item) => {
          if (item.evidence?.storage_path) {
            const url = await getEvidenceSignedUrl(item.evidence.storage_path);
            return {
              ...item,
              evidence: {
                ...item.evidence,
                signedUrl: url || undefined,
              },
            };
          }
          return item;
        })
      );

      setAgendas(withSignedUrls);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat riwayat agenda.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRiwayat();
  }, [activeTeacherName]);

  const handleDelete = async (id: string, kelas: string, tanggal: string) => {
    if (confirm(`Hapus agenda ${kelas} tanggal ${tanggal}?`)) {
      try {
        await deleteAgenda(id);
        showToast('success', 'Agenda berhasil dihapus.');
        fetchRiwayat();
      } catch (err) {
        showToast('error', 'Gagal menghapus agenda.');
      }
    }
  };

  const formatDateIndo = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16 md:pb-0">
      {/* Header Bar - Bersih & Minimalis */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Riwayat Agenda Saya
          </h2>
          <p className="text-xs text-slate-500">
            Daftar agenda yang diisi oleh <strong>{activeTeacherName}</strong>
          </p>
        </div>

        <button
          onClick={fetchRiwayat}
          className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-300 rounded transition flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* List Agendas */}
      {isLoading ? (
        <div className="bg-white border border-slate-300 rounded-lg p-10 text-center text-xs text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
          Memuat data riwayat...
        </div>
      ) : agendas.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-lg p-10 text-center text-xs text-slate-500">
          Belum ada catatan agenda untuk Anda. Silakan isi melalui menu <strong>Isi Agenda</strong>.
        </div>
      ) : (
        <div className="space-y-4">
          {agendas.map((agenda) => {
            const isToday = agenda.header.tanggal === todayStr;
            const canEdit = isToday || isAdmin;

            return (
              <div
                key={agenda.header.id}
                className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden"
              >
                {/* Header Card Minimalis */}
                <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs px-2 py-0.5 bg-slate-800 text-white rounded">
                      {agenda.header.kelas}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {formatDateIndo(agenda.header.tanggal)}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <button
                        onClick={() => onEditAgenda(agenda)}
                        className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded flex items-center gap-1 transition"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Koreksi / Edit</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        Terkunci
                      </span>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() =>
                          handleDelete(
                            agenda.header.id,
                            agenda.header.kelas,
                            agenda.header.tanggal
                          )
                        }
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                        title="Hapus Agenda"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile Card/Timeline View (< md) */}
                <div className="md:hidden p-3.5 space-y-3">
                  <div className="space-y-2.5">
                    {agenda.kbm.map((k, idx) => {
                      const isBreak = k.jam_ke === 'Istirahat' || k.jam_ke === 'Isoma';

                      if (isBreak) {
                        return (
                          <div
                            key={idx}
                            className="py-1.5 px-3 bg-amber-50/70 border border-amber-200/60 rounded-lg text-center text-xs font-semibold text-amber-800"
                          >
                            ☕ {k.jam_ke}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[11px] px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md">
                                Jam {k.jam_ke}
                              </span>
                              <span className="font-bold text-slate-800 text-xs">
                                {k.mapel}
                              </span>
                            </div>
                            {k.is_badal && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                                Badal
                              </span>
                            )}
                          </div>

                          <div className="text-slate-500 text-[11px]">
                            Guru: <span className="text-slate-700 font-medium">{k.nama_guru || '-'}</span>
                          </div>

                          <div className="p-2 bg-white rounded-lg border border-slate-200/90 text-slate-800 leading-relaxed text-xs">
                            {k.materi}
                          </div>

                          {k.tugas_pr && (
                            <div className="text-[11px] text-slate-600 bg-amber-50/80 border border-amber-200/60 rounded-md p-2">
                              <strong>Tugas/PR:</strong> {k.tugas_pr}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bukti Foto Mengajar (Mobile View) */}
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    {agenda.evidence ? (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {agenda.evidence.signedUrl ? (
                            <img
                              src={agenda.evidence.signedUrl}
                              alt="Bukti Foto"
                              className="w-12 h-12 rounded-lg object-cover border border-slate-300 shadow-2xs shrink-0 cursor-pointer hover:opacity-90 transition"
                              onClick={() =>
                                setActivePhoto({
                                  url: agenda.evidence!.signedUrl!,
                                  uploadedAt: agenda.evidence!.uploaded_at,
                                  title: `Bukti Foto Mengajar - ${agenda.header.kelas}`,
                                })
                              }
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                              <Camera className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-[11px] truncate flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span>Bukti foto tersedia</span>
                            </p>
                            {agenda.evidence.uploaded_at && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Diunggah{' '}
                                {new Date(agenda.evidence.uploaded_at).toLocaleDateString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </p>
                            )}
                          </div>
                        </div>

                        {agenda.evidence.signedUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setActivePhoto({
                                url: agenda.evidence!.signedUrl!,
                                uploadedAt: agenda.evidence!.uploaded_at,
                                title: `Bukti Foto Mengajar - ${agenda.header.kelas}`,
                              })
                            }
                            className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-[11px] flex items-center gap-1 shrink-0 transition"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span>Lihat</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 bg-slate-50/60 border border-slate-200/70 rounded-lg text-[11px] text-slate-400 italic">
                        Bukti foto belum tersedia
                      </div>
                    )}
                  </div>

                  {/* Absensi & Kejadian Note */}
                  <div className="space-y-2 pt-1 border-t border-slate-100 text-xs">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="font-bold text-slate-700 block mb-1 text-[11px] uppercase tracking-wider">
                        Ketidakhadiran Siswa:
                      </span>
                      {agenda.absensi && agenda.absensi.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {agenda.absensi.map((ab, abIdx) => (
                            <span
                              key={abIdx}
                              className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-800 flex items-center gap-1"
                            >
                              <span>{ab.nama_siswa}</span>
                              <span
                                className={`font-bold px-1 rounded text-[10px] ${
                                  ab.status === 'S'
                                    ? 'bg-blue-100 text-blue-800'
                                    : ab.status === 'I'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {ab.status}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-medium text-[11px]">
                          ✓ Nihil (Semua siswa hadir)
                        </span>
                      )}
                    </div>

                    {agenda.kejadian &&
                      agenda.kejadian.length > 0 &&
                      agenda.kejadian[0].uraian_kejadian && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="font-bold text-slate-700 block mb-1 text-[11px] uppercase tracking-wider">
                            Catatan Kejadian:
                          </span>
                          <p className="text-slate-700 leading-relaxed text-xs">
                            {agenda.kejadian[0].uraian_kejadian}
                          </p>
                        </div>
                      )}
                  </div>
                </div>

                {/* Table KBM Sheet Style (Desktop >= md) */}
                <div className="hidden md:block p-3 sm:p-4 space-y-3">
                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                          <th className="py-1.5 px-2.5 w-16 border-r border-slate-200">Jam</th>
                          <th className="py-1.5 px-2.5 w-36 border-r border-slate-200">Guru</th>
                          <th className="py-1.5 px-2.5 w-32 border-r border-slate-200">Mapel</th>
                          <th className="py-1.5 px-2.5 border-r border-slate-200">Materi</th>
                          <th className="py-1.5 px-2.5 w-28">Tugas/PR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {agenda.kbm.map((k, idx) => {
                          const isBreak = k.jam_ke === 'Istirahat' || k.jam_ke === 'Isoma';
                          return (
                            <tr key={idx} className={isBreak ? 'bg-slate-50 text-slate-500' : 'bg-white'}>
                              <td className="p-2 border-r border-slate-200 font-bold text-slate-700">
                                {k.jam_ke}
                              </td>
                              <td className="p-2 border-r border-slate-200 font-medium text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <span>{k.nama_guru || '-'}</span>
                                  {k.is_badal && (
                                    <span className="px-1 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
                                      Badal
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 border-r border-slate-200 font-semibold text-slate-800">
                                {k.mapel}
                              </td>
                              <td className="p-2 border-r border-slate-200 text-slate-700">
                                {k.materi}
                              </td>
                              <td className="p-2 text-slate-600">
                                {k.tugas_pr || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bukti Foto Mengajar (Desktop) */}
                  {agenda.evidence && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        {agenda.evidence.signedUrl ? (
                          <img
                            src={agenda.evidence.signedUrl}
                            alt="Bukti Foto"
                            className="w-12 h-12 rounded object-cover border border-slate-300 shadow-2xs cursor-pointer hover:opacity-90 transition shrink-0"
                            onClick={() =>
                              setActivePhoto({
                                url: agenda.evidence!.signedUrl!,
                                uploadedAt: agenda.evidence!.uploaded_at,
                                title: `Bukti Foto Mengajar - ${agenda.header.kelas}`,
                              })
                            }
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                            <Camera className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>Bukti Foto Mengajar Tersedia</span>
                          </p>
                          {agenda.evidence.uploaded_at && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Diunggah:{' '}
                              {new Date(agenda.evidence.uploaded_at).toLocaleDateString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                      </div>

                      {agenda.evidence.signedUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setActivePhoto({
                              url: agenda.evidence!.signedUrl!,
                              uploadedAt: agenda.evidence!.uploaded_at,
                              title: `Bukti Foto Mengajar - ${agenda.header.kelas}`,
                            })
                          }
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded text-xs flex items-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Buka Foto</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Absensi & Kejadian Note (Desktop) */}
                  <div className="flex flex-col sm:flex-row gap-2.5 text-xs">
                    <div className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded">
                      <span className="font-bold text-slate-700 block mb-0.5">
                        Ketidakhadiran:
                      </span>
                      {agenda.absensi && agenda.absensi.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {agenda.absensi.map((ab, abIdx) => (
                            <span
                              key={abIdx}
                              className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-medium text-slate-800"
                            >
                              {ab.nama_siswa} ({ab.status})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600">Nihil (Semua siswa hadir)</span>
                      )}
                    </div>

                    {agenda.kejadian &&
                      agenda.kejadian.length > 0 &&
                      agenda.kejadian[0].uraian_kejadian && (
                        <div className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded">
                          <span className="font-bold text-slate-700 block mb-0.5">
                            Catatan Khusus:
                          </span>
                          <p className="text-slate-600 leading-tight">
                            {agenda.kejadian[0].uraian_kejadian}
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      <PhotoLightboxModal
        isOpen={!!activePhoto}
        onClose={() => setActivePhoto(null)}
        imageUrl={activePhoto?.url}
        uploadedAt={activePhoto?.uploadedAt}
        title={activePhoto?.title}
      />
    </div>
  );
};
