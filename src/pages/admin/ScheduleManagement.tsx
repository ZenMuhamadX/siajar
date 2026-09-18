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
import {
  Plus,
  Filter,
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

interface ScheduleManagementProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onNavigateTab?: (tab: string) => void;
}

type ViewMode = 'day' | 'teacher' | 'class' | 'list';

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({ showToast }) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [subjects, setSubjects] = useState<MataPelajaran[]>([]);
  const [periodTemplates, setPeriodTemplates] = useState<PeriodTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Default mode per request: Per Hari
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

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
          teacher_name: formData.teacher_name,
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
          teacher_name: formData.teacher_name,
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
      showToast('success', `Status jadwal diubah menjadi ${nextStatus}.`);
      const updated = await getSchedules({ academicYearId: selectedAYId });
      setSchedules(updated);
    } catch (err: any) {
      showToast('error', 'Gagal mengubah status: ' + (err?.message || ''));
    }
  };

  // Delete
  const handleDelete = async (item: ScheduleItem) => {
    if (
      confirm(
        `Hapus jadwal ${item.class_id} - ${item.subject_name} (${item.teacher_name})?`
      )
    ) {
      try {
        await deleteSchedule(item.id);
        showToast('info', 'Jadwal dihapus.');
        const updated = await getSchedules({ academicYearId: selectedAYId });
        setSchedules(updated);
      } catch (err: any) {
        showToast('error', 'Gagal menghapus jadwal: ' + (err?.message || ''));
      }
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

  const filteredSchedules = schedules.filter((s) => {
    if (filterDay !== 'ALL' && s.day !== filterDay) return false;
    if (filterTeacher !== 'ALL' && s.teacher_name !== filterTeacher) return false;
    if (filterClass !== 'ALL' && s.class_id !== filterClass) return false;
    if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Consistent Page Header */}
      <PageHeader
        title="Jadwal Pembelajaran"
        description="Kelola jadwal pelajaran mingguan, penugasan guru, dan slot jam pelajaran."
        action={
          <div className="flex items-center gap-2">
            {/* <button
              onClick={handleSeedReference}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              title="Generate Jadwal Referensi 2026/2027"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Seed 2026/2027</span>
            </button> */}

            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal</span>
            </button>
          </div>
        }
      />

      {/* Modern Compact Toolbar & Filters */}
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: View Mode Tabs */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-lg text-xs gap-1 self-start">
          {/* <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'day'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Per Hari</span>
          </button> */}

          <button
            onClick={() => setViewMode('teacher')}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'teacher'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Per Guru</span>
          </button>

          <button
            onClick={() => setViewMode('class')}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'class'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Per Kelas</span>
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Daftar</span>
          </button>
        </div>

        {/* Right: Filters & TA Context */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Subtle TA indicator */}
          <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-md text-[11px] font-medium text-slate-600 border border-slate-200">
            <span>TA:</span>
            <select
              value={selectedAYId}
              onChange={(e) => handleAYChange(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.status === 'ACTIVE' ? '(Aktif)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
            <Filter className="w-3 h-3" />
          </div>

          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden"
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
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden"
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
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden max-w-[140px] truncate"
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
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          <button
            onClick={() => loadData()}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mode 1: PER HARI (DEFAULT)
      {viewMode === 'day' && (
        <div className="space-y-5">
          {SCHEDULE_DAYS.filter((d) => filterDay === 'ALL' || d.key === filterDay).map((dayObj) => {
            const daySchedules = filteredSchedules.filter((s) => s.day === dayObj.key);

            return (
              <div key={dayObj.key} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                      {dayObj.label}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {daySchedules.length} slot jadwal
                  </span>
                </div>

                <div className="p-4 sm:p-5">
                  {daySchedules.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center">
                      Belum ada jadwal untuk hari {dayObj.label}.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {daySchedules.map((slot) => {
                        const isActive = slot.status === 'ACTIVE';
                        return (
                          <div
                            key={slot.id}
                            className="bg-white rounded-lg border border-slate-200/90 hover:border-slate-300 p-3.5 flex flex-col justify-between space-y-2.5 transition shadow-2xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {slot.start_time.slice(0, 5)} — {slot.end_time.slice(0, 5)}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                  JP {slot.period_number}
                                </span>
                              </div>

                              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 pt-0.5">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>{slot.subject_name}</span>
                              </h4>

                              <div className="flex items-center justify-between text-xs pt-1">
                                <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                  {slot.class_id}
                                </span>
                                <span className="text-slate-600 text-[11px] truncate max-w-[130px]" title={slot.teacher_name}>
                                  {slot.teacher_name}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {slot.status}
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEdit(slot)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 transition"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(slot)}
                                  className="p-1 text-slate-400 hover:text-rose-600 transition"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )} */}

      {/* Mode 2: PER GURU */}
      {viewMode === 'teacher' && (
        <div className="space-y-4">
          {teachers
            .filter((t) => filterTeacher === 'ALL' || t.nama_guru === filterTeacher)
            .map((guru) => {
              const teacherSchedules = filteredSchedules.filter(
                (s) => s.teacher_name === guru.nama_guru
              );

              return (
                <div
                  key={guru.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        {guru.nama_guru.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {guru.nama_guru}
                        </h3>
                        <p className="text-[11px] text-slate-400">Guru Pengampu</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {teacherSchedules.length} slot jadwal
                    </span>
                  </div>

                  {teacherSchedules.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      Belum ada jadwal mengajar pada filter ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {teacherSchedules.map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 text-xs flex justify-between items-start"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-indigo-700">
                                {DAY_TRANSLATION_MAP[slot.day]}
                              </span>
                              <span className="text-slate-300">&bull;</span>
                              <span className="font-mono text-[11px] text-slate-600">
                                {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                              </span>
                            </div>
                            <p className="font-bold text-slate-900 pt-0.5">
                              {slot.class_id} — {slot.subject_name}
                            </p>
                            <span className="text-[10px] text-slate-500">
                              JP {slot.period_number}
                            </span>
                          </div>

                          <button
                            onClick={() => handleOpenEdit(slot)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Mode 3: PER KELAS */}
      {viewMode === 'class' && (
        <div className="space-y-4">
          {DAFTAR_KELAS.filter(
            (c) => filterClass === 'ALL' || c === filterClass
          ).map((kelas) => {
            const classSchedules = filteredSchedules.filter((s) => s.class_id === kelas);

            return (
              <div
                key={kelas}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {kelas}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {classSchedules.length} slot pembelajaran
                  </span>
                </div>

                {classSchedules.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Belum ada jadwal aktif untuk {kelas}.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {classSchedules.map((slot) => (
                      <div
                        key={slot.id}
                        className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 text-xs flex justify-between items-start"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-indigo-700">
                              {DAY_TRANSLATION_MAP[slot.day]}
                            </span>
                            <span className="text-slate-300">&bull;</span>
                            <span className="font-mono text-[11px] text-slate-600">
                              {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 pt-0.5">
                            {slot.subject_name}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            Guru: <span className="font-medium text-slate-800">{slot.teacher_name}</span>
                          </p>
                          <span className="text-[10px] text-slate-400">
                            JP {slot.period_number}
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenEdit(slot)}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mode 4: DAFTAR TABEL */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Hari</th>
                  <th className="px-3 py-3">Jam</th>
                  <th className="px-3 py-3">JP</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Mata Pelajaran</th>
                  <th className="px-4 py-3">Guru Pengampu</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                      Memuat data jadwal...
                    </td>
                  </tr>
                ) : filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                      Tidak ada jadwal yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((item) => {
                    const isActive = item.status === 'ACTIVE';
                    const isDraft = item.status === 'DRAFT';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-2.5 font-semibold text-slate-800">
                          {DAY_TRANSLATION_MAP[item.day]}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-indigo-700">
                          JP {item.period_number}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          {item.class_id}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 font-medium">
                          {item.subject_name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {item.teacher_name}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : isDraft
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(item)}
                            className={`p-1 rounded transition text-xs ${
                              isActive
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={isActive ? 'Arsipkan Jadwal' : 'Aktifkan Jadwal'}
                          >
                            {isActive ? (
                              <Archive className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Edit Jadwal"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Hapus Jadwal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                        <div className="px-2.5 py-2 text-xs bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                          Belum ada JP. Konfigurasi di <span className="font-semibold">Slot Waktu</span>.
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
    </div>
  );
};
