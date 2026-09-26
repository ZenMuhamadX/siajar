import React, { useState, useEffect, useCallback } from 'react';
import { localDateString } from '../../../utils/date';
import {
  Printer,
  RefreshCw,
  Eye,
  Camera,
  Clock,
  Info,
} from 'lucide-react';
import { PageHeader } from '../../../components/admin/PageHeader';
import { DataTable, FilterBar, type Column } from '../../../components/common';
import { DailyReportDetailModal } from '../../../components/admin/report/DailyReportDetailModal';
import { ReportPrintLayout } from '../../../components/admin/report/ReportPrintLayout';
import { PhotoLightboxModal } from '../../../components/PhotoLightboxModal';
import {
  getDailyReport,
  type DailyReportItem,
  type ReportItemStatus,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_BADGE,
  REPORT_STATUS_PRINT_LABEL,
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
  const todayStr = localDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Filter Dropdowns
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('SEMUA');
  // Default semua kelas: rekap harian adalah vista monitoring admin untuk
  // satu hari, bukan checklist satu kelas.
  const [selectedClass, setSelectedClass] = useState<string>('SEMUA');
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

  // Badge status memakai peta gaya yang sama dengan halaman rekap lain
  // (src/services/report/reportStatus.ts) supaya tampilan konsisten.
  const renderStatusBadge = (status: ReportItemStatus) => (
    <span className={REPORT_STATUS_BADGE[status]}>{REPORT_STATUS_LABEL[status]}</span>
  );

  const activeAYName = academicYears.find((y) => y.id === selectedAYId)?.name || '2026/2027';

  // Ringkasan hanya menghitung slot yang benar-benar dijadwalkan.
  // Agenda "di luar jadwal" (tanpa schedule_id) tidak punya jam, jadi tidak
  // boleh ikut Menggeser persentase ketercapaian.
  const scheduledItems = reportItems.filter((r) => !r.isUnscheduledAgenda);
  const unscheduledCount = reportItems.length - scheduledItems.length;
  const totalSlots = scheduledItems.length;
  const completedSlots = scheduledItems.filter((r) => r.status === 'SELESAI' || r.status === 'BADAL').length;
  const badalSlots = scheduledItems.filter((r) => r.isBadal).length;
  const missingSlots = scheduledItems.filter((r) => r.status === 'BELUM_TEREALISASI').length;
  const realizeRate = totalSlots > 0 ? (completedSlots / totalSlots) * 100 : 0;

  // Tanggal & tahun ajaran adalah cakupan data, bukan filter baris, jadi tidak
  // ikut ter-reset (pola yang sama dipakai halaman Jadwal).
  const isFiltered =
    selectedClass !== 'SEMUA' ||
    selectedTeacher !== 'SEMUA' ||
    selectedSubject !== 'SEMUA' ||
    selectedStatus !== 'ALL';

  const handleResetFilters = () => {
    setSelectedClass('SEMUA');
    setSelectedTeacher('SEMUA');
    setSelectedSubject('SEMUA');
    setSelectedStatus('ALL');
  };

  const selectClass =
    'px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none';

  const columns: Column<DailyReportItem>[] = [
    {
      key: 'waktu',
      header: 'Waktu',
      width: '150px',
      accessor: (item) =>
        item.startTime && item.endTime ? (
          <div className="whitespace-nowrap">
            <div className="flex items-center gap-1.5 font-mono font-medium text-slate-900">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {item.startTime} - {item.endTime}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block pl-5">
              {item.durationMinutes} menit
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Di luar jadwal</span>
        ),
    },
    {
      key: 'classId',
      header: 'Kelas',
      width: '130px',
      accessor: (item) => (
        <div>
          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold whitespace-nowrap">
            {item.classId}
          </span>
          {item.isUnscheduledAgenda && (
            <span className="block text-[9px] text-amber-600 font-normal mt-0.5">
              Tanpa Jadwal
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'subjectName',
      header: 'Mata Pelajaran',
      accessor: (item) => <span className="font-semibold text-slate-900">{item.subjectName}</span>,
    },
    {
      key: 'scheduledTeacherName',
      header: 'Guru Terjadwal',
      accessor: (item) => <span className="text-slate-600">{item.scheduledTeacherName}</span>,
    },
    {
      key: 'actualTeacherName',
      header: 'Guru Aktual',
      accessor: (item) => (
        <span
          className={`font-semibold whitespace-nowrap ${
            item.isBadal
              ? 'text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[11px] border border-amber-200'
              : 'text-slate-800'
          }`}
        >
          {item.actualTeacherName}
          {item.isBadal && ' (Badal)'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '130px',
      accessor: (item) => renderStatusBadge(item.status),
    },
    {
      key: 'hasDocumentation',
      header: 'Dokumentasi',
      align: 'center',
      width: '130px',
      accessor: (item) =>
        item.hasDocumentation ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Camera className="w-3 h-3 text-emerald-600" />
            Ada
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">Tidak ada</span>
        ),
    },
    {
      key: 'aksi',
      header: 'Aksi',
      align: 'center',
      width: '80px',
      accessor: (item) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveItemForDetail(item);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          title="Lihat Detail Agenda"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

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
            <span className="text-[10px] text-slate-400">{realizeRate.toFixed(0)}% terlaksana</span>
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

        {/* Agenda di luar jadwal: tetap terlihat, tapi tidak dihitung sebagai JP */}
        {unscheduledCount > 0 && (
          <div className="flex items-start gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>
              <strong>{unscheduledCount} agenda</strong> dibuat tanpa slot jadwal (tidak punya jam
              tetap). Agenda ini ditampilkan di tabel dengan label <em>Tanpa Jadwal</em> dan tidak
              dihitung pada Total Jadwal maupun persentase ketercapaian.
            </p>
          </div>
        )}

        {/* FilterBar standar: pencarian, tanggal, tahun ajaran, guru, kelas, mapel, status */}
        <FilterBar
          isFiltered={isFiltered}
          onResetFilters={handleResetFilters}
          filters={
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              <select
                value={selectedAYId}
                onChange={(e) => setSelectedAYId(e.target.value)}
                title="Tahun ajaran"
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-bold focus:outline-none"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} {ay.status === 'ACTIVE' ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>

              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className={selectClass}
              >
                <option value="SEMUA">Semua Kelas</option>
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>

              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className={`${selectClass} max-w-[150px]`}
              >
                <option value="SEMUA">Semua Guru</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.nama_guru}>
                    {t.nama_guru}
                  </option>
                ))}
              </select>

              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className={`${selectClass} max-w-[150px]`}
              >
                <option value="SEMUA">Semua Mapel</option>
                {subjects.map((m) => (
                  <option key={m.id} value={m.nama_mapel}>
                    {m.nama_mapel}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className={selectClass}
              >
                <option value="ALL">Semua Status</option>
                <option value="SELESAI">Selesai</option>
                <option value="BADAL">Badal</option>
                <option value="BELUM_TEREALISASI">Belum Diisi</option>
                <option value="SEDANG_BERLANGSUNG">Sedang Berlangsung</option>
                <option value="BELUM_DIMULAI">Belum Dimulai</option>
              </select>
            </>
          }
        />

        {/* Tabel Data Rekap Harian */}
        <DataTable
          title={`Daftar Jadwal & Agenda • ${formatDateIndo(selectedDate)}`}
          subtitle={`Menampilkan ${reportItems.length} slot pembelajaran`}
          columns={columns}
          data={reportItems}
          keyExtractor={(item, idx) => item.id + idx}
          isLoading={isLoading}
          emptyTitle="Tidak ada jadwal atau agenda"
          emptyDescription="Tidak ada jadwal atau agenda yang ditemukan untuk filter ini."
          onRowClick={(item) => setActiveItemForDetail(item)}
        />
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
                  {r.startTime && r.endTime
                    ? `${r.startTime}–${r.endTime} (${r.durationMinutes}m)`
                    : '—'}
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
                  {REPORT_STATUS_PRINT_LABEL[r.status]}
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
