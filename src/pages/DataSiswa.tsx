import React, { useState, useEffect } from 'react';
import { DAFTAR_KELAS, type KelasOption, type Siswa } from '../types';
import {
  getDaftarSiswa,
  addSiswa,
  updateSiswa,
  deleteSiswa,
} from '../services/agendaService';
import {
  Users,
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

interface DataSiswaProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DataSiswa: React.FC<DataSiswaProps> = ({ showToast }) => {
  const [selectedFilterKelas, setSelectedFilterKelas] = useState<string>('KELAS 1');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form states for Add / Edit
  const [namaInput, setNamaInput] = useState<string>('');
  const [kelasInput, setKelasInput] = useState<KelasOption>('KELAS 1');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchSiswa = async () => {
    setIsLoading(true);
    try {
      const data = await getDaftarSiswa(
        selectedFilterKelas === 'SEMUA' ? undefined : selectedFilterKelas
      );
      setSiswaList(data);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat data siswa.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSiswa();
  }, [selectedFilterKelas]);

  const handleSaveSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaInput.trim()) {
      showToast('error', 'Nama siswa tidak boleh kosong.');
      return;
    }

    try {
      if (editingId) {
        await updateSiswa(editingId, namaInput, kelasInput);
        showToast('success', 'Data siswa berhasil diperbarui.');
        setEditingId(null);
      } else {
        await addSiswa(namaInput, kelasInput);
        showToast('success', `Siswa ${namaInput} berhasil ditambahkan.`);
      }
      setNamaInput('');
      fetchSiswa();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan siswa. ' + (err?.message || ''));
    }
  };

  const handleEditClick = (siswa: Siswa) => {
    setEditingId(siswa.id);
    setNamaInput(siswa.nama_siswa);
    setKelasInput(siswa.kelas as KelasOption);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNamaInput('');
    setKelasInput('KELAS 1');
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
      await deleteSiswa(deleteTarget.id);
      showToast('success', `Siswa ${deleteTarget.nama} berhasil dihapus.`);
      setDeleteTarget(null);
      fetchSiswa();
    } catch (err) {
      showToast('error', 'Gagal menghapus siswa.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Siswa"
        description="Daftar siswa untuk pengisian absensi jurnal pembelajaran."
      />

      {/* Add / Edit Form */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-xs">
        <form onSubmit={handleSaveSiswa} className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            {editingId ? (
              <>
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Perbarui Data Siswa</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tambah Siswa Baru</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-4">
              <label className="block text-[10px] sm:text-[11px] font-semibold text-slate-600 mb-1">
                Tingkat Kelas
              </label>
              <select
                value={kelasInput}
                onChange={(e) => setKelasInput(e.target.value as KelasOption)}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-8">
              <label className="block text-[10px] sm:text-[11px] font-semibold text-slate-600 mb-1">
                Nama Lengkap Siswa
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  required
                  placeholder="Contoh: Muhammad Fatih Al-Ayyubi"
                  value={namaInput}
                  onChange={(e) => setNamaInput(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 sm:px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1 shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Simpan' : 'Tambah'}</span>
                </button>
                {editingId && (
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
          </div>
        </form>
      </div>

      {/* List Siswa */}
      <div className="space-y-3">
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari nama siswa..."
          isFiltered={selectedFilterKelas !== 'SEMUA' || Boolean(searchQuery.trim())}
          onResetFilters={() => {
            setSelectedFilterKelas('SEMUA');
            setSearchQuery('');
          }}
          filters={
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs">Kelas:</span>
              <select
                value={selectedFilterKelas}
                onChange={(e) => setSelectedFilterKelas(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
              >
                <option value="SEMUA">Semua Kelas</option>
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          }
          actions={
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>{siswaList.length} Siswa</span>
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
              key: 'nama_siswa',
              header: 'Nama Lengkap Siswa',
              align: 'left',
              accessor: (item) => (
                <span className="font-semibold text-slate-900">
                  {item.nama_siswa}
                </span>
              ),
            },
            {
              key: 'kelas',
              header: 'Kelas',
              width: '100px',
              align: 'center',
              accessor: (item) => (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded-md border border-emerald-200/80 text-[10px]">
                  {item.kelas}
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
                    title="Edit Siswa"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.nama_siswa)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                    title="Hapus Siswa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
          data={siswaList.filter((s) =>
            searchQuery.trim()
              ? s.nama_siswa.toLowerCase().includes(searchQuery.toLowerCase().trim())
              : true
          )}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          isFiltered={selectedFilterKelas !== 'SEMUA' || Boolean(searchQuery.trim())}
          onResetFilter={() => {
            setSelectedFilterKelas('SEMUA');
            setSearchQuery('');
          }}
          emptyTitle="Belum ada data siswa"
          emptyDescription={
            searchQuery.trim()
              ? 'Tidak ada siswa yang sesuai pencarian.'
              : `Belum ada siswa terdaftar di ${selectedFilterKelas}.`
          }
          rowClassName={(item) =>
            editingId === item.id ? 'bg-amber-50/80 font-medium' : ''
          }
          enablePagination={true}
          defaultPageSize={25}
        />
      </div>

      {/* Dialog konfirmasi hapus siswa */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Hapus data siswa?"
        message={
          deleteTarget ? `Data siswa "${deleteTarget.nama}" akan dihapus permanen.` : ''
        }
        confirmText="Hapus"
      />
    </div>
  );
};
