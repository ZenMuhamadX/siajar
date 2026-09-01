import React, { useState, useEffect } from 'react';
import { DAFTAR_KELAS, type FullAgenda, type Guru } from '../types';
import { getRekapAgenda, deleteAgenda, getDaftarGuru } from '../services/agendaService';
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
} from 'lucide-react';

interface RekapAgendaProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onEditAgenda?: (agenda: FullAgenda) => void;
}

type PeriodeType = '30_hari' | 'bulan_ini' | 'harian' | 'custom';

export const RekapAgenda: React.FC<RekapAgendaProps> = ({ showToast, onEditAgenda }) => {
  const { isAdmin } = useAuth();

  // Filter States
  const [periodeType, setPeriodeType] = useState<PeriodeType>('30_hari');
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

    if (periodeType === '30_hari') {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      return {
        tanggal: undefined,
        startDate: past30.toISOString().split('T')[0],
        endDate: todayStr,
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
      setAgendas(data);
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
    if (confirm(`Yakin ingin menghapus agenda ${kelas} tanggal ${tanggal}?`)) {
      try {
        await deleteAgenda(id);
        showToast('success', 'Agenda berhasil dihapus.');
        fetchAgendas();
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
              <span>Rekap Agenda Kelas & KBM</span>
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

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Periode Tab Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setPeriodeType('30_hari')}
              className={`px-2.5 py-1 rounded transition ${
                periodeType === '30_hari'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              30 Hari Terakhir
            </button>
            <button
              onClick={() => setPeriodeType('bulan_ini')}
              className={`px-2.5 py-1 rounded transition ${
                periodeType === 'bulan_ini'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setPeriodeType('harian')}
              className={`px-2.5 py-1 rounded transition ${
                periodeType === 'harian'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => setPeriodeType('custom')}
              className={`px-2.5 py-1 rounded transition ${
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
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedTanggal}
                onChange={(e) => setSelectedTanggal(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none"
              />
            </div>
          )}

          {/* Conditional Date Input: Custom Range */}
          {periodeType === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-slate-400 text-[10px]">Dari:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none"
              />
              <span className="text-slate-400 text-[10px]">S.d:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none"
              />
            </div>
          )}

          {/* Filter Guru */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedGuru}
              onChange={(e) => setSelectedGuru(e.target.value)}
              className="bg-transparent font-medium text-slate-800 focus:outline-none"
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
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="bg-transparent font-medium text-slate-800 focus:outline-none"
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

          {/* LIST AGENDA HARIAN */}
          {agendas.map((agenda, index) => (
            <div
              key={agenda.header.id || index}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-black print:rounded-none print:shadow-none page-break"
            >
              {/* Header Sesi Harian */}
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between print:bg-transparent print:border-b print:border-black">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-800 text-white font-bold text-xs rounded print:border print:border-black print:text-black print:bg-white">
                    {agenda.header.kelas}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {formatDateIndo(agenda.header.tanggal)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 no-print">
                  {onEditAgenda && (
                    <button
                      onClick={() => onEditAgenda(agenda)}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition flex items-center gap-1"
                      title="Edit / Koreksi Agenda"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
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

              {/* Tabel KBM */}
              <div className="p-3 sm:p-4 space-y-3">
                <div className="overflow-x-auto border border-slate-200 rounded print:border-black print:rounded-none">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold print:border-b print:border-black print:bg-slate-50">
                        <th className="py-1.5 px-2.5 w-14 text-center border-r border-slate-200 print:border-black">
                          Jam
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
                      {agenda.kbm && agenda.kbm.length > 0 ? (
                        agenda.kbm.map((k, kIdx) => (
                          <tr key={kIdx} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-2.5 text-center font-medium border-r border-slate-200 print:border-black">
                              {k.jam_ke}
                            </td>
                            <td className="py-1.5 px-2.5 font-medium border-r border-slate-200 print:border-black">
                              <div className="flex items-center gap-1">
                                <span>{k.nama_guru || '-'}</span>
                                {k.is_badal && (
                                  <span className="px-1 text-[9px] font-bold border border-slate-400 rounded">
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
                          <td colSpan={5} className="py-2 text-center text-slate-400">
                            Tidak ada data KBM.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Sub info: Ketidakhadiran & Kejadian */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Ketidakhadiran */}
                  <div className="border border-slate-200 rounded p-2.5 bg-slate-50/40 print:bg-white print:border-black">
                    <p className="font-bold text-slate-700 mb-1">
                      Ketidakhadiran Siswa ({agenda.absensi?.length || 0})
                    </p>
                    {agenda.absensi && agenda.absensi.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {agenda.absensi.map((ab, abIdx) => (
                          <span
                            key={abIdx}
                            className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-slate-800"
                          >
                            {ab.nama_siswa || ab.siswa?.nama_siswa} ({ab.status})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">Hadir lengkap</p>
                    )}
                  </div>

                  {/* Catatan Kejadian */}
                  <div className="border border-slate-200 rounded p-2.5 bg-slate-50/40 print:bg-white print:border-black">
                    <p className="font-bold text-slate-700 mb-1">Catatan Kejadian</p>
                    {agenda.kejadian && agenda.kejadian.length > 0 ? (
                      <p className="text-[11px] text-slate-700 leading-normal">
                        {agenda.kejadian[0].uraian_kejadian}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Tidak ada catatan.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

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
    </div>
  );
};
