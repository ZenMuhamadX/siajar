import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { localDateString } from '../utils/date';
import { DAFTAR_KELAS, type Guru } from '../types';
import type { AcademicYear } from '../types/schedule';
import { deleteAgenda, getDaftarGuru } from '../services/agendaService';
import { getAcademicYears } from '../services/scheduleService';
import { deleteAgendaEvidence } from '../services/evidenceService';
import {
  queryJournalRows,
  queryJournalAbsenceStats,
  type JournalRow,
} from '../services/report/reportQuery';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AgendaDetailDrawer } from '../components/report/AgendaDetailDrawer';
import { ReportPrintLayout } from '../components/admin/report/ReportPrintLayout';
import { useAuth } from '../contexts/AuthContext';
import { DataTable, FilterBar, type Column } from '../components/common';
import { PageHeader } from '../components/admin/PageHeader';
import {
  Printer,
  Calendar,
  Filter,
  Trash2,
  BookOpen,
  FileCheck,
  RefreshCw,
  User,
  Camera,
  Eye,
} from 'lucide-react';

interface RekapAgendaProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  /** Handoff koreksi: dipanggil dengan `agenda_id`. */
  onEditAgenda?: (agendaId: string) => void;
}

type PeriodeType = '7_hari' | '30_hari' | 'bulan_ini' | 'tahun_ajaran' | 'custom';

const PERIODE_OPTIONS: { value: PeriodeType; label: string }[] = [
  { value: '7_hari', label: '7 Hari' },
  { value: '30_hari', label: '30 Hari' },
  { value: 'bulan_ini', label: 'Bulan Ini' },
  { value: 'tahun_ajaran', label: 'Tahun Ajaran' },
  { value: 'custom', label: 'Kustom' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Log Jurnal Agenda — arsip isi agenda (tampilan "Log Jurnal" di Pusat Rekap).
 *
 * Prinsipnya:
 *   - **payload ringan**: daftar hanya menarik kolom yang dirender tabel
 *     (lihat `services/report/reportQuery.ts`); materi/PR/kehadiran/kejadian/foto
 *     diambil saat baris dibuka (drawer detail),
 *   - **filter di SQL**: kelas, guru, dan pencarian tidak lagi menyaring
 *     di memori setelah semua data ditarik,
 *   - **paginasi server**: satu bulan bisa ratusan agenda, jadi halaman hanya
 *     mengambil satu halaman dan `total` untuk paginator.
 */
export const RekapAgenda: React.FC<RekapAgendaProps> = ({ showToast, onEditAgenda }) => {
  const { isAdmin } = useAuth();

  // ---- Filter state ----
  // Default 30 hari terakhir (dulu "bulan kalender", yang di awal bulan kosong).
  const [periodeType, setPeriodeType] = useState<PeriodeType>('30_hari');
  const [selectedGuru, setSelectedGuru] = useState<string>('SEMUA');
  const [selectedKelas, setSelectedKelas] = useState<string>('SEMUA');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ---- Data state ----
  const [daftarGuru, setDaftarGuru] = useState<Guru[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [absenceStats, setAbsenceStats] = useState({ S: 0, I: 0, A: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ---- Dialog & drawer state ----
  const [detailAgendaId, setDetailAgendaId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JournalRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [evidenceDeleteTarget, setEvidenceDeleteTarget] = useState<{
    agendaId: string;
    storagePath?: string;
  } | null>(null);
  const [isDeletingEvidence, setIsDeletingEvidence] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [teachers, ays] = await Promise.all([getDaftarGuru(), getAcademicYears()]);
        setDaftarGuru(teachers);
        setAcademicYears(ays);
      } catch (err) {
        console.error('Gagal memuat opsi filter:', err);
      }
    }
    loadOptions();
  }, []);

  /** Rentang tanggal aktif sesuai preset. */
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = localDateString(today);
    const shift = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return localDateString(d);
    };

    switch (periodeType) {
      case '7_hari':
        return { startDate: shift(6), endDate: todayStr };
      case '30_hari':
        return { startDate: shift(29), endDate: todayStr };
      case 'bulan_ini': {
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
        return {
          startDate: `${year}-${month}-01`,
          endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
        };
      }
      case 'tahun_ajaran': {
        const ay = academicYears.find((a) => a.status === 'ACTIVE') || academicYears[0];
        const start = ay?.start_date || shift(180);
        return { startDate: start, endDate: todayStr < (ay?.end_date || todayStr) ? todayStr : ay!.end_date };
      }
      case 'custom':
      default:
        return {
          startDate: customStartDate || shift(29),
          endDate: customEndDate || todayStr,
        };
    }
  }, [periodeType, customStartDate, customEndDate, academicYears]);

  const queryParams = useMemo(
    () => ({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      classId: selectedKelas,
      teacherName: selectedGuru,
      search: searchQuery.trim(),
    }),
    [dateRange, selectedKelas, selectedGuru, searchQuery]
  );

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await queryJournalRows({ ...queryParams, page, pageSize });
      setRows(res.rows);
      setTotalRows(res.total);
      if (res.searchTruncated) {
        showToast('info', 'Hasil pencarian terlalu banyak — persempit kata kunci untuk hasil lengkap.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat rekap agenda.');
    } finally {
      setIsLoading(false);
    }
  }, [queryParams, page, pageSize, showToast]);

  /** Statistik S/I/A mewakili SELURUH hasil filter, bukan hanya halaman aktif. */
  const fetchAbsenceStats = useCallback(async () => {
    try {
      setAbsenceStats(await queryJournalAbsenceStats(queryParams));
    } catch (err) {
      console.error('Gagal menghitung rekap kehadiran:', err);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    fetchAbsenceStats();
  }, [fetchAbsenceStats]);

  // Catatan: setiap perubahan filter/preset sudah memanggil `setPage(1)` di
  // handler-nya masing-masing, jadi tidak perlu efek untuk mereset halaman.

  const handlePrint = () => window.print();

  // ---- Hapus agenda (selalu lewat dialog konfirmasi) ----
  const confirmDeleteAgenda = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAgenda(deleteTarget.id);
      showToast('success', 'Agenda berhasil dihapus.');
      setDeleteTarget(null);
      fetchRows();
    } catch {
      showToast('error', 'Gagal menghapus agenda.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ---- Hapus foto dokumentasi (dipanggil dari drawer) ----
  const confirmDeleteEvidence = async () => {
    if (!evidenceDeleteTarget) return;
    setIsDeletingEvidence(true);
    try {
      await deleteAgendaEvidence(
        evidenceDeleteTarget.agendaId,
        evidenceDeleteTarget.storagePath,
        true
      );
      showToast('success', 'Foto dokumentasi dihapus. Status agenda kembali ke belum ada foto.');
      setEvidenceDeleteTarget(null);
      setDetailAgendaId(null);
      fetchRows();
    } catch (err: any) {
      showToast('error', 'Gagal menghapus foto dokumentasi: ' + (err?.message || ''));
    } finally {
      setIsDeletingEvidence(false);
    }
  };

  const formatDateIndo = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatSimpleDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getPeriodeLabel = () => {
    if (periodeType === 'custom' && (customStartDate || customEndDate)) {
      return `Periode: ${formatSimpleDate(customStartDate || dateRange.startDate)} s.d. ${formatSimpleDate(
        customEndDate || dateRange.endDate
      )}`;
    }
    const preset = PERIODE_OPTIONS.find((o) => o.value === periodeType)?.label;
    return `${preset || 'Periode'}: ${formatSimpleDate(dateRange.startDate)} s.d. ${formatSimpleDate(
      dateRange.endDate
    )}`;
  };

  const isFiltered =
    periodeType !== '30_hari' ||
    selectedGuru !== 'SEMUA' ||
    selectedKelas !== 'SEMUA' ||
    Boolean(customStartDate) ||
    Boolean(customEndDate) ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setPeriodeType('30_hari');
    setSelectedGuru('SEMUA');
    setSelectedKelas('SEMUA');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
    setPage(1);
  };

  const kelasLabel = selectedKelas === 'SEMUA' ? 'Semua Kelas' : selectedKelas;
  const guruLabel = selectedGuru === 'SEMUA' ? 'Semua Guru' : selectedGuru;

  const columns: Column<JournalRow>[] = useMemo(
    () => [
      {
        key: 'kelas',
        header: 'Kelas',
        align: 'center',
        width: '90px',
        accessor: (r) => (
          <span className="inline-block px-2 py-0.5 bg-slate-800 text-white font-bold text-[11px] rounded print:border print:border-black print:text-black print:bg-white">
            {r.kelas}
          </span>
        ),
      },
      {
        key: 'tanggal',
        header: 'Tanggal',
        align: 'left',
        width: '130px',
        accessor: (r) => (
          <span className="block font-medium text-slate-700 whitespace-nowrap" title={formatDateIndo(r.tanggal)}>
            {formatSimpleDate(r.tanggal)}
          </span>
        ),
      },
      {
        key: 'guru',
        header: 'Guru',
        align: 'left',
        width: '160px',
        accessor: (r) => {
          const namaGuru = r.actualTeacherName || r.kbm?.[0]?.nama_guru || '-';
          const isBadal = (r.kbm || []).some((k) => k.is_badal);
          return (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-medium text-slate-800">{namaGuru}</span>
              {isBadal && (
                <span className="px-1 text-[9px] font-bold border border-amber-400 text-amber-700 rounded">
                  Badal
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'mapel',
        header: 'Mata Pelajaran',
        align: 'left',
        width: '140px',
        accessor: (r) => {
          const mapels = Array.from(new Set((r.kbm || []).map((k) => k.mapel).filter(Boolean)));
          return <span className="text-slate-700">{mapels.length ? mapels.join(', ') : '-'}</span>;
        },
      },
      {
        key: 'jam',
        header: 'Jam',
        align: 'center',
        width: '80px',
        accessor: (r) => {
          const jam = (r.kbm || []).map((k) => k.jam_ke).filter(Boolean);
          return (
            <span className="text-[11px] font-semibold text-slate-700">
              {jam.length ? jam.join(', ') : '-'}
            </span>
          );
        },
      },
      {
        key: 'absensi',
        header: 'Ketidakhadiran',
        align: 'center',
        width: '130px',
        accessor: (r) => {
          const absensi = r.absensi || [];
          if (absensi.length === 0) return <span className="text-[11px] text-emerald-600">Hadir lengkap</span>;
          const count = (status: 'S' | 'I' | 'A') => absensi.filter((x) => x.status === status).length;
          return (
            <div className="flex items-center justify-center gap-1 flex-wrap">
              {count('S') > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[10px] font-bold">
                  S {count('S')}
                </span>
              )}
              {count('I') > 0 && (
                <span className="px-1.5 py-0.5 bg-sky-50 border border-sky-200 text-sky-700 rounded text-[10px] font-bold">
                  I {count('I')}
                </span>
              )}
              {count('A') > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-[10px] font-bold">
                  A {count('A')}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'bukti',
        header: 'Bukti Foto',
        align: 'center',
        width: '110px',
        accessor: (r) =>
          r.evidence?.storage_path ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailAgendaId(r.id);
              }}
              className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition inline-flex items-center gap-1"
              title="Lihat foto di detail agenda"
            >
              <Camera className="h-3 w-3 text-emerald-700" />
              <span>Ada</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400" title="Belum ada bukti foto">
              -
            </span>
          ),
      },
      {
        key: 'actions',
        header: 'Aksi',
        align: 'right',
        width: '150px',
        accessor: (r) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailAgendaId(r.id);
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
              title="Lihat Detail Agenda"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            {onEditAgenda && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditAgenda(r.id);
                }}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                title="Koreksi Agenda"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(r);
                }}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition"
                title="Hapus Agenda"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [isAdmin, onEditAgenda]
  );

  return (
    <div className="w-full space-y-4">
      {/* PAGE HEADER (Screen Only, Hidden in Print) */}
      <div className="no-print">
        <PageHeader
          title="Log Jurnal Agenda"
          description="Arsip jurnal pembelajaran & KBM seluruh kelas — telusuri, saring, dan cetak laporan."
        />
      </div>

      {/* FILTER BAR (Screen Only, Hidden in Print) */}
      <FilterBar
        className="no-print"
        searchValue={searchQuery}
        onSearchChange={(v) => {
          setSearchQuery(v);
          setPage(1);
        }}
        searchPlaceholder="Cari kelas, guru, mapel, materi..."
        isFiltered={isFiltered}
        onResetFilters={handleResetFilters}
        filters={
          <>
            {/* Preset periode */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium overflow-x-auto no-scrollbar">
              {PERIODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setPeriodeType(opt.value);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded whitespace-nowrap transition text-[11px] sm:text-xs ${
                    periodeType === opt.value
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {periodeType === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 w-full sm:w-auto">
                <span className="text-slate-400 text-[10px] shrink-0">Dari:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-medium text-slate-800 focus:outline-none text-xs w-full"
                />
                <span className="text-slate-400 text-[10px] shrink-0">S.d:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-medium text-slate-800 focus:outline-none text-xs w-full"
                />
              </div>
            )}

            {/* Filter Guru */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedGuru}
                onChange={(e) => {
                  setSelectedGuru(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 focus:outline-none w-full text-xs"
              >
                <option value="SEMUA">Semua Guru</option>
                {daftarGuru.map((g) => (
                  <option key={g.id} value={g.nama_guru}>
                    {g.nama_guru}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kelas */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedKelas}
                onChange={(e) => {
                  setSelectedKelas(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 focus:outline-none w-full text-xs"
              >
                <option value="SEMUA">Semua Kelas</option>
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            {periodeType !== 'custom' && (
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5" />
                {formatSimpleDate(dateRange.startDate)} – {formatSimpleDate(dateRange.endDate)}
              </span>
            )}
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                fetchRows();
                fetchAbsenceStats();
              }}
              className="p-2 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak PDF / Print</span>
            </button>
          </>
        }
      />

      {/* STATISTIK RINGKAS — mengikuti filter, bukan hanya halaman aktif (Screen Only) */}
      <div className="grid grid-cols-3 gap-2.5 no-print">
        {(
          [
            { label: 'Total Sakit (S)', value: absenceStats.S, code: 'S', tone: 'text-slate-800' },
            { label: 'Total Izin (I)', value: absenceStats.I, code: 'I', tone: 'text-slate-800' },
            { label: 'Total Alpha (A)', value: absenceStats.A, code: 'A', tone: 'text-slate-800' },
          ] as const
        ).map((s) => (
          <div key={s.code} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">{s.label}</p>
              <p className={`text-lg font-bold ${s.tone}`}>{s.value}</p>
            </div>
            <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
              {s.code}
            </span>
          </div>
        ))}
      </div>

      {/* DOKUMEN REKAP & CETAK RESMI */}
      <DataTable
        title="Rekap Agenda Pembelajaran & KBM"
        subtitle={`${getPeriodeLabel()} • ${
          totalRows > 0 ? `${totalRows} sesi agenda ditemukan` : 'Belum ada agenda pada periode ini'
        }`}
        titleIcon={<FileCheck className="w-4 h-4 text-slate-700 shrink-0" />}
        columns={columns}
        data={rows}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        onRowClick={(r) => setDetailAgendaId(r.id)}
        emptyTitle="Tidak Ada Data Agenda"
        emptyDescription="Tidak ditemukan agenda untuk filter yang dipilih."
        emptyIcon={<BookOpen className="w-5 h-5" />}
        isFiltered={isFiltered}
        onResetFilter={handleResetFilters}
        enablePagination
        defaultPageSize={25}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        serverPagination={{
          page,
          pageSize,
          total: totalRows,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
      />

      {/* LAYOUT CETAK — satu kop resmi; isi tabel memakai kolom ringkas yang sama
          dengan layar agar tidak ada isi layar yang bocor ke kertas. */}
      {rows.length > 0 && (
        <ReportPrintLayout
          title="Laporan Rekapitulasi Agenda & KBM Kelas"
          periodInfo={getPeriodeLabel()}
          subtitle={`Kelas: ${kelasLabel} • Guru: ${guruLabel}`}
          signature={
            <div className="grid grid-cols-2 text-center">
              <div>
                <p>Mengetahui,</p>
                <p className="font-bold">Kepala Sekolah SDIT AS-SYIFA</p>
                <div className="h-16" />
                <p className="font-bold underline">( ........................................ )</p>
              </div>
              <div>
                <p>Pengawas / Guru Piket,</p>
                <p className="font-bold">SDIT AS-SYIFA</p>
                <div className="h-16" />
                <p className="font-bold underline">( ........................................ )</p>
              </div>
            </div>
          }
        >
          <table className="w-full text-left text-[10px] border-collapse border border-slate-900">
            <thead className="bg-slate-100 border-b border-slate-900 font-bold uppercase">
              <tr>
                <th className="p-1.5 border-r border-slate-900 text-center w-8">No</th>
                <th className="p-1.5 border-r border-slate-900 text-center w-24">Tanggal</th>
                <th className="p-1.5 border-r border-slate-900 text-center w-20">Kelas</th>
                <th className="p-1.5 border-r border-slate-900">Guru</th>
                <th className="p-1.5 border-r border-slate-900">Mata Pelajaran</th>
                <th className="p-1.5 border-r border-slate-900 text-center w-16">Jam</th>
                <th className="p-1.5 border-r border-slate-900 text-center w-24">Tidak Hadir</th>
                <th className="p-1.5 text-center w-20">Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400">
              {rows.map((r, i) => {
                const s = r.absensi.filter((x) => x.status === 'S').length;
                const iz = r.absensi.filter((x) => x.status === 'I').length;
                const al = r.absensi.filter((x) => x.status === 'A').length;
                const mapel = Array.from(new Set(r.kbm.map((k) => k.mapel).filter(Boolean)));
                return (
                  <tr key={r.id}>
                    <td className="p-1.5 border-r border-slate-900 text-center">{i + 1}</td>
                    <td className="p-1.5 border-r border-slate-900 text-center">{formatSimpleDate(r.tanggal)}</td>
                    <td className="p-1.5 border-r border-slate-900 text-center font-bold">{r.kelas}</td>
                    <td className="p-1.5 border-r border-slate-900">
                      {r.actualTeacherName || r.kbm?.[0]?.nama_guru || '-'}
                      {r.kbm.some((k) => k.is_badal) ? ' (Badal)' : ''}
                    </td>
                    <td className="p-1.5 border-r border-slate-900">{mapel.join(', ') || '-'}</td>
                    <td className="p-1.5 border-r border-slate-900 text-center">
                      {r.kbm.map((k) => k.jam_ke).filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-900 text-center">
                      {r.absensi.length === 0 ? 'Lengkap' : `S ${s} · I ${iz} · A ${al}`}
                    </td>
                    <td className="p-1.5 text-center">{r.evidence?.storage_path ? 'Ada' : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ReportPrintLayout>
      )}

      {/* Drawer detail: isi agenda lengkap (KBM, absensi, kejadian, foto) */}
      <AgendaDetailDrawer
        agendaId={detailAgendaId}
        onClose={() => setDetailAgendaId(null)}
        onEdit={onEditAgenda}
        isAdmin={isAdmin}
        onAdminDeleteEvidence={(agendaId, storagePath) =>
          setEvidenceDeleteTarget({ agendaId, storagePath })
        }
      />

      {/* Konfirmasi hapus agenda (selalu dialog, tidak pernah confirm() native) */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteAgenda}
        isLoading={isDeleting}
        title="Hapus agenda ini?"
        message={
          deleteTarget
            ? `Agenda ${deleteTarget.kelas} tanggal ${deleteTarget.tanggal} beserta KBM, absensi, dan catatan kejadian akan dihapus permanen.`
            : ''
        }
        confirmText="Hapus"
      />

      {/* Konfirmasi hapus foto dokumentasi */}
      <ConfirmDialog
        isOpen={Boolean(evidenceDeleteTarget)}
        onClose={() => setEvidenceDeleteTarget(null)}
        onConfirm={confirmDeleteEvidence}
        isLoading={isDeletingEvidence}
        title="Hapus foto dokumentasi?"
        message="Foto akan dihapus dan status agenda kembali ke “Belum ada foto”. Isi agenda tidak ikut terhapus."
        confirmText="Hapus Foto"
      />
    </div>
  );
};
