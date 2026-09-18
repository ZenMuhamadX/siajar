import React, { useState, useEffect, useCallback } from 'react';
import { getSubstitutionHistory, cancelSubstitution } from '../../services/substitutionService';
import type { Substitution } from '../../types';
import { PageHeader } from '../../components/admin/PageHeader';
import {
  Users,
  Calendar,
  Loader2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SubstitusiPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface SubWithSchedule extends Substitution {
  schedule?: {
    class_id: string;
    subject_name: string;
    start_time: string;
    end_time: string;
    period_number: number;
    day: string;
  };
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Senin',
  TUESDAY: 'Selasa',
  WEDNESDAY: 'Rabu',
  THURSDAY: 'Kamis',
  FRIDAY: 'Jumat',
};

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const SubstitusiPage: React.FC<SubstitusiPageProps> = ({ showToast }) => {
  const [data, setData] = useState<SubWithSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Filters
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [showCancelled, setShowCancelled] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSubstitutionHistory({
        startDate,
        endDate,
      });
      setData(result as SubWithSchedule[]);
    } catch (err: any) {
      showToast('error', 'Gagal memuat histori badal: ' + (err?.message || ''));
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancel = async (sub: SubWithSchedule) => {
    if (!confirm(`Batalkan badal "${sub.substitute_teacher_name}" untuk kelas ${sub.schedule?.class_id || '-'}?`)) return;

    setCancellingId(sub.id);
    try {
      await cancelSubstitution(sub.id);
      showToast('success', 'Badal berhasil dibatalkan.');
      fetchData();
    } catch (err: any) {
      showToast('error', 'Gagal membatalkan badal: ' + (err?.message || ''));
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = showCancelled ? data : data.filter((d) => !d.cancelled_at);
  const activeCount = data.filter((d) => !d.cancelled_at).length;
  const cancelledCount = data.filter((d) => d.cancelled_at).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histori Badal / Guru Pengganti"
        description="Pantau dan kelola data penggantian guru (badal) pada jadwal kelas."
      />

      {/* Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-none"
            />
          </div>
          <button
            onClick={fetchData}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tampilkan
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-semibold">
            {activeCount} Aktif
          </span>
          {cancelledCount > 0 && (
            <button
              onClick={() => setShowCancelled((v) => !v)}
              className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-semibold flex items-center gap-1 hover:bg-slate-200 transition"
            >
              {cancelledCount} Dibatalkan
              {showCancelled ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            <span>Memuat data...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">Tidak ada data badal</p>
            <p className="text-xs text-slate-400">Belum ada penggantian guru pada rentang tanggal ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Tanggal</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Kelas & Mapel</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Jam</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Guru Terjadwal</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Guru Pengganti</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Alasan</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((sub) => {
                  const isCancelled = Boolean(sub.cancelled_at);
                  const sch = sub.schedule;
                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-slate-50/60 transition ${isCancelled ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {formatDate(sub.substitution_date)}
                      </td>
                      <td className="px-4 py-3">
                        {sch ? (
                          <div>
                            <p className="font-bold text-slate-900">{sch.class_id}</p>
                            <p className="text-slate-500">{sch.subject_name}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {sch ? (
                          <>
                            {sch.start_time.slice(0, 5)} – {sch.end_time.slice(0, 5)}
                            <span className="ml-1 text-[10px] text-slate-400">(JP {sch.period_number})</span>
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {sub.original_teacher_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-amber-800">{sub.substitute_teacher_name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {sub.reason}
                        {sub.reason_detail && (
                          <p className="text-[11px] text-slate-400 italic">{sub.reason_detail}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[11px] font-semibold">
                            Dibatalkan
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-semibold">
                            Aktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleCancel(sub)}
                            disabled={cancellingId === sub.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50"
                            title="Batalkan badal"
                          >
                            {cancellingId === sub.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            Batalkan
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
