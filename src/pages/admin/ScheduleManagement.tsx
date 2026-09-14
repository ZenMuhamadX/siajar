import React, { useState, useEffect } from 'react';
import {
  type AcademicYear,
  type ScheduleItem,
  type ScheduleDay,
  type ScheduleStatus,
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
  seedAcademicYearAndReferenceSchedule,
} from '../../services/scheduleService';
import { getDaftarGuru, getDaftarMapel } from '../../services/agendaService';
import { AcademicYearModal } from './AcademicYearModal';
import {
  Calendar,
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
  Sparkles,
} from 'lucide-react';

interface ScheduleManagementProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type ViewMode = 'list' | 'teacher' | 'class';

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({ showToast }) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [subjects, setSubjects] = useState<MataPelajaran[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals
  const [isAYModalOpen, setIsAYModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    day: 'MONDAY' as ScheduleDay,
    period_number: 1,
    start_time: '07:30',
    end_time: '08:05',
    class_id: 'KELAS 1',
    subject_name: 'Matematika',
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

      // Default to active academic year or first
      let currentAYId = selectedAYId;
      if (!currentAYId || !ayList.some((y) => y.id === currentAYId)) {
        const activeAY = ayList.find((y) => y.status === 'ACTIVE') || ayList[0];
        if (activeAY) {
          currentAYId = activeAY.id;
          setSelectedAYId(currentAYId);
        }
      }

      if (currentAYId) {
        const schList = await getSchedules({ academicYearId: currentAYId });
        setSchedules(schList);
      } else {
        setSchedules([]);
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

  // When academic year changes
  const handleAYChange = async (ayId: string) => {
    setSelectedAYId(ayId);
    setIsLoading(true);
    try {
      const schList = await getSchedules({ academicYearId: ayId });
      setSchedules(schList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    if (!selectedAYId) {
      showToast('error', 'Pilih atau buat Tahun Ajaran terlebih dahulu.');
      return;
    }
    setEditingItem(null);
    setFormConflictError('');
    setFormData({
      day: 'MONDAY',
      period_number: 1,
      start_time: '07:30',
      end_time: '08:05',
      class_id: DAFTAR_KELAS[0] || 'KELAS 1',
      subject_name: subjects[0]?.nama_mapel || 'Matematika',
      teacher_name: teachers[0]?.nama_guru || '',
      status: 'ACTIVE',
    });
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormConflictError('');
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

  // Save Schedule (Create / Update)
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormConflictError('');

    if (!formData.teacher_name) {
      setFormConflictError('Pilih Guru terlebih dahulu.');
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

  // Activate / Publish
  const handleToggleStatus = async (item: ScheduleItem) => {
    const nextStatus: ScheduleStatus =
      item.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    try {
      await setScheduleStatus(item.id, nextStatus);
      showToast(
        'success',
        `Status jadwal diubah menjadi ${nextStatus}.`
      );
      const updated = await getSchedules({ academicYearId: selectedAYId });
      setSchedules(updated);
    } catch (err: any) {
      showToast('error', 'Gagal mengubah status: ' + (err?.message || ''));
    }
  };

  // Delete / Archive
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

  // Bootstrap reference data 2026/2027
  const handleSeedReference = async () => {
    if (
      confirm(
        'Generate jadwal referensi otomatis 2026/2027 untuk seluruh kelas? Jadwal yang sudah ada tidak akan diduplikasi.'
      )
    ) {
      try {
        setIsLoading(true);
        const res = await seedAcademicYearAndReferenceSchedule(
          teachers.map((t) => t.nama_guru),
          selectedAYId
        );
        showToast(
          'success',
          `Sukses mengenerate ${res.createdCount} slot jadwal referensi 2026/2027!`
        );
        await loadData();
      } catch (err: any) {
        showToast('error', 'Gagal generate referensi: ' + (err?.message || ''));
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Filtered schedules for List View
  const filteredSchedules = schedules.filter((s) => {
    if (filterDay !== 'ALL' && s.day !== filterDay) return false;
    if (filterTeacher !== 'ALL' && s.teacher_name !== filterTeacher) return false;
    if (filterClass !== 'ALL' && s.class_id !== filterClass) return false;
    if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
    return true;
  });

  const activeAY = academicYears.find((y) => y.id === selectedAYId);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Bar: Academic Year Selector & Action Buttons */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-purple-50 text-purple-800 px-3 py-1.5 rounded-lg border border-purple-200 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-purple-600" />
            <span>Tahun Ajaran:</span>
            <select
              value={selectedAYId}
              onChange={(e) => handleAYChange(e.target.value)}
              className="bg-transparent font-bold text-purple-950 focus:outline-hidden cursor-pointer"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} ({ay.status})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsAYModalOpen(true)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Kelola TA
          </button>

          {activeAY?.status === 'ACTIVE' && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
              ACTIVE
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={handleSeedReference}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
            title="Generate Jadwal Referensi 2026/2027"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Seed Jadwal 2026/2027</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {/* View Switcher & Filters */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Mode Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs gap-1 self-start">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Daftar Tabel</span>
          </button>

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
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-slate-500 text-[11px] font-semibold">
            <Filter className="w-3 h-3" />
            <span>Filter:</span>
          </div>

          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-slate-700 text-xs focus:outline-hidden"
          >
            <option value="ALL">Semua Hari</option>
            {SCHEDULE_DAYS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>

          {viewMode === 'list' && (
            <>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-slate-700 text-xs focus:outline-hidden"
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
                className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-slate-700 text-xs focus:outline-hidden max-w-[150px] truncate"
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
                className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-slate-700 text-xs focus:outline-hidden"
              >
                <option value="ALL">Semua Status</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </>
          )}

          <button
            onClick={() => loadData()}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main View Render */}
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
                        <td className="px-3 py-2.5 font-semibold text-purple-700">
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
                        <td className="px-4 py-2.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(item)}
                            className={`p-1 rounded transition text-xs font-semibold ${
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
                            className="p-1 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded transition"
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

      {/* Teacher Grid View */}
      {viewMode === 'teacher' && (
        <div className="space-y-4">
          {teachers
            .filter((t) => filterTeacher === 'ALL' || t.nama_guru === filterTeacher)
            .map((guru) => {
              const teacherSchedules = schedules.filter(
                (s) =>
                  s.teacher_name === guru.nama_guru &&
                  (filterDay === 'ALL' || s.day === filterDay) &&
                  s.status !== 'ARCHIVED'
              );

              return (
                <div
                  key={guru.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                        {guru.nama_guru.charAt(0)}
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {guru.nama_guru}
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {teacherSchedules.length} slot jadwal mengajar
                    </span>
                  </div>

                  {teacherSchedules.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      Belum ada jadwal mengajar aktif pada filter ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {teacherSchedules.map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs flex justify-between items-start"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-purple-700">
                                {DAY_TRANSLATION_MAP[slot.day]}
                              </span>
                              <span className="text-slate-400">&bull;</span>
                              <span className="font-mono text-[11px] text-slate-600">
                                {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                              </span>
                            </div>
                            <p className="font-bold text-slate-800">
                              {slot.class_id} — {slot.subject_name}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              JP {slot.period_number}
                            </span>
                          </div>

                          <button
                            onClick={() => handleOpenEdit(slot)}
                            className="p-1 text-slate-400 hover:text-purple-600 transition"
                          >
                            <Edit2 className="w-3 h-3" />
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

      {/* Class Grid View */}
      {viewMode === 'class' && (
        <div className="space-y-4">
          {DAFTAR_KELAS.filter(
            (c) => filterClass === 'ALL' || c === filterClass
          ).map((kelas) => {
            const classSchedules = schedules.filter(
              (s) =>
                s.class_id === kelas &&
                (filterDay === 'ALL' || s.day === filterDay) &&
                s.status !== 'ARCHIVED'
            );

            return (
              <div
                key={kelas}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {kelas}
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {classSchedules.length} slot pembelajaran
                  </span>
                </div>

                {classSchedules.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Belum ada jadwal kelas aktif pada filter ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {classSchedules.map((slot) => (
                      <div
                        key={slot.id}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs flex justify-between items-start"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-purple-700">
                              {DAY_TRANSLATION_MAP[slot.day]}
                            </span>
                            <span className="text-slate-400">&bull;</span>
                            <span className="font-mono text-[11px] text-slate-600">
                              {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            </span>
                          </div>
                          <p className="font-bold text-slate-800">
                            {slot.subject_name}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            Guru: <span className="font-medium text-slate-800">{slot.teacher_name}</span>
                          </p>
                          <span className="text-[10px] text-purple-600 font-semibold">
                            JP {slot.period_number}
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenEdit(slot)}
                          className="p-1 text-slate-400 hover:text-purple-600 transition"
                        >
                          <Edit2 className="w-3 h-3" />
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

      {/* Academic Year Management Modal */}
      <AcademicYearModal
        isOpen={isAYModalOpen}
        onClose={() => setIsAYModalOpen(false)}
        academicYears={academicYears}
        onRefresh={() => loadData()}
        showToast={showToast}
      />

      {/* Create / Edit Schedule Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                {editingItem ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Baru'}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="p-5 space-y-3 overflow-y-auto">
              {formConflictError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p>{formConflictError}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Hari
                  </label>
                  <select
                    value={formData.day}
                    onChange={(e) =>
                      setFormData({ ...formData, day: e.target.value as ScheduleDay })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    {SCHEDULE_DAYS.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nomor JP
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={formData.period_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        period_number: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({ ...formData, start_time: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData({ ...formData, end_time: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Kelas
                  </label>
                  <select
                    value={formData.class_id}
                    onChange={(e) =>
                      setFormData({ ...formData, class_id: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    {DAFTAR_KELAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    list="mapel-list"
                    value={formData.subject_name}
                    onChange={(e) =>
                      setFormData({ ...formData, subject_name: e.target.value })
                    }
                    placeholder="Pilih atau ketik mapel..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <datalist id="mapel-list">
                    {subjects.map((m) => (
                      <option key={m.id} value={m.nama_mapel} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Guru Pengampu
                </label>
                <select
                  value={formData.teacher_name}
                  onChange={(e) =>
                    setFormData({ ...formData, teacher_name: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map((g) => (
                    <option key={g.id} value={g.nama_guru}>
                      {g.nama_guru}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Status:</span>
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
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
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
