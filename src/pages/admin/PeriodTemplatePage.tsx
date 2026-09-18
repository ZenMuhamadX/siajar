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

  // Delete
  const handleDelete = async (t: PeriodTemplate) => {
    if (!confirm(`Hapus ${t.label} (${t.start_time.slice(0, 5)} – ${t.end_time.slice(0, 5)})?`)) return;
    try {
      await deletePeriodTemplate(t.id);
      showToast('info', `${t.label} dihapus.`);
      const list = await getPeriodTemplates(selectedAYId);
      setTemplates(list);
    } catch (e: any) {
      showToast('error', e?.message ?? 'Gagal menghapus JP.');
    }
  };

  const selectedAY = academicYears.find((y) => y.id === selectedAYId);
  const activeCount = templates.filter((t) => t.is_active).length;

  return (
    <div className="space-y-5 max-w-4xl">
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
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah JP</span>
            </button>
          </div>
        }
      />

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">Memuat data...</div>
        ) : templates.length === 0 ? (
          /* Empty state */
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700 text-sm">Belum ada konfigurasi JP</p>
            <p className="text-xs text-slate-400">
              Tahun ajaran <span className="font-semibold">{selectedAY?.name ?? '-'}</span> belum memiliki
              konfigurasi Jam Pelajaran.
            </p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah JP Pertama
            </button>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                {templates.length} JP dikonfigurasi •{' '}
                <span className="text-emerald-600 font-semibold">{activeCount} aktif</span>
                {activeCount < templates.length && (
                  <span className="text-slate-400"> · {templates.length - activeCount} nonaktif</span>
                )}
              </span>
              <span className="text-slate-400">Tahun Ajaran: {selectedAY?.name}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-5 py-3 font-semibold text-slate-500 w-10">#</th>
                    <th className="px-3 py-3 font-semibold text-slate-500">Label</th>
                    <th className="px-3 py-3 font-semibold text-slate-500">Jam Mulai</th>
                    <th className="px-3 py-3 font-semibold text-slate-500">Jam Selesai</th>
                    <th className="px-3 py-3 font-semibold text-slate-500">Durasi</th>
                    <th className="px-3 py-3 font-semibold text-slate-500">Status</th>
                    <th className="px-5 py-3 font-semibold text-slate-500 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((t) => {
                    const dur = calcDuration(t.start_time.slice(0, 5), t.end_time.slice(0, 5));
                    return (
                      <tr key={t.id} className={`hover:bg-slate-50 transition ${!t.is_active ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-3.5 font-mono text-slate-400">{t.period_number}</td>
                        <td className="px-3 py-3.5 font-semibold text-slate-800">{t.label}</td>
                        <td className="px-3 py-3.5 font-mono text-slate-700">{t.start_time.slice(0, 5)}</td>
                        <td className="px-3 py-3.5 font-mono text-slate-700">{t.end_time.slice(0, 5)}</td>
                        <td className="px-3 py-3.5 text-slate-500">
                          {dur > 0 ? `${dur} menit` : <span className="text-rose-400">?</span>}
                        </td>
                        <td className="px-3 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              t.is_active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {t.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleToggle(t)}
                              className={`p-1.5 rounded-lg transition ${
                                t.is_active
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(t)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(t)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

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

      {/* Modal Tambah / Edit JP */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {formMode === 'create' ? 'Tambah Jam Pelajaran' : 'Edit Jam Pelajaran'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {selectedAY?.name ?? ''}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <p>{formError}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Label
                  </label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="JP 1"
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Duration preview */}
              {form.start_time && form.end_time && form.start_time < form.end_time && (
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Durasi: <strong>{calcDuration(form.start_time, form.end_time)} menit</strong>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-600">JP Aktif</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition"
                  >
                    {isSaving ? 'Menyimpan...' : formMode === 'create' ? 'Tambah' : 'Perbarui'}
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
