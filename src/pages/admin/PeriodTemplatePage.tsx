import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Power, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import type { AcademicYear } from '../../types/schedule';
import type { PeriodTemplate } from '../../types/schedule';
import { getAcademicYears } from '../../services/scheduleService';
import {
  getPeriodTemplates,
  createPeriodTemplate,
  updatePeriodTemplate,
  togglePeriodTemplateActive,
  deletePeriodTemplate,
} from '../../services/periodTemplateService';
import { PageHeader } from '../../components/admin/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, FormModal, formStyles, type Column } from '../../components/common';

interface PeriodTemplatePageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type FormMode = 'create' | 'edit';

const emptyForm = {
  period_number: 1,
  label: '',
  start_time: '07:30',
  end_time: '08:05',
  is_active: true,
};

/** Hitung durasi menit dari dua string HH:mm */
function calcDuration(start: string, end: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return toMin(end) - toMin(start);
}

export const PeriodTemplatePage: React.FC<PeriodTemplatePageProps> = ({ showToast }) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [templates, setTemplates] = useState<PeriodTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load academic years & templates
  const loadData = async (ayId?: string) => {
    setIsLoading(true);
    try {
      const ayList = await getAcademicYears();
      setAcademicYears(ayList);

      let targetAYId = ayId ?? selectedAYId;
      if (!targetAYId || !ayList.some((y) => y.id === targetAYId)) {
        const active = ayList.find((y) => y.status === 'ACTIVE') ?? ayList[0];
        if (active) {
          targetAYId = active.id;
          setSelectedAYId(targetAYId);
        }
      }

      if (targetAYId) {
        const list = await getPeriodTemplates(targetAYId);
        setTemplates(list);
      }
    } catch (e: any) {
      showToast('error', 'Gagal memuat data: ' + (e?.message ?? ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAYChange = async (ayId: string) => {
    setSelectedAYId(ayId);
    setIsLoading(true);
    try {
      const list = await getPeriodTemplates(ayId);
      setTemplates(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open modal
  const handleOpenCreate = () => {
    if (!selectedAYId) {
      showToast('error', 'Pilih Tahun Ajaran terlebih dahulu.');
      return;
    }
    setFormMode('create');
    setEditingId(null);
    setFormError('');
    // Auto-suggest next period_number
    const next = templates.length > 0 ? Math.max(...templates.map((t) => t.period_number)) + 1 : 1;
    setForm({
      period_number: next,
      label: `JP ${next}`,
      start_time: '07:30',
      end_time: '08:05',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: PeriodTemplate) => {
    setFormMode('edit');
    setEditingId(t.id);
    setFormError('');
    setForm({
      period_number: t.period_number,
      label: t.label,
      start_time: t.start_time.slice(0, 5),
      end_time: t.end_time.slice(0, 5),
      is_active: t.is_active,
    });
    setIsModalOpen(true);
  };

  // Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.label.trim()) {
      setFormError('Label JP tidak boleh kosong.');
      return;
    }
    if (form.start_time >= form.end_time) {
      setFormError('Jam mulai harus lebih awal dari jam selesai.');
      return;
    }

    setIsSaving(true);
    try {
      if (formMode === 'create') {
        await createPeriodTemplate({
          academic_year_id: selectedAYId,
          period_number: Number(form.period_number),
          label: form.label.trim(),
          start_time: form.start_time,
          end_time: form.end_time,
          is_active: form.is_active,
        });
        showToast('success', `${form.label} berhasil ditambahkan.`);
      } else if (editingId) {
        await updatePeriodTemplate(editingId, {
          period_number: Number(form.period_number),
          label: form.label.trim(),
          start_time: form.start_time,
          end_time: form.end_time,
          is_active: form.is_active,
        });
        showToast('success', `${form.label} berhasil diperbarui.`);
      }
      setIsModalOpen(false);
      const list = await getPeriodTemplates(selectedAYId);
      setTemplates(list);
    } catch (e: any) {
      setFormError(e?.message ?? 'Gagal menyimpan JP.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active
  const handleToggle = async (t: PeriodTemplate) => {
    try {
      await togglePeriodTemplateActive(t.id, !t.is_active);
      showToast('success', `${t.label} ${!t.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`);
      const list = await getPeriodTemplates(selectedAYId);
      setTemplates(list);
    } catch (e: any) {
      showToast('error', e?.message ?? 'Gagal mengubah status JP.');
    }
  };

  // Delete (via dialog konfirmasi)
  const [deleteTarget, setDeleteTarget] = useState<PeriodTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (t: PeriodTemplate) => {
    setDeleteTarget(t);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePeriodTemplate(deleteTarget.id);
      showToast('info', `${deleteTarget.label} dihapus.`);
      setDeleteTarget(null);
      const list = await getPeriodTemplates(selectedAYId);
      setTemplates(list);
    } catch (e: any) {
      showToast('error', e?.message ?? 'Gagal menghapus JP.');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedAY = academicYears.find((y) => y.id === selectedAYId);
  const activeCount = templates.filter((t) => t.is_active).length;

  const columns: Column<PeriodTemplate>[] = [
    {
      key: 'period_number',
      header: '#',
      align: 'center',
      width: '50px',
      accessor: (t) => <span className="font-mono text-slate-600">{t.period_number}</span>,
    },
    {
      key: 'label',
      header: 'Label',
      align: 'left',
      accessor: (t) => <span className="font-semibold text-slate-800">{t.label}</span>,
    },
    {
      key: 'start_time',
      header: 'Jam Mulai',
      align: 'center',
      width: '110px',
      accessor: (t) => (
        <span className="font-mono text-slate-700 whitespace-nowrap">{t.start_time.slice(0, 5)}</span>
      ),
    },
    {
      key: 'end_time',
      header: 'Jam Selesai',
      align: 'center',
      width: '110px',
      accessor: (t) => (
        <span className="font-mono text-slate-700 whitespace-nowrap">{t.end_time.slice(0, 5)}</span>
      ),
    },
    {
      key: 'duration',
      header: 'Durasi',
      align: 'center',
      width: '100px',
      accessor: (t) => {
        const dur = calcDuration(t.start_time.slice(0, 5), t.end_time.slice(0, 5));
        return (
          <span className="text-slate-500 whitespace-nowrap">
            {dur > 0 ? `${dur} menit` : <span className="text-rose-400">?</span>}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '110px',
      accessor: (t) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
            t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {t.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      width: '130px',
      accessor: (t) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleToggle(t)}
            className={`p-1.5 rounded-lg transition ${
              t.is_active
                ? 'text-slate-600 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
          <button
            aria-label="Edit"
            onClick={() => handleOpenEdit(t)}
            className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
           <button
             aria-label="Hapus"
            onClick={() => handleDelete(t)}
            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            title="Hapus"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
         </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Slot Waktu (JP)"
        description="Konfigurasi Jam Pelajaran (JP) per Tahun Ajaran. Waktu JP akan otomatis digunakan saat membuat jadwal."
        action={
          <div className="flex items-center gap-2">
            {/* Tahun Ajaran selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
              <span className="font-medium text-slate-500">TA:</span>
              <select
                value={selectedAYId}
                onChange={(e) => handleAYChange(e.target.value)}
                className="bg-transparent font-bold text-slate-800 cursor-pointer"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} {ay.status === 'ACTIVE' ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              aria-label="Refresh"
              onClick={() => loadData()}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

             <button
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah JP</span>
            </button>
          </div>
        }
      />

      {/* Table Card */}
      <DataTable
        title="Daftar Slot Waktu (JP)"
        subtitle={
          <>
            <span>{`${templates.length} JP dikonfigurasi · `}</span>
            <span className="text-emerald-600 font-semibold">{`${activeCount} aktif`}</span>
            {activeCount < templates.length && (
              <span className="text-slate-600">{` · ${templates.length - activeCount} nonaktif`}</span>
            )}
          </>
        }
        headerRightContent={
          <span className="text-slate-600 whitespace-nowrap">Tahun Ajaran: {selectedAY?.name}</span>
        }
        columns={columns}
        data={templates}
        keyExtractor={(t) => t.id}
        isLoading={isLoading}
        emptyTitle="Belum ada konfigurasi JP"
        emptyDescription={`Tahun ajaran ${
          selectedAY?.name ?? '-'
        } belum memiliki konfigurasi Jam Pelajaran. Klik "Tambah JP" di kanan atas untuk menambahkan.`}
        emptyIcon={<Clock className="w-5 h-5" />}
        rowClassName={(t) => (t.is_active ? '' : 'opacity-60')}
      />

      {/* All-nonactive warning */}
      {!isLoading && templates.length > 0 && activeCount === 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            Semua JP untuk tahun ajaran ini dinonaktifkan. JP tidak akan muncul sebagai pilihan
            saat membuat jadwal baru. Aktifkan setidaknya satu JP.
          </span>
        </div>
      )}

      {/* Modal Tambah / Edit JP — FormModal (scroll-safe + body scroll lock) */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formMode === 'create' ? 'Tambah Jam Pelajaran' : 'Edit Jam Pelajaran'}
        subtitle={selectedAY?.name ?? ''}
        size="sm"
        onSubmit={handleSave}
        busy={isSaving}
        footer={(formId) => (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className={formStyles.checkbox}
              />
              <span className="text-xs font-semibold text-slate-600">JP Aktif</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={formStyles.ghostBtn}
              >
                Batal
              </button>
              <button
                type="submit"
                form={formId}
                disabled={isSaving}
                className={formStyles.primaryBtn}
              >
                {isSaving ? 'Menyimpan...' : formMode === 'create' ? 'Tambah' : 'Perbarui'}
              </button>
            </div>
          </>
        )}
      >
        <div className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <p>{formError}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={formStyles.label}>
                    Nomor JP
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={form.period_number}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10) || 1;
                      setForm((f) => ({ ...f, period_number: n, label: `JP ${n}` }));
                    }}
                    className={`${formStyles.input} text-center font-bold`}
                  />
                </div>

                <div>
                  <label className={formStyles.label}>
                    Label
                  </label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="JP 1"
                    className={formStyles.input}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={formStyles.label}>
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    className={formStyles.input}
                  />
                </div>

                <div>
                  <label className={formStyles.label}>
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    className={formStyles.input}
                  />
                </div>
              </div>

              {/* Duration preview */}
              {form.start_time && form.end_time && form.start_time < form.end_time && (
                <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 text-xs text-primary-700">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Durasi: <strong>{calcDuration(form.start_time, form.end_time)} menit</strong>
                  </span>
                </div>
              )}
        </div>
      </FormModal>

      {/* Dialog konfirmasi hapus JP */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Hapus Slot Waktu (JP)?"
        message={
          deleteTarget
            ? `JP "${deleteTarget.label}" (${deleteTarget.start_time.slice(0, 5)} – ${deleteTarget.end_time.slice(0, 5)}) akan dihapus.`
            : ''
        }
        confirmText="Hapus"
      />
    </div>
  );
};
