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
  SelectInput,
  formStyles,
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
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

    setIsSaving(true);
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
      setIsFormOpen(false);
      fetchSiswa();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan siswa. ' + (err?.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setNamaInput('');
    setKelasInput(
      selectedFilterKelas === 'SEMUA' ? 'KELAS 1' : (selectedFilterKelas as KelasOption),
    );
    setIsFormOpen(true);
  };

  const handleEditClick = (siswa: Siswa) => {
    setEditingId(siswa.id);
    setNamaInput(siswa.nama_siswa);
    setKelasInput(siswa.kelas as KelasOption);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
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
              <span className="text-slate-600 text-xs">Kelas:</span>
              <select
                value={selectedFilterKelas}
                onChange={(e) => setSelectedFilterKelas(e.target.value)}
                className={`${formStyles.select} w-auto font-semibold`}
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
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <Users className="w-4 h-4 text-primary-600" />
                <span>{siswaList.length} Siswa</span>
              </div>
              <button type="button" onClick={handleOpenCreate} className={formStyles.primaryBtn}>
                <Plus className="w-3.5 h-3.5" />
                Tambah Siswa
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
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded-md border border-emerald-200/80 text-[12px]">
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
                    aria-label="Edit Siswa"
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                    title="Edit Siswa"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                   <button
                     aria-label="Hapus Siswa"
                    type="button"
                    onClick={() => handleDelete(item.id, item.nama_siswa)}
                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
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
              : `Belum ada siswa terdaftar. Klik "Tambah Siswa" untuk menambahkan.`
          }
          rowClassName={(item) =>
            editingId === item.id ? 'bg-amber-50/80 font-medium' : ''
          }
          enablePagination={true}
          defaultPageSize={25}
        />
      </div>

      {/* Modal Tambah / Edit Siswa */}
      <FormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingId ? 'Perbarui Data Siswa' : 'Tambah Siswa Baru'}
        subtitle={
          editingId
            ? 'Perbarui data siswa yang sudah terdaftar.'
            : 'Siswa ini akan muncul di daftar absensi pada jurnal.'
        }
        onSubmit={handleSaveSiswa}
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
          <FormField
            label="Tingkat Kelas"
            htmlFor="siswa-kelas"
            className="sm:col-span-4"
            required
          >
            <SelectInput
              id="siswa-kelas"
              value={kelasInput}
              onChange={(e) => setKelasInput(e.target.value as KelasOption)}
              className="font-bold"
            >
              {DAFTAR_KELAS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField
            label="Nama Lengkap Siswa"
            htmlFor="siswa-nama"
            className="sm:col-span-8"
            required
          >
            <TextInput
              id="siswa-nama"
              type="text"
              required
              autoFocus
              placeholder="Contoh: Muhammad Fatih Al-Ayyubi"
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
            />
          </FormField>
        </div>
      </FormModal>

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
