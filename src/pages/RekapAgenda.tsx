import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { localDateString, formatDateShort, formatDateLong } from '../utils/date';
import { type Guru } from '../types';
import { useClassLabels } from '../contexts/ClassContext';
import type { AcademicYear } from '../types/schedule';
import { deleteAgenda, getDaftarGuru } from '../services/agendaService';
import { getAcademicYears } from '../services/scheduleService';
import { deleteAgendaEvidence } from '../services/evidenceService';
import { invalidateReportCache } from '../services/reportService';
import {
  queryJournalRows,
  queryJournalAbsenceStats,
  queryAllJournalRowsForPrint,
  JOURNAL_PRINT_MAX_ROWS,
  type JournalRow,
} from '../services/report/reportQuery';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AgendaDetailDrawer } from '../components/report/AgendaDetailDrawer';
import { createPrintModel, cellText } from '../services/report/printReportModel';
import {
  downloadReportPdf,
  ReportPdfExportError,
} from '../services/export/reportPdfExport';
import { mapFriendlyError } from '../utils/friendlyError';
import { useAuth } from '../contexts/AuthContext';
import { useSchoolName } from '../contexts/SettingsContext';
import { DataTable, FilterBar, ErrorState, type Column } from '../components/common';
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

type PeriodeType = 'hari_ini' | '7_hari' | 'bulan_ini' | 'tahun_ajaran' | 'custom';

const PERIODE_OPTIONS: { value: PeriodeType; label: string }[] = [
  { value: 'hari_ini', label: 'Hari Ini' },
  { value: '7_hari', label: '7 Hari' },
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
  const schoolName = useSchoolName();
  // Sumber kelas: master data, bukan konstanta hardcoded.
  const kelasLabels = useClassLabels();

  // ---- Filter state ----
  // Default "Hari Ini" — halaman ini dipakai sebagai papan pemantauan harian,
  // jadi membuka Log Jurnal langsung menampilkan agenda hari berjalan, bukan
  // rentang luas yang harus dipersempit dulu.
  const [periodeType, setPeriodeType] = useState<PeriodeType>('hari_ini');
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
  // K-05: saat mengekspor PDF, seluruh hasil filter diunduh (bukan hanya halaman
  // aktif). State ini menandai prosesnya agar tombol bisa menampilkan status.
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  // K-11: kegagalan muat jadi state agar ekspor dapat diblokir.
  const [loadError, setLoadError] = useState<string | null>(null);

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
      case 'hari_ini':
        // Satu hari: awal dan akhir sama. Dipakai untuk pemeriksaan per hari
        // (mis. "agenda hari ini sudah lengkap belum?").
        return { startDate: todayStr, endDate: todayStr };
      case '7_hari':
        return { startDate: shift(6), endDate: todayStr };
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
        // Bila salah satu tanggal belum dipilih, mundur 29 hari (≈ sebulan)
        // supaya preset ini tetap punya rentang yang berguna, bukan kosong.
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
    setLoadError(null);
    try {
      const res = await queryJournalRows({ ...queryParams, page, pageSize });
      setRows(res.rows);
      setTotalRows(res.total);
      if (res.searchTruncated) {
        showToast('info', 'Hasil pencarian terlalu banyak — persempit kata kunci untuk hasil lengkap.');
      }
    } catch (err) {
      // K-12: pesan ramah, detail teknis cukup di konsol.
      console.error(err);
      const message = mapFriendlyError(err, { subject: 'log jurnal agenda' });
      setLoadError(message);
      showToast('error', message);
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

  // ---- Hapus agenda (selalu lewat dialog konfirmasi) ----
  const confirmDeleteAgenda = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAgenda(deleteTarget.id);
      // K-10: hasil rekap yang di-cache tidak boleh menampilkan agenda terhapus.
      invalidateReportCache();
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
      // K-10: kosongkan cache rekap agar status dokumentasi ikut tersegarkan.
      invalidateReportCache();
      fetchRows();
    } catch (err: any) {
      showToast('error', 'Gagal menghapus foto dokumentasi: ' + (err?.message || ''));
    } finally {
      setIsDeletingEvidence(false);
    }
  };

  /**
   * Rentang tanggal siap tampil.
   *
   * Dipisah dari `periodeLabel` karena keduanya dipakai di tempat berbeda:
   * label layar memuat nama preset ("Hari Ini: …"), sedangkan dokumen PDF hanya
   * butuh rentangnya — baris "Periode:" pada dokumen sudah menambahkan
   * labelnya sendiri, sehingga tidak ada keluaran "Periode: Hari Ini: …".
   */
  const periodeRange = useMemo(() => {
    if (periodeType === 'custom' && (customStartDate || customEndDate)) {
      return `${formatDateShort(customStartDate || dateRange.startDate)} s.d. ${formatDateShort(
        customEndDate || dateRange.endDate,
      )}`;
    }
    return `${formatDateShort(dateRange.startDate)} s.d. ${formatDateShort(dateRange.endDate)}`;
  }, [periodeType, customStartDate, customEndDate, dateRange.startDate, dateRange.endDate]);

  const periodeLabel = useMemo(() => {
    if (periodeType === 'custom' && (customStartDate || customEndDate)) {
      return `Periode: ${periodeRange}`;
    }
    const preset = PERIODE_OPTIONS.find((o) => o.value === periodeType)?.label;
    return `${preset || 'Periode'}: ${periodeRange}`;
  }, [periodeType, customStartDate, customEndDate, periodeRange]);

  const isFiltered =
    periodeType !== 'hari_ini' ||
    selectedGuru !== 'SEMUA' ||
    selectedKelas !== 'SEMUA' ||
    Boolean(customStartDate) ||
    Boolean(customEndDate) ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setPeriodeType('hari_ini');
    setSelectedGuru('SEMUA');
    setSelectedKelas('SEMUA');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
    setPage(1);
  };

  const kelasLabel = selectedKelas === 'SEMUA' ? 'Semua Kelas' : selectedKelas;
  const guruLabel = selectedGuru === 'SEMUA' ? 'Semua Guru' : selectedGuru;

  /**
   * Bangun model cetak dari baris jurnal (K-13, K-14, K-17).
   *
   * Dua keputusan bentuk dokumen, sesuai arahan pemilik produk:
   *   1. **Satu baris KBM = satu baris dokumen.** Satu agenda bisa memuat
   *      beberapa sesi mengajar (mis. SBDP jam 3 DAN jam 4). Digabung jadi satu
   *      baris, materi sesi kedua tidak punya tempat menempel. Dipecah, setiap
   *      mapel berdiri sendiri dengan JP dan materinya masing-masing — inilah
   *      bentuk yang layak untuk laporan.
   *   2. **Tanpa kolom absensi & foto.** Dokumen cetak hanya memuat informasi
   *      tekstual yang diminta; status kehadiran siswa dan bukti foto adalah
   *      kebutuhan dashboard, bukan dokumen arsip.
   *
   * Kolom "Materi" sengaja TIDAK diberi lebar tetap, melainkan menyerap sisa
   * lebar tabel (lihat `resolveColumnWidths` di penulis PDF) sehingga teksnya
   * membungkus penuh, tidak pernah terpotong.
   *
   * Lebar kolom ditulis dalam POIN (satuan cetak) karena model yang sama juga
   * menyuplai layar — tidak ada lagi daftar lebar terpisah di penulis PDF yang
   * bisa menyimpang dari kolomnya.
   */
  const buildJournalPrintModel = useCallback(
    (printRows: JournalRow[]) =>
      createPrintModel({
        documentKind: 'jurnal',
        orientation: 'landscape',
        title: 'Laporan Rekapitulasi Agenda & KBM Kelas',
        subtitle: `Kelas: ${kelasLabel} • Guru: ${guruLabel}`,
        periodInfo: periodeRange,
        fileLabel: localDateString(),
        columns: [
          { key: 'no', header: 'No', align: 'center', ptWidth: 24 },
          { key: 'tanggal', header: 'Tanggal', align: 'center', ptWidth: 62 },
          { key: 'kelas', header: 'Kelas', align: 'center', ptWidth: 48 },
          { key: 'guru', header: 'Nama Guru', align: 'left', ptWidth: 118 },
          { key: 'mapel', header: 'Mata Pelajaran', align: 'left', ptWidth: 88 },
          { key: 'jp', header: 'JP Ke-', align: 'center', ptWidth: 34 },
          { key: 'materi', header: 'Materi', align: 'left' },
        ],
        rows: printRows
          .flatMap((r) => {
            // Agenda tanpa baris KBM tetap ditampilkan sebagai satu baris kosong
            // supaya agenda yang belum diisi tidak "hilang" dari dokumen.
            const kbmList = r.kbm.length > 0 ? r.kbm : [null];
            return kbmList.map((k) => ({
              tanggal: cellText(formatDateShort(r.tanggal)),
              kelas: cellText(r.kelas),
              guru: `${cellText(
                k?.nama_guru || r.actualTeacherName || r.kbm?.[0]?.nama_guru,
              )}${k?.is_badal ? ' (Badal)' : ''}`,
              mapel: cellText(k?.mapel),
              jp: cellText(k?.jam_ke),
              materi: cellText(k?.materi),
            }));
          })
          // Nomor urut diberikan SETELAH pemecahan, agar dokumen bernomor 1..N
          // berurutan — bukan mengulang nomor agenda yang sama untuk tiap KBM.
          .map((row, i) => ({ no: cellText(i + 1), ...row })),
        emptyMessage: 'Tidak ada agenda pada periode dan filter yang dipilih.',
      }),
    [kelasLabel, guruLabel, periodeRange],
  );

  /**
   * Unduh PDF Log Jurnal (K-05, K-14, K-17).
   *
   * Alur lengkapnya:
   *   1. tarik SELURUH baris hasil filter (dibatasi `JOURNAL_PRINT_MAX_ROWS`) —
   *      bukan hanya halaman aktif, sehingga tidak ada data yang hilang diam-diam;
   *   2. bangun model cetak dari baris lengkap itu;
   *   3. serahkan model ke penulis PDF (`downloadReportPdf`), yang menyusun
   *      dokumen dari NOL — tanpa membaca DOM, sehingga tabel layar, paginasi,
   *      filter, dan kolom AKSI tidak mungkin ikut tercetak;
   *   4. bila hasil melebihi plafon, beri tahu pengguna bahwa dokumen dibatasi.
   *
   * Tidak ada `window.print()` di jalur ini sama sekali; dokumen ditulis oleh
   * mesin PDF yang sama dengan rekap harian/mingguan/bulanan (pola yang sama
   * dengan export jadwal .xlsx).
   */
  const handleDownloadPdf = useCallback(async () => {
    if (isPreparingPrint) return;
    setIsPreparingPrint(true);
    try {
      const { rows: allRows, total, truncated } = await queryAllJournalRowsForPrint(queryParams);
      if (allRows.length === 0) {
        showToast('info', 'Tidak ada data untuk diekspor pada periode ini.');
        return;
      }

      const fullModel = buildJournalPrintModel(allRows);
      const fileName = await downloadReportPdf(fullModel, {
        schoolName,
        // Tanggal dokumen: hari ini, memakai formatter terpusat (WIB-safe).
        dateLabel: formatDateLong(localDateString()),
      });

      if (truncated) {
        showToast(
          'info',
          `Hasil filter melebihi ${JOURNAL_PRINT_MAX_ROWS} baris. Dokumen dibatasi ${JOURNAL_PRINT_MAX_ROWS} baris pertama — persempit filter untuk dokumen lengkap.`,
        );
      } else if (total > rows.length) {
        showToast('success', `PDF dibuat: ${fileName} (${allRows.length} sesi mengajar).`);
      } else {
        showToast('success', `PDF dibuat: ${fileName}`);
      }
    } catch (err) {
      console.error('Gagal menyiapkan dokumen PDF:', err);
      // Error domain pdf sudah punya pesan Indonesia; sisanya dipetakan.
      const message =
        err instanceof ReportPdfExportError
          ? err.message
          : mapFriendlyError(err, { subject: 'dokumen PDF' });
      showToast('error', message);
    } finally {
      setIsPreparingPrint(false);
    }
  }, [
    isPreparingPrint,
    queryParams,
    rows.length,
    showToast,
    schoolName,
    buildJournalPrintModel,
  ]);

  const columns: Column<JournalRow>[] = useMemo(
    () => [
      {
        key: 'kelas',
        header: 'Kelas',
        align: 'center',
        width: '90px',
        accessor: (r) => (
          <span className="inline-block px-2 py-0.5 bg-slate-800 text-white font-bold text-xs rounded print:border print:border-black print:text-black print:bg-white">
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
          <span className="block font-medium text-slate-700 whitespace-nowrap" title={formatDateLong(r.tanggal)}>
            {formatDateShort(r.tanggal)}
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
                <span className="px-1 text-xs font-bold border border-amber-400 text-amber-700 rounded">
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
            <span className="text-xs font-semibold text-slate-700">
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
          if (absensi.length === 0) return <span className="text-xs text-emerald-600">Hadir lengkap</span>;
          const count = (status: 'S' | 'I' | 'A') => absensi.filter((x) => x.status === status).length;
          return (
            <div className="flex items-center justify-center gap-1 flex-wrap">
              {count('S') > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs font-bold">
                  S {count('S')}
                </span>
              )}
              {count('I') > 0 && (
                <span className="px-1.5 py-0.5 bg-sky-50 border border-sky-200 text-sky-700 rounded text-xs font-bold">
                  I {count('I')}
                </span>
              )}
              {count('A') > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs font-bold">
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
              className="px-2 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition inline-flex items-center gap-1"
              title="Lihat foto di detail agenda"
            >
              <Camera className="h-3 w-3 text-emerald-700" />
              <span>Ada</span>
            </button>
          ) : (
            <span className="text-xs text-slate-600" title="Belum ada bukti foto">
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
              aria-label="Lihat Detail Agenda"
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
                aria-label="Koreksi Agenda"
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
                aria-label="Hapus Agenda"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(r);
                }}
                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition"
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
                  className={`px-2.5 py-1 rounded whitespace-nowrap transition text-xs sm:text-xs ${
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
                <span className="text-slate-600 text-xs shrink-0">Dari:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-medium text-slate-800 text-xs w-full"
                />
                <span className="text-slate-600 text-xs shrink-0">S.d:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-medium text-slate-800 text-xs w-full"
                />
              </div>
            )}

            {/* Filter Guru */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedGuru}
                onChange={(e) => {
                  setSelectedGuru(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 w-full text-xs"
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
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedKelas}
                onChange={(e) => {
                  setSelectedKelas(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 w-full text-xs"
              >
                <option value="SEMUA">Semua Kelas</option>
                {kelasLabels.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            {periodeType !== 'custom' && (
              <span className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5" />
                {formatDateShort(dateRange.startDate)} – {formatDateShort(dateRange.endDate)}
              </span>
            )}
          </>
        }
        actions={
          <>
            <button
              aria-label="Refresh"
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
              onClick={handleDownloadPdf}
              disabled={rows.length === 0 || isLoading || Boolean(loadError) || isPreparingPrint}
              title={
                loadError
                  ? 'Tidak dapat mengekspor: data gagal dimuat'
                  : 'Mengunduh PDF seluruh hasil filter, bukan hanya halaman ini'
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className={`w-3.5 h-3.5 ${isPreparingPrint ? 'animate-pulse' : ''}`} />
              <span>{isPreparingPrint ? 'Menyiapkan…' : 'Unduh PDF'}</span>
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
              <p className="text-xs text-slate-600 font-medium">{s.label}</p>
              <p className={`text-lg font-bold ${s.tone}`}>{s.value}</p>
            </div>
            <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
              {s.code}
            </span>
          </div>
        ))}
      </div>

      {/* K-11: state error eksplisit; mencetak otomatis terblokir. */}
      {loadError && (
        <div className="no-print bg-white rounded-xl border border-rose-200 shadow-2xs">
          <ErrorState title="Gagal memuat log jurnal" message={loadError} onRetry={fetchRows} />
        </div>
      )}

      {/* DOKUMEN REKAP & CETAK RESMI */}
      <DataTable
        title="Rekap Agenda Pembelajaran & KBM"
        subtitle={`${periodeLabel} • ${
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

      {/* Dokumen cetak dihasilkan mesin PDF terprogram (`downloadReportPdf`)
          langsung dari `printModel` — bukan dari DOM. Karena itu tidak ada lagi
          tabel cetak tersembunyi di sini yang bisa bocor ke kertas (K-13/K-14),
          dan orientasi/lebar kolom ditentukan model, bukan CSS halaman (K-15). */}

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
