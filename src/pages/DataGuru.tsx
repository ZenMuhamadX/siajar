import React, { useState, useEffect } from 'react';
import type { Guru } from '../types';
import {
  getDaftarGuru,
  addGuru,
  updateGuru,
  deleteGuru,
} from '../services/agendaService';
import {
  UserCheck,
  Edit2,
  Trash2,
  Check,
  Plus,
} from 'lucide-react';
import {
  DataTable,
  StatusBadge,
  FilterBar,
  FormModal,
  FormField,
  TextInput,
  formStyles,
} from '../components/common';
import { PageHeader } from '../components/admin/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface DataGuruProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DataGuru: React.FC<DataGuruProps> = ({ showToast }) => {
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form states for Add / Edit
  const [namaInput, setNamaInput] = useState<string>('');
  const [editingGuru, setEditingGuru] = useState<Guru | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchGuru = async () => {
    setIsLoading(true);
    try {
      const dataG = await getDaftarGuru();
      setGuruList(dataG);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat data guru.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuru();
  }, []);

  const handleSaveGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaInput.trim()) {
      showToast('error', 'Nama guru tidak boleh kosong.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingGuru) {
        await updateGuru(editingGuru.id, namaInput);
        showToast('success', 'Data guru berhasil diperbarui.');
        setEditingGuru(null);
      } else {
        await addGuru(namaInput);
        showToast(
          'success',
          `Guru ${namaInput} berhasil ditambahkan.`
        );
      }
      setNamaInput('');
      setIsFormOpen(false);
      fetchGuru();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan data guru. ' + (err?.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingGuru(null);
    setNamaInput('');
    setIsFormOpen(true);
  };

  const handleEditClick = (guru: Guru) => {
    setEditingGuru(guru);
    setNamaInput(guru.nama_guru);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingGuru(null);
    setNamaInput('');
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nama: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (id: string, nama: string) => {
    setDeleteTarget({ id, nama });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteGuru(deleteTarget.id);
      showToast('success', `Guru ${deleteTarget.nama} berhasil dihapus.`);
      setDeleteTarget(null);
      fetchGuru();
    } catch (err) {
      showToast('error', 'Gagal menghapus data guru.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Guru"
        description="Atur daftar guru yang dapat digunakan pada agenda dan jadwal."
      />

      {/* List Guru */}
      <div className="space-y-3">
        {/* Toolbar & FilterBar */}
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari nama guru..."
          isFiltered={Boolean(searchQuery.trim())}
          onResetFilters={() => setSearchQuery('')}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>{guruList.length} Guru Terdaftar</span>
              </div>
              <button
                type="button"
                onClick={handleOpenCreate}
                className={formStyles.primaryBtn}
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Guru
              </button>
            </div>
          }
        />

        {/* Standardized DataTable */}
        <DataTable
          columns={[
            {
              key: 'no',
              header: 'No',
              width: '50px',
              align: 'center',
              accessor: (_item, idx) => (
                <span className="text-slate-400 font-medium">{idx + 1}</span>
              ),
            },
            {
              key: 'nama_guru',
              header: 'Nama Lengkap Guru',
              align: 'left',
              accessor: (item) => (
                <span className="font-semibold text-slate-900">
                  {item.nama_guru}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              width: '100px',
              align: 'center',
              accessor: () => <StatusBadge status="Aktif" />,
            },
            {
              key: 'actions',
              header: 'Aksi',
              width: '100px',
              align: 'right',
              accessor: (item) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                    title="Edit Data Guru"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.nama_guru)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                    title="Hapus Data Guru"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
          data={guruList.filter((g) =>
            searchQuery.trim()
              ? g.nama_guru.toLowerCase().includes(searchQuery.toLowerCase().trim())
              : true
          )}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          isFiltered={Boolean(searchQuery.trim())}
          onResetFilter={() => setSearchQuery('')}
          emptyTitle="Belum ada data guru"
          emptyDescription={
            searchQuery.trim()
              ? 'Tidak ada guru yang sesuai dengan pencarian.'
              : 'Klik "Tambah Guru" untuk menambahkan guru baru.'
          }
          rowClassName={(item) =>
            editingGuru?.id === item.id ? 'bg-amber-50/80 font-medium' : ''
          }
          enablePagination={true}
          defaultPageSize={25}
        />
      </div>

      {/* Modal Tambah / Edit Guru */}
      <FormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingGuru ? 'Perbarui Data Guru' : 'Tambah Guru Baru'}
        subtitle={
          editingGuru
            ? 'Perbarui nama guru yang sudah terdaftar.'
            : 'Guru ini akan tersedia pada agenda dan jadwal.'
        }
        size="sm"
        onSubmit={handleSaveGuru}
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
                {isSaving ? 'Menyimpan...' : editingGuru ? 'Simpan' : 'Tambah Guru'}
              </button>
            </div>
          </>
        )}
      >
        <div className="p-5">
          <FormField
            label="Nama Lengkap Guru"
            htmlFor="guru-nama"
            required
            hint="beserta gelar jika ada"
          >
            <TextInput
              id="guru-nama"
              type="text"
              required
              autoFocus
              placeholder="Contoh: Abdullah, S.Pd.I / Fatimah, S.Pd"
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
            />
          </FormField>
        </div>
      </FormModal>

      {/* Dialog konfirmasi hapus guru */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Hapus data guru?"
        message={
          deleteTarget ? `Data guru "${deleteTarget.nama}" akan dihapus permanen.` : ''
        }
        confirmText="Hapus"
      />
    </div>
  );
};
