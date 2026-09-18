import React, { useState, useEffect } from 'react';
import {
  getDaftarGuru,
  getDaftarSiswa,
  getRekapAgenda,
  getDaftarKotakSaran,
} from '../../services/agendaService';
import type { FullAgenda, Guru } from '../../types';
import { PageHeader } from '../../components/admin/PageHeader';
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
  onNavigateTab: (tab: any) => void;
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

  // Guru yang sudah mengisi hari ini
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

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Ringkasan Dashboard"
        description="Pantau kegiatan pembelajaran, status pengisian agenda hari ini, dan data master sekolah."
        action={
          <button
            onClick={fetchDashboardData}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition flex items-center gap-1.5 text-xs font-semibold"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        }
      />

      {isLoading ? (
        <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Memuat data ringkasan...</p>
        </div>
      ) : (
        <>
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div
              onClick={() => onNavigateTab('guru')}
              className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total Guru</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{totalGuru}</p>
              <span className="text-[11px] text-slate-400 mt-1">Tenaga pendidik terdaftar</span>
            </div>

            <div
              onClick={() => onNavigateTab('siswa')}
              className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total Siswa</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{totalSiswa}</p>
              <span className="text-[11px] text-slate-400 mt-1">Siswa aktif terdata</span>
            </div>

            <div
              onClick={() => onNavigateTab('rekap')}
              className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total Agenda</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{totalAgenda}</p>
              <span className="text-[11px] text-slate-400 mt-1">Jurnal pembelajaran tersimpan</span>
            </div>

            <div
              onClick={() => onNavigateTab('saran')}
              className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Kotak Saran</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{totalSaran}</p>
              <span className="text-[11px] text-slate-400 mt-1">Aspirasi & masukan guru</span>
            </div>
          </div>

          {/* Section: Monitoring Hari Ini & Log Terbaru */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Status Guru Hari Ini (2 Columns) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Status Pengisian Agenda Hari Ini
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDateIndo(todayStr)} &bull; {agendasHariIni.length} agenda pembelajaran dibuat hari ini
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('rekap_harian')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <span>Lihat Rekap Harian</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sudah Mengisi */}
                <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Sudah Mengisi ({listGuruSudahMengisi.length})
                    </span>
                  </div>

                  {listGuruSudahMengisi.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center">
                      Belum ada guru yang mengisi agenda hari ini.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-200/60 max-h-56 overflow-y-auto pr-1">
                      {listGuruSudahMengisi.map((guru) => (
                        <li key={guru.id} className="py-1.5 text-xs text-slate-800 font-medium">
                          {guru.nama_guru}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Belum Mengisi */}
                <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-amber-600" />
                      Belum Mengisi ({listGuruBelumMengisi.length})
                    </span>
                  </div>

                  {listGuruBelumMengisi.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center">
                      Semua guru sudah mengisi agenda hari ini!
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-200/60 max-h-56 overflow-y-auto pr-1">
                      {listGuruBelumMengisi.map((guru) => (
                        <li key={guru.id} className="py-1.5 text-xs text-slate-600">
                          {guru.nama_guru}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Aktivitas Agenda Terbaru (1 Column) */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Agenda Terbaru
                </h3>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>

              {aktivitasTerbaru.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  Belum ada catatan agenda pembelajaran.
                </p>
              ) : (
                <div className="space-y-3">
                  {aktivitasTerbaru.map((agenda) => (
                    <div
                      key={agenda.header.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {agenda.header.kelas}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDateIndo(agenda.header.tanggal)}
                        </span>
                      </div>
                      <p className="text-slate-600 truncate text-[11px]">
                        {agenda.kbm.length} sesi pembelajaran tercatat
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
