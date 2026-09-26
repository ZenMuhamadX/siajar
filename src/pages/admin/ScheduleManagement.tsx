import React, { useState, useEffect } from 'react';
import {
  type AcademicYear,
  type ScheduleItem,
  type ScheduleDay,
  type ScheduleStatus,
  type PeriodTemplate,
  SCHEDULE_DAYS,
  DAY_TRANSLATION_MAP,
  DAFTAR_KELAS,
  type Guru,
  type MataPelajaran,
} from '../../types';
import {
  getAcademicYears,
  getSchedules,
  createSchedule,
  updateSchedule,
  setScheduleStatus,
  deleteSchedule,
} from '../../services/scheduleService';
import { getPeriodTemplates } from '../../services/periodTemplateService';
import { getDaftarGuru, getDaftarMapel } from '../../services/agendaService';
import { PageHeader } from '../../components/admin/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Archive,
  Edit2,
  Trash2,
  Users,
  Building2,
  List,
  AlertTriangle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import {
  DataTable,
  StatusBadge,
  FilterBar,
  type Column,
} from '../../components/common';

interface ScheduleManagementProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onNavigateTab?: (tab: string) => void;
}

type ViewMode = 'day' | 'teacher' | 'class' | 'list';

/** Label Indonesia untuk status (konsisten dengan StatusBadge). */
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktif',
  DRAFT: 'Draft',
  ARCHIVED: 'Diarsipkan',
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

/** Tab mode tampilan: "Daftar" jadi default karena paling cepat dipindai & di-sort. */
const VIEW_TABS: {
  mode: ViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { mode: 'list', label: 'Daftar', icon: List },
  { mode: 'day', label: 'Per Hari', icon: CalendarDays },
  { mode: 'teacher', label: 'Per Guru', icon: Users },
  { mode: 'class', label: 'Per Kelas', icon: Building2 },
];

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({
  showToast,
  onNavigateTab,
}) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [subjects, setSubjects] = useState<MataPelajaran[]>([]);
  const [periodTemplates, setPeriodTemplates] = useState<PeriodTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Default mode: Daftar (satu tabel flat, paling cepat dipindai & di-sort)
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Selected JP template for the form
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    day: 'MONDAY' as ScheduleDay,
    period_number: 1,
    start_time: '07:30',
    end_time: '08:05',
    class_id: 'KELAS 1',
    subject_name: '',
    teacher_name: '',
    status: 'ACTIVE' as ScheduleStatus,
  });
  const [formConflictError, setFormConflictError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Dialog hapus (menggantikan confirm() bawaan browser)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load masters & initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ayList, gList, mList] = await Promise.all([
        getAcademicYears(),
        getDaftarGuru(),
        getDaftarMapel(),
      ]);

      setAcademicYears(ayList);
      setTeachers(gList);
      setSubjects(mList);

      // Default to active academic year
      let currentAYId = selectedAYId;
      if (!currentAYId || !ayList.some((y) => y.id === currentAYId)) {
        const activeAY = ayList.find((y) => y.status === 'ACTIVE') || ayList[0];
        if (activeAY) {
          currentAYId = activeAY.id;
          setSelectedAYId(currentAYId);
        }
      }

      if (currentAYId) {
        const [schList, ptList] = await Promise.all([
          getSchedules({ academicYearId: currentAYId }),
          getPeriodTemplates(currentAYId, true),
        ]);
        setSchedules(schList);
        setPeriodTemplates(ptList);
      } else {
        setSchedules([]);
        setPeriodTemplates([]);
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Gagal memuat data jadwal: ' + (err?.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAYChange = async (ayId: string) => {
    setSelectedAYId(ayId);
    setIsLoading(true);
    try {
      const [schList, ptList] = await Promise.all([
        getSchedules({ academicYearId: ayId }),
        getPeriodTemplates(ayId, true),
      ]);
      setSchedules(schList);
      setPeriodTemplates(ptList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    if (!selectedAYId) {
      showToast('error', 'Pilih atau buat Tahun Ajaran di menu Pengaturan > Tahun Ajaran.');
      return;
    }
    setEditingItem(null);
    setFormConflictError('');
    // Pre-select first active JP if available
    const firstPT = periodTemplates[0] ?? null;
    setSelectedTemplateId(firstPT?.id ?? '');
    setFormData({
      day: 'MONDAY',
      period_number: firstPT?.period_number ?? 1,
      start_time: firstPT?.start_time.slice(0, 5) ?? '07:30',
      end_time: firstPT?.end_time.slice(0, 5) ?? '08:05',
      class_id: DAFTAR_KELAS[0] || 'KELAS 1',
      subject_name: '',
      teacher_name: '',
      status: 'ACTIVE',
    });
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormConflictError('');
    // Try to match existing period_number to a template
    const matchedPT = periodTemplates.find((pt) => pt.period_number === item.period_number) ?? null;
    setSelectedTemplateId(matchedPT?.id ?? '');
    setFormData({
      day: item.day,
      period_number: item.period_number,
      start_time: item.start_time.slice(0, 5),
      end_time: item.end_time.slice(0, 5),
      class_id: item.class_id,
      subject_name: item.subject_name,
      teacher_name: item.teacher_name,
      status: item.status,
    });
    setIsEditModalOpen(true);
  };

  // Save Schedule
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormConflictError('');

    if (!formData.subject_name) {
      setFormConflictError('Pilih Mata Pelajaran terlebih dahulu.');
      return;
    }
    if (!formData.teacher_name) {
      setFormConflictError('Pilih Guru terlebih dahulu.');
      return;
    }
    if (periodTemplates.length > 0 && !selectedTemplateId) {
      setFormConflictError('Pilih Jam Pelajaran (JP) terlebih dahulu.');
      return;
    }
    if (formData.start_time >= formData.end_time) {
      setFormConflictError('Jam mulai harus lebih awal dari jam selesai.');
      return;
    }

    // RLS relies on schedule.teacher_id / subject_id, not the name text.
    // Resolve the master row so the ID is always stored.
    const selectedTeacher = teachers.find((t) => t.nama_guru === formData.teacher_name);
    const selectedSubject = subjects.find((m) => m.nama_mapel === formData.subject_name);

    if (!selectedTeacher) {
      setFormConflictError(
        'Guru tidak ditemukan di master data. Muat ulang halaman lalu coba lagi.'
      );
      return;
    }
    if (!selectedSubject) {
      setFormConflictError(
        'Mata pelajaran tidak ditemukan di master data. Muat ulang halaman lalu coba lagi.'
      );
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        await updateSchedule(editingItem.id, {
          academic_year_id: selectedAYId,
          day: formData.day,
          period_number: Number(formData.period_number),
          start_time: formData.start_time,
          end_time: formData.end_time,
          class_id: formData.class_id,
          subject_name: formData.subject_name,
          subject_id: selectedSubject.id,
          teacher_name: formData.teacher_name,
          teacher_id: selectedTeacher.id,
          status: formData.status,
          ...(selectedTemplateId ? { period_template_id: selectedTemplateId } : {}),
        });
        showToast('success', 'Jadwal berhasil diperbarui.');
      } else {
        await createSchedule({
          academic_year_id: selectedAYId,
          day: formData.day,
          period_number: Number(formData.period_number),
          start_time: formData.start_time,
          end_time: formData.end_time,
          class_id: formData.class_id,
          subject_name: formData.subject_name,
          subject_id: selectedSubject.id,
          teacher_name: formData.teacher_name,
          teacher_id: selectedTeacher.id,
          status: formData.status,
          activity_type: 'KBM',
          ...(selectedTemplateId ? { period_template_id: selectedTemplateId } : {}),
        });
        showToast('success', 'Jadwal baru berhasil dibuat.');
      }

      setIsEditModalOpen(false);
      const updated = await getSchedules({ academicYearId: selectedAYId });
      setSchedules(updated);
    } catch (err: any) {
      setFormConflictError(err?.message || 'Gagal menyimpan jadwal.');
    } finally {
      setIsSaving(false);
    }
  };

  // Status toggle
  const handleToggleStatus = async (item: ScheduleItem) => {
    const nextStatus: ScheduleStatus =
      item.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    try {
      await setScheduleStatus(item.id, nextStatus);
      showToast('success', `Status jadwal diubah menjadi ${statusLabel(nextStatus)}.`);
      const updated = await getSchedules({ academicYearId: selectedAYId });
      setSchedules(updated);
    } catch (err: any) {
      showToast('error', 'Gagal mengubah status: ' + (err?.message || ''));
    }
  };

  // Delete (buka dialog konfirmasi)
  const handleDelete = (item: ScheduleItem) => {
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSchedule(deleteTarget.id);
      showToast('info', 'Jadwal dihapus.');
      setDeleteTarget(null);
      const updated = await getSchedules({ academicYearId: selectedAYId });
      setSchedules(updated);
    } catch (err: any) {
      showToast('error', 'Gagal menghapus jadwal: ' + (err?.message || ''));
    } finally {
      setIsDeleting(false);
    }
  };

  // // Seed reference
  // const handleSeedReference = async () => {
  //   if (
  //     confirm(
  //       'Generate jadwal referensi otomatis 2026/2027 untuk seluruh kelas? Jadwal yang sudah ada tidak akan diduplikasi.'
  //     )
  //   ) {
  //     try {
  //       setIsLoading(true);
  //       const res = await seedAcademicYearAndReferenceSchedule(
  //         teachers.map((t) => t.nama_guru),
  //         selectedAYId
  //       );
  //       showToast(
  //         'success',
  //         `Sukses mengenerate ${res.createdCount} slot jadwal referensi 2026/2027!`
  //       );
  //       await loadData();
  //     } catch (err: any) {
  //       showToast('error', 'Gagal generate referensi: ' + (err?.message || ''));
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   }
  // };

  const DAY_ORDER: Record<string, number> = {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
  };

  const isFiltered =
    filterDay !== 'ALL' ||
    filterTeacher !== 'ALL' ||
    filterClass !== 'ALL' ||
    filterStatus !== 'ALL' ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setFilterDay('ALL');
    setFilterTeacher('ALL');
    setFilterClass('ALL');
    setFilterStatus('ALL');
    setSearchQuery('');
  };

  const filteredSchedules = schedules
    .filter((s) => {
      if (filterDay !== 'ALL' && s.day !== filterDay) return false;
      if (filterTeacher !== 'ALL' && s.teacher_name !== filterTeacher) return false;
      if (filterClass !== 'ALL' && s.class_id !== filterClass) return false;
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSubj = s.subject_name.toLowerCase().includes(q);
        const matchTeach = s.teacher_name.toLowerCase().includes(q);
        const matchClass = s.class_id.toLowerCase().includes(q);
        if (!matchSubj && !matchTeach && !matchClass) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
      if (dayDiff !== 0) return dayDiff;
      if (a.period_number !== b.period_number) return a.period_number - b.period_number;
      const timeDiff = a.start_time.localeCompare(b.start_time);
      if (timeDiff !== 0) return timeDiff;
      return a.class_id.localeCompare(b.class_id);
    });

  // KPI mengikuti filter yang sedang aktif, supaya angka == baris yang terlihat
  const kpiSource = isFiltered ? filteredSchedules : schedules;
  const activeCount = kpiSource.filter((s) => s.status === 'ACTIVE').length;
  const draftOrArchiveCount = kpiSource.length - activeCount;
  const uniqueTeachersCount = new Set(kpiSource.map((s) => s.teacher_name)).size;

  // ── Cell renderers: satu sumber untuk SEMUA mode tampilan ──
  const cellDay = (item: ScheduleItem) => (
    <span className="font-semibold text-slate-800">{DAY_TRANSLATION_MAP[item.day]}</span>
  );
  const cellTime = (item: ScheduleItem) => (
    <span className="font-mono text-[11px] text-slate-600 whitespace-nowrap">
      {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}
    </span>
  );
  const cellPeriod = (item: ScheduleItem) => (
    <span className="font-bold text-slate-700">{item.period_number}</span>
  );
  const cellClass = (item: ScheduleItem) => (
    <span className="font-bold text-slate-900">{item.class_id}</span>
  );
  const cellSubject = (item: ScheduleItem) => (
    <span className="font-semibold text-slate-900">{item.subject_name}</span>
  );
  const cellTeacher = (item: ScheduleItem) => (
    <span className="text-slate-700">{item.teacher_name}</span>
  );
  const cellStatus = (item: ScheduleItem) => <StatusBadge status={item.status} />;
  const cellActions = (item: ScheduleItem) => {
    const isActive = item.status === 'ACTIVE';
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => handleToggleStatus(item)}
          className={`p-1.5 rounded-md transition ${
            isActive
              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
          }`}
          title={isActive ? 'Arsipkan Jadwal' : 'Aktifkan Jadwal'}
        >
          {isActive ? <Archive className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => handleOpenEdit(item)}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
          title="Edit Jadwal"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleDelete(item)}
          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
          title="Hapus Jadwal"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const COL_DAY: Column<ScheduleItem> = {
    key: 'day',
    header: 'Hari',
    align: 'left',
    width: '110px',
    accessor: cellDay,
  };
  const COL_TIME: Column<ScheduleItem> = {
    key: 'time',
    header: 'Waktu',
    align: 'left',
    width: '130px',
    accessor: cellTime,
  };
  const COL_PERIOD: Column<ScheduleItem> = {
    key: 'period_number',
    header: 'JP',
    align: 'center',
    width: '60px',
    accessor: cellPeriod,
  };
  const COL_CLASS: Column<ScheduleItem> = {
    key: 'class_id',
    header: 'Kelas',
    align: 'center',
    width: '90px',
    accessor: cellClass,
  };
  const COL_SUBJECT: Column<ScheduleItem> = {
    key: 'subject_name',
    header: 'Mata Pelajaran',
    align: 'left',
    accessor: cellSubject,
  };
  const COL_TEACHER: Column<ScheduleItem> = {
    key: 'teacher_name',
    header: 'Guru Pengampu',
    align: 'left',
    accessor: cellTeacher,
  };
  const COL_STATUS: Column<ScheduleItem> = {
    key: 'status',
    header: 'Status',
    align: 'center',
    width: '110px',
    accessor: cellStatus,
  };
  const COL_ACTIONS: Column<ScheduleItem> = {
    key: 'actions',
    header: 'Aksi',
    align: 'right',
    width: '110px',
    accessor: cellActions,
  };

  const listColumns: Column<ScheduleItem>[] = [
    COL_DAY,
    COL_TIME,
    COL_PERIOD,
    COL_CLASS,
    COL_SUBJECT,
    COL_TEACHER,
    COL_STATUS,
    COL_ACTIONS,
  ];

  // Mode "Per Hari": Hari jadi judul grup, disembunyikan dari kolom
  const dayColumns: Column<ScheduleItem>[] = [
    COL_TIME,
    COL_PERIOD,
    COL_CLASS,
    COL_SUBJECT,
    COL_TEACHER,
    COL_STATUS,
    COL_ACTIONS,
  ];

  // Mode "Per Guru": Guru jadi judul grup
  const teacherColumns: Column<ScheduleItem>[] = [
    COL_DAY,
    COL_TIME,
    COL_PERIOD,
    COL_CLASS,
    COL_SUBJECT,
    COL_STATUS,
    COL_ACTIONS,
  ];

  // Mode "Per Kelas": Kelas jadi judul grup
  const classColumns: Column<ScheduleItem>[] = [
    COL_DAY,
    COL_TIME,
    COL_PERIOD,
    COL_SUBJECT,
    COL_TEACHER,
    COL_STATUS,
    COL_ACTIONS,
  ];

  const sharedTableProps = {
    isLoading,
    isFiltered,
    onResetFilter: handleResetFilters,
    emptyTitle: isFiltered
      ? 'Tidak ada jadwal yang sesuai filter'
      : 'Belum ada jadwal pelajaran',
    emptyDescription: isFiltered
      ? 'Coba ubah kata kunci atau filter, lalu reset bila perlu.'
      : 'Klik "Tambah Jadwal" untuk membuat slot jadwal mengajar.',
  };

  // Grup untuk tampilan berkelompok (mode Per Hari / Per Guru / Per Kelas)
  const dayGroups = SCHEDULE_DAYS.filter((d) => filterDay === 'ALL' || d.key === filterDay).map(
    (d) => ({
      key: d.key,
      label: d.label,
      rows: filteredSchedules.filter((s) => s.day === d.key),
    })
  );

  const teacherGroups = teachers
    .filter((t) => filterTeacher === 'ALL' || t.nama_guru === filterTeacher)
    .map((t) => ({
      key: t.id,
      label: t.nama_guru,
      initial: t.nama_guru.charAt(0).toUpperCase(),
      rows: filteredSchedules.filter((s) => s.teacher_name === t.nama_guru),
    }))
    .filter((g) => g.rows.length > 0);

  const classGroups = DAFTAR_KELAS.filter((c) => filterClass === 'ALL' || c === filterClass)
    .map((c) => ({
      key: c,
      label: c,
      rows: filteredSchedules.filter((s) => s.class_id === c),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-5">
      {/* Consistent Page Header */}
      <PageHeader
        title="Jadwal Pembelajaran"
        description="Kelola jadwal pelajaran mingguan, penugasan guru, dan slot jam pelajaran."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal</span>
            </button>
          </div>
        }
      />

      {/* Summary KPI Cards (mengikuti filter yang sedang aktif) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500">Total Slot Jadwal</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{kpiSource.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isFiltered ? `dari ${schedules.length} total` : 'seluruh tahun ajaran aktif'}
          </p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500">Jadwal Aktif</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500">Draft / Diarsipkan</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-600 mt-1">{draftOrArchiveCount}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500">Guru Terjadwal</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-700 mt-1">{uniqueTeachersCount}</p>
        </div>
      </div>

      {/* Modern Compact Toolbar & Filters */}
      <div className="space-y-3">
        {/* View Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs gap-1">
            {VIEW_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = viewMode === tab.mode;
              return (
                <button
                  key={tab.mode}
                  onClick={() => setViewMode(tab.mode)}
                  aria-pressed={isActive}
                  className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* TA Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-600 border border-slate-200">
              <span className="text-slate-400">TA:</span>
              <select
                value={selectedAYId}
                onChange={(e) => handleAYChange(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} {ay.status === 'ACTIVE' ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadData()}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Standardized FilterBar */}
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari mapel, guru, kelas..."
          isFiltered={isFiltered}
          onResetFilters={handleResetFilters}
          filters={
            <>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none"
              >
                <option value="ALL">Semua Hari</option>
                {SCHEDULE_DAYS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>

              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none"
              >
                <option value="ALL">Semua Kelas</option>
                {DAFTAR_KELAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none max-w-[140px] truncate"
              >
                <option value="ALL">Semua Guru</option>
                {teachers.map((g) => (
                  <option key={g.id} value={g.nama_guru}>
                    {g.nama_guru}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Diarsipkan</option>
              </select>
            </>
          }
        />
      </div>

      {/* Mode 1: PER HARI (grouped table) */}
      {viewMode === 'day' && (
        <div className="space-y-5">
          {filteredSchedules.length === 0 ? (
            <DataTable
              columns={dayColumns}
              data={[]}
              keyExtractor={(item) => item.id}
              {...sharedTableProps}
            />
          ) : (
            dayGroups.map((group) => (
              <DataTable
                key={group.key}
                title={group.label}
                subtitle={
                  group.rows.length > 0 ? `${group.rows.length} slot jadwal` : 'Belum ada jadwal'
                }
                titleIcon={<span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />}
                columns={dayColumns}
                data={group.rows}
                keyExtractor={(item) => item.id}
                isLoading={isLoading}
                isFiltered={isFiltered}
                onResetFilter={handleResetFilters}
                emptyTitle={`Belum ada jadwal hari ${group.label}`}
                emptyDescription={
                  isFiltered
                    ? 'Tidak ada jadwal hari ini yang sesuai filter.'
                    : 'Buat slot jadwal untuk hari ini lewat tombol "Tambah Jadwal".'
                }
              />
            ))
          )}
        </div>
      )}

      {/* Mode 2: PER GURU (grouped table) */}
      {viewMode === 'teacher' && (
        <div className="space-y-4">
          {teacherGroups.length === 0 ? (
            <DataTable
              columns={teacherColumns}
              data={[]}
              keyExtractor={(item) => item.id}
              {...sharedTableProps}
            />
          ) : (
            teacherGroups.map((group) => (
              <DataTable
                key={group.key}
                title={group.label}
                subtitle={`${group.rows.length} slot jadwal`}
                titleIcon={
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {group.initial}
                  </span>
                }
                columns={teacherColumns}
                data={group.rows}
                keyExtractor={(item) => item.id}
                isLoading={isLoading}
              />
            ))
          )}
        </div>
      )}

      {/* Mode 3: PER KELAS (grouped table) */}
      {viewMode === 'class' && (
        <div className="space-y-4">
          {classGroups.length === 0 ? (
            <DataTable
              columns={classColumns}
              data={[]}
              keyExtractor={(item) => item.id}
              {...sharedTableProps}
            />
          ) : (
            classGroups.map((group) => (
              <DataTable
                key={group.key}
                title={group.label}
                subtitle={`${group.rows.length} slot pembelajaran`}
                titleIcon={
                  <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </span>
                }
                columns={classColumns}
                data={group.rows}
                keyExtractor={(item) => item.id}
                isLoading={isLoading}
              />
            ))
          )}
        </div>
      )}

      {/* Mode 4: DAFTAR (REUSABLE DATATABLE) */}
      {viewMode === 'list' && (
        <DataTable
          columns={listColumns}
          data={filteredSchedules}
          keyExtractor={(item) => item.id}
          {...sharedTableProps}
          headerRightContent={
            <span className="text-[11px] font-semibold text-slate-500">
              {filteredSchedules.length}
              {isFiltered ? ` dari ${schedules.length}` : ''} slot jadwal
            </span>
          }
          enablePagination={true}
          defaultPageSize={25}
        />
      )}


      {/* Create / Edit Schedule Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white">
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  {editingItem ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Baru'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {editingItem
                    ? 'Perbarui informasi slot jadwal pelajaran'
                    : 'Isi semua field untuk menambah slot jadwal'}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="overflow-y-auto">
              {formConflictError && (
                <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p>{formConflictError}</p>
                </div>
              )}

              <div className="p-5 space-y-5">

                {/* ── Section 1: Waktu & Jadwal ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                      Waktu &amp; Jadwal
                    </span>
                    <div className="flex-1 h-px bg-indigo-100" />
                  </div>

                  {/* Hari + JP Selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Hari
                      </label>
                      <select
                        value={formData.day}
                        onChange={(e) =>
                          setFormData({ ...formData, day: e.target.value as ScheduleDay })
                        }
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      >
                        {SCHEDULE_DAYS.map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Jam Pelajaran (JP)
                      </label>
                      {periodTemplates.length === 0 ? (
                        <div className="px-2.5 py-2 text-xs bg-amber-50 border border-amber-200 rounded-lg text-amber-700 space-y-2">
                          <p>Belum ada JP. Konfigurasi dulu di menu Slot Waktu (JP).</p>
                          <button
                            type="button"
                            onClick={() => onNavigateTab?.('slot_waktu')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-md transition"
                          >
                            <Clock className="w-3 h-3" />
                            <span>Buka Slot Waktu (JP)</span>
                          </button>
                        </div>
                      ) : (
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => {
                            const pt = periodTemplates.find((t) => t.id === e.target.value);
                            setSelectedTemplateId(e.target.value);
                            if (pt) {
                              setFormData((f) => ({
                                ...f,
                                period_number: pt.period_number,
                                start_time: pt.start_time.slice(0, 5),
                                end_time: pt.end_time.slice(0, 5),
                              }));
                            }
                          }}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        >
                          <option value="">-- Pilih JP --</option>
                          {periodTemplates.map((pt) => (
                            <option key={pt.id} value={pt.id}>
                              {pt.label} · {pt.start_time.slice(0, 5)}–{pt.end_time.slice(0, 5)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Time preview read-only */}
                  {selectedTemplateId && formData.start_time && formData.end_time && (
                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Waktu:{' '}
                        <strong>
                          {formData.start_time} – {formData.end_time}
                        </strong>
                        <span className="text-indigo-400 ml-2">(dari Master JP)</span>
                      </span>
                    </div>
                  )}
                </div>


                {/* ── Section 2: Kelas & Mata Pelajaran ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                      Kelas &amp; Mata Pelajaran
                    </span>
                    <div className="flex-1 h-px bg-indigo-100" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Kelas
                      </label>
                      <select
                        value={formData.class_id}
                        onChange={(e) =>
                          setFormData({ ...formData, class_id: e.target.value })
                        }
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      >
                        {DAFTAR_KELAS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Mata Pelajaran
                      </label>
                      <select
                        value={formData.subject_name}
                        onChange={(e) =>
                          setFormData({ ...formData, subject_name: e.target.value })
                        }
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      >
                        <option value="">-- Pilih Mapel --</option>
                        {subjects.map((m) => (
                          <option key={m.id} value={m.nama_mapel}>
                            {m.nama_mapel}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Guru Pengampu ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                      Guru Pengampu
                    </span>
                    <div className="flex-1 h-px bg-indigo-100" />
                  </div>

                  <select
                    value={formData.teacher_name}
                    onChange={(e) =>
                      setFormData({ ...formData, teacher_name: e.target.value })
                    }
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="">-- Pilih Guru --</option>
                    {teachers.map((g) => (
                      <option key={g.id} value={g.nama_guru}>
                        {g.nama_guru}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-slate-500">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as ScheduleStatus,
                      })
                    }
                    className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-hidden"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Aktif</option>
                    <option value="ARCHIVED">Arsip</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition shadow-xs"
                  >
                    {isSaving ? 'Menyimpan...' : editingItem ? 'Perbarui' : 'Simpan Jadwal'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog konfirmasi hapus jadwal */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Hapus jadwal ini?"
        message={
          deleteTarget
            ? `Jadwal ${deleteTarget.class_id} — ${deleteTarget.subject_name} (${deleteTarget.teacher_name}) akan dihapus permanen.`
            : ''
        }
        confirmText="Hapus"
      />
    </div>
  );
};
