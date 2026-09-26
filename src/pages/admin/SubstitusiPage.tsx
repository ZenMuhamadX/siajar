import React, { useState, useEffect, useCallback } from 'react';
import { localDateString } from '../../utils/date';
import { getSubstitutionHistory, cancelSubstitution } from '../../services/substitutionService';
import type { Substitution } from '../../types';
import { PageHeader } from '../../components/admin/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, FilterBar, StatusBadge, type Column } from '../../components/common';
import {
  Users,
  Loader2,
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
  const today = localDateString();
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

  // Batalkan badal via dialog konfirmasi
  const [cancelTarget, setCancelTarget] = useState<SubWithSchedule | null>(null);

  const handleCancel = (sub: SubWithSchedule) => {
    setCancelTarget(sub);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;

    setCancellingId(cancelTarget.id);
    try {
      await cancelSubstitution(cancelTarget.id);
      showToast('success', 'Badal berhasil dibatalkan.');
      setCancelTarget(null);
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
  const isFiltered = startDate !== monthStart || endDate !== today;

  const handleResetFilters = () => {
    setStartDate(monthStart);
    setEndDate(today);
  };

  const columns: Column<SubWithSchedule>[] = [
    {
      key: 'substitution_date',
      header: 'Tanggal',
      align: 'left',
      width: '170px',
      accessor: (sub) => (
        <span className="font-medium text-slate-800 whitespace-nowrap">
          {formatDate(sub.substitution_date)}
        </span>
      ),
    },
    {
      key: 'schedule_time',
      header: 'Waktu & JP',
      align: 'center',
      width: '130px',
      accessor: (sub) => {
        const sch = sub.schedule;
        if (!sch) return <span className="text-slate-400">—</span>;
        return (
          <span className="font-mono text-slate-700 whitespace-nowrap">
            {sch.start_time.slice(0, 5)} – {sch.end_time.slice(0, 5)}
            <span className="block text-[10px] text-slate-400 font-sans">
              JP {sch.period_number}
            </span>
          </span>
        );
      },
    },
    {
      key: 'class_subject',
      header: 'Kelas & Mapel',
      align: 'left',
      width: '150px',
      accessor: (sub) => {
        const sch = sub.schedule;
        if (!sch) return <span className="text-slate-400 italic">—</span>;
        return (
          <div className="whitespace-nowrap">
            <span className="font-bold text-slate-900 text-xs block">{sch.class_id}</span>
            <span className="text-slate-500 text-[11px]">{sch.subject_name}</span>
          </div>
        );
      },
    },
    {
      key: 'original_teacher_name',
      header: 'Guru Terjadwal',
      align: 'left',
      width: '160px',
      accessor: (sub) => (
        <span className="text-slate-700 font-medium">{sub.original_teacher_name}</span>
      ),
    },
    {
      key: 'substitute_teacher_name',
      header: 'Guru Pengganti',
      align: 'left',
      width: '170px',
      accessor: (sub) => (
        <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block whitespace-nowrap">
          {sub.substitute_teacher_name}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Alasan',
      align: 'left',
      accessor: (sub) => (
        <div className="max-w-xs">
          <span className="font-medium text-slate-700">{sub.reason}</span>
          {sub.reason_detail && (
            <p className="text-[11px] text-slate-400 italic mt-0.5">{sub.reason_detail}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '120px',
      accessor: (sub) =>
        sub.cancelled_at ? (
          <StatusBadge status="ARCHIVED" label="Dibatalkan" size="sm" />
        ) : (
          <StatusBadge status="ACTIVE" label="Aktif" size="sm" />
        ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      width: '120px',
      accessor: (sub) => {
        if (sub.cancelled_at) return null;
        return (
          <div className="flex items-center justify-end">
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
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histori Badal / Guru Pengganti"
        description="Pantau dan kelola data penggantian guru (badal) pada jadwal kelas."
      />

      {/* Standardized FilterBar */}
      <FilterBar
        filters={
          <>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Dari Tanggal
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Sampai Tanggal
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </label>

            {/* Stats & Toggle */}
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-semibold text-[11px]">
              {activeCount} Badal Aktif
            </span>
            {cancelledCount > 0 && (
              <button
                onClick={() => setShowCancelled((v) => !v)}
                className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-semibold text-[11px] flex items-center gap-1 hover:bg-slate-200 transition"
              >
                {cancelledCount} Dibatalkan
                {showCancelled ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
          </>
        }
        actions={
          <button
            onClick={fetchData}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tampilkan
          </button>
        }
        isFiltered={isFiltered}
        onResetFilters={handleResetFilters}
      />

      {/* Table Card */}
      <DataTable
        title="Daftar Badal"
        subtitle={`Total ${filtered.length} data badal`}
        titleIcon={<Users className="w-4 h-4 text-slate-600" />}
        columns={columns}
        data={filtered}
        keyExtractor={(sub) => sub.id}
        isLoading={isLoading}
        isFiltered={isFiltered}
        onResetFilter={handleResetFilters}
        emptyTitle="Tidak ada data badal"
        emptyDescription={
          isFiltered
            ? 'Belum ada penggantian guru pada rentang tanggal yang dipilih. Coba ubah rentang tanggalnya.'
            : 'Belum ada penggantian guru pada rentang tanggal ini.'
        }
        emptyIcon={<Users className="w-5 h-5" />}
        rowClassName={(sub) => (sub.cancelled_at ? 'opacity-50 bg-slate-50/30' : '')}
        enablePagination
        defaultPageSize={25}
      />

      {/* Dialog konfirmasi batalkan badal */}
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
        isLoading={Boolean(cancelTarget) && cancellingId === cancelTarget?.id}
        variant="warning"
        title="Batalkan badal ini?"
        message={
          cancelTarget
            ? `Badal "${cancelTarget.substitute_teacher_name}" untuk kelas ${
                cancelTarget.schedule?.class_id || '-'
              } akan dibatalkan dan jadwal kembali ke guru terjadwal.`
            : ''
        }
        confirmText="Batalkan Badal"
      />
    </div>
  );
};
