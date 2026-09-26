import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '../../../components/admin/PageHeader';
import { EmptyState, LoadingState } from '../../../components/common';
import { ReportPrintLayout } from '../../../components/admin/report/ReportPrintLayout';
import {
  getWeeklyReport,
  getMondayToSundayRange,
  formatMinutesToHourMin,
  type WeeklyReportResult,
} from '../../../services/reportService';
import { getAcademicYears } from '../../../services/scheduleService';
import { getDaftarGuru } from '../../../services/agendaService';
import type { Guru } from '../../../types';
import type { AcademicYear } from '../../../types/schedule';
import { ScrollArea } from '../../../components/common/ScrollArea';

interface RekapMingguanPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const RekapMingguanPage: React.FC<RekapMingguanPageProps> = ({ showToast }) => {
  // Rentang minggu berjalan
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
  const weekRange = getMondayToSundayRange(currentWeekDate);

  // Filter Dropdowns
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('SEMUA');

  // Report Data State
  const [reportResult, setReportResult] = useState<WeeklyReportResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load Filters
  useEffect(() => {
    async function loadFilters() {
      try {
        const [ays, gList] = await Promise.all([getAcademicYears(), getDaftarGuru()]);
        setAcademicYears(ays);
        const activeAY = ays.find((a) => a.status === 'ACTIVE') || ays[0];
        if (activeAY) setSelectedAYId(activeAY.id);
        setTeachers(gList);
      } catch (err) {
        console.error('Gagal memuat filter rekap mingguan:', err);
      }
    }
    loadFilters();
  }, []);

  // Fetch Report
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getWeeklyReport({
        startDate: weekRange.monday,
        endDate: weekRange.sunday,
        academicYearId: selectedAYId || undefined,
        teacherFilter: selectedTeacher,
      });
      setReportResult(data);
    } catch (err: any) {
      console.error('Gagal memuat data rekap mingguan:', err);
      showToast('error', 'Gagal memuat rekap mingguan: ' + (err?.message || ''));
    } finally {
      setIsLoading(false);
    }
  }, [weekRange.monday, weekRange.sunday, selectedAYId, selectedTeacher, showToast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekDate);
    next.setDate(next.getDate() + 7);
    setCurrentWeekDate(next);
  };

  const handleCurrentWeek = () => {
    setCurrentWeekDate(new Date());
  };

  const formatDateDisplay = (dateStr: string) => {
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

  const handlePrint = () => {
    window.print();
  };

  const totals = reportResult?.totals;
  const activeAYName =
    reportResult?.academicYear?.name ||
    academicYears.find((y) => y.id === selectedAYId)?.name ||
    '2026/2027';

  return (
    <div className="space-y-6">
      {/* SCREEN UI (Hidden on Print) */}
      <div className="no-print space-y-6">
        <PageHeader
          title="Rekap Mingguan"
          description="Rekapitulasi jam mengajar, durasi, dan aktivitas badal per guru dalam periode mingguan (Senin - Minggu)."
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={fetchReport}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-3 py-2 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Laporan</span>
              </button>
            </div>
          }
        />

        {/* Summary Cards */}
        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-600">JP Terjadwal</span>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                {totals.totalJpScheduled} JP
              </p>
              <span className="text-[12px] text-slate-600">
                Durasi: {formatMinutesToHourMin(totals.totalDurationScheduledMin)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-emerald-600">JP Terealisasi</span>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">
                {totals.totalJpRealized} JP
              </p>
              <span className="text-[12px] text-slate-600">
                Durasi: {formatMinutesToHourMin(totals.totalDurationRealizedMin)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-amber-600">Total Badal</span>
              <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">
                {totals.totalBadalIn} JP
              </p>
              <span className="text-[12px] text-slate-600">
                Masuk: {totals.totalBadalIn} | Keluar: {totals.totalBadalOut}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-rose-600">Belum Terealisasi</span>
              <p className="text-xl sm:text-2xl font-bold text-rose-700 mt-1">
                {totals.totalNotRealized} JP
              </p>
              <span className="text-[12px] text-slate-600">Slot jadwal tanpa agenda</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-xs font-medium text-primary-600">Persentase Realisasi</span>
              <p className="text-xl sm:text-2xl font-bold text-primary-700 mt-1">
                {totals.overallRealizationRate}%
              </p>
              <span className="text-[12px] text-slate-600">Capaian mengajar minggu ini</span>
            </div>
          </div>
        )}

        {/* Filter Bar & Navigator Minggu */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            {/* Week Navigator */}
            <div className="flex items-center gap-2">
              <button
                aria-label="Minggu Sebelumnya"
                onClick={handlePrevWeek}
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                title="Minggu Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

               <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center">
                <span>
                  {formatDateDisplay(weekRange.monday)} &mdash; {formatDateDisplay(weekRange.sunday)}
                </span>
              </div>

              <button
                aria-label="Minggu Berikutnya"
                onClick={handleNextWeek}
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                title="Minggu Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

               <button
                onClick={handleCurrentWeek}
                className="px-2.5 py-1 text-[13px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              >
                Minggu Ini
              </button>
            </div>

            {/* Quick Filter Guru & AY */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500">Tahun Ajaran:</label>
                <select
                  value={selectedAYId}
                  onChange={(e) => setSelectedAYId(e.target.value)}
                  className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
                >
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name} {ay.status === 'ACTIVE' ? '(Aktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500">Guru:</label>
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
                >
                  <option value="SEMUA">Semua Guru</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.nama_guru}>
                      {t.nama_guru}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Rekap Per Guru */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight truncate">
                Rekapitulasi Mengajar Mingguan Per Guru
              </h3>
              <p className="text-[13px] text-slate-500 font-medium truncate mt-0.5">
                Menampilkan {reportResult?.teacherSummaries.length || 0} tenaga pendidik
              </p>
            </div>
          </div>

          <ScrollArea label="Tabel rekap mingguan">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[12px]">
                <tr>
                  <th className="py-3 px-3 sm:px-4">Nama Guru</th>
                  <th className="py-3 px-3 sm:px-4 text-center w-24">JP Terjadwal</th>
                  <th className="py-3 px-3 sm:px-4 text-center w-24">JP Terealisasi</th>
                  <th className="py-3 px-3 sm:px-4 text-center w-28">Durasi Terjadwal</th>
                  <th className="py-3 px-3 sm:px-4 text-center w-28">Durasi Terealisasi</th>
                  <th className="py-3 px-3 sm:px-4 text-center w-20">Badal Masuk</th>
                  <th className="py-3 px-3 sm:px-4 text-center w-20">Badal Keluar</th>
                  <th className="py-3 px-3 sm:px-4 text-center w-24">Belum Realisasi</th>
                  <th className="py-3 px-3 sm:px-4 text-center w-28">Realisasi %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-6">
                      <LoadingState message="Memuat data rekap mingguan..." />
                    </td>
                  </tr>
                ) : !reportResult || reportResult.teacherSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6">
                      <EmptyState
                        title="Belum ada data rekap mingguan"
                        description="Tidak ada data jadwal atau guru pada periode minggu ini."
                      />
                    </td>
                  </tr>
                ) : (
                  reportResult.teacherSummaries.map((item, idx) => (
                    <tr key={item.teacherName + idx} className="hover:bg-slate-50/80 transition-colors">
                      {/* Nama Guru */}
                      <td className="py-3 px-3 sm:px-4 font-semibold text-slate-900">
                        {item.teacherName}
                      </td>

                      {/* JP Terjadwal */}
                      <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-800">
                        {item.jpScheduled}
                      </td>

                      {/* JP Terealisasi */}
                      <td className="py-3 px-3 sm:px-4 text-center font-bold text-emerald-700">
                        {item.jpRealized}
                      </td>

                      {/* Durasi Terjadwal */}
                      <td className="py-3 px-3 sm:px-4 text-center font-mono text-slate-600">
                        {formatMinutesToHourMin(item.durationScheduledMin)}
                      </td>

                      {/* Durasi Terealisasi */}
                      <td className="py-3 px-3 sm:px-4 text-center font-mono font-medium text-emerald-700">
                        {formatMinutesToHourMin(item.durationRealizedMin)}
                      </td>

                      {/* Badal Masuk */}
                      <td className="py-3 px-3 sm:px-4 text-center">
                        {item.badalIn > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[13px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            +{item.badalIn}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Badal Keluar */}
                      <td className="py-3 px-3 sm:px-4 text-center">
                        {item.badalOut > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[13px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            -{item.badalOut}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Belum Terealisasi */}
                      <td className="py-3 px-3 sm:px-4 text-center">
                        {item.notRealized > 0 ? (
                          <span className="font-bold text-rose-600">{item.notRealized}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Realisasi % */}
                      <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className={`font-bold ${
                              item.realizationRate >= 90
                                ? 'text-emerald-700'
                                : item.realizationRate >= 70
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {item.realizationRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {totals && reportResult?.teacherSummaries.length ? (
                <tfoot className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <tr>
                    <td className="py-3 px-3 sm:px-4">TOTAL KESELURUHAN</td>
                    <td className="py-3 px-3 sm:px-4 text-center">{totals.totalJpScheduled}</td>
                    <td className="py-3 px-3 sm:px-4 text-center text-emerald-700">
                      {totals.totalJpRealized}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-center font-mono">
                      {formatMinutesToHourMin(totals.totalDurationScheduledMin)}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-center font-mono text-emerald-700">
                      {formatMinutesToHourMin(totals.totalDurationRealizedMin)}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-center text-amber-700">+{totals.totalBadalIn}</td>
                    <td className="py-3 px-3 sm:px-4 text-center text-orange-700">
                      -{totals.totalBadalOut}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-center text-rose-700">
                      {totals.totalNotRealized}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-center text-primary-700">
                      {totals.overallRealizationRate}%
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </ScrollArea>
        </div>
      </div>

      {/* PRINT VERSION (Shown ONLY on Print) */}
      <ReportPrintLayout
        title="LAPORAN REKAPITULASI PEMBELAJARAN MINGGUAN"
        subtitle={`Periode: ${formatDateDisplay(weekRange.monday)} s.d. ${formatDateDisplay(weekRange.sunday)}`}
        periodInfo={`${weekRange.monday} s.d. ${weekRange.sunday}`}
        academicYearName={activeAYName}
      >
        <table className="w-full text-left text-[12px] border-collapse border border-slate-900">
          <thead className="bg-slate-100 border-b border-slate-900 font-bold uppercase text-center">
            <tr>
              <th className="p-1.5 border-r border-slate-900 w-8">No</th>
              <th className="p-1.5 border-r border-slate-900 text-left">Nama Guru</th>
              <th className="p-1.5 border-r border-slate-900 w-16">JP Terjadwal</th>
              <th className="p-1.5 border-r border-slate-900 w-16">JP Realisasi</th>
              <th className="p-1.5 border-r border-slate-900 w-20">Durasi Terjadwal</th>
              <th className="p-1.5 border-r border-slate-900 w-20">Durasi Realisasi</th>
              <th className="p-1.5 border-r border-slate-900 w-14">Badal Masuk</th>
              <th className="p-1.5 border-r border-slate-900 w-14">Badal Keluar</th>
              <th className="p-1.5 border-r border-slate-900 w-16">Belum Realisasi</th>
              <th className="p-1.5 w-16">Capaian %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400">
            {reportResult?.teacherSummaries.map((item, idx) => (
              <tr key={idx}>
                <td className="p-1.5 border-r border-slate-900 text-center">{idx + 1}</td>
                <td className="p-1.5 border-r border-slate-900 font-medium">{item.teacherName}</td>
                <td className="p-1.5 border-r border-slate-900 text-center font-bold">
                  {item.jpScheduled}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center font-bold">
                  {item.jpRealized}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center font-mono">
                  {formatMinutesToHourMin(item.durationScheduledMin)}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center font-mono">
                  {formatMinutesToHourMin(item.durationRealizedMin)}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center">
                  {item.badalIn > 0 ? `+${item.badalIn}` : '0'}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center">
                  {item.badalOut > 0 ? `-${item.badalOut}` : '0'}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center">{item.notRealized}</td>
                <td className="p-1.5 text-center font-bold">{item.realizationRate}%</td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot className="bg-slate-100 border-t-2 border-slate-900 font-bold">
              <tr>
                <td colSpan={2} className="p-1.5 border-r border-slate-900 text-center">
                  TOTAL KESELURUHAN
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center">
                  {totals.totalJpScheduled}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center">
                  {totals.totalJpRealized}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center font-mono">
                  {formatMinutesToHourMin(totals.totalDurationScheduledMin)}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center font-mono">
                  {formatMinutesToHourMin(totals.totalDurationRealizedMin)}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center">
                  +{totals.totalBadalIn}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center">
                  -{totals.totalBadalOut}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center">
                  {totals.totalNotRealized}
                </td>
                <td className="p-1.5 text-center">{totals.overallRealizationRate}%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </ReportPrintLayout>
    </div>
  );
};
