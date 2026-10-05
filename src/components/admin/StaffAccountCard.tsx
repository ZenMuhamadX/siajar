import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { FormField, TextInput, SelectInput, FormModal, formStyles } from '../common';
import {
  createStaffAccount,
  deleteStaffAccount,
  listStaffAccounts,
  setStaffPassword,
  type StaffAccount,
} from '../../services/userAdminService';

/**
 * Pengelolaan akun staf (superadmin & kurikulum).
 *
 * Hanya ditampilkan kepada superadmin — halaman Pengaturan sendiri sudah
 * dikecualikan dari tab yang boleh dibuka peran `kurikulum`
 * (lihat `KURIKULUM_TABS`), jadi tidak perlu penjaga kedua di sini.
 *
 * Kenapa menumpang di Pengaturan, bukan halaman baru:
 *   - Semua urusan keamanan akun sudah berkumpul di sini (ganti sandi sendiri).
 *   - Akun staf adalah data level sekolah, bukan master data akademik — ia
 *     tidak sekelompok dengan Siswa/Guru/Mapel.
 *
 * Peran TIDAK dipilih di halaman login: server yang menentukannya dari
 * `app_metadata`. Di sini superadmin yang menetapkannya saat membuat akun.
 */

/** Panjang sandi minimum, sejalan dengan validasi Edge Function. */
const MIN_PASSWORD = 6;

const ROLE_OPTIONS = [
  { value: 'kurikulum', label: 'Kurikulum — Master Data & Penugasan' },
  { value: 'admin', label: 'Superadmin — seluruh menu' },
] as const;

const ROLE_LABEL: Record<string, string> = {
  admin: 'Superadmin',
  kurikulum: 'Kurikulum',
};

function formatLastSignIn(iso: string | null): string {
  if (!iso) return 'Belum pernah masuk';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Status akun dalam kata — dipakai sebagai badge teks sederhana. */
const StatusPill: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold border ${
      active
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-600 border-slate-200'
    }`}
  >
    {active ? 'Aktif' : 'Nonaktif'}
  </span>
);

const RolePill: React.FC<{ role: string }> = ({ role }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold border ${
      role === 'admin'
        ? 'bg-primary-50 text-primary-700 border-primary-200'
        : 'bg-blue-50 text-blue-700 border-blue-200'
    }`}
  >
    {ROLE_LABEL[role] ?? role}
  </span>
);

export const StaffAccountCard: React.FC = () => {
  const { role: myRole, isAdmin } = useAuth();
  const showToast = useToast();

  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Modal buat/edit. `editing === null` → mode tambah.
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'kurikulum' as 'admin' | 'kurikulum',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Konfirmasi hapus.
  const [deleteTarget, setDeleteTarget] = useState<StaffAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setStaff(await listStaffAccounts());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat daftar akun staf.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = () => {
    setEditing(null);
    setForm({ email: '', name: '', role: 'kurikulum', password: '' });
    setShowPassword(false);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEdit = (account: StaffAccount) => {
    setEditing(account);
    setForm({
      email: account.email,
      name: account.name,
      role: (account.role === 'admin' ? 'admin' : 'kurikulum') as 'admin' | 'kurikulum',
      password: '',
    });
    setShowPassword(false);
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setIsFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.email.trim() || !form.email.includes('@')) {
      setFormError('Email belum valid.');
      return;
    }
    if (form.password.trim().length < MIN_PASSWORD) {
      setFormError(`Sandi minimal ${MIN_PASSWORD} karakter.`);
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        // Email & peran tidak diubah di sini — hanya sandi. Mengubah peran
        // orang lain adalah keputusan berat; lebih baik lewat akun baru
        // daripada diam-diam menaikkan wewenang.
        await setStaffPassword(form.email, form.password);
        showToast('success', `Sandi akun ${form.email} berhasil diganti.`);
      } else {
        await createStaffAccount({
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || form.email.trim(),
          role: form.role,
        });
        showToast('success', `Akun ${ROLE_LABEL[form.role]} berhasil dibuat.`);
      }
      setIsFormOpen(false);
      setEditing(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan akun.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStaffAccount(deleteTarget.email);
      showToast('success', `Akun ${deleteTarget.email} dihapus.`);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus akun.');
    } finally {
      setDeleting(false);
    }
  };

  // Halaman ini memang hanya untuk superadmin, tetapi penjaga ini menjaga
  // kalau komponen dipakai ulang di tempat lain — akun kurikulum tidak boleh
  // melihat (apalagi mengubah) daftar akun staf.
  if (!isAdmin) return null;

  const isEditing = Boolean(editing);

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Akun Staf</h3>
            <p className="text-xs text-slate-600">
              Akun untuk superadmin dan kurikulum. Guru diatur dari menu Data Guru.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className={formStyles.ghostBtn}
            title="Muat ulang daftar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Muat ulang</span>
          </button>
          <button type="button" onClick={openCreate} className={formStyles.primaryBtn}>
            <Plus className="w-3.5 h-3.5" />
            Tambah Akun
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">{loadError}</span>
        </div>
      )}

      {loading && !staff.length ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Memuat akun staf...
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {staff.map((account) => (
            <li
              key={account.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 text-xs truncate">
                    {account.name || account.email}
                  </span>
                  <RolePill role={account.role} />
                  {account.is_self && (
                    <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
                      Anda
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{account.email}</p>
                <p className="text-2xs text-slate-400 mt-0.5">
                  Terakhir masuk: {formatLastSignIn(account.last_sign_in_at)}
                </p>
              </div>

              <StatusPill active={account.active} />

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(account)}
                  className={formStyles.ghostBtn}
                  title={`Ganti sandi ${account.email}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sandi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(account)}
                  disabled={account.is_self}
                  className={`${formStyles.ghostBtn} text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={
                    account.is_self
                      ? 'Tidak bisa menghapus akun yang sedang dipakai'
                      : `Hapus ${account.email}`
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
        Peran menentukan menu yang terlihat. Batas wewenang yang sebenarnya
        ditegakkan di database, sehingga memanggil API langsung tetap ditolak.
        {myRole === 'admin' && ' Anda masuk sebagai superadmin.'}
      </p>

      {/* Modal tambah / ganti sandi */}
      <FormModal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={isEditing ? 'Ganti Sandi Akun' : 'Tambah Akun Staf'}
        subtitle={
          isEditing
            ? editing?.email
            : 'Akun baru untuk superadmin atau kurikulum.'
        }
        size="sm"
        onSubmit={handleSubmit}
        busy={saving}
        footer={(formId) => (
          <>
            <span />
            <div className="flex items-center gap-2">
              <button type="button" onClick={closeForm} className={formStyles.ghostBtn}>
                Batal
              </button>
              <button
                type="submit"
                form={formId}
                disabled={saving}
                className={formStyles.primaryBtn}
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isEditing ? (
                  <KeyRound className="w-3.5 h-3.5" />
                ) : (
                  <UserCog className="w-3.5 h-3.5" />
                )}
                {saving ? 'Menyimpan...' : isEditing ? 'Simpan Sandi' : 'Buat Akun'}
              </button>
            </div>
          </>
        )}
      >
        <div className="p-5 space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{formError}</span>
            </div>
          )}

          <FormField
            label="Email"
            htmlFor="staff-email"
            required
            hint="dipakai untuk masuk di tab Staf halaman login"
          >
            <TextInput
              id="staff-email"
              type="email"
              required
              disabled={isEditing}
              placeholder="nama@sekolah.sch.id"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>

          {!isEditing && (
            <>
              <FormField
                label="Nama"
                htmlFor="staff-name"
                hint="ditampilkan di header panel admin"
              >
                <TextInput
                  id="staff-name"
                  type="text"
                  placeholder="mis. Ustadzah Fatimah"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormField>

              <FormField
                label="Peran"
                htmlFor="staff-role"
                hint="menentukan menu yang boleh dibuka"
              >
                <SelectInput
                  id="staff-role"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as 'admin' | 'kurikulum' })
                  }
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </>
          )}

          <FormField
            label={isEditing ? 'Sandi Baru' : 'Sandi'}
            htmlFor="staff-password"
            required
            hint={`Minimal ${MIN_PASSWORD} karakter.`}
          >
            <TextInput
              id="staff-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              placeholder="Sandi untuk akun ini"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </FormField>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className={formStyles.checkbox}
            />
            Tampilkan sandi
          </label>

          {isEditing ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
              Email dan peran tidak diubah di sini. Untuk memindahkan wewenang,
              buat akun baru lalu hapus yang lama.
            </p>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
              Berikan email dan sandi ini kepada pemiliknya. Ia masuk lewat tab
              <strong> Staf </strong> di halaman login — perannya ditentukan
              server, jadi tidak perlu memilih apa pun saat masuk.
            </p>
          )}
        </div>
      </FormModal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        variant="danger"
        title="Hapus akun staf?"
        message={`Akun ${deleteTarget?.email} akan dihapus dan tidak bisa masuk lagi. Tindakan ini tidak bisa dibatalkan.`}
        confirmText="Hapus Akun"
      />
    </section>
  );
};
