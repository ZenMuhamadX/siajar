import React, { useState, useEffect } from 'react';
import { DAFTAR_KELAS, type FullAgenda } from '../types';
import { getRekapAgenda, deleteAgenda } from '../services/agendaService';
import { useAuth } from '../contexts/AuthContext';
import {
  Printer,
  Calendar,
  Filter,
  Trash2,
  BookOpen,
  FileCheck,
  RefreshCw,
} from 'lucide-react';

interface RekapAgendaProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const RekapAgenda: React.FC<RekapAgendaProps> = ({ showToast }) => {
  const { activeTeacherName, isAdmin } = useAuth();
  const [selectedKelas, setSelectedKelas] = useState<string>('SEMUA');
  const [selectedTanggal, setSelectedTanggal] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'guru_aktif' | 'semua'>(
    isAdmin ? 'semua' : 'guru_aktif'
  );
  const [agendas, setAgendas] = useState<FullAgenda[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAgendas = async () => {
    setIsLoading(true);
    try {
      const data = await getRekapAgenda({
        kelas: selectedKelas !== 'SEMUA' ? selectedKelas : undefined,
        tanggal: selectedTanggal ? selectedTanggal : undefined,
        nama_guru: filterMode === 'guru_aktif' && activeTeacherName ? activeTeacherName : undefined,
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
  }, [selectedKelas, selectedTanggal, filterMode, activeTeacherName]);

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
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Hitung total akumulasi ketidakhadiran (S, I, A)
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Filter & Print Bar (Hidden during print) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            Rekap Jurnal & Absensi Siswa
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filterMode === 'guru_aktif'
              ? `Menampilkan sesi kelas yang diajar oleh ${activeTeacherName}`
              : 'Menampilkan seluruh sesi & agenda kelas'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle Sesi Guru vs Semua */}
          {isAdmin && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFilterMode('guru_aktif')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterMode === 'guru_aktif'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Guru Saya
              </button>
              <button
                onClick={() => setFilterMode('semua')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterMode === 'semua'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Semua Guru
              </button>
            </div>
          )}

          {/* Filter Kelas */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="SEMUA">Semua Kelas</option>
              {DAFTAR_KELAS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tanggal */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedTanggal}
              onChange={(e) => setSelectedTanggal(e.target.value)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none"
            />
            {selectedTanggal && (
              <button
                onClick={() => setSelectedTanggal('')}
                className="text-slate-400 hover:text-slate-600 text-[10px] underline ml-1"
              >
                Reset
              </button>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchAgendas}
            className="p-2 text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            disabled={agendas.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Cetak / Print
          </button>
        </div>
      </div>

      {/* Akumulasi Ketidakhadiran Stat Cards */}
      <div className="grid grid-cols-3 gap-3 no-print">
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-800">Total Sakit (S)</p>
            <p className="text-xl font-bold text-amber-900 mt-0.5">{totalSakit}</p>
          </div>
          <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
            S
          </span>
        </div>
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-blue-800">Total Izin (I)</p>
            <p className="text-xl font-bold text-blue-900 mt-0.5">{totalIzin}</p>
          </div>
          <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
            I
          </span>
        </div>
        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-rose-800">Total Alpha (A)</p>
            <p className="text-xl font-bold text-rose-900 mt-0.5">{totalAlpha}</p>
          </div>
          <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
            A
          </span>
        </div>
      </div>

      {/* Agendas List / Printable Document */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Memuat data rekap...</p>
        </div>
      ) : agendas.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Belum Ada Data Agenda</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Belum ada data agenda kelas yang sesuai kriteria filter saat ini.
          </p>
        </div>
      ) : (
        <div className="space-y-8 print:space-y-6">
          {agendas.map((agenda, index) => (
            <div
              key={agenda.header.id || index}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:shadow-none print:border-slate-800 print:rounded-none page-break"
            >
              {/* Header Agenda */}
              <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:bg-transparent print:border-b-2 print:border-black">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded-full print:border print:border-black print:text-black print:bg-white">
                      {agenda.header.kelas}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">
                      {agenda.header.sekolah || 'SDIT AS-SYIFA'}
                    </h3>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Hari & Tanggal: {formatDateIndo(agenda.header.tanggal)}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 no-print">
                    <button
                      onClick={() =>
                        handleDelete(
                          agenda.header.id,
                          agenda.header.kelas,
                          agenda.header.tanggal
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  </div>
                )}
              </div>

              {/* Table KBM */}
              <div className="p-4 sm:p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Jurnal Pembelajaran (KBM)
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl print:rounded-none print:border-black">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold print:border-b print:border-black">
                          <th className="py-2 px-3 w-16 text-center border-r border-slate-200 print:border-black">
                            Jam Ke
                          </th>
                          <th className="py-2 px-3 w-40 border-r border-slate-200 print:border-black">
                            Nama Guru
                          </th>
                          <th className="py-2 px-3 w-40 border-r border-slate-200 print:border-black">
                            Mata Pelajaran
                          </th>
                          <th className="py-2 px-3 border-r border-slate-200 print:border-black">
                            Materi / Pokok Bahasan
                          </th>
                          <th className="py-2 px-3 w-36">Tugas / PR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 print:divide-black">
                        {agenda.kbm && agenda.kbm.length > 0 ? (
                          agenda.kbm.map((k, kIdx) => {
                            const isBreak =
                              k.jam_ke === 'Istirahat' || k.jam_ke === 'Isoma';
                            const isCurrentTeacher = k.nama_guru === activeTeacherName;
                            return (
                              <tr
                                key={kIdx}
                                className={
                                  isBreak
                                    ? 'bg-amber-50/40 font-medium'
                                    : isCurrentTeacher
                                    ? 'bg-emerald-50/30 font-medium'
                                    : ''
                                }
                              >
                                <td className="py-2 px-3 text-center border-r border-slate-200 font-semibold print:border-black">
                                  {k.jam_ke}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200 print:border-black">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{k.nama_guru || '-'}</span>
                                    {k.is_badal && (
                                      <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
                                        Badal
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200 font-semibold print:border-black">
                                  {k.mapel}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200 print:border-black">
                                  {k.materi}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {k.tugas_pr || '-'}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-3 text-center text-slate-400">
                              Tidak ada data KBM.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grid for Absensi & Catatan Kejadian */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Absensi */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 print:bg-white print:border-black print:rounded-none">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Ketidakhadiran Siswa</span>
                      <span className="text-[11px] font-normal lowercase text-slate-500">
                        {agenda.absensi?.length || 0} siswa
                      </span>
                    </h5>
                    {agenda.absensi && agenda.absensi.length > 0 ? (
                      <ul className="divide-y divide-slate-200 text-xs print:divide-black">
                        {agenda.absensi.map((ab, abIdx) => (
                          <li
                            key={abIdx}
                            className="py-1.5 flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-800">
                              {abIdx + 1}. {ab.nama_siswa || ab.siswa?.nama_siswa || 'Siswa'}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
                                ab.status === 'S'
                                  ? 'bg-amber-100 text-amber-800'
                                  : ab.status === 'I'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              } print:border print:border-black print:bg-white print:text-black`}
                            >
                              {ab.status === 'S'
                                ? 'Sakit (S)'
                                : ab.status === 'I'
                                ? 'Izin (I)'
                                : 'Alpha (A)'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-700 font-semibold py-1">
                        ✓ Seluruh siswa hadir lengkap
                      </p>
                    )}
                  </div>

                  {/* Catatan Kejadian */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 print:bg-white print:border-black print:rounded-none">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Catatan Kejadian Khusus
                    </h5>
                    {agenda.kejadian && agenda.kejadian.length > 0 ? (
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {agenda.kejadian[0].uraian_kejadian}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-1">
                        Tidak ada catatan kejadian khusus.
                      </p>
                    )}
                  </div>
                </div>

                {/* Print Signatures */}
                <div className="hidden print:grid grid-cols-2 pt-8 text-center text-xs">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-semibold">Kepala Sekolah SDIT AS-SYIFA</p>
                    <div className="h-16" />
                    <p className="font-bold underline">( ........................................ )</p>
                  </div>
                  <div>
                    <p>Guru Pengajar,</p>
                    <p className="font-semibold">{activeTeacherName || agenda.header.kelas}</p>
                    <div className="h-16" />
                    <p className="font-bold underline">( {activeTeacherName || '........................................'} )</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
