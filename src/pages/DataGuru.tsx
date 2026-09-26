import React, { useState, useEffect } from 'react';
import type { Guru } from '../types';
import {
  getDaftarGuru,
  addGuru,
  updateGuru,
  deleteGuru,
} from '../services/agendaService';
import {
  createTeacherAccount,
  listTeacherAccounts,
  setTeacherActive,
  setTeacherCode,
  type TeacherAccount,
} from '../services/userAdminService';
import {
  UserCheck,
  Edit2,
  Trash2,
  Check,
  Plus,
  KeyRound,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
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

const MIN_CODE_LENGTH = 6;

/** Kode acak yang mudah dibaca: tanpa I/O/0/1 supaya tidak salah ketik. */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${pick(3)}-${pick(3)}`;
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

  // --- Akun login ---------------------------------------------------------
  const [accounts, setAccounts] = useState<Record<string, TeacherAccount>>({});
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [accountTarget, setAccountTarget] = useState<Guru | null>(null);
  const [kodeInput, setKodeInput] = useState('');
  const [showKode, setShowKode] = useState(false);
  const [isSavingKode, setIsSavingKode] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [accountError, setAccountError] = useState('');

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

  const fetchAccounts = async () => {
    try {
      const list = await listTeacherAccounts();
      const map: Record<string, TeacherAccount> = {};
      for (const acc of list) map[acc.guru_id] = acc;
      setAccounts(map);
      setAccountsError(null);
    } catch (err) {
      // Biasanya karena Edge Function belum di-deploy. Panel tetap bisa dipakai.
      setAccountsError((err as Error).message);
    }
  };

  useEffect(() => {
    fetchGuru();
    fetchAccounts();
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
        showToast('success', `Guru ${namaInput} berhasil ditambahkan.`);
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
      fetchAccounts();
    } catch {
      showToast('error', 'Gagal menghapus data guru.');
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Kelola akun --------------------------------------------------------

  const openAccountModal = (guru: Guru) => {
    setAccountTarget(guru);
    setKodeInput('');
    setShowKode(false);
    setSavedCode(null);
    setAccountError('');
  };

  const closeAccountModal = () => {
    setAccountTarget(null);
    setKodeInput('');
    setShowKode(false);
    setSavedCode(null);
    setAccountError('');
  };

  const handleSaveKode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountTarget) return;

    const kode = kodeInput.trim();
    if (kode.length < MIN_CODE_LENGTH) {
      setAccountError(`Kode minimal ${MIN_CODE_LENGTH} karakter.`);
      return;
    }

    setAccountError('');
    setIsSavingKode(true);
    const existing = accounts[accountTarget.id]?.has_account;
    try {
      if (existing) {
        await setTeacherCode(accountTarget.id, kode);
      } else {
        await createTeacherAccount(accountTarget.id, kode);
      }
      setSavedCode(kode);
      await fetchAccounts();
    } catch (err) {
      setAccountError((err as Error).message);
    } finally {
      setIsSavingKode(false);
    }
  };

  const handleToggleActive = async () => {
    if (!accountTarget) return;
    const acc = accounts[accountTarget.id];
    if (!acc?.has_account) return;

    setIsTogglingActive(true);
    try {
      await setTeacherActive(accountTarget.id, !acc.active);
      showToast(
        'success',
        acc.active
          ? `Akun ${accountTarget.nama_guru} dinonaktifkan.`
          : `Akun ${accountTarget.nama_guru} diaktifkan kembali.`
      );
      await fetchAccounts();
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setIsTogglingActive(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast('success', 'Kode disalin.');
    } catch {
      showToast('error', 'Gagal menyalin. Salin manual dari kotak di atas.');
    }
  };

  const targetAccount = accountTarget ? accounts[accountTarget.id] : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Guru"
        description="Atur daftar guru, akun login, dan kode masing-masing."
      />

      {accountsError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">
            Kelola akun tidak aktif: {accountsError}
          </span>
        </div>
      )}

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
              key: 'akun',
              header: 'Akun Login',
              width: '150px',
              align: 'center',
              accessor: (item) => {
                if (accountsError) {
                  return <span className="text-[11px] text-slate-400">Tidak tersedia</span>;
                }
                const acc = accounts[item.id];
                if (!acc) return <span className="text-[11px] text-slate-400">Memuat...</span>;
                if (!acc.has_account) {
                  return <StatusBadge status="DRAFT" label="Belum dibuatkan" />;
                }
                return acc.active ? (
                  <StatusBadge status="Aktif" />
                ) : (
                  <StatusBadge status="Nonaktif" />
                );
              },
            },
            {
              key: 'actions',
              header: 'Aksi',
              width: '140px',
              align: 'right',
              accessor: (item) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => openAccountModal(item)}
                    disabled={Boolean(accountsError)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    title="Kelola akun login"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
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

      {/* Modal Kelola Akun Login */}
      <FormModal
        isOpen={Boolean(accountTarget)}
        onClose={closeAccountModal}
        title="Akun Login Guru"
        subtitle={accountTarget?.nama_guru}
        size="sm"
        onSubmit={savedCode ? (e) => { e.preventDefault(); closeAccountModal(); } : handleSaveKode}
        busy={isSavingKode}
        footer={(formId) => (
          <>
            <span />
            <div className="flex items-center gap-2">
              {savedCode ? (
                <button type="button" onClick={closeAccountModal} className={formStyles.primaryBtn}>
                  <Check className="w-3.5 h-3.5" />
                  Selesai
                </button>
              ) : (
                <>
                  <button type="button" onClick={closeAccountModal} className={formStyles.ghostBtn}>
                    Batal
                  </button>
                  <button
                    type="submit"
                    form={formId}
                    disabled={isSavingKode}
                    className={formStyles.primaryBtn}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {isSavingKode
                      ? 'Menyimpan...'
                      : targetAccount?.has_account
                        ? 'Simpan Kode Baru'
                        : 'Buatkan Akun'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      >
        <div className="p-5 space-y-4">
          {savedCode ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs font-semibold text-emerald-900 mb-1">
                  Kode tersimpan
                </p>
                <p className="text-[12px] text-emerald-800 leading-relaxed">
                  Berikan kode ini kepada {accountTarget?.nama_guru}. Kode tidak
                  bisa dilihat lagi setelah ditutup — kalau lupa, buat kode baru.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold tracking-wider text-slate-900 text-center">
                  {savedCode}
                </code>
                <button
                  type="button"
                  onClick={() => copyCode(savedCode)}
                  className={formStyles.ghostBtn}
                  title="Salin kode"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Salin
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Status akun</span>
                  <span className="font-semibold text-slate-800">
                    {targetAccount?.has_account
                      ? targetAccount.active
                        ? 'Aktif'
                        : 'Nonaktif'
                      : 'Belum dibuatkan'}
                  </span>
                </div>
                {targetAccount?.last_sign_in_at && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Terakhir masuk</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(targetAccount.last_sign_in_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {accountError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{accountError}</span>
                </div>
              )}

              <FormField
                label={targetAccount?.has_account ? 'Kode Baru' : 'Kode untuk Guru Ini'}
                htmlFor="guru-kode"
                required
                hint={`Minimal ${MIN_CODE_LENGTH} karakter. Kode ini hanya untuk guru ini.`}
              >
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      id="guru-kode"
                      type={showKode ? 'text' : 'password'}
                      required
                      autoFocus
                      autoComplete="new-password"
                      placeholder="Ketik atau klik Acak"
                      value={kodeInput}
                      onChange={(e) => setKodeInput(e.target.value)}
                      className={formStyles.input}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKode((v) => !v)}
                      className="absolute right-2 top-1.5 p-0.5 text-slate-400 hover:text-slate-600 transition"
                      title={showKode ? 'Sembunyikan' : 'Lihat'}
                    >
                      {showKode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setKodeInput(generateCode());
                      setShowKode(true);
                    }}
                    className={formStyles.ghostBtn}
                    title="Buat kode acak"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Acak
                  </button>
                </div>
              </FormField>

              {targetAccount?.has_account && (
                <div className="pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleToggleActive}
                    disabled={isTogglingActive}
                    className={formStyles.ghostBtn}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {isTogglingActive
                      ? 'Memproses...'
                      : targetAccount.active
                        ? 'Nonaktifkan akun ini'
                        : 'Aktifkan kembali'}
                  </button>
                  <p className={formStyles.hint}>
                    Akun nonaktif tidak bisa masuk, tetapi datanya tetap tersimpan.
                  </p>
                </div>
              )}
            </>
          )}
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
