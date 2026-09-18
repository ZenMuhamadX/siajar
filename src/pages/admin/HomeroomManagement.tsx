import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { DAFTAR_KELAS, type Guru, type HomeroomAssignment } from '../../types';
import type { AcademicYear } from '../../types/schedule';
import { getAcademicYears } from '../../services/scheduleService';
import { getDaftarGuru } from '../../services/agendaService';
import {
  getHomeroomAssignments,
  upsertHomeroomAssignment,
  deleteHomeroomAssignment,
} from '../../services/homeroomService';
import {
  Award,
  Calendar,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

interface HomeroomManagementProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const HomeroomManagement: React.FC<HomeroomManagementProps> = ({ showToast }) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [assignments, setAssignments] = useState<HomeroomAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<string | null>(null); // class_id being saved

  // Temporary selection state for each class: { [classId]: teacherName }
  const [draftSelection, setDraftSelection] = useState<Record<string, string>>({});

  // 1. Initial Load: Academic Years & Teachers
  useEffect(() => {
    async function loadMeta() {
      try {
        const [ays, teachs] = await Promise.all([
          getAcademicYears(),
          getDaftarGuru(),
        ]);
        setAcademicYears(ays);
        setTeachers(teachs);

        const activeAY = ays.find((a) => a.status === 'ACTIVE') || ays[0];
        if (activeAY) {
          setSelectedAYId(activeAY.id);
        }
      } catch (err: any) {
        console.error('Failed to load initial metadata:', err);
        showToast('error', 'Gagal memuat daftar tahun ajaran atau guru.');
      }
    }
    loadMeta();
  }, [showToast]);

  // 2. Load Assignments when selectedAYId changes
  const fetchAssignments = useCallback(async () => {
    if (!selectedAYId) return;
    setIsLoading(true);
    try {
      const data = await getHomeroomAssignments(selectedAYId);
      setAssignments(data);

      const mapping: Record<string, string> = {};
      data.forEach((item) => {
        mapping[item.class_id] = item.teacher_name;
      });
      setDraftSelection(mapping);
    } catch (err: any) {
      console.error('Failed to load homeroom assignments:', err);
      showToast('error', 'Gagal memuat data penugasan wali kelas.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAYId, showToast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSelectTeacher = (classId: string, teacherName: string) => {
    setDraftSelection((prev) => ({
      ...prev,
      [classId]: teacherName,
    }));
  };

  const handleSaveClassAssignment = async (classId: string) => {
    const teacherName = draftSelection[classId]?.trim();
    if (!teacherName) {
      showToast('error', `Pilih guru wali kelas untuk ${classId}.`);
      return;
    }

    // Check if the selected teacher is already assigned to another class in this academic year
    const conflictClass = Object.entries(draftSelection).find(
      ([cId, tName]) => cId !== classId && tName.toLowerCase() === teacherName.toLowerCase()
    );
    if (conflictClass) {
      showToast(
        'info',
        `Perhatian: ${teacherName} juga dipilih sebagai wali kelas di ${conflictClass[0]}.`
      );
    }

    setIsSaving(classId);
    try {
      const teacherObj = teachers.find(
        (t) => t.nama_guru.toLowerCase().trim() === teacherName.toLowerCase().trim()
      );

      await upsertHomeroomAssignment({
        academicYearId: selectedAYId,
        classId,
        teacherId: teacherObj?.id || null,
        teacherName,
      });

      showToast('success', `Wali kelas ${classId} berhasil diperbarui.`);
      await fetchAssignments();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan penugasan wali kelas: ' + (err?.message || ''));
    } finally {
      setIsSaving(null);
    }
  };

  const handleDeleteAssignment = async (classId: string) => {
    const existing = assignments.find((a) => a.class_id === classId);
    if (!existing) {
      // Just clear draft
      setDraftSelection((prev) => {
        const copy = { ...prev };
        delete copy[classId];
        return copy;
      });
      return;
    }

    if (confirm(`Hapus penugasan wali kelas untuk ${classId}?`)) {
      try {
        await deleteHomeroomAssignment(existing.id);
        showToast('success', `Penugasan wali kelas ${classId} dihapus.`);
        await fetchAssignments();
      } catch (err: any) {
        showToast('error', 'Gagal menghapus penugasan.');
      }
    }
  };

  const selectedAY = academicYears.find((a) => a.id === selectedAYId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penugasan Wali Kelas"
        description="Tetapkan guru yang bertugas sebagai wali kelas untuk setiap tingkat kelas per tahun ajaran."
      />

      {/* Filter / Selector Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Tahun Ajaran Aktif
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Penugasan wali kelas terikat secara spesifik pada periode tahun ajaran.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedAYId}
              onChange={(e) => setSelectedAYId(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.status === 'ACTIVE' ? ' (Aktif)' : ''}
                </option>
              ))}
            </select>
            <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          {selectedAY?.status === 'ACTIVE' && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sedang Aktif</span>
            </span>
          )}
        </div>
      </div>

      {/* Info Notice: Separation of Homeroom & Teaching Schedule */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <AlertCircle className="w-4 h-4 text-slate-600 shrink-0" />
          <span>Aturan Konseptual Penugasan Wali Kelas</span>
        </div>
        <p className="text-[11px] leading-relaxed pl-6">
          Wali kelas bertindak sebagai penanggung jawab administratif kelas. Status wali kelas{' '}
          <strong>tidak menentukan hak membuat agenda mengajar</strong>. Hak membuat agenda KBM
          reguler sepenuhnya merujuk pada <strong>Jadwal Pelajaran (Schedule)</strong>.
        </p>
      </div>

      {/* Class Cards / Grid */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Daftar Penugasan Kelas ({DAFTAR_KELAS.length} Kelas)
            </h4>
          </div>
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
              <span>Memuat...</span>
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {DAFTAR_KELAS.map((kelasName) => {
            const currentSaved = assignments.find((a) => a.class_id === kelasName);
            const currentSelected = draftSelection[kelasName] || '';
            const isChanged = currentSelected !== (currentSaved?.teacher_name || '');
            const isProcessing = isSaving === kelasName;

            return (
              <div
                key={kelasName}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
              >
                {/* Left: Class Info */}
                <div className="w-full sm:w-48 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 font-bold text-slate-800 flex items-center justify-center text-xs">
                      {kelasName.replace('KELAS ', 'K')}
                    </span>
                    <div>
                      <h5 className="font-bold text-sm text-slate-900">{kelasName}</h5>
                      <span className="text-[11px] text-slate-400">
                        {currentSaved ? 'Wali kelas aktif' : 'Belum ditetapkan'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle: Teacher Dropdown Selector */}
                <div className="flex-1 max-w-md">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 sm:hidden">
                    Pilih Wali Kelas
                  </label>
                  <select
                    value={currentSelected}
                    onChange={(e) => handleSelectTeacher(kelasName, e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                  >
                    <option value="">-- Belum Dipilih / Kosong --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.nama_guru}>
                        {t.nama_guru}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-2 shrink-0">
                  {currentSaved && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(kelasName)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus penugasan wali kelas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isProcessing || !currentSelected || !isChanged}
                    onClick={() => handleSaveClassAssignment(kelasName)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                      isChanged && currentSelected
                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>{isChanged ? 'Simpan' : 'Tersimpan'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
