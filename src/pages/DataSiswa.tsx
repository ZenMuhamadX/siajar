import React, { useState, useEffect } from 'react';
import {
  DAFTAR_STATUS_PENEMPATAN,
  DAFTAR_STATUS_SISWA,
  LABEL_STATUS_SISWA,
  type SiswaStatus,
  type SiswaTerdaftar,
} from '../types';
import {
  getDaftarSiswa,
  addSiswa,
  updateSiswa,
  deleteSiswa,
} from '../services/agendaService';
import { useClassLabels } from '../contexts/ClassContext';
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
  // Daftar kelas berasal dari master data (`agenda.kelas`), bukan konstanta
  // hardcoded — supaya rombel baru langsung muncul tanpa deploy ulang.
  const kelasLabels = useClassLabels();

  const [selectedFilterKelas, setSelectedFilterKelas] = useState<string>('SEMUA');
  // Bawaannya 'AKTIF', bukan 'SEMUA': begitu ada siswa lulus atau pindah, daftar
  // akan bercampur mantan siswa yang kelasnya "—" dan justru menutupi yang masih
  // aktif. Yang lain tetap bisa dilihat dengan mengganti filter ini.
  const [selectedFilterStatus, setSelectedFilterStatus] = useState<string>('AKTIF');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [siswaList, setSiswaList] = useState<SiswaTerdaftar[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form states for Add / Edit
  const [namaInput, setNamaInput] = useState<string>('');
  const [nisInput, setNisInput] = useState<string>('');
  const [kelasInput, setKelasInput] = useState<string>('');
  const [statusInput, setStatusInput] = useState<SiswaStatus>('AKTIF');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchSiswa = async () => {
    setIsLoading(true);
    try {
      const data = await getDaftarSiswa({
        kelas: selectedFilterKelas === 'SEMUA' ? undefined : selectedFilterKelas,
        // Siswa yang sudah lulus atau pindah tidak punya penempatan lagi, tetapi
        // tetap harus terlihat di sini — justru statusnya yang perlu diubah.
        sertakanTanpaKelas: true,
      });
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
    // Kelas wajib saat menambah siswa baru. Saat menyunting boleh kosong — itu
    // keadaan wajar bagi siswa yang sudah lulus atau pindah.
    if (!editingId && !kelasInput.trim()) {
      showToast('error', 'Kelas siswa belum dipilih.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateSiswa(editingId, {
          nama: namaInput,
          kelas: kelasInput,
          nis: nisInput,
          status: statusInput,
        });
        showToast('success', 'Data siswa berhasil diperbarui.');
        setEditingId(null);
      } else {
        await addSiswa({
          nama: namaInput,
          kelas: kelasInput,
          nis: nisInput,
          status: statusInput,
        });
        showToast('success', `Siswa ${namaInput} berhasil ditambahkan.`);
      }
      setNamaInput('');
      setNisInput('');
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
    setNisInput('');
    setStatusInput('AKTIF');
    setKelasInput(
      selectedFilterKelas === 'SEMUA' ? (kelasLabels[0] ?? '') : selectedFilterKelas,
    );
    setIsFormOpen(true);
  };

  const handleEditClick = (siswa: SiswaTerdaftar) => {
    setEditingId(siswa.id);
    setNamaInput(siswa.nama_siswa);
    setNisInput(siswa.nis ?? '');
    setStatusInput(siswa.status);
    setKelasInput(siswa.kelas);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setNamaInput('');
    setNisInput('');
    setStatusInput('AKTIF');
    setKelasInput('');
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

  const hasActiveFilter =
    selectedFilterKelas !== 'SEMUA' ||
    selectedFilterStatus !== 'SEMUA' ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setSelectedFilterKelas('SEMUA');
    setSelectedFilterStatus('SEMUA');
    setSearchQuery('');
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
          isFiltered={hasActiveFilter}
          onResetFilters={resetFilters}
          filters={
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 text-xs">Kelas:</span>
                <select
                  value={selectedFilterKelas}
                  onChange={(e) => setSelectedFilterKelas(e.target.value)}
                  className={`${formStyles.select} w-auto font-semibold`}
                >
                  <option value="SEMUA">Semua Kelas</option>
                  {kelasLabels.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 text-xs">Status:</span>
                <select
                  value={selectedFilterStatus}
                  onChange={(e) => setSelectedFilterStatus(e.target.value)}
                  className={`${formStyles.select} w-auto font-semibold`}
                >
                  <option value="SEMUA">Semua Status</option>
                  {DAFTAR_STATUS_SISWA.map((s) => (
                    <option key={s} value={s}>
                      {LABEL_STATUS_SISWA[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
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
              key: 'nis',
              header: 'NIS',
              width: '110px',
              align: 'left',
              accessor: (item) => (
                <span className="font-mono text-xs text-slate-600">{item.nis || '—'}</span>
              ),
            },
            {
              key: 'kelas',
              header: 'Kelas',
              width: '100px',
              align: 'center',
              accessor: (item) => (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded-md border border-emerald-200/80 text-xs">
                  {item.kelas || '—'}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              width: '120px',
              align: 'center',
              accessor: (item) => (
                <StatusBadge status={LABEL_STATUS_SISWA[item.status] ?? item.status} />
              ),
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
          data={siswaList.filter((s) => {
            if (selectedFilterStatus !== 'SEMUA' && s.status !== selectedFilterStatus) {
              return false;
            }
            const q = searchQuery.toLowerCase().trim();
            if (!q) return true;
            return (
              s.nama_siswa.toLowerCase().includes(q) ||
              (s.nis ?? '').toLowerCase().includes(q)
            );
          })}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          isFiltered={hasActiveFilter}
          onResetFilter={resetFilters}
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
            ? 'Perbarui data siswa, termasuk kelasnya pada tahun ajaran berjalan.'
            : 'Kelas yang dipilih berlaku untuk tahun ajaran berjalan.'
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
            className="sm:col-span-3"
            required
          >
            <SelectInput
              id="siswa-kelas"
              value={kelasInput}
              onChange={(e) => setKelasInput(e.target.value)}
              className="font-bold"
            >
              {kelasInput === '' && (
                <option value="">{editingId ? '— Tidak ditempatkan —' : 'Pilih kelas…'}</option>
              )}
              {kelasLabels.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField
            label="Nama Lengkap Siswa"
            htmlFor="siswa-nama"
            className="sm:col-span-6"
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

          <FormField
            label="NIS"
            htmlFor="siswa-nis"
            className="sm:col-span-3"
            hint="Opsional. Membantu membedakan siswa bernama sama."
          >
            <TextInput
              id="siswa-nis"
              type="text"
              placeholder="Contoh: 2026001"
              value={nisInput}
              onChange={(e) => setNisInput(e.target.value)}
              className="font-mono"
            />
          </FormField>

          {/*
            Pilihan status mengikuti keadaan siswa:
            - punya kelas tahun ini  → status PADA tahun itu (tanpa Lulus, karena
              yang lulus memang tidak lagi punya kelas);
            - tidak punya kelas      → status SEKARANG, termasuk Lulus.
            Aturan ini yang membuat "punya kelas tapi berstatus lulus" mustahil.
          */}
          <FormField
            label="Status"
            htmlFor="siswa-status"
            className="sm:col-span-4"
            hint={
              kelasInput
                ? 'Berlaku untuk tahun ajaran berjalan. Selain Aktif, siswa tidak lagi muncul di absensi dan tidak ikut naik kelas.'
                : 'Lulus hanya untuk siswa yang sudah tidak punya kelas di tahun ajaran berjalan.'
            }
          >
            <SelectInput
              id="siswa-status"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value as SiswaStatus)}
            >
              {(kelasInput ? DAFTAR_STATUS_PENEMPATAN : DAFTAR_STATUS_SISWA).map((s) => (
                <option key={s} value={s}>
                  {LABEL_STATUS_SISWA[s]}
                </option>
              ))}
            </SelectInput>
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
