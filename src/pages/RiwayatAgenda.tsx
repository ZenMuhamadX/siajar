import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRekapAgenda, deleteAgenda } from '../services/agendaService';
import type { FullAgenda } from '../types';
import {
  History,
  Edit,
  Trash2,
  Calendar,
  BookOpen,
  RefreshCw,
  Clock,
  AlertTriangle,
} from 'lucide-react';

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

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchRiwayat = async () => {
    setIsLoading(true);
    try {
      const data = await getRekapAgenda({
        nama_guru: activeTeacherName || undefined,
      });
      setAgendas(data);
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
    if (confirm(`Yakin ingin menghapus agenda ${kelas} tanggal ${tanggal}?`)) {
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
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Riwayat Agenda Saya
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar pengisian agenda pembelajaran oleh <strong>{activeTeacherName}</strong>
          </p>
        </div>

        <button
          onClick={fetchRiwayat}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* List Content */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Memuat riwayat agenda...</p>
        </div>
      ) : agendas.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Belum Ada Riwayat Agenda</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Anda belum pernah mengisi agenda atau tidak terdaftar di agenda yang ada. Silakan mulai input di menu <strong>Isi Agenda</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {agendas.map((agenda) => {
            const isToday = agenda.header.tanggal === todayStr;
            const canEdit = isToday || isAdmin;

            return (
              <div
                key={agenda.header.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition hover:border-slate-300"
              >
                {/* Header Card */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 bg-emerald-700 text-white text-xs font-bold rounded-lg">
                      {agenda.header.kelas}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-800">
                          {formatDateIndo(agenda.header.tanggal)}
                        </span>
                        {isToday && (
                          <span className="px-2 py-0.2 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                            Hari Ini
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <button
                        onClick={() => onEditAgenda(agenda)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Koreksi / Edit
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 italic">
                        <Clock className="w-3 h-3" /> Terkunci (Hari lalu)
                      </span>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() =>
                          handleDelete(agenda.header.id, agenda.header.kelas, agenda.header.tanggal)
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Hapus Agenda (Admin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* KBM Summary Table */}
                <div className="p-4 space-y-3">
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                          <th className="py-2 px-2.5 w-16 border-r border-slate-200">Jam</th>
                          <th className="py-2 px-2.5 w-36 border-r border-slate-200">Guru</th>
                          <th className="py-2 px-2.5 w-32 border-r border-slate-200">Mapel</th>
                          <th className="py-2 px-2.5 border-r border-slate-200">Materi</th>
                          <th className="py-2 px-2.5 w-28">Tugas/PR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {agenda.kbm.map((k, idx) => {
                          const isBreak = k.jam_ke === 'Istirahat' || k.jam_ke === 'Isoma';
                          return (
                            <tr key={idx} className={isBreak ? 'bg-slate-50' : 'bg-white'}>
                              <td className="p-2 border-r border-slate-200 font-bold text-slate-700">
                                {k.jam_ke}
                              </td>
                              <td className="p-2 border-r border-slate-200 font-medium text-slate-800">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{k.nama_guru || '-'}</span>
                                  {k.is_badal && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
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

                  {/* Absensi & Kejadian Note */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-1 text-xs">
                    <div className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="font-bold text-slate-700 block mb-1">Ketidakhadiran:</span>
                      {agenda.absensi && agenda.absensi.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {agenda.absensi.map((ab, abIdx) => (
                            <span
                              key={abIdx}
                              className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-medium text-slate-800"
                            >
                              {ab.nama_siswa} ({ab.status})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-medium">✓ Seluruh siswa hadir</span>
                      )}
                    </div>

                    {agenda.kejadian && agenda.kejadian.length > 0 && agenda.kejadian[0].uraian_kejadian && (
                      <div className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Kejadian Khusus:
                        </span>
                        <p className="text-slate-600">{agenda.kejadian[0].uraian_kejadian}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
