import React, { useState, useEffect } from 'react';
import {
  getDaftarGuru,
  getDaftarSiswa,
  getRekapAgenda,
  getDaftarKotakSaran,
} from '../../services/agendaService';
import type { FullAgenda, Guru } from '../../types';
import {
  Users,
  GraduationCap,
  FileText,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

interface DashboardOverviewProps {
  onNavigateTab: (tab: 'rekap' | 'siswa' | 'guru' | 'mapel' | 'saran') => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onNavigateTab,
  showToast,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [totalGuru, setTotalGuru] = useState(0);
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [totalAgenda, setTotalAgenda] = useState(0);
  const [totalSaran, setTotalSaran] = useState(0);

  const [daftarGuru, setDaftarGuru] = useState<Guru[]>([]);
  const [agendasHariIni, setAgendasHariIni] = useState<FullAgenda[]>([]);
  const [aktivitasTerbaru, setAktivitasTerbaru] = useState<FullAgenda[]>([]);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [guruList, siswaList, allAgendas, saranList] = await Promise.all([
        getDaftarGuru(),
        getDaftarSiswa(),
        getRekapAgenda(),
        getDaftarKotakSaran(),
      ]);

      setTotalGuru(guruList.length);
      setTotalSiswa(siswaList.length);
      setTotalAgenda(allAgendas.length);
      setTotalSaran(saranList.length);
      setDaftarGuru(guruList);

      // Filter agenda hari ini
      const today = allAgendas.filter((a) => a.header.tanggal === todayStr);
      setAgendasHariIni(today);

      // 5 aktivitas agenda terkini
      setAktivitasTerbaru(allAgendas.slice(0, 5));
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat data dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Guru yang sudah mengisi hari ini (berdasarkan nama di agenda_kbm)
  const guruSudahMengisiSet = new Set<string>();
  agendasHariIni.forEach((agenda) => {
    agenda.kbm.forEach((k) => {
      if (k.nama_guru) {
        guruSudahMengisiSet.add(k.nama_guru.trim());
      }
    });
  });

  const listGuruSudahMengisi = daftarGuru.filter((g) =>
    guruSudahMengisiSet.has(g.nama_guru.trim())
  );
  const listGuruBelumMengisi = daftarGuru.filter(
    (g) => !guruSudahMengisiSet.has(g.nama_guru.trim())
  );

  const formatDateIndo = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
        <RefreshCw className="w-6 h-6 text-slate-600 animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Memuat data dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bar Statistik Ringkas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          onClick={() => onNavigateTab('guru')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Total Guru</span>
            <GraduationCap className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-800 mt-1">{totalGuru}</p>
        </div>

        <div
          onClick={() => onNavigateTab('siswa')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Total Siswa</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-800 mt-1">{totalSiswa}</p>
        </div>

        <div
          onClick={() => onNavigateTab('rekap')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Total Jurnal</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-800 mt-1">{totalAgenda}</p>
        </div>

        <div
          onClick={() => onNavigateTab('saran')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Kotak Saran</span>
            <MessageSquare className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-800 mt-1">{totalSaran}</p>
        </div>
      </div>

      {/* Indikator Status Guru Hari Ini */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Status Pengisian Guru Hari Ini
            </h3>
            <p className="text-[11px] text-slate-500">
              Tanggal: {formatDateIndo(todayStr)} &bull; {listGuruSudahMengisi.length} dari{' '}
              {daftarGuru.length} guru sudah mengisi
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            title="Refresh"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Sudah Mengisi */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sudah Mengisi ({listGuruSudahMengisi.length})</span>
            </div>
            {listGuruSudahMengisi.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Belum ada guru yang mengisi hari ini.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {listGuruSudahMengisi.map((g) => (
                  <span
                    key={g.id}
                    className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-800 text-[11px] font-medium rounded"
                  >
                    {g.nama_guru}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Belum Mengisi */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs mb-2">
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Belum Mengisi ({listGuruBelumMengisi.length})</span>
            </div>
            {listGuruBelumMengisi.length === 0 ? (
              <p className="text-[11px] text-emerald-600 font-medium">
                Semua guru sudah mengisi jurnal hari ini.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {listGuruBelumMengisi.map((g) => (
                  <span
                    key={g.id}
                    className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-[11px] rounded"
                  >
                    {g.nama_guru}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Aktivitas Terkini */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Aktivitas Jurnal Terkini</span>
          </h3>
          <button
            onClick={() => onNavigateTab('rekap')}
            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-0.5"
          >
            <span>Buka Semua</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {aktivitasTerbaru.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Belum ada aktivitas jurnal.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {aktivitasTerbaru.map((agenda, idx) => {
              const guruPertama = agenda.kbm[0]?.nama_guru || 'Guru';
              const mapelPertama = agenda.kbm[0]?.mapel || '-';
              const totalKbm = agenda.kbm.length;

              return (
                <div key={agenda.header.id || idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px] shrink-0 border border-slate-200">
                      {agenda.header.kelas}
                    </span>
                    <div className="truncate">
                      <p className="font-semibold text-slate-800 truncate">
                        {guruPertama} {totalKbm > 1 ? `(+${totalKbm - 1} sesi)` : ''} &bull;{' '}
                        <span className="text-slate-500 font-normal">{mapelPertama}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatDateIndo(agenda.header.tanggal)}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 shrink-0">
                    {agenda.absensi.length > 0 ? `${agenda.absensi.length} tdk hadir` : 'Nihil'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
