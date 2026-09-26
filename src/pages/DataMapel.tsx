import React, { useState, useEffect } from 'react';
import type { MataPelajaran } from '../types';
import {
  getDaftarMapel,
  addMapel,
  updateMapel,
  deleteMapel,
} from '../services/agendaService';
import {
  Edit2,
  Trash2,
  Check,
  BookOpen,
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

interface DataMapelProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DataMapel: React.FC<DataMapelProps> = ({ showToast }) => {
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form state
  const [namaInput, setNamaInput] = useState<string>('');
  const [editingMapel, setEditingMapel] = useState<MataPelajaran | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchMapel = async () => {
    setIsLoading(true);
    try {
      const data = await getDaftarMapel();
      setMapelList(data);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat data mata pelajaran.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMapel();
  }, []);

  const handleSaveMapel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaInput.trim()) {
      showToast('error', 'Nama mata pelajaran tidak boleh kosong.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMapel) {
        await updateMapel(editingMapel.id, namaInput);
        showToast('success', 'Mata pelajaran berhasil diperbarui.');
        setEditingMapel(null);
      } else {
        await addMapel(namaInput);
        showToast('success', `Mata pelajaran ${namaInput} berhasil ditambahkan.`);
      }
      setNamaInput('');
      setIsFormOpen(false);
      fetchMapel();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan mata pelajaran. ' + (err?.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingMapel(null);
    setNamaInput('');
    setIsFormOpen(true);
  };

  const handleEditClick = (mapel: MataPelajaran) => {
    setEditingMapel(mapel);
    setNamaInput(mapel.nama_mapel);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingMapel(null);
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
      await deleteMapel(deleteTarget.id);
      showToast('success', `Mata pelajaran ${deleteTarget.nama} berhasil dihapus.`);
      setDeleteTarget(null);
      fetchMapel();
    } catch (err) {
      showToast('error', 'Gagal menghapus mata pelajaran.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mata Pelajaran"
        description="Daftar mata pelajaran yang diajarkan pada kegiatan KBM."
      />

      {/* List Mapel */}
      <div className="space-y-3">
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari nama mata pelajaran..."
          isFiltered={Boolean(searchQuery.trim())}
          onResetFilters={() => setSearchQuery('')}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                <BookOpen className="w-4 h-4 text-primary-600" />
                <span>{mapelList.length} Mata Pelajaran</span>
              </div>
              <button type="button" onClick={handleOpenCreate} className={formStyles.primaryBtn}>
                <Plus className="w-3.5 h-3.5" />
                Tambah Mapel
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
              key: 'nama_mapel',
              header: 'Nama Mata Pelajaran',
              align: 'left',
              accessor: (item) => (
                <span className="font-semibold text-slate-900">
                  {item.nama_mapel}
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
                    aria-label="Edit Mata Pelajaran"
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                    title="Edit Mata Pelajaran"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                   <button
                     aria-label="Hapus Mata Pelajaran"
                    type="button"
                    onClick={() => handleDelete(item.id, item.nama_mapel)}
                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                    title="Hapus Mata Pelajaran"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                 </div>
              ),
            },
          ]}
          data={mapelList.filter((m) =>
            searchQuery.trim()
              ? m.nama_mapel.toLowerCase().includes(searchQuery.toLowerCase().trim())
              : true
          )}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          isFiltered={Boolean(searchQuery.trim())}
          onResetFilter={() => setSearchQuery('')}
          emptyTitle="Belum ada data mata pelajaran"
          emptyDescription={
            searchQuery.trim()
              ? 'Tidak ada mata pelajaran yang sesuai pencarian.'
              : 'Klik "Tambah Mapel" untuk menambahkan mata pelajaran baru.'
          }
          rowClassName={(item) =>
            editingMapel?.id === item.id ? 'bg-amber-50/80 font-medium' : ''
          }
          enablePagination={true}
          defaultPageSize={25}
        />
      </div>

      {/* Modal Tambah / Edit Mata Pelajaran */}
      <FormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingMapel ? 'Perbarui Data Mapel' : 'Tambah Mata Pelajaran Baru'}
        subtitle={
          editingMapel
            ? 'Perbarui nama mata pelajaran yang sudah terdaftar.'
            : 'Mata pelajaran ini akan tersedia pada agenda dan jadwal.'
        }
        size="sm"
        onSubmit={handleSaveMapel}
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
                {isSaving ? 'Menyimpan...' : editingMapel ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </>
        )}
      >
        <div className="p-5">
          <FormField label="Nama Mata Pelajaran" htmlFor="mapel-nama" required>
            <TextInput
              id="mapel-nama"
              type="text"
              required
              autoFocus
              placeholder="Contoh: Matematika, Bahasa Indonesia, PAI..."
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
            />
          </FormField>
        </div>
      </FormModal>

      {/* Dialog konfirmasi hapus mata pelajaran */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Hapus mata pelajaran?"
        message={
          deleteTarget
            ? `Mata pelajaran "${deleteTarget.nama}" akan dihapus permanen.`
            : ''
        }
        confirmText="Hapus"
      />
    </div>
  );
};
