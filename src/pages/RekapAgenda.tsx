import React, { useState, useEffect } from 'react';
import { localDateString } from '../utils/date';
import { DAFTAR_KELAS, type FullAgenda, type Guru } from '../types';
import { getRekapAgenda, deleteAgenda, getDaftarGuru } from '../services/agendaService';
import { getEvidenceSignedUrl, deleteAgendaEvidence } from '../services/evidenceService';
import { PhotoLightboxModal } from '../components/PhotoLightboxModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
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
} from 'lucide-react';

interface RekapAgendaProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onEditAgenda?: (agenda: FullAgenda) => void;
}

type PeriodeType = 'bulan_ini' | 'harian' | 'custom';

export const RekapAgenda: React.FC<RekapAgendaProps> = ({ showToast, onEditAgenda }) => {
  const { isAdmin } = useAuth();

  // Filter States
  const [periodeType, setPeriodeType] = useState<PeriodeType>('bulan_ini');
  const [selectedGuru, setSelectedGuru] = useState<string>('SEMUA');
  const [selectedKelas, setSelectedKelas] = useState<string>('SEMUA');
  const [selectedTanggal, setSelectedTanggal] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data States
  const [daftarGuru, setDaftarGuru] = useState<Guru[]>([]);
  const [agendas, setAgendas] = useState<FullAgenda[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load daftar guru untuk dropdown filter
  useEffect(() => {
    async function loadTeachers() {
      try {
        const teachers = await getDaftarGuru();
        setDaftarGuru(teachers);
      } catch (err) {
        console.error('Gagal mengambil daftar guru:', err);
      }
    }
    loadTeachers();
  }, []);

  const calculateDateRange = () => {
    const today = new Date();
    const todayStr = localDateString(today);

    if (periodeType === 'harian') {
      const tgl = selectedTanggal || todayStr;
      return { tanggal: tgl, startDate: undefined, endDate: undefined };
    }

    if (periodeType === 'bulan_ini') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      return {
        tanggal: undefined,
        startDate: `${year}-${month}-01`,
        endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
      };
    }


    if (periodeType === 'custom') {
      return {
        tanggal: undefined,
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }

    return { tanggal: undefined, startDate: undefined, endDate: undefined };
  };

  // Lightbox Modal State
  const [activePhoto, setActivePhoto] = useState<{
    agendaId: string;
    storagePath?: string;
    url: string;
    uploadedAt?: string;
    capturedAt?: string;
    actualTeacherName?: string;
    title: string;
  } | null>(null);
  const [isDeletingEvidence, setIsDeletingEvidence] = useState<boolean>(false);
  const [isConfirmEvidenceOpen, setIsConfirmEvidenceOpen] = useState<boolean>(false);
  // Target hapus agenda + status proses, supaya penghapusan selalu terkonfirmasi
  // (dulu memakai confirm() dan dilewati di mode DEV).
  const [deleteTarget, setDeleteTarget] = useState<FullAgenda | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleAdminDeleteEvidence = async () => {
    if (!activePhoto || !activePhoto.agendaId) return;

    setIsDeletingEvidence(true);
    try {
      await deleteAgendaEvidence(activePhoto.agendaId, activePhoto.storagePath, true);
      showToast('success', 'Foto dokumentasi berhasil dihapus. Status agenda kembali ke belum ada foto.');
      setActivePhoto(null);
      setIsConfirmEvidenceOpen(false);
      fetchAgendas();
    } catch (err: any) {
      console.error('Gagal menghapus foto dokumentasi:', err);
      showToast('error', 'Gagal menghapus foto dokumentasi: ' + (err?.message || ''));
    } finally {
      setIsDeletingEvidence(false);
    }
  };

  const fetchAgendas = async () => {
    setIsLoading(true);
    try {
      const { tanggal, startDate, endDate } = calculateDateRange();
      const data = await getRekapAgenda({
        kelas: selectedKelas !== 'SEMUA' ? selectedKelas : undefined,
        tanggal: tanggal,
        startDate: startDate,
        endDate: endDate,
        nama_guru: selectedGuru !== 'SEMUA' ? selectedGuru : undefined,
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
      showToast('error', 'Gagal memuat rekap agenda.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgendas();
  }, [periodeType, selectedGuru, selectedKelas, selectedTanggal, customStartDate, customEndDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = (agenda: FullAgenda) => {
    setDeleteTarget(agenda);
  };

  const confirmDeleteAgenda = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAgenda(deleteTarget.header.id);
      showToast('success', 'Agenda berhasil dihapus.');
      setDeleteTarget(null);
      fetchAgendas();
    } catch (err) {
      showToast('error', 'Gagal menghapus agenda.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDateIndo = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('id-ID', {
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
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Periode label untuk header cetak
  const getPeriodeLabel = () => {
    const { tanggal, startDate, endDate } = calculateDateRange();
    if (tanggal) return `Tanggal: ${formatDateIndo(tanggal)}`;
    if (startDate && endDate) {
      return `Periode: ${formatSimpleDate(startDate)} s.d. ${formatSimpleDate(endDate)}`;
    }
    return 'Semua Periode';
  };

  // Hitung statistik akumulasi
  const totalSakit = agendas.reduce(
    (acc, ag) => acc + (ag.absensi?.filter((a) => a.status === 'S').length || 0),
    0
  );
  const totalIzin = agendas.reduce(
    (acc, ag) => acc + (ag.absensi?.filter((a) => a.status === 'I').length || 0),
    0
  );
  const totalAlpha = agendas.reduce(
    (acc, ag) => acc + (ag.absensi?.filter((a) => a.status === 'A').length || 0),
    0
  );

  // Status filter aktif (untuk tombol Reset FilterBar & empty state DataTable)
  const isFiltered =
    periodeType !== 'bulan_ini' ||
    selectedGuru !== 'SEMUA' ||
    selectedKelas !== 'SEMUA' ||
    Boolean(selectedTanggal) ||
    Boolean(customStartDate) ||
    Boolean(customEndDate) ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setPeriodeType('bulan_ini');
    setSelectedGuru('SEMUA');
    setSelectedKelas('SEMUA');
    setSelectedTanggal('');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
  };

  // Pencarian teks bebas (client-side, tidak mengubah hasil fetch)
  const search = searchQuery.trim().toLowerCase();
  const filteredAgendas = search
    ? agendas.filter((a) => {
        const haystack = [
          a.header.kelas,
          a.header.actual_teacher_name || '',
          ...(a.kbm || []).map(
            (k) => `${k.nama_guru} ${k.mapel} ${k.materi} ${k.tugas_pr || ''}`
          ),
          ...(a.kejadian || []).map((k) => k.uraian_kejadian),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      })
    : agendas;

  const sortedKbm = (agenda: FullAgenda) =>
    (agenda.kbm || []).slice().sort((a, b) => Number(a.jam_ke) - Number(b.jam_ke));

  const columns: Column<FullAgenda>[] = [
    {
      key: 'kelas',
      header: 'Kelas',
      align: 'center',
      width: '90px',
      accessor: (a) => (
        <span className="inline-block px-2 py-0.5 bg-slate-800 text-white font-bold text-[11px] rounded print:border print:border-black print:text-black print:bg-white">
          {a.header.kelas}
        </span>
      ),
    },
    {
      key: 'tanggal',
      header: 'Tanggal',
      align: 'left',
      width: '140px',
      accessor: (a) => (
        <span
          className="block font-medium text-slate-700 whitespace-nowrap"
          title={formatDateIndo(a.header.tanggal)}
        >
          {formatSimpleDate(a.header.tanggal)}
        </span>
      ),
    },
    {
      key: 'guru',
      header: 'Guru',
      align: 'left',
      width: '170px',
      accessor: (a) => {
        const namaGuru = a.header.actual_teacher_name || a.kbm?.[0]?.nama_guru || '-';
        const isBadal = (a.kbm || []).some((k) => k.is_badal);
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
      width: '150px',
      accessor: (a) => {
        const mapels = Array.from(
          new Set((a.kbm || []).map((k) => k.mapel).filter(Boolean))
        );
        return <span className="text-slate-700">{mapels.length ? mapels.join(', ') : '-'}</span>;
      },
    },
    {
      key: 'materi',
      header: 'Materi Pembahasan',
      align: 'left',
      accessor: (a) => {
        const kbm = sortedKbm(a);
        if (kbm.length === 0) return <span className="text-slate-400">-</span>;
        return (
          <ul className="space-y-0.5">
            {kbm.map((k, idx) => (
              <li key={idx} className="text-slate-700">
                <span className="font-bold text-slate-800 mr-1">Jam {k.jam_ke}</span>
                {k.materi || '-'}
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      key: 'tugas',
      header: 'Tugas / PR',
      align: 'left',
      width: '150px',
      accessor: (a) => {
        const tugas = sortedKbm(a).map((k) => k.tugas_pr).filter(Boolean);
        if (tugas.length === 0) return <span className="text-slate-400">-</span>;
        return (
          <ul className="space-y-0.5">
            {tugas.map((t, idx) => (
              <li key={idx} className="text-slate-600">
                {t}
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      key: 'absensi',
      header: 'Ketidakhadiran',
      align: 'center',
      width: '150px',
      accessor: (a) => {
        const absensi = a.absensi || [];
        if (absensi.length === 0) {
          return <span className="text-[11px] text-slate-400">Hadir lengkap</span>;
        }
        const count = (status: 'S' | 'I' | 'A') =>
          absensi.filter((x) => x.status === status).length;
        const detail = absensi
          .map((x) => `${x.nama_siswa || x.siswa?.nama_siswa} (${x.status})`)
          .join(', ');
        return (
          <div
            className="flex items-center justify-center gap-1 flex-wrap"
            title={detail}
          >
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
      key: 'kejadian',
      header: 'Catatan Kejadian',
      align: 'left',
      width: '180px',
      accessor: (a) =>
        a.kejadian && a.kejadian.length > 0 ? (
          <span
            className="block truncate text-slate-600"
            title={a.kejadian[0].uraian_kejadian}
          >
            {a.kejadian[0].uraian_kejadian}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Tidak ada catatan.</span>
        ),
    },
    {
      key: 'bukti',
      header: 'Bukti Foto',
      align: 'center',
      width: '110px',
      accessor: (a) =>
        a.evidence?.signedUrl ? (
          <button
            type="button"
            onClick={() => {
              if (a.evidence?.signedUrl) {
                setActivePhoto({
                  agendaId: a.header.id,
                  storagePath: a.evidence.storage_path,
                  url: a.evidence.signedUrl,
                  uploadedAt: a.evidence.uploaded_at,
                  capturedAt: a.evidence.captured_at,
                  actualTeacherName:
                    a.evidence.actual_teacher_name ||
                    a.header.actual_teacher_name ||
                    a.kbm?.[0]?.nama_guru,
                  title: `Dokumentasi Foto - ${a.header.kelas} (${a.kbm?.[0]?.mapel || 'KBM'})`,
                });
              }
            }}
            className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition inline-flex items-center gap-1"
            title="Lihat bukti foto"
          >
            <Camera className="w-3 h-3 text-emerald-700" />
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
      width: '120px',
      accessor: (a) => (
        <div className="flex items-center justify-end gap-1.5">
          {onEditAgenda && (
            <button
              type="button"
              onClick={() => onEditAgenda(a)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
              title="Edit Agenda"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleDelete(a)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition"
              title="Hapus Agenda"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

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
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari kelas, guru, mapel, materi..."
        isFiltered={isFiltered}
        onResetFilters={handleResetFilters}
        filters={
          <>
            {/* Periode Tab Buttons (Horizontal scrollable / wrap in mobile) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium overflow-x-auto no-scrollbar">
              <button
                onClick={() => setPeriodeType('bulan_ini')}
                className={`px-2.5 py-1 rounded whitespace-nowrap transition text-[11px] sm:text-xs ${
                  periodeType === 'bulan_ini'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Bulan Ini
              </button>
              <button
                onClick={() => setPeriodeType('harian')}
                className={`px-2.5 py-1 rounded whitespace-nowrap transition text-[11px] sm:text-xs ${
                  periodeType === 'harian'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Harian
              </button>
              <button
                onClick={() => setPeriodeType('custom')}
                className={`px-2.5 py-1 rounded whitespace-nowrap transition text-[11px] sm:text-xs ${
                  periodeType === 'custom'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Kustom
              </button>
            </div>

            {/* Conditional Date Input: Harian */}
            {periodeType === 'harian' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 w-full sm:w-auto">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={selectedTanggal}
                  onChange={(e) => setSelectedTanggal(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 focus:outline-none w-full text-xs"
                />
              </div>
            )}

            {/* Conditional Date Input: Custom Range */}
            {periodeType === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 w-full sm:w-auto">
                <span className="text-slate-400 text-[10px] shrink-0">Dari:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 focus:outline-none text-xs w-full"
                />
                <span className="text-slate-400 text-[10px] shrink-0">S.d:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 focus:outline-none text-xs w-full"
                />
              </div>
            )}

            {/* Filter Guru */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedGuru}
                onChange={(e) => setSelectedGuru(e.target.value)}
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
                onChange={(e) => setSelectedKelas(e.target.value)}
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
          </>
        }
        actions={
          <>
            <button
              onClick={fetchAgendas}
              className="p-2 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handlePrint}
              disabled={agendas.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak PDF / Print</span>
            </button>
          </>
        }
      />

      {/* STATISTIK RINGKAS (Screen Only) */}
      <div className="grid grid-cols-3 gap-2.5 no-print">
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Total Sakit (S)</p>
            <p className="text-lg font-bold text-slate-800">{totalSakit}</p>
          </div>
          <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
            S
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Total Izin (I)</p>
            <p className="text-lg font-bold text-slate-800">{totalIzin}</p>
          </div>
          <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
            I
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Total Alpha (A)</p>
            <p className="text-lg font-bold text-slate-800">{totalAlpha}</p>
          </div>
          <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
            A
          </span>
        </div>
      </div>

      {/* HEADER RESMI CETAK (Hanya Muncul saat Print PDF) */}
      {agendas.length > 0 && (
        <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-4">
          <div className="flex items-center justify-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            <div>
              <h1 className="text-base font-bold tracking-tight uppercase">
                LAPORAN REKAPITULASI AGENDA & KBM KELAS
              </h1>
              <p className="text-xs font-semibold">SDIT AS-SYIFA</p>
              <p className="text-[11px] text-slate-700 mt-0.5">
                {getPeriodeLabel()} &bull; Kelas: {selectedKelas} &bull; Guru:{' '}
                {selectedGuru}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DOKUMEN REKAP & CETAK RESMI */}
      <DataTable
        title="Rekap Agenda Pembelajaran & KBM"
        subtitle={`${getPeriodeLabel()} • ${
          filteredAgendas.length === agendas.length
            ? `${agendas.length} sesi agenda ditemukan`
            : `${filteredAgendas.length} dari ${agendas.length} sesi agenda ditemukan`
        }`}
        titleIcon={<FileCheck className="w-4 h-4 text-slate-700 shrink-0" />}
        columns={columns}
        data={filteredAgendas}
        keyExtractor={(a) => a.header.id}
        isLoading={isLoading}
        emptyTitle="Tidak Ada Data Agenda"
        emptyDescription="Tidak ditemukan agenda untuk filter yang dipilih."
        emptyIcon={<BookOpen className="w-5 h-5" />}
        isFiltered={isFiltered}
        onResetFilter={handleResetFilters}
      />

      {/* Kolom Tanda Tangan Cetak PDF (Hanya di print) */}
      {agendas.length > 0 && (
        <div className="hidden print:grid grid-cols-2 pt-8 text-center text-xs page-break">
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
      )}

      {/* Lightbox Modal untuk Bukti Foto Mengajar */}
      <PhotoLightboxModal
        isOpen={!!activePhoto}
        onClose={() => setActivePhoto(null)}
        imageUrl={activePhoto?.url}
        uploadedAt={activePhoto?.uploadedAt}
        capturedAt={activePhoto?.capturedAt}
        actualTeacherName={activePhoto?.actualTeacherName}
        title={activePhoto?.title}
        isAdmin={isAdmin}
        onAdminDelete={() => setIsConfirmEvidenceOpen(true)}
        isDeleting={isDeletingEvidence}
      />

      {/* Konfirmasi hapus agenda (pengganti confirm() agar konsisten & tidak
          dilewati di mode DEV) */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteAgenda}
        isLoading={isDeleting}
        title="Hapus agenda ini?"
        message={
          deleteTarget
            ? `Agenda ${deleteTarget.header.kelas} tanggal ${deleteTarget.header.tanggal} beserta KBM, absensi, dan catatan kejadian akan dihapus permanen.`
            : ''
        }
        confirmText="Hapus"
      />

      {/* Konfirmasi hapus foto dokumentasi */}
      <ConfirmDialog
        isOpen={isConfirmEvidenceOpen}
        onClose={() => setIsConfirmEvidenceOpen(false)}
        onConfirm={handleAdminDeleteEvidence}
        isLoading={isDeletingEvidence}
        title="Hapus foto dokumentasi?"
        message="Foto akan dihapus dan status agenda kembali ke “Belum ada foto”. Isi agenda tidak ikut terhapus."
        confirmText="Hapus Foto"
      />
    </div>
  );
};
