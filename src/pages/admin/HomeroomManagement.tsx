import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { type Guru, type HomeroomAssignment } from '../../types';
import { useClassLabels } from '../../contexts/ClassContext';
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
import { DataTable, StatusBadge, formStyles, type Column } from '../../components/common';

interface HomeroomManagementProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface HomeroomRow {
  classId: string;
  saved: HomeroomAssignment | undefined;
  selected: string;
  isChanged: boolean;
  isProcessing: boolean;
}

export const HomeroomManagement: React.FC<HomeroomManagementProps> = ({ showToast }) => {
  // Sumber kelas: master data, bukan konstanta hardcoded.
  const kelasLabels = useClassLabels();

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [assignments, setAssignments] = useState<HomeroomAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<string | null>(null); // kelas being saved

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
        mapping[item.kelas] = item.teacher_name;
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

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAssignment = (classId: string) => {
    const existing = assignments.find((a) => a.kelas === classId);
    if (!existing) {
      // Just clear draft
      setDraftSelection((prev) => {
        const copy = { ...prev };
        delete copy[classId];
        return copy;
      });
      return;
    }

    setDeleteTarget(classId);
  };

  const confirmDeleteAssignment = async () => {
    if (!deleteTarget) return;
    const existing = assignments.find((a) => a.kelas === deleteTarget);
    if (!existing) {
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteHomeroomAssignment(existing.id);
      showToast('success', `Penugasan wali kelas ${deleteTarget} dihapus.`);
      setDeleteTarget(null);
      await fetchAssignments();
    } catch (err: any) {
      showToast('error', 'Gagal menghapus penugasan.');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedAY = academicYears.find((a) => a.id === selectedAYId);

  // Derived rows (murni tampilan): satu per kelas, berisi data tersimpan + draft
  const tableRows: HomeroomRow[] = kelasLabels.map((classId) => {
    const saved = assignments.find((a) => a.kelas === classId);
    const selected = draftSelection[classId] || '';
    return {
      classId,
      saved,
      selected,
      isChanged: selected !== (saved?.teacher_name || ''),
      isProcessing: isSaving === classId,
    };
  });

  const columns: Column<HomeroomRow>[] = [
    {
      key: 'academic_year',
      header: 'Tahun Ajaran',
      align: 'left',
      width: '160px',
      accessor: (_row) => (
        <span className="text-slate-600 font-medium whitespace-nowrap">
          {selectedAY?.name || '-'}
        </span>
      ),
    },
    {
      key: 'kelas',
      header: 'Kelas',
      align: 'center',
      width: '110px',
      accessor: (row) => (
        <span className="font-bold text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80 whitespace-nowrap">
          {row.classId}
        </span>
      ),
    },
    {
      key: 'teacher',
      header: 'Guru Wali Kelas',
      align: 'left',
      className: 'min-w-[220px]',
      accessor: (row) => (
        <select
          value={row.selected}
          onChange={(e) => handleSelectTeacher(row.classId, e.target.value)}
          className={`${formStyles.select} max-w-sm font-semibold`}
        >
          <option value="">-- Belum Dipilih / Kosong --</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.nama_guru}>
              {t.nama_guru}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '150px',
      accessor: (row) => (
        <StatusBadge
          status={row.saved ? 'ACTIVE' : 'DRAFT'}
          label={row.saved ? 'Ditetapkan' : 'Belum Ditetapkan'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      width: '200px',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.saved && (
            <button
              aria-label="Hapus penugasan wali kelas"
              type="button"
              onClick={() => handleDeleteAssignment(row.classId)}
              className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
              title="Hapus penugasan wali kelas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
           )}

          <button
            type="button"
            disabled={row.isProcessing || !row.selected || !row.isChanged}
            onClick={() => handleSaveClassAssignment(row.classId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs ${
              row.isChanged && row.selected
                ? 'bg-primary-600 hover:bg-primary-700 text-white'
                : 'bg-slate-100 text-slate-600 border border-slate-200 cursor-not-allowed'
            }`}
          >
            {row.isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{row.isChanged ? 'Simpan' : 'Tersimpan'}</span>
              </>
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penugasan Wali Kelas"
        description="Tetapkan guru yang bertugas sebagai wali kelas untuk setiap tingkat kelas per tahun ajaran."
      />

      {/* Filter / Selector Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Tahun Ajaran Aktif
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
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
            <Calendar className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
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
        <p className="text-xs leading-relaxed pl-6">
          Wali kelas bertindak sebagai penanggung jawab administratif kelas. Status wali kelas{' '}
          <strong>tidak menentukan hak membuat agenda mengajar</strong>. Hak membuat agenda KBM
          reguler sepenuhnya merujuk pada <strong>Jadwal Pelajaran (Schedule)</strong>.
        </p>
      </div>

      {/* Class Table */}
      <DataTable
        title="Daftar Penugasan Kelas"
        subtitle={`Total ${kelasLabels.length} data kelas`}
        titleIcon={<UserCheck className="w-4 h-4 text-slate-600" />}
        columns={columns}
        data={tableRows}
        keyExtractor={(row) => row.classId}
        isLoading={isLoading}
        emptyTitle="Belum ada daftar kelas"
        emptyDescription="Daftar kelas tidak tersedia untuk tahun ajaran ini."
      />

      {/* Dialog konfirmasi hapus penugasan wali kelas */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteAssignment}
        isLoading={isDeleting}
        title="Hapus penugasan wali kelas?"
        message={`Penugasan wali kelas untuk ${deleteTarget ?? ''} akan dihapus dan kolom kembali kosong.`}
        confirmText="Hapus"
      />
    </div>
  );
};
