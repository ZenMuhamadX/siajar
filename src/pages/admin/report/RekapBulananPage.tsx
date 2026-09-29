import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Printer,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../../components/admin/PageHeader';
import { EmptyState, LoadingState, ErrorState } from '../../../components/common';
import { ReportPrintLayout } from '../../../components/admin/report/ReportPrintLayout';
import { useReportPrint } from '../../../hooks/useReportPrint';
import { createPrintModel, cellText } from '../../../services/report/printReportModel';
import { mapFriendlyError } from '../../../utils/friendlyError';
import {
  getMonthlyReport,
  formatMinutesToHourMin,
  type MonthlyReportResult,
} from '../../../services/reportService';
import { getAcademicYears } from '../../../services/scheduleService';
import { getDaftarGuru } from '../../../services/agendaService';
import type { Guru } from '../../../types';
import type { AcademicYear } from '../../../types/schedule';
import { ScrollArea } from '../../../components/common/ScrollArea';

interface RekapBulananPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const BULAN_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

export const RekapBulananPage: React.FC<RekapBulananPageProps> = ({ showToast }) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);

  // Filter Dropdowns
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('SEMUA');

  // Report Data
  const [reportResult, setReportResult] = useState<MonthlyReportResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // K-11: kegagalan fetch jadi state, agar cetak bisa diblokir.
  const [loadError, setLoadError] = useState<string | null>(null);

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
        console.error('Gagal memuat filter rekap bulanan:', err);
      }
    }
    loadFilters();
  }, []);

  // Fetch Report
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getMonthlyReport({
        year: selectedYear,
        month: selectedMonth,
        academicYearId: selectedAYId || undefined,
        teacherFilter: selectedTeacher,
      });
      setReportResult(data);
    } catch (err: any) {
      console.error('Gagal memuat data rekap bulanan:', err);
      // K-12: pesan ramah, bukan `err.message` mentah.
      const message = mapFriendlyError(err, { subject: 'rekap bulanan' });
      setLoadError(message);
      showToast('error', message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedAYId, selectedTeacher, showToast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const totals = reportResult?.totals;
  const activeAYName =
    reportResult?.academicYear?.name ||
    academicYears.find((y) => y.id === selectedAYId)?.name ||
    '2026/2027';

  /**
   * Model cetak (K-13, K-14). Landscape — tabel 10 kolom (K-15). Tanpa foto.
   */
  const printModel = useMemo(
    () =>
      createPrintModel({
        orientation: 'landscape',
        title: 'LAPORAN REKAPITULASI PEMBELAJARAN BULANAN',
        subtitle: `Bulan: ${reportResult?.monthName || ''} ${selectedYear}`,
        periodInfo: `${reportResult?.monthName || ''} ${selectedYear}`,
        academicYearName: activeAYName,
        columns: [
          { key: 'no', header: 'No', align: 'center', width: 'w-8' },
          { key: 'guru', header: 'Nama Guru', align: 'left' },
          { key: 'jpTerjadwal', header: 'JP Terjadwal', align: 'center', width: 'w-16' },
          { key: 'jpRealisasi', header: 'JP Realisasi', align: 'center', width: 'w-16' },
          { key: 'durasiTerjadwal', header: 'Durasi Terjadwal', align: 'center', width: 'w-20' },
          { key: 'durasiRealisasi', header: 'Durasi Realisasi', align: 'center', width: 'w-20' },
          { key: 'badalMasuk', header: 'Badal Masuk', align: 'center', width: 'w-14' },
          { key: 'badalKeluar', header: 'Badal Keluar', align: 'center', width: 'w-14' },
          { key: 'belumRealisasi', header: 'Belum Realisasi', align: 'center', width: 'w-16' },
          { key: 'capaian', header: 'Capaian %', align: 'center', width: 'w-16' },
        ],
        rows: (reportResult?.teacherSummaries ?? []).map((item, idx) => ({
          no: cellText(idx + 1),
          guru: cellText(item.teacherName),
          jpTerjadwal: cellText(item.jpScheduled),
          jpRealisasi: cellText(item.jpRealized),
          durasiTerjadwal: cellText(formatMinutesToHourMin(item.durationScheduledMin)),
          durasiRealisasi: cellText(formatMinutesToHourMin(item.durationRealizedMin)),
          badalMasuk: item.badalIn > 0 ? `+${item.badalIn}` : '0',
          badalKeluar: item.badalOut > 0 ? `-${item.badalOut}` : '0',
          belumRealisasi: cellText(item.notRealized),
          capaian: `${cellText(item.realizationRate)}%`,
        })),
        totalsRow: totals
          ? {
              no: '',
              guru: 'TOTAL KESELURUHAN',
              jpTerjadwal: cellText(totals.totalJpScheduled),
              jpRealisasi: cellText(totals.totalJpRealized),
              durasiTerjadwal: cellText(formatMinutesToHourMin(totals.totalDurationScheduledMin)),
              durasiRealisasi: cellText(formatMinutesToHourMin(totals.totalDurationRealizedMin)),
              badalMasuk: `+${totals.totalBadalIn}`,
              badalKeluar: `-${totals.totalBadalOut}`,
              belumRealisasi: cellText(totals.totalNotRealized),
              capaian: `${cellText(totals.overallRealizationRate)}%`,
            }
          : undefined,
        emptyMessage: 'Tidak ada data pembelajaran pada bulan ini.',
      }),
    [reportResult, selectedYear, activeAYName, totals]
  );

  // K-06 & K-11: cetak hanya saat data siap dan tidak ada kegagalan.
  const { print } = useReportPrint({
    orientation: printModel.orientation,
    canPrint: !isLoading && !loadError && printModel.rows.length > 0,
    onBlocked: (reason) => showToast('info', reason),
  });

  return (
    <div className="space-y-6">
      {/* SCREEN UI (Hidden on Print) */}
      <div className="no-print space-y-6">
        <PageHeader
          title="Rekap Bulanan"
          description="Rekapitulasi beban dan capaian jam/JP mengajar guru beserta durasi aktual selama satu bulan penuh."
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
                onClick={print}
                disabled={isLoading || Boolean(loadError) || printModel.rows.length === 0}
                title={
                  loadError
                    ? 'Tidak dapat mencetak: data gagal dimuat'
                    : 'Cetak laporan rekap bulanan'
                }
                className="px-3 py-2 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Laporan</span>
              </button>
            </div>
          }
        />

        {/* Summary Cards Terpadu */}
        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-600">JP Terjadwal</span>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                {totals.totalJpScheduled} JP
              </p>
              <span className="text-xs text-slate-600">
                Durasi: {formatMinutesToHourMin(totals.totalDurationScheduledMin)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-emerald-600">JP Terealisasi</span>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">
                {totals.totalJpRealized} JP
              </p>
              <span className="text-xs text-slate-600">
                Durasi: {formatMinutesToHourMin(totals.totalDurationRealizedMin)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-primary-600">Durasi Mengajar</span>
              <p className="text-xl sm:text-2xl font-bold text-primary-700 mt-1">
                {formatMinutesToHourMin(totals.totalDurationRealizedMin)}
              </p>
              <span className="text-xs text-slate-600">Total sesi pembelajaran</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-amber-600">Badal Terlaksana</span>
              <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">
                {totals.totalBadalIn} JP
              </p>
              <span className="text-xs text-slate-600">
                Masuk {totals.totalBadalIn} · Keluar {totals.totalBadalOut}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-xs font-medium text-rose-600">Agenda Belum Terealisasi</span>
              <p className="text-xl sm:text-2xl font-bold text-rose-700 mt-1">
                {totals.totalNotRealized} JP
              </p>
              <span className="text-xs text-slate-600">
                Capaian: {totals.overallRealizationRate}%
              </span>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Periode & Filter Rekap Bulanan</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Bulan */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Bulan
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
              >
                {BULAN_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tahun */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Tahun
              </label>
              <input
                type="number"
                min={2020}
                max={2035}
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
              />
            </div>

            {/* Tahun Ajaran */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Tahun Ajaran
              </label>
              <select
                value={selectedAYId}
                onChange={(e) => setSelectedAYId(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} {ay.status === 'ACTIVE' ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Guru */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Guru
              </label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
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

        {/* K-11: state error eksplisit; mencetak otomatis terblokir. */}
        {loadError && (
          <div className="bg-white rounded-xl border border-rose-200 shadow-2xs">
            <ErrorState
              title="Gagal memuat rekap bulanan"
              message={loadError}
              onRetry={fetchReport}
            />
          </div>
        )}

        {/* Tabel Data Rekap Bulanan Per Guru */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight truncate">
                Rekapitulasi Mengajar Bulanan &bull; {reportResult?.monthName} {selectedYear}
              </h3>
              <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
                Menampilkan {reportResult?.teacherSummaries.length || 0} tenaga pendidik
              </p>
            </div>
          </div>

          <ScrollArea label="Tabel rekap bulanan">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-xs">
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
                      <LoadingState message="Memuat rekap bulanan..." />
                    </td>
                  </tr>
                ) : !reportResult || reportResult.teacherSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6">
                      <EmptyState
                        title="Belum ada data rekap bulanan"
                        description="Tidak ada data pembelajaran pada bulan ini."
                      />
                    </td>
                  </tr>
                ) : (
                  reportResult.teacherSummaries.map((item, idx) => (
                    <tr key={item.teacherName + idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 sm:px-4 font-semibold text-slate-900">{item.teacherName}</td>
                      <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-800">
                        {item.jpScheduled}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-bold text-emerald-700">
                        {item.jpRealized}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-mono text-slate-600">
                        {formatMinutesToHourMin(item.durationScheduledMin)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-mono font-medium text-emerald-700">
                        {formatMinutesToHourMin(item.durationRealizedMin)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center">
                        {item.badalIn > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            +{item.badalIn}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center">
                        {item.badalOut > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            -{item.badalOut}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center">
                        {item.notRealized > 0 ? (
                          <span className="font-bold text-rose-600">{item.notRealized}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
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
                    <td className="py-3 px-3 sm:px-4 text-center text-orange-700">-{totals.totalBadalOut}</td>
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

      {/* PRINT VERSION (Shown ONLY on Print).
          Dirender dari `printModel` (landscape, tanpa foto) — K-13/K-14/K-15.
          Kelas `print-table` memberi header berulang + baris utuh (K-02/K-03). */}
      <ReportPrintLayout
        title={printModel.title}
        subtitle={printModel.subtitle}
        periodInfo={printModel.periodInfo}
        academicYearName={printModel.academicYearName}
        hasRows={printModel.rows.length > 0}
        emptyMessage={printModel.emptyMessage}
      >
        <table className="print-table w-full text-left text-xs border-collapse border border-slate-900">
          <thead className="bg-slate-100 border-b border-slate-900 font-bold uppercase text-center">
            <tr>
              {printModel.columns.map((col, ci) => (
                <th
                  key={col.key}
                  className={`p-1.5 ${col.width ?? ''} ${
                    ci < printModel.columns.length - 1 ? 'border-r border-slate-900' : ''
                  } ${col.align === 'left' ? 'text-left' : 'text-center'}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400">
            {printModel.rows.map((row, i) => (
              <tr key={i}>
                {printModel.columns.map((col, ci) => (
                  <td
                    key={col.key}
                    className={`p-1.5 ${
                      ci < printModel.columns.length - 1 ? 'border-r border-slate-900' : ''
                    } ${
                      col.key === 'guru'
                        ? 'font-medium text-left'
                        : col.key === 'jpTerjadwal' || col.key === 'jpRealisasi'
                          ? 'text-center font-bold'
                          : col.key === 'durasiTerjadwal' || col.key === 'durasiRealisasi'
                            ? 'text-center font-mono'
                            : col.key === 'capaian'
                              ? 'text-center font-bold'
                              : 'text-center'
                    }`}
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {printModel.totalsRow && (
            <tfoot className="bg-slate-100 border-t-2 border-slate-900 font-bold">
              <tr>
                {printModel.columns.map((col, ci) => (
                  <td
                    key={col.key}
                    className={`p-1.5 ${
                      ci < printModel.columns.length - 1 ? 'border-r border-slate-900' : ''
                    } text-center`}
                  >
                    {printModel.totalsRow![col.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </ReportPrintLayout>
    </div>
  );
};
