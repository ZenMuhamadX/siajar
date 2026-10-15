import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { formatDateLong, formatDateMedium, localDateString } from '../../../utils/date';
import {
  FileDown,
  RefreshCw,
  Eye,
  Camera,
  Clock,
  Info,
} from 'lucide-react';
import { PageHeader } from '../../../components/admin/PageHeader';
import { DataTable, FilterBar, ErrorState, type Column } from '../../../components/common';
import { DailyReportDetailModal } from '../../../components/admin/report/DailyReportDetailModal';
import { PhotoLightboxModal } from '../../../components/PhotoLightboxModal';
import { useReportPdf } from '../../../hooks/useReportPdf';
import { useSchoolName } from '../../../contexts/SettingsContext';
import { createPrintModel, cellText } from '../../../services/report/printReportModel';
import { mapFriendlyError } from '../../../utils/friendlyError';
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
import { type Guru, type MataPelajaran } from '../../../types';
import { useClassLabels } from '../../../contexts/ClassContext';
import type { AcademicYear } from '../../../types/schedule';

interface RekapHarianPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const RekapHarianPage: React.FC<RekapHarianPageProps> = ({ showToast }) => {
  // Nama sekolah dari Pengaturan — dipakai kop dan footer dokumen PDF.
  const schoolName = useSchoolName();
  // Sumber kelas: master data, bukan konstanta hardcoded.
  const kelasLabels = useClassLabels();

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
  // K-11: kegagalan fetch disimpan sebagai state, bukan hanya Toast, supaya
  // pencetakan bisa diblokir dan pengguna melihat alasan yang jelas.
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Fetch HANYA saat tanggal / tahun ajaran berubah.
  // Guru, kelas, mapel, dan status disaring di memori (satu hari = maksimal
  // belasan slot), jadi mengubah dropdown tidak lagi memanggil jaringan.
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getDailyReport({
        date: selectedDate,
        academicYearId: selectedAYId || undefined,
        kelasOrder: kelasLabels,
      });
      setReportItems(data);
    } catch (err: any) {
      console.error('Gagal mengambil data rekap harian:', err);
      // K-12: pesan ramah, bukan `err.message` mentah dari Supabase.
      const message = mapFriendlyError(err, { subject: 'rekap harian' });
      setLoadError(message);
      showToast('error', message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, selectedAYId, kelasLabels, showToast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Badge status memakai peta gaya yang sama dengan halaman rekap lain
  // (src/services/report/reportStatus.ts) supaya tampilan konsisten.
  const renderStatusBadge = (status: ReportItemStatus) => (
    <span className={REPORT_STATUS_BADGE[status]}>{REPORT_STATUS_LABEL[status]}</span>
  );

  const activeAYName = academicYears.find((y) => y.id === selectedAYId)?.name || '2026/2027';

  // Filter harian diterapkan di memori terhadap data yang sudah dimuat, sehingga
  // KPI, tabel, dan cetakan selalu memakai himpunan baris yang sama.
  const filteredItems = useMemo(
    () =>
      reportItems.filter((item) => {
        if (selectedTeacher !== 'SEMUA') {
          const teacher = selectedTeacher.trim().toLowerCase();
          const matchScheduled = item.scheduledTeacherName.trim().toLowerCase() === teacher;
          const matchActual = item.actualTeacherName.trim().toLowerCase() === teacher;
          if (!matchScheduled && !matchActual) return false;
        }
        // Sesi halaqoh lintas kelas muncul di tiap kelas sumbernya. Perbandingan
        // WAJIB memakai `classIds` (daftar), bukan `classId` — yang untuk baris
        // halaqoh berisi gabungan "1A, 2A" sehingga tidak pernah sama dengan
        // satu label kelas.
        if (selectedClass !== 'SEMUA' && !item.classIds.includes(selectedClass)) return false;
        if (
          selectedSubject !== 'SEMUA' &&
          item.subjectName.trim().toLowerCase() !== selectedSubject.trim().toLowerCase()
        )
          return false;
        if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false;
        return true;
      }),
    [reportItems, selectedTeacher, selectedClass, selectedSubject, selectedStatus]
  );

  // Ringkasan hanya menghitung slot yang benar-benar dijadwalkan.
  // Agenda "di luar jadwal" (tanpa schedule_id) tidak punya jam, jadi tidak
  // boleh ikut menggeser persentase ketercapaian.
  const scheduledItems = filteredItems.filter((r) => !r.isUnscheduledAgenda);
  const unscheduledCount = filteredItems.length - scheduledItems.length;
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

  /**
   * Model cetak (K-13, K-14). Dibangun MURNI dari state yang sudah jadi.
   *
   * Tanpa kolom Dokumentasi: dokumen cetak hanya memuat informasi tekstual
   * (waktu, kelas, mapel, guru, status). Status keberadaan foto tetap tampil di
   * tabel layar — dokumen arsip tidak perlu menyatakannya, apalagi gambarnya.
   *
   * Portrait (7 kolom), dan — karena barisnya per slot, bukan agregat per guru —
   * dokumen ini TIDAK memakai baris TOTAL. Angka agregatnya dipindahkan ke strip
   * ringkasan di bawah judul, sama seperti kartu ringkasan di layar.
   */
  const printModel = useMemo(
    () =>
      createPrintModel({
        documentKind: 'harian',
        orientation: 'portrait',
        title: 'Laporan Rekap Pembelajaran Harian',
        subtitle: `Hari, Tanggal: ${formatDateLong(selectedDate)}`,
        periodInfo: formatDateMedium(selectedDate),
        fileLabel: selectedDate,
        academicYearName: activeAYName,
        columns: [
          { key: 'no', header: 'No', align: 'center', ptWidth: 20 },
          { key: 'waktu', header: 'Waktu', align: 'center', ptWidth: 58 },
          { key: 'kelas', header: 'Kelas', align: 'center', ptWidth: 34 },
          // Kelompok: pembeda WAJIB untuk mapel berkelompok — tanpa kolom ini,
          // dua guru Ummi pada kelas & jam yang sama tercetak sebagai baris
          // yang tampak sama persis.
          { key: 'kelompok', header: 'Kelompok', align: 'center', ptWidth: 56 },
          // Mata Pelajaran menyerap sisa lebar — termasuk ruang yang dulu dipakai
          // kolom Dokumentasi, sehingga nama mapel panjang membungkus penuh.
          { key: 'mapel', header: 'Mata Pelajaran', align: 'left' },
          { key: 'guruTerjadwal', header: 'Guru Terjadwal', align: 'left', ptWidth: 82 },
          { key: 'guruAktual', header: 'Guru Aktual', align: 'left', ptWidth: 82 },
          { key: 'status', header: 'Status', align: 'center', ptWidth: 50 },
        ],
        summary: [
          { label: 'Total Jadwal', value: `${cellText(totalSlots)} JP` },
          { label: 'Terealisasi', value: `${cellText(completedSlots)} JP` },
          { label: 'Badal', value: `${cellText(badalSlots)} JP` },
          { label: 'Belum Terealisasi', value: `${cellText(missingSlots)} JP` },
        ],
        rows: filteredItems.map((r, i) => ({
          no: cellText(i + 1),
          waktu:
            r.startTime && r.endTime
              ? `${r.startTime}\u2013${r.endTime} (${r.durationMinutes}m)`
              : '\u2014',
          kelas: cellText(r.classId),
          kelompok: cellText(r.kelompok),
          mapel: cellText(r.subjectName),
          guruTerjadwal: cellText(r.scheduledTeacherName),
          guruAktual: `${cellText(r.actualTeacherName)}${r.isBadal ? ' (Badal)' : ''}`,
          status: cellText(REPORT_STATUS_PRINT_LABEL[r.status]),
        })),
        emptyMessage: 'Tidak ada jadwal atau agenda pada tanggal ini untuk filter yang dipilih.',
      }),
    [
      filteredItems,
      selectedDate,
      activeAYName,
      totalSlots,
      completedSlots,
      badalSlots,
      missingSlots,
    ]
  );

  // K-06 & K-11: unduh hanya boleh saat data siap dan tidak ada kegagalan.
  const { downloadPdf, isPreparing } = useReportPdf({
    model: printModel,
    schoolName,
    canExport: !isLoading && !loadError,
    onBlocked: (reason) => showToast('info', reason),
    onSuccess: (fileName) => showToast('success', `PDF dibuat: ${fileName}`),
    onError: (message) => showToast('error', message),
  });

  const selectClass =
    'px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs';

  const columns: Column<DailyReportItem>[] = [
    {
      key: 'waktu',
      header: 'Waktu',
      width: '150px',
      accessor: (item) =>
        item.startTime && item.endTime ? (
          <div className="whitespace-nowrap">
            <div className="flex items-center gap-1.5 font-mono font-medium text-slate-900">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {item.startTime} - {item.endTime}
              </span>
            </div>
            <span className="text-xs text-slate-600 block pl-5">
              {item.durationMinutes} menit
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-600 italic">Di luar jadwal</span>
        ),
    },
    {
      key: 'classId',
      header: 'Kelas',
      width: '130px',
      accessor: (item) => (
        <div>
          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-bold whitespace-nowrap">
            {item.classId}
          </span>
          {/*
            Kelompok ditulis sebagai baris terpisah, bukan disambung ke label
            kelas: lencana kelas sudah punya latar, dan menyambungnya membuat
            labelnya panjang lalu terpotong di kolom selebar 130px.
          */}
          {item.kelompok && (
            <span className="block text-2xs font-semibold text-primary-700 mt-0.5">
              {item.kelompok}
            </span>
          )}
          {item.isUnscheduledAgenda && (
            <span className="block text-xs text-amber-600 font-normal mt-0.5">
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
              ? 'text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-xs border border-amber-200'
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
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Camera className="w-3 h-3 text-emerald-600" />
            Ada
          </span>
        ) : (
          <span className="text-xs text-slate-600">Tidak ada</span>
        ),
    },
    {
      key: 'aksi',
      header: 'Aksi',
      align: 'center',
      width: '80px',
      accessor: (item) => (
        <button
          aria-label="Lihat Detail Agenda"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveItemForDetail(item);
          }}
          className="p-1.5 text-slate-600 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
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
                onClick={downloadPdf}
                disabled={isLoading || Boolean(loadError) || isPreparing}
                title={
                  loadError
                    ? 'Tidak dapat mengunduh: data gagal dimuat'
                    : 'Unduh laporan rekap harian sebagai PDF'
                }
                className="px-3 py-2 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileDown className={`w-3.5 h-3.5 ${isPreparing ? 'animate-pulse' : ''}`} />
                <span>{isPreparing ? 'Menyiapkan…' : 'Unduh PDF'}</span>
              </button>
            </div>
          }
        />

        {/* Ringkasan Cepat Harian */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-medium text-slate-600">Total Jadwal</span>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{totalSlots} JP</p>
            <span className="text-xs text-slate-600">Slot terjadwal hari ini</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-medium text-emerald-600">Terealisasi</span>
            <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{completedSlots} JP</p>
            <span className="text-xs text-slate-600">{realizeRate.toFixed(0)}% terlaksana</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-medium text-amber-600">Badal (Pengganti)</span>
            <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">{badalSlots} JP</p>
            <span className="text-xs text-slate-600">Digantikan guru lain</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-medium text-rose-600">Belum Terealisasi</span>
            <p className="text-xl sm:text-2xl font-bold text-rose-700 mt-1">{missingSlots} JP</p>
            <span className="text-xs text-slate-600">Agenda belum diisi</span>
          </div>
        </div>

        {/* Agenda di luar jadwal: tetap terlihat, tapi tidak dihitung sebagai JP */}
        {unscheduledCount > 0 && (
          <div className="flex items-start gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
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
                  className="text-xs font-bold text-slate-800 bg-transparent cursor-pointer"
                />
              </div>

              <select
                value={selectedAYId}
                onChange={(e) => setSelectedAYId(e.target.value)}
                title="Tahun ajaran"
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-bold"
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
                {kelasLabels.map((k) => (
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

        {/* K-11: state error eksplisit — unduhan otomatis terblokir karena
            `canExport` pada useReportPdf bernilai false saat `loadError` ada. */}
        {loadError ? (
          <div className="bg-white rounded-xl border border-rose-200 shadow-2xs">
            <ErrorState
              title="Gagal memuat rekap harian"
              message={loadError}
              onRetry={fetchReport}
            />
          </div>
        ) : (
          <DataTable
            title={`Daftar Jadwal & Agenda • ${formatDateLong(selectedDate)}`}
            subtitle={`Menampilkan ${filteredItems.length} slot pembelajaran`}
            columns={columns}
            data={filteredItems}
            keyExtractor={(item, idx) => item.id + idx}
            isLoading={isLoading}
            emptyTitle="Tidak ada jadwal atau agenda"
            emptyDescription="Tidak ada jadwal atau agenda yang ditemukan untuk filter ini."
            onRowClick={(item) => setActiveItemForDetail(item)}
          />
        )}
      </div>

      {/* Dokumen cetak dihasilkan mesin PDF terprogram dari `printModel` —
          bukan dari DOM. Jadi tidak ada tabel cetak tersembunyi di sini yang
          bisa membawa kolom/foto layar ke kertas (K-13/K-14), dan orientasi
          serta lebar kolom ditentukan model, bukan CSS halaman (K-15). */}

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
