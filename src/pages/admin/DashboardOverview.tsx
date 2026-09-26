import React, { useState, useEffect, useCallback } from 'react';
import { localDateString } from '../../utils/date';
import {
  getDaftarGuru,
  getDaftarSiswa,
  getRekapAgenda,
  getDaftarKotakSaran,
} from '../../services/agendaService';
import { getAcademicYears, getSchedules } from '../../services/scheduleService';
import { getScheduleDayFromDate } from '../../services/scheduleDetectionService';
import type { FullAgenda, Guru } from '../../types';
import type { ScheduleItem } from '../../types/schedule';
import type { AdminTab } from '../../components/admin/AdminLayout';
import type { ReportView } from '../../routes/useReportQueryParam';
import { PageHeader } from '../../components/admin/PageHeader';
import { StatusBadge, EmptyState, ErrorState } from '../../components/common';
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
  ArrowUpRight,
  CalendarDays,
} from 'lucide-react';

interface DashboardOverviewProps {
  onNavigateTab: (tab: AdminTab, view?: ReportView) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

/** Cocokkan nama guru tanpa peduli spasi/kapital (agenda menyimpan teks bebas). */
const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
);

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onNavigateTab,
  showToast,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [totalGuru, setTotalGuru] = useState(0);
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [totalSaran, setTotalSaran] = useState(0);

  const [daftarGuru, setDaftarGuru] = useState<Guru[]>([]);
  const [agendasHariIni, setAgendasHariIni] = useState<FullAgenda[]>([]);
  const [agendaTerbaru, setAgendaTerbaru] = useState<FullAgenda[]>([]);
  const [jadwalHariIni, setJadwalHariIni] = useState<ScheduleItem[]>([]);

  const todayStr = localDateString();
  const dayKey = getScheduleDayFromDate(new Date());

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);

    try {
      // Query ringan: hanya agenda hari ini + 5 terbaru (bukan seluruh tabel)
      const [guruList, siswaList, saranList, agendaHariIni, agendaTerbaruList, ayList] =
        await Promise.all([
          getDaftarGuru(),
          getDaftarSiswa(),
          getDaftarKotakSaran(),
          getRekapAgenda({ tanggal: localDateString() }),
          getRekapAgenda({ limit: 5 }),
          getAcademicYears(),
        ]);

      setTotalGuru(guruList.length);
      setTotalSiswa(siswaList.length);
      setTotalSaran(saranList.length);
      setDaftarGuru(guruList);
      setAgendasHariIni(agendaHariIni);
      setAgendaTerbaru(agendaTerbaruList);

      // Jadwal mengajar hari ini (untuk "jadwal berjalan" & logika belum mengisi)
      const activeAY = ayList.find((ay) => ay.status === 'ACTIVE') || ayList[0];
      if (activeAY && dayKey) {
        const schedules = await getSchedules({
          academicYearId: activeAY.id,
          day: dayKey,
          status: 'ACTIVE',
        });
        setJadwalHariIni(
          schedules.sort((a, b) => a.start_time.localeCompare(b.start_time))
        );
      } else {
        setJadwalHariIni([]);
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(err);
      const message = err?.message || 'Terjadi kendala saat mengambil data dashboard.';
      if (silent) {
        showToast('error', 'Gagal menyegarkan data dashboard.');
      } else {
        setLoadError(message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dayKey, showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Status pengisian: HANYA guru yang memang punya jadwal hari ini ──
  const pengisiSet = new Set<string>();
  agendasHariIni.forEach((agenda) => {
    agenda.kbm.forEach((k) => {
      if (k.nama_guru) pengisiSet.add(normalizeName(k.nama_guru));
    });
  });

  const guruTerjadwal = daftarGuru.filter((guru) =>
    jadwalHariIni.some((slot) =>
      slot.teacher_id
        ? slot.teacher_id === guru.id
        : normalizeName(slot.teacher_name) === normalizeName(guru.nama_guru)
    )
  );

  const listGuruSudahMengisi = guruTerjadwal.filter((guru) =>
    pengisiSet.has(normalizeName(guru.nama_guru))
  );
  const listGuruBelumMengisi = guruTerjadwal.filter(
    (guru) => !pengisiSet.has(normalizeName(guru.nama_guru))
  );

  const totalGuruTerjadwal = guruTerjadwal.length;
  const persentase =
    totalGuruTerjadwal > 0
      ? Math.round((listGuruSudahMengisi.length / totalGuruTerjadwal) * 100)
      : 0;

  // ── Jadwal berlangsung / berikutnya sekarang ──
  const jamSekarang = new Date().toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const sedangBerlangsung = jadwalHariIni.filter(
    (s) => s.start_time.slice(0, 5) <= jamSekarang && jamSekarang < s.end_time.slice(0, 5)
  );
  const jadwalBerikutnya = jadwalHariIni.find((s) => s.start_time.slice(0, 5) > jamSekarang);

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

  const statCards: {
    label: string;
    value: number;
    caption: string;
    tab: AdminTab;
    /** Tampilan Pusat Rekap yang dituju (`/admin/rekap?view=…`). */
    view?: ReportView;
    icon: React.ReactNode;
  }[] = [
    {
      label: 'Total Guru',
      value: totalGuru,
      caption: 'Tenaga pendidik terdaftar',
      tab: 'guru',
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      label: 'Total Siswa',
      value: totalSiswa,
      caption: 'Siswa aktif terdata',
      tab: 'siswa',
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: 'Agenda Hari Ini',
      value: agendasHariIni.length,
      caption: `Jurnal pembelajaran ${formatDateIndo(todayStr)}`,
      tab: 'rekap',
      view: 'harian',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: 'Kotak Saran',
      value: totalSaran,
      caption: 'Aspirasi & masukan guru',
      tab: 'saran',
      icon: <MessageSquare className="w-4 h-4" />,
    },
  ];

  const isInitialLoad = isLoading && lastUpdated === null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan Dashboard"
        description="Pantau kegiatan pembelajaran, status pengisian agenda hari ini, dan data master sekolah."
        action={
          <div className="flex items-center gap-3">
            {lastUpdated && !isLoading && (
              <span className="hidden sm:inline text-[12px] text-slate-500">
                Diperbarui {lastUpdated.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            <button
              aria-label="Segarkan Data"
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition flex items-center gap-1.5 text-xs font-semibold disabled:opacity-60"
              title="Segarkan Data"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Menyegarkan…' : 'Segarkan'}</span>
            </button>
           </div>
        }
      />

      {/* Gagal memuat (percobaan pertama) */}
      {loadError && !isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
          <ErrorState
            title="Gagal memuat data dashboard"
            message={loadError}
            onRetry={() => fetchDashboardData()}
          />
        </div>
      ) : (
        <>
          {/* Key Stat Cards (bisa diklik — ada affordance & bisa diakses keyboard) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {statCards.map((card) =>
              isInitialLoad ? (
                <div
                  key={card.label}
                  className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ) : (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => onNavigateTab(card.tab, card.view)}
                  className="group bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-primary-300 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer transition flex flex-col justify-between text-left w-full"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-600">{card.label}</span>
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-primary-50 group-hover:text-primary-600 flex items-center justify-center transition">
                      {card.icon}
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                    {card.value}
                  </p>
                  <span className="flex items-center gap-1 text-[12px] text-slate-500 mt-1">
                    <span className="truncate">{card.caption}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition text-primary-600" />
                  </span>
                </button>
              )
            )}
          </div>

          {/* Jadwal hari ini + Status pengisian */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Jadwal berlangsung / berikutnya */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Jadwal Hari Ini</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {dayKey
                      ? `${formatDateIndo(todayStr)} • ${jadwalHariIni.length} slot mengajar`
                      : `${formatDateIndo(todayStr)} • hari libur sekolah`}
                  </p>
                </div>
                <CalendarDays className="w-4 h-4 text-slate-500" />
              </div>

              {isInitialLoad ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : !dayKey ? (
                <EmptyState
                  title="Bukan hari sekolah"
                  description="Jadwal mengajar hanya tersedia Senin–Jumat."
                />
              ) : jadwalHariIni.length === 0 ? (
                <EmptyState
                  title="Tidak ada jadwal hari ini"
                  description="Belum ada slot jadwal aktif untuk hari ini. Atur di menu Penugasan → Jadwal."
                  action={
                    <button
                      type="button"
                      onClick={() => onNavigateTab('jadwal')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <span>Buka Jadwal</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {sedangBerlangsung.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-3 rounded-lg bg-primary-50 border border-primary-100 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px] font-bold text-primary-700">
                          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                        </span>
                        <StatusBadge status="IN_PROGRESS" label="Berlangsung" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">{slot.subject_name}</p>
                      <p className="text-xs text-slate-600">
                        {slot.class_id} • {slot.teacher_name}
                      </p>
                    </div>
                  ))}

                  {jadwalBerikutnya && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px] font-bold text-slate-600">
                          {jadwalBerikutnya.start_time.slice(0, 5)} –{' '}
                          {jadwalBerikutnya.end_time.slice(0, 5)}
                        </span>
                        <StatusBadge status="UPCOMING" label="Berikutnya" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        {jadwalBerikutnya.subject_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {jadwalBerikutnya.class_id} • {jadwalBerikutnya.teacher_name}
                      </p>
                    </div>
                  )}

                  {sedangBerlangsung.length === 0 && !jadwalBerikutnya && (
                    <p className="text-xs text-slate-500 italic py-4 text-center">
                      Semua jadwal hari ini sudah selesai. {jadwalHariIni.length} slot tercatat.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Status Guru Hari Ini (2 kolom) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Status Pengisian Agenda Hari Ini
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDateIndo(todayStr)} &bull; {agendasHariIni.length} agenda pembelajaran
                    dibuat hari ini
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('rekap', 'harian')}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 shrink-0"
                >
                  <span className="hidden sm:inline">Lihat Rekap Harian</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {isInitialLoad ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                </div>
              ) : !dayKey ? (
                <EmptyState
                  title="Bukan hari sekolah"
                  description="Tidak ada penugasan mengajar hari ini, sehingga tidak ada kewajiban pengisian agenda."
                />
              ) : totalGuruTerjadwal === 0 ? (
                <EmptyState
                  title="Tidak ada jadwal mengajar hari ini"
                  description="Belum ada slot jadwal aktif untuk hari ini, belum ada guru yang wajib mengisi agenda."
                />
              ) : (
                <>
                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {listGuruSudahMengisi.length} dari {totalGuruTerjadwal} guru terjadwal
                        sudah mengisi
                      </span>
                      <span className="font-bold text-slate-900">{persentase}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${persentase}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Sudah Mengisi */}
                    <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/70 space-y-2">
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Sudah Mengisi ({listGuruSudahMengisi.length})
                      </span>

                      {listGuruSudahMengisi.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-3 text-center">
                          Belum ada guru terjadwal yang mengisi agenda hari ini.
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-200/60 max-h-56 overflow-y-auto pr-1">
                          {listGuruSudahMengisi.map((guru) => (
                            <li
                              key={guru.id}
                              className="py-1.5 text-xs text-slate-800 font-medium"
                            >
                              {guru.nama_guru}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Belum Mengisi (hanya guru yang punya jadwal hari ini) */}
                    <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/70 space-y-2">
                      <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-amber-600" />
                        Belum Mengisi ({listGuruBelumMengisi.length})
                      </span>

                      {listGuruBelumMengisi.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-3 text-center">
                          🎉 Semua guru yang mengajar hari ini sudah mengisi agenda!
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-200/60 max-h-56 overflow-y-auto pr-1">
                          {listGuruBelumMengisi.map((guru) => (
                            <li key={guru.id} className="py-1.5 text-xs text-slate-700">
                              {guru.nama_guru}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Agenda Terbaru */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Agenda Terbaru</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  5 jurnal pembelajaran yang terakhir dicatat
                </p>
              </div>
              <Clock className="w-4 h-4 text-slate-500" />
            </div>

            {isInitialLoad ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : agendaTerbaru.length === 0 ? (
              <EmptyState
                title="Belum ada catatan agenda"
                description="Jurnal pembelajaran akan muncul di sini setelah guru mengisi agenda."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {agendaTerbaru.map((agenda) => (
                  <button
                    key={agenda.header.id}
                    type="button"
                    onClick={() => onNavigateTab('rekap', 'jurnal')}
                    className="group p-3 rounded-lg bg-slate-50 border border-slate-200/70 hover:border-primary-300 hover:bg-white text-left transition space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {agenda.header.kelas}
                      </span>
                      <span className="text-[13px] text-slate-500 font-mono">
                        {formatDateIndo(agenda.header.tanggal)}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-600 flex items-center justify-between gap-2">
                      <span className="truncate">
                        {agenda.kbm.length} sesi pembelajaran
                        {agenda.kbm[0]?.nama_guru ? ` • ${agenda.kbm[0].nama_guru}` : ''}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition text-primary-600" />
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
