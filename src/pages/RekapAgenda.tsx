import React, { useState, useEffect } from 'react';
import { DAFTAR_KELAS, type FullAgenda, type Guru } from '../types';
import { getRekapAgenda, deleteAgenda, getDaftarGuru } from '../services/agendaService';
import { getEvidenceSignedUrl, deleteAgendaEvidence } from '../services/evidenceService';
import { PhotoLightboxModal } from '../components/PhotoLightboxModal';
import { useAuth } from '../contexts/AuthContext';
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
    const todayStr = today.toISOString().split('T')[0];

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

  const handleAdminDeleteEvidence = async () => {
    if (!activePhoto || !activePhoto.agendaId) return;
    if (!import.meta.env.DEV && !confirm('Hapus foto dokumentasi agenda ini? Status agenda akan kembali ke "Belum ada foto" tanpa menghapus isi agenda.')) {
      return;
    }

    setIsDeletingEvidence(true);
    try {
      await deleteAgendaEvidence(activePhoto.agendaId, activePhoto.storagePath, true);
      showToast('success', 'Foto dokumentasi berhasil dihapus. Status agenda kembali ke belum ada foto.');
      setActivePhoto(null);
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

  const handleDelete = async (id: string, kelas: string, tanggal: string) => {
    if (!import.meta.env.DEV && !confirm(`Yakin ingin menghapus agenda ${kelas} tanggal ${tanggal}?`)) {
      return;
    }
    try {
      await deleteAgenda(id);
      showToast('success', 'Agenda berhasil dihapus.');
      fetchAgendas();
    } catch (err) {
      showToast('error', 'Gagal menghapus agenda.');
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

  return (
    <div className="w-full space-y-4">
      {/* FILTER BAR (Screen Only, Hidden in Print) */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-slate-700" />
              <span>Rekap Agenda Pembelajaran & KBM</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {getPeriodeLabel()} &bull; {agendas.length} sesi agenda ditemukan
            </p>
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* Filter Controls Row (Responsive Mobile Grid / Desktop Flex) */}
        <div className="space-y-2.5 text-xs">
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

          {/* Conditional Date Input & Dropdown Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap md:items-center gap-2">
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
          </div>
        </div>
      </div>

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

      {/* DOKUMEN REKAP & CETAK RESMI */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
          <RefreshCw className="w-6 h-6 text-slate-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Memuat data rekap...</p>
        </div>
      ) : agendas.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">Tidak Ada Data Agenda</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tidak ditemukan agenda untuk filter yang dipilih.
          </p>
        </div>
      ) : (
        <div className="space-y-4 print:space-y-6">
          {/* HEADER RESMI CETAK (Hanya Muncul saat Print PDF) */}
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

          {/* GROUP BY KELAS */}
          {(() => {
            // Kelompokkan agendas berdasarkan kelas
            const kelasList = Array.from(new Set(agendas.map((a) => a.header.kelas))).sort();

            return kelasList.map((kelas) => {
              const kelasAgendas = agendas.filter((a) => a.header.kelas === kelas);

              // Kumpulkan semua KBM dari semua sesi kelas ini, tambahkan info tanggal & agenda_id
              const allKbm = kelasAgendas
                .flatMap((ag) =>
                  (ag.kbm || []).map((k) => ({
                    ...k,
                    _tanggal: ag.header.tanggal,
                    _agendaId: ag.header.id,
                  }))
                )
                .sort((a, b) => Number(a.jam_ke) - Number(b.jam_ke));

              return (
                <div
                  key={kelas}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-black print:rounded-none print:shadow-none page-break"
                >
                  {/* Header Kelas */}
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between print:bg-transparent print:border-b print:border-black">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-white font-bold text-xs rounded print:border print:border-black print:text-black print:bg-white">
                        {kelas}
                      </span>
                      <span className="text-xs text-slate-500">
                        {kelasAgendas.length} sesi
                      </span>
                    </div>
                  </div>

                  {/* Tabel KBM semua sesi, diurutkan jam */}
                  <div className="overflow-x-auto border-b border-slate-200 print:border-black">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold print:border-b print:border-black print:bg-slate-50">
                          <th className="py-1.5 px-2.5 w-14 text-center border-r border-slate-200 print:border-black">
                            Jam
                          </th>
                          <th className="py-1.5 px-2.5 w-28 border-r border-slate-200 print:border-black">
                            Tanggal
                          </th>
                          <th className="py-1.5 px-2.5 w-36 border-r border-slate-200 print:border-black">
                            Guru
                          </th>
                          <th className="py-1.5 px-2.5 w-32 border-r border-slate-200 print:border-black">
                            Mata Pelajaran
                          </th>
                          <th className="py-1.5 px-2.5 border-r border-slate-200 print:border-black">
                            Materi Pembahasan
                          </th>
                          <th className="py-1.5 px-2.5 w-32">Tugas / PR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 print:divide-black">
                        {allKbm.length > 0 ? (
                          allKbm.map((k, kIdx) => (
                            <tr key={kIdx} className="hover:bg-slate-50/50">
                              <td className="py-1.5 px-2.5 text-center font-bold text-slate-800 border-r border-slate-200 print:border-black">
                                {k.jam_ke}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600 border-r border-slate-200 print:border-black whitespace-nowrap">
                                {formatSimpleDate(k._tanggal)}
                              </td>
                              <td className="py-1.5 px-2.5 font-medium border-r border-slate-200 print:border-black">
                                <div className="flex items-center gap-1">
                                  <span>{k.nama_guru || '-'}</span>
                                  {k.is_badal && (
                                    <span className="px-1 text-[9px] font-bold border border-amber-400 text-amber-700 rounded">
                                      Badal
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-1.5 px-2.5 font-medium border-r border-slate-200 print:border-black">
                                {k.mapel}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-800 border-r border-slate-200 print:border-black">
                                {k.materi}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600">
                                {k.tugas_pr || '-'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">
                              Tidak ada data KBM.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Detail per sesi: Absensi, Catatan, Bukti Foto */}
                  <div className="divide-y divide-slate-100">
                    {kelasAgendas.map((agenda, sesiIdx) => (
                      <div key={agenda.header.id || sesiIdx} className="p-3 sm:p-4 space-y-2">
                        {/* Sub-header sesi */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-600">
                            {formatDateIndo(agenda.header.tanggal)}
                          </span>
                          <div className="flex items-center gap-1.5 no-print">
                            {agenda.evidence ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (agenda.evidence?.signedUrl) {
                                    setActivePhoto({
                                      agendaId: agenda.header.id,
                                      storagePath: agenda.evidence.storage_path,
                                      url: agenda.evidence.signedUrl,
                                      uploadedAt: agenda.evidence.uploaded_at,
                                      capturedAt: agenda.evidence.captured_at,
                                      actualTeacherName: agenda.evidence.actual_teacher_name || agenda.header.actual_teacher_name || agenda.kbm?.[0]?.nama_guru,
                                      title: `Dokumentasi Foto - ${agenda.header.kelas} (${agenda.kbm?.[0]?.mapel || 'KBM'})`,
                                    });
                                  }
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition flex items-center gap-1"
                              >
                                <Camera className="w-3 h-3 text-emerald-700" />
                                <span>Bukti: Ada</span>
                              </button>
                            ) : (
                              <span className="px-2 py-1 text-[11px] text-slate-400 border border-slate-200 bg-slate-50/50 rounded flex items-center gap-1 cursor-default">
                                <Camera className="w-3 h-3 text-slate-300" />
                                <span>Bukti: -</span>
                              </span>
                            )}
                            {onEditAgenda && (
                              <button
                                onClick={() => onEditAgenda(agenda)}
                                className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition flex items-center gap-1"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(agenda.header.id, agenda.header.kelas, agenda.header.tanggal)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                title="Hapus Agenda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Info absensi & kejadian */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="border border-slate-200 rounded p-2 bg-slate-50/40 print:bg-white print:border-black">
                            <p className="font-bold text-slate-700 mb-1 text-[11px]">Ketidakhadiran ({agenda.absensi?.length || 0})</p>
                            {agenda.absensi && agenda.absensi.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {agenda.absensi.map((ab, abIdx) => (
                                  <span key={abIdx} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-800">
                                    {ab.nama_siswa || ab.siswa?.nama_siswa} ({ab.status})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-500">Hadir lengkap</p>
                            )}
                          </div>
                          <div className="border border-slate-200 rounded p-2 bg-slate-50/40 print:bg-white print:border-black">
                            <p className="font-bold text-slate-700 mb-1 text-[11px]">Catatan Kejadian</p>
                            {agenda.kejadian && agenda.kejadian.length > 0 ? (
                              <p className="text-[11px] text-slate-700 leading-normal">{agenda.kejadian[0].uraian_kejadian}</p>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">Tidak ada catatan.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}

          {/* Kolom Tanda Tangan Cetak PDF (Hanya di print) */}
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
        onAdminDelete={handleAdminDeleteEvidence}
        isDeleting={isDeletingEvidence}
      />
    </div>
  );
};
