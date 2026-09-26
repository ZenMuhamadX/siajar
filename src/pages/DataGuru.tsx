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
  UserPlus,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import {
  DataTable,
  StatusBadge,
  FilterBar,
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
      fetchGuru();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan data guru. ' + (err?.message || ''));
    }
  };

  const handleEditClick = (guru: Guru) => {
    setEditingGuru(guru);
    setNamaInput(guru.nama_guru);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
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

      {/* Add / Edit Form */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-xs">
        <form
          onSubmit={handleSaveGuru}
          className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
        >
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            {editingGuru ? (
              <>
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Perbarui Data Guru</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                <span>Tambah Guru Baru</span>
              </>
            )}
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-semibold text-slate-600 mb-1">
              Nama Lengkap Guru (beserta gelar jika ada)
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Abdullah, S.Pd.I / Fatimah, S.Pd"
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-200">
            {editingGuru && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition"
              >
                <X className="w-3.5 h-3.5 inline mr-0.5" />
                Batal
              </button>
            )}
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingGuru ? 'Simpan' : 'Tambah Guru'}</span>
            </button>
          </div>
        </form>
      </div>

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
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <UserCheck className="w-4 h-4 text-purple-600" />
              <span>{guruList.length} Guru Terdaftar</span>
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
              : 'Gunakan formulir di atas untuk menambahkan guru baru.'
          }
          rowClassName={(item) =>
            editingGuru?.id === item.id ? 'bg-amber-50/80 font-medium' : ''
          }
          enablePagination={true}
          defaultPageSize={25}
        />
      </div>

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
