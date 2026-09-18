import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  Filter,
  RefreshCw,
  Eye,
  Camera,
  Clock,
} from 'lucide-react';
import { PageHeader } from '../../../components/admin/PageHeader';
import { DailyReportDetailModal } from '../../../components/admin/report/DailyReportDetailModal';
import { ReportPrintLayout } from '../../../components/admin/report/ReportPrintLayout';
import { PhotoLightboxModal } from '../../../components/PhotoLightboxModal';
import {
  getDailyReport,
  type DailyReportItem,
  type ReportItemStatus,
} from '../../../services/reportService';
import { getAcademicYears } from '../../../services/scheduleService';
import { getDaftarGuru, getDaftarMapel } from '../../../services/agendaService';
import { DAFTAR_KELAS, type Guru, type MataPelajaran } from '../../../types';
import type { AcademicYear } from '../../../types/schedule';

interface RekapHarianPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const RekapHarianPage: React.FC<RekapHarianPageProps> = ({ showToast }) => {
  // Tanggal default: Hari ini
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Filter Dropdowns
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('SEMUA');
  const [selectedClass, setSelectedClass] = useState<string>('KELAS 1');
  const [subjects, setSubjects] = useState<MataPelajaran[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('SEMUA');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Data & State
  const [reportItems, setReportItems] = useState<DailyReportItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeItemForDetail, setActiveItemForDetail] = useState<DailyReportItem | null>(null);

  // Lightbox Photo State
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    title: string;
    uploadedAt?: string;
    capturedAt?: string;
    actualTeacherName?: string;
    agendaId: string;
    storagePath?: string;
  } | null>(null);

  // Load Filter Options
  useEffect(() => {
    async function loadFilters() {
      try {
        const [ays, gList, mList] = await Promise.all([
          getAcademicYears(),
          getDaftarGuru(),
          getDaftarMapel(),
        ]);
        setAcademicYears(ays);
        const activeAY = ays.find((a) => a.status === 'ACTIVE') || ays[0];
        if (activeAY) setSelectedAYId(activeAY.id);
        setTeachers(gList);
        setSubjects(mList);
      } catch (err) {
        console.error('Gagal memuat filter opsi:', err);
      }
    }
    loadFilters();
  }, []);

  // Fetch Report Data
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getDailyReport({
        date: selectedDate,
        academicYearId: selectedAYId || undefined,
        teacherName: selectedTeacher,
        classId: selectedClass,
        subjectName: selectedSubject,
        statusFilter: selectedStatus,
      });
      setReportItems(data);
    } catch (err: any) {
      console.error('Gagal mengambil data rekap harian:', err);
      showToast('error', 'Gagal memuat rekap harian: ' + (err?.message || ''));
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, selectedAYId, selectedTeacher, selectedClass, selectedSubject, selectedStatus, showToast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  const formatDateIndo = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: ReportItemStatus) => {
    switch (status) {
      case 'SELESAI':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Selesai
          </span>
        );
      case 'BADAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Badal
          </span>
        );
      case 'SEDANG_BERLANGSUNG':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            Berlangsung
          </span>
        );
      case 'BELUM_DIMULAI':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Belum Dimulai
          </span>
        );
      case 'BELUM_TEREALISASI':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            Belum Diisi
          </span>
        );
    }
  };

  const activeAYName = academicYears.find((y) => y.id === selectedAYId)?.name || '2026/2027';

  // Summary counts
  const totalSlots = reportItems.length;
  const completedSlots = reportItems.filter((r) => r.status === 'SELESAI' || r.status === 'BADAL').length;
  const badalSlots = reportItems.filter((r) => r.isBadal).length;
  const missingSlots = reportItems.filter((r) => r.status === 'BELUM_TEREALISASI').length;

  return (
    <div className="space-y-6">
      {/* SCREEN UI (Hidden on Print) */}
      <div className="no-print space-y-6">
        <PageHeader
          title="Rekap Harian"
          description="Monitoring pelaksanaan jadwal pembelajaran harian, kehadiran guru, status agenda, dan dokumentasi foto."
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
                className="px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Laporan</span>
              </button>
            </div>
          }
        />

        {/* Ringkasan Cepat Harian */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-medium text-slate-400">Total Jadwal</span>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{totalSlots} JP</p>
            <span className="text-[10px] text-slate-400">Slot terjadwal hari ini</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-medium text-emerald-600">Terealisasi</span>
            <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{completedSlots} JP</p>
            <span className="text-[10px] text-slate-400">
              {totalSlots > 0 ? ((completedSlots / totalSlots) * 100).toFixed(0) : 0}% terlaksana
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-medium text-amber-600">Badal (Pengganti)</span>
            <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">{badalSlots} JP</p>
            <span className="text-[10px] text-slate-400">Digantikan guru lain</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-medium text-rose-600">Belum Terealisasi</span>
            <p className="text-xl sm:text-2xl font-bold text-rose-700 mt-1">{missingSlots} JP</p>
            <span className="text-[10px] text-slate-400">Agenda belum diisi</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filter Rekap Harian</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Tanggal */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Tanggal
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
              />
            </div>

            {/* Tahun Ajaran */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
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
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
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

            {/* Kelas */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Kelas
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
              >
                {/* <option value="SEMUA">Semua Kelas</option> */}
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            {/* Mata Pelajaran */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Mata Pelajaran
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
              >
                <option value="SEMUA">Semua Mapel</option>
                {subjects.map((m) => (
                  <option key={m.id} value={m.nama_mapel}>
                    {m.nama_mapel}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
              >
                <option value="ALL">Semua Status</option>
                <option value="SELESAI">Selesai</option>
                <option value="BADAL">Badal</option>
                <option value="BELUM_TEREALISASI">Belum Diisi</option>
                <option value="SEDANG_BERLANGSUNG">Sedang Berlangsung</option>
                <option value="BELUM_DIMULAI">Belum Dimulai</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabel Data Rekap Harian */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Daftar Jadwal & Agenda &bull; {formatDateIndo(selectedDate)}
              </h3>
              <p className="text-[11px] text-slate-400">
                Menampilkan {reportItems.length} slot pembelajaran
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-28">Waktu</th>
                  <th className="py-3 px-4 w-24">Kelas</th>
                  <th className="py-3 px-4">Mata Pelajaran</th>
                  <th className="py-3 px-4">Guru Terjadwal</th>
                  <th className="py-3 px-4">Guru Aktual</th>
                  <th className="py-3 px-4 text-center w-28">Status</th>
                  <th className="py-3 px-4 text-center w-28">Dokumentasi</th>
                  <th className="py-3 px-4 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                      <span>Memuat data rekap...</span>
                    </td>
                  </tr>
                ) : reportItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Tidak ada jadwal atau agenda yang ditemukan untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  reportItems.map((item, idx) => (
                    <tr
                      key={item.id + idx}
                      className="hover:bg-slate-50/80 transition group cursor-pointer"
                      onClick={() => setActiveItemForDetail(item)}
                    >
                      {/* Waktu */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {item.startTime} - {item.endTime}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block pl-5">
                          {item.durationMinutes} menit
                        </span>
                      </td>

                      {/* Kelas */}
                      <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                          {item.classId}
                        </span>
                        {item.isUnscheduledAgenda && (
                          <span className="block text-[9px] text-amber-600 font-normal mt-0.5">
                            Tanpa Jadwal
                          </span>
                        )}
                      </td>

                      {/* Mapel */}
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {item.subjectName}
                      </td>

                      {/* Guru Terjadwal */}
                      <td className="py-3 px-4 text-slate-600">
                        {item.scheduledTeacherName}
                      </td>

                      {/* Guru Aktual */}
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            item.isBadal
                              ? 'text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[11px] border border-amber-200'
                              : 'text-slate-800'
                          }`}
                        >
                          {item.actualTeacherName}
                          {item.isBadal && ' (Badal)'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {renderStatusBadge(item.status)}
                      </td>

                      {/* Dokumentasi */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {item.hasDocumentation ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Camera className="w-3 h-3 text-emerald-600" />
                            Ada
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Tidak ada</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td
                        className="py-3 px-4 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setActiveItemForDetail(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          title="Lihat Detail Agenda"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PRINT VERSION (Shown ONLY on Print) */}
      <ReportPrintLayout
        title="LAPORAN REKAP PEMBELAJARAN HARIAN"
        subtitle={`Hari, Tanggal: ${formatDateIndo(selectedDate)}`}
        periodInfo={selectedDate}
        academicYearName={activeAYName}
      >
        <table className="w-full text-left text-[10px] border-collapse border border-slate-900">
          <thead className="bg-slate-100 border-b border-slate-900 font-bold uppercase">
            <tr>
              <th className="p-1.5 border-r border-slate-900 text-center w-8">No</th>
              <th className="p-1.5 border-r border-slate-900 text-center w-24">Waktu</th>
              <th className="p-1.5 border-r border-slate-900 text-center w-16">Kelas</th>
              <th className="p-1.5 border-r border-slate-900">Mata Pelajaran</th>
              <th className="p-1.5 border-r border-slate-900">Guru Terjadwal</th>
              <th className="p-1.5 border-r border-slate-900">Guru Aktual</th>
              <th className="p-1.5 border-r border-slate-900 text-center w-20">Status</th>
              <th className="p-1.5 text-center w-20">Dokumentasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400">
            {reportItems.map((r, i) => (
              <tr key={i}>
                <td className="p-1.5 border-r border-slate-900 text-center">{i + 1}</td>
                <td className="p-1.5 border-r border-slate-900 text-center font-mono">
                  {r.startTime}–{r.endTime} ({r.durationMinutes}m)
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center font-bold">
                  {r.classId}
                </td>
                <td className="p-1.5 border-r border-slate-900 font-medium">{r.subjectName}</td>
                <td className="p-1.5 border-r border-slate-900">{r.scheduledTeacherName}</td>
                <td className="p-1.5 border-r border-slate-900">
                  {r.actualTeacherName} {r.isBadal ? '(Badal)' : ''}
                </td>
                <td className="p-1.5 border-r border-slate-900 text-center font-semibold">
                  {r.status === 'SELESAI'
                    ? 'Selesai'
                    : r.status === 'BADAL'
                    ? 'Badal'
                    : r.status === 'SEDANG_BERLANGSUNG'
                    ? 'Berlangsung'
                    : 'Belum Diisi'}
                </td>
                <td className="p-1.5 text-center">
                  {r.hasDocumentation ? 'Ada Foto' : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportPrintLayout>

      {/* Modal Detail Agenda */}
      <DailyReportDetailModal
        isOpen={Boolean(activeItemForDetail)}
        onClose={() => setActiveItemForDetail(null)}
        item={activeItemForDetail}
        onOpenPhotoLightbox={(photo) => setLightboxData(photo)}
      />

      {/* Lightbox Preview Foto */}
      {lightboxData && (
        <PhotoLightboxModal
          isOpen={Boolean(lightboxData)}
          onClose={() => setLightboxData(null)}
          imageUrl={lightboxData.url}
          title={lightboxData.title}
          uploadedAt={lightboxData.uploadedAt}
          capturedAt={lightboxData.capturedAt}
          actualTeacherName={lightboxData.actualTeacherName}
          isAdmin={true}
        />
      )}
    </div>
  );
};
