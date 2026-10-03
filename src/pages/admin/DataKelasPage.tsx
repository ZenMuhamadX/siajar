import React, { useMemo, useState } from 'react';
import type { Kelas } from '../../types';
import { addKelas, updateKelas, setKelasActive } from '../../services/classService';
import { useClasses } from '../../contexts/ClassContext';
import { Check, Edit2, Plus, Power, School } from 'lucide-react';
import {
  DataTable,
  StatusBadge,
  FilterBar,
  FormModal,
  FormField,
  TextInput,
  SelectInput,
  formStyles,
} from '../../components/common';
import { PageHeader } from '../../components/admin/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface DataKelasPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const TINGKAT_OPTIONS = [1, 2, 3, 4, 5, 6];

/**
 * Master Kelas.
 *
 * Halaman ini sumber rombel. Menambah 1B, 2B, dan seterusnya cukup dari sini —
 * tidak ada kode yang perlu diubah, karena seluruh aplikasi membaca daftar kelas
 * dari `ClassContext`.
 *
 * `tingkat` sengaja tidak bisa diubah saat menyunting: mengubah tingkat berarti
 * mengubah identitas kelas, bukan sekadar namanya. Yang bisa diubah adalah
 * `label` (teks tampilan) dan `rombel` (huruf rombel).
 */
export const DataKelasPage: React.FC<DataKelasPageProps> = ({ showToast }) => {
  const { classes, loading, reload } = useClasses();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tingkatInput, setTingkatInput] = useState<number>(1);
  const [rombelInput, setRombelInput] = useState<string>('A');
  const [labelInput, setLabelInput] = useState<string>('');
  /**
   * Selama pengguna belum menyentuh kolom Label, nilainya mengikuti Tingkat +
   * Rombel. Begitu ia mengetik sendiri, jangan ditimpa lagi — kalau ditimpa,
   * ketikan pengguna akan terus hilang di tengah jalan.
   */
  const [labelTouched, setLabelTouched] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const suggestedLabel = `${tingkatInput}${rombelInput.trim().toUpperCase()}`;
  const effectiveLabel = labelTouched ? labelInput : suggestedLabel;

  const sorted = useMemo(
    () => [...classes].sort((a, b) => a.tingkat - b.tingkat || a.rombel.localeCompare(b.rombel)),
    [classes],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (k) => k.label.toLowerCase().includes(q) || k.rombel.toLowerCase().includes(q),
    );
  }, [sorted, searchQuery]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setTingkatInput(1);
    setRombelInput('A');
    setLabelInput('');
    setLabelTouched(false);
    setIsFormOpen(true);
  };

  const handleEditClick = (kelas: Kelas) => {
    setEditingId(kelas.id);
    setTingkatInput(kelas.tingkat);
    setRombelInput(kelas.rombel);
    setLabelInput(kelas.label);
    setLabelTouched(true);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = effectiveLabel.trim();

    if (!rombelInput.trim()) {
      showToast('error', 'Huruf rombel tidak boleh kosong.');
      return;
    }
    if (!label) {
      showToast('error', 'Label kelas tidak boleh kosong.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateKelas(editingId, { label, rombel: rombelInput });
        showToast('success', `Kelas ${label} berhasil diperbarui.`);
      } else {
        await addKelas({ tingkat: tingkatInput, rombel: rombelInput, label });
        showToast('success', `Kelas ${label} berhasil ditambahkan.`);
      }
      setIsFormOpen(false);
      setEditingId(null);
      await reload();
    } catch (err: any) {
      const pesan = String(err?.message || '');
      if (pesan.includes('uq_kelas_tingkat_rombel') || pesan.includes('duplicate key')) {
        showToast('error', `Rombel ${suggestedLabel} sudah ada. Pilih huruf rombel lain.`);
      } else {
        showToast('error', 'Gagal menyimpan kelas. ' + pesan);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const [toggleTarget, setToggleTarget] = useState<Kelas | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    const next = !toggleTarget.is_active;
    setIsToggling(true);
    try {
      await setKelasActive(toggleTarget.id, next);
      showToast(
        'success',
        next
          ? `Kelas ${toggleTarget.label} diaktifkan kembali.`
          : `Kelas ${toggleTarget.label} dinonaktifkan. Riwayat lamanya tetap utuh.`,
      );
      setToggleTarget(null);
      await reload();
    } catch (err: any) {
      showToast('error', 'Gagal mengubah status kelas. ' + (err?.message || ''));
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Kelas"
        description="Master rombel. Menambah kelas di sini langsung tersedia di seluruh aplikasi."
      />

      <div className="space-y-3">
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari kelas..."
          isFiltered={Boolean(searchQuery.trim())}
          onResetFilters={() => setSearchQuery('')}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                <School className="w-4 h-4 text-primary-600" />
                <span>{sorted.length} Kelas</span>
              </div>
              <button type="button" onClick={handleOpenCreate} className={formStyles.primaryBtn}>
                <Plus className="w-3.5 h-3.5" />
                Tambah Rombel
              </button>
            </div>
          }
        />

        <DataTable
          columns={[
            {
              key: 'no',
              header: 'No',
              width: '50px',
              align: 'center',
              accessor: (_item, idx) => (
                <span className="text-slate-600 font-medium">{idx + 1}</span>
              ),
            },
            {
              key: 'label',
              header: 'Kelas',
              width: '120px',
              align: 'left',
              accessor: (item) => (
                <span className="font-semibold text-slate-900">{item.label}</span>
              ),
            },
            {
              key: 'tingkat',
              header: 'Tingkat',
              width: '100px',
              align: 'center',
              accessor: (item) => (
                <span className="text-slate-700">Kelas {item.tingkat}</span>
              ),
            },
            {
              key: 'rombel',
              header: 'Rombel',
              width: '90px',
              align: 'center',
              accessor: (item) => (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-md border border-slate-200/80 text-xs">
                  {item.rombel}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              width: '110px',
              align: 'center',
              accessor: (item) => (
                <StatusBadge status={item.is_active ? 'Aktif' : 'Nonaktif'} />
              ),
            },
            {
              key: 'actions',
              header: 'Aksi',
              width: '110px',
              align: 'right',
              accessor: (item) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    aria-label="Edit Kelas"
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                    title="Edit Kelas"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    aria-label={item.is_active ? 'Nonaktifkan Kelas' : 'Aktifkan Kelas'}
                    type="button"
                    onClick={() => setToggleTarget(item)}
                    className={`p-1.5 rounded-md transition ${
                      item.is_active
                        ? 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                        : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={item.is_active ? 'Nonaktifkan Kelas' : 'Aktifkan Kelas'}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => item.id}
          isLoading={loading}
          isFiltered={Boolean(searchQuery.trim())}
          onResetFilter={() => setSearchQuery('')}
          emptyTitle="Belum ada data kelas"
          emptyDescription={
            searchQuery.trim()
              ? 'Tidak ada kelas yang sesuai pencarian.'
              : 'Klik "Tambah Rombel" untuk membuat kelas pertama.'
          }
          rowClassName={(item) => (editingId === item.id ? 'bg-amber-50/80 font-medium' : '')}
          enablePagination={true}
          defaultPageSize={25}
        />
      </div>

      <FormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingId ? 'Perbarui Kelas' : 'Tambah Rombel Baru'}
        subtitle={
          editingId
            ? 'Ubah label atau huruf rombel. Tingkat tidak bisa diubah.'
            : 'Contoh: tingkat 1 + rombel B menghasilkan kelas 1B.'
        }
        size="sm"
        onSubmit={handleSave}
        busy={isSaving}
        footer={(formId) => (
          <>
            <span />
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleCloseForm} className={formStyles.ghostBtn}>
                Batal
              </button>
              <button type="submit" form={formId} disabled={isSaving} className={formStyles.primaryBtn}>
                <Check className="w-3.5 h-3.5" />
                {isSaving ? 'Menyimpan...' : editingId ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </>
        )}
      >
        <div className="p-5 grid grid-cols-1 sm:grid-cols-12 gap-3">
          <FormField label="Tingkat" htmlFor="kelas-tingkat" className="sm:col-span-5" required>
            <SelectInput
              id="kelas-tingkat"
              value={String(tingkatInput)}
              disabled={Boolean(editingId)}
              onChange={(e) => setTingkatInput(Number(e.target.value))}
            >
              {TINGKAT_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  Kelas {t}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="Rombel" htmlFor="kelas-rombel" className="sm:col-span-3" required>
            <TextInput
              id="kelas-rombel"
              type="text"
              required
              maxLength={2}
              placeholder="A"
              value={rombelInput}
              onChange={(e) =>
                setRombelInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())
              }
              className="font-bold uppercase"
            />
          </FormField>

          <FormField
            label="Label Kelas"
            htmlFor="kelas-label"
            className="sm:col-span-4"
            required
            hint={labelTouched ? undefined : 'Terisi otomatis dari tingkat + rombel.'}
          >
            <TextInput
              id="kelas-label"
              type="text"
              required
              placeholder={suggestedLabel}
              value={effectiveLabel}
              onChange={(e) => {
                setLabelTouched(true);
                setLabelInput(e.target.value);
              }}
              className="font-bold"
            />
          </FormField>
        </div>
      </FormModal>

      <ConfirmDialog
        isOpen={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={confirmToggle}
        isLoading={isToggling}
        title={toggleTarget?.is_active ? 'Nonaktifkan kelas?' : 'Aktifkan kelas?'}
        message={
          toggleTarget
            ? toggleTarget.is_active
              ? `Kelas "${toggleTarget.label}" tidak akan muncul lagi di pilihan kelas. Riwayat jadwal dan agenda lamanya tetap utuh — kelas tidak dihapus.`
              : `Kelas "${toggleTarget.label}" akan muncul kembali di pilihan kelas.`
            : ''
        }
        confirmText={toggleTarget?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
      />
    </div>
  );
};
