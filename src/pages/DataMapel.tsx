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
  X,
  BookOpen,
  Plus,
} from 'lucide-react';
import {
  DataTable,
  StatusBadge,
  FilterBar,
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
      fetchMapel();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan mata pelajaran. ' + (err?.message || ''));
    }
  };

  const handleEditClick = (mapel: MataPelajaran) => {
    setEditingMapel(mapel);
    setNamaInput(mapel.nama_mapel);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
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

      {/* Add / Edit Form */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-2xs">
        <form onSubmit={handleSaveMapel} className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            {editingMapel ? (
              <>
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Perbarui Data Mapel</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>Tambah Mata Pelajaran Baru</span>
              </>
            )}
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-semibold text-slate-600 mb-1">
              Nama Mata Pelajaran
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                required
                placeholder="Contoh: Matematika, Bahasa Indonesia, PAI..."
                value={namaInput}
                onChange={(e) => setNamaInput(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 sm:px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-2xs transition flex items-center gap-1 shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingMapel ? 'Simpan' : 'Tambah'}</span>
              </button>
              {editingMapel && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition shrink-0"
                  title="Batal"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* List Mapel */}
      <div className="space-y-3">
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari nama mata pelajaran..."
          isFiltered={Boolean(searchQuery.trim())}
          onResetFilters={() => setSearchQuery('')}
          actions={
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>{mapelList.length} Mata Pelajaran</span>
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
                <span className="text-slate-400 font-medium">{idx + 1}</span>
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
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                    title="Edit Mata Pelajaran"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.nama_mapel)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
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
              : 'Gunakan formulir di atas untuk menambahkan mata pelajaran baru.'
          }
          rowClassName={(item) =>
            editingMapel?.id === item.id ? 'bg-amber-50/80 font-medium' : ''
          }
          enablePagination={true}
          defaultPageSize={25}
        />
      </div>

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
