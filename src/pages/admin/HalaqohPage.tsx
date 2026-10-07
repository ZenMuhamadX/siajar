import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Edit2,
  Layers,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AnggotaHalaqoh, Halaqoh, SiswaTerdaftar } from '../../types';
import { useClasses } from '../../contexts/ClassContext';
import {
  addHalaqoh,
  countJadwalHalaqoh,
  deleteHalaqoh,
  getAnggotaSemuaHalaqoh,
  getHalaqohByKelas,
  getSiswaBelumBerhalaqoh,
  keluarkanSiswaDariHalaqoh,
  setSiswaHalaqoh,
  updateHalaqoh,
} from '../../services/halaqohService';
import { resolveAcademicYearId } from '../../services/agendaService';
import {
  ConfirmDialog,
} from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/admin/PageHeader';
import {
  EmptyState,
  ErrorState,
  FormModal,
  LoadingState,
  formStyles,
} from '../../components/common';

interface HalaqohPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

/**
 * Halaqoh Ummi — membagi siswa satu kelas menjadi beberapa kelompok untuk mapel
 * berkelompok.
 *
 * Kenapa satu halaman, bukan dua menu terpisah (kelompok vs anggota):
 * pekerjaan sebenarnya bukan "membuat kelompok", melainkan "memindahkan anak ke
 * kelompok yang benar". Keduanya terjadi dalam satu tarikan napas, jadi
 * dipisahkan malah membuat pengguna bolak-balik antar menu.
 *
 * Susunan layar mengikuti alur kerja itu:
 *   1. pilih kelas,
 *   2. lihat kelompok yang sudah ada beserta anggotanya,
 *   3. pindahkan anak dari daftar "belum masuk kelompok" ke sebuah kelompok.
 *
 * Kenapa ada daftar "belum masuk kelompok" yang menonjol:
 * anak yang tidak masuk kelompok mana pun tidak akan muncul di absensi mapel
 * Ummi dan jurnalnya bolong. Itu kegagalan yang senyap — ketahuan setelah
 * mengajar, bukan sebelum. Karena itu jumlahnya ditampilkan sebagai peringatan,
 * bukan disembunyikan di balik tombol.
 */
export const HalaqohPage: React.FC<HalaqohPageProps> = ({ showToast }) => {
  const { classes, loading: classesLoading } = useClasses();

  const [kelasId, setKelasId] = useState<string>('');
  const [academicYearId, setAcademicYearId] = useState<string>('');

  const [halaqohList, setHalaqohList] = useState<Halaqoh[]>([]);
  const [anggotaPerHalaqoh, setAnggotaPerHalaqoh] = useState<Record<string, AnggotaHalaqoh[]>>({});
  const [belumBerhalaqoh, setBelumBerhalaqoh] = useState<SiswaTerdaftar[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveAcademicYearId()
      .then((id) => {
        if (!cancelled) setAcademicYearId(id ?? '');
      })
      .catch(() => {
        if (!cancelled) setAcademicYearId('');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Kelas yang sedang dilihat.
   *
   * `kelasId` kosong berarti "belum dipilih" — dan itu dijawab dengan kelas
   * pertama, dihitung SAAT RENDER, bukan lewat efek. Menaruhnya di efek berarti
   * menjadwalkan render kedua yang tidak perlu, dan pada sesaat itu layar
   * sempat menampilkan keadaan kosong yang tidak pernah benar-benar ada.
   */
  const selectedKelas = useMemo(
    () => classes.find((k) => k.id === kelasId) ?? classes[0] ?? null,
    [classes, kelasId],
  );
  const effectiveKelasId = selectedKelas?.id ?? '';

  /**
   * Muat ulang seluruh data kelas terpilih.
   *
   * Anggota dan daftar "belum berhalaqoh" diambil bersamaan: keduanya saling
   * melengkapi (yang satu daftar orang di dalam, yang lain di luar), dan memuat
   * hanya salah satunya membuat angka di layar tidak konsisten.
   */
  const loadData = useCallback(async () => {
    if (!effectiveKelasId || !academicYearId) {
      setHalaqohList([]);
      setAnggotaPerHalaqoh({});
      setBelumBerhalaqoh([]);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const halaqoh = await getHalaqohByKelas(effectiveKelasId);
      const ids = halaqoh.map((h) => h.id);

      const [anggota, belum] = await Promise.all([
        getAnggotaSemuaHalaqoh(ids, academicYearId),
        getSiswaBelumBerhalaqoh(effectiveKelasId, academicYearId),
      ]);

      setHalaqohList(halaqoh);
      setAnggotaPerHalaqoh(anggota);
      setBelumBerhalaqoh(belum);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data halaqoh.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveKelasId, academicYearId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ----------------- Pindah & keluarkan siswa -----------------

  const [movingSiswa, setMovingSiswa] = useState<SiswaTerdaftar | null>(null);
  const [isSavingMove, setIsSavingMove] = useState(false);

  const handleMove = async (targetHalaqohId: string) => {
    if (!movingSiswa || !academicYearId) return;
    setIsSavingMove(true);
    try {
      await setSiswaHalaqoh({
        siswaId: movingSiswa.id,
        halaqohId: targetHalaqohId,
        academicYearId,
      });
      const nama = halaqohList.find((h) => h.id === targetHalaqohId)?.nama ?? 'halaqoh';
      showToast('success', `${movingSiswa.nama_siswa} dimasukkan ke ${nama}.`);
      setMovingSiswa(null);
      await loadData();
    } catch (err) {
      showToast('error', 'Gagal memindahkan siswa. ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsSavingMove(false);
    }
  };

  /** Anggota yang dipilih untuk dikeluarkan dari kelompoknya. */
  const [selectedAnggota, setSelectedAnggota] = useState<AnggotaHalaqoh | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const confirmRemove = async () => {
    if (!selectedAnggota || !academicYearId) return;
    setIsRemoving(true);
    try {
      await keluarkanSiswaDariHalaqoh(selectedAnggota.siswa_id, academicYearId);
      showToast(
        'info',
        `${selectedAnggota.nama_siswa} dikeluarkan dari kelompok. Ia muncul di daftar "belum masuk kelompok".`,
      );
      setSelectedAnggota(null);
      await loadData();
    } catch (err) {
      showToast('error', 'Gagal mengeluarkan siswa. ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsRemoving(false);
    }
  };

  // ----------------- Kelola kelompok -----------------

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHalaqoh, setEditingHalaqoh] = useState<Halaqoh | null>(null);
  const [namaInput, setNamaInput] = useState('');
  const [isSavingForm, setIsSavingForm] = useState(false);

  const openCreate = () => {
    setEditingHalaqoh(null);
    setNamaInput('');
    setIsFormOpen(true);
  };

  const openEdit = (h: Halaqoh) => {
    setEditingHalaqoh(h);
    setNamaInput(h.nama);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaInput.trim()) {
      showToast('error', 'Nama halaqoh tidak boleh kosong.');
      return;
    }
    setIsSavingForm(true);
    try {
      if (editingHalaqoh) {
        await updateHalaqoh(editingHalaqoh.id, { nama: namaInput });
        showToast('success', 'Nama halaqoh diperbarui.');
      } else {
        await addHalaqoh({ kelasId: effectiveKelasId, nama: namaInput });
        showToast('success', `Halaqoh "${namaInput.trim()}" dibuat.`);
      }
      setIsFormOpen(false);
      setEditingHalaqoh(null);
      await loadData();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan halaqoh.');
    } finally {
      setIsSavingForm(false);
    }
  };

  /**
   * Hapus kelompok — dengan pemeriksaan jadwal lebih dulu.
   *
   * `schedule.halaqoh_id` memakai ON DELETE CASCADE, jadi menghapus kelompok
   * ikut membuang baris jadwalnya. Jumlahnya diperiksa dan disebut di dialog
   * konfirmasi; menghilangkan jadwal tanpa memberi tahu adalah kerusakan yang
   * tidak akan disadari sampai jadwal dipakai mengajar.
   */
  const [deleteTarget, setDeleteTarget] = useState<{ halaqoh: Halaqoh; jadwal: number } | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = async (h: Halaqoh) => {
    try {
      const jadwal = await countJadwalHalaqoh(h.id);
      setDeleteTarget({ halaqoh: h, jadwal });
    } catch (err) {
      showToast('error', 'Gagal memeriksa jadwal. ' + (err instanceof Error ? err.message : ''));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteHalaqoh(deleteTarget.halaqoh.id);
      showToast('success', `Halaqoh "${deleteTarget.halaqoh.nama}" dihapus.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus halaqoh.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ----------------- Ringkasan angka -----------------

  const totalAnggota = useMemo(
    () => Object.values(anggotaPerHalaqoh).reduce((n, arr) => n + arr.length, 0),
    [anggotaPerHalaqoh],
  );

  const isSiap = Boolean(effectiveKelasId && academicYearId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Halaqoh Ummi"
        description="Bagi siswa satu kelas menjadi beberapa kelompok untuk mapel berkelompok. Guru tiap kelompok ditentukan di baris jadwal."
      />

      {/* Pemilih kelas + keterangan tahun ajaran */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="halaqoh-kelas"
              className="block text-2xs font-semibold text-slate-600 mb-1.5"
            >
              Kelas
            </label>
            <select
              id="halaqoh-kelas"
              value={effectiveKelasId}
              onChange={(e) => setKelasId(e.target.value)}
              disabled={classesLoading || classes.length === 0}
              className={`${formStyles.select} min-h-11 font-bold`}
            >
              {classes.length === 0 && <option value="">Belum ada kelas</option>}
              {classes.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-2xs text-slate-600 font-semibold min-h-11">
            <Users className="w-4 h-4 text-primary-600" />
            <span>
              {totalAnggota} siswa sudah berhalaqoh
              {belumBerhalaqoh.length > 0 && (
                <span className="text-amber-700"> · {belumBerhalaqoh.length} belum</span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={openCreate}
            disabled={!isSiap}
            className={formStyles.primaryBtn}
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Halaqoh
          </button>
        </div>

        {!academicYearId && !classesLoading && (
          <p className="mt-3 text-2xs text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
            Belum ada tahun ajaran aktif. Keanggotaan halaqoh disimpan per tahun ajaran —
            aktifkan tahun ajaran dulu di menu Tahun Ajaran.
          </p>
        )}
      </div>

      {isLoading ? (
        <LoadingState message="Memuat halaqoh…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadData} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Kolom kiri: daftar kelompok */}
          <div className="lg:col-span-2 space-y-3">
            {halaqohList.length === 0 ? (
              <EmptyState
                title="Belum ada halaqoh"
                description={
                  isSiap
                    ? `Kelas ${selectedKelas?.label ?? ''} belum dibagi. Klik "Tambah Halaqoh" untuk membuat kelompok pertama.`
                    : 'Pilih kelas terlebih dahulu.'
                }
                icon={<Layers className="w-5 h-5" />}
                action={
                  isSiap ? (
                    <button type="button" onClick={openCreate} className={formStyles.primaryBtn}>
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Halaqoh
                    </button>
                  ) : undefined
                }
              />
            ) : (
              halaqohList.map((h) => {
                const anggota = anggotaPerHalaqoh[h.id] ?? [];
                return (
                  <HalaqohCard
                    key={h.id}
                    halaqoh={h}
                    anggota={anggota}
                    onEdit={() => openEdit(h)}
                    onDelete={() => handleDeleteClick(h)}
                    onRemoveAnggota={setSelectedAnggota}
                  />
                );
              })
            )}
          </div>

          {/* Kolom kanan: siswa yang belum masuk kelompok */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:sticky lg:top-4">
              <div
                className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${
                  belumBerhalaqoh.length > 0
                    ? 'bg-amber-50 border-amber-200/80'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {belumBerhalaqoh.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                  <h2 className="text-sm font-bold text-slate-800">Belum masuk kelompok</h2>
                </div>
                <span
                  className={`text-2xs font-bold px-2 py-0.5 rounded-md ${
                    belumBerhalaqoh.length > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {belumBerhalaqoh.length}
                </span>
              </div>

              {belumBerhalaqoh.length === 0 ? (
                <p className="px-4 py-5 text-2xs text-slate-600">
                  Semua siswa aktif kelas ini sudah masuk kelompok. Pembagian lengkap.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                  {belumBerhalaqoh.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {s.nama_siswa}
                        </p>
                        <p className="text-2xs font-mono text-slate-500">{s.nis || '—'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMovingSiswa(s)}
                        disabled={halaqohList.length === 0}
                        className={`${formStyles.ghostBtn} shrink-0 disabled:opacity-40`}
                        title={
                          halaqohList.length === 0
                            ? 'Buat halaqoh dulu'
                            : 'Masukkan ke sebuah halaqoh'
                        }
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Masukkan
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: masukkan siswa ke sebuah halaqoh */}
      <FormModal
        isOpen={Boolean(movingSiswa)}
        onClose={() => setMovingSiswa(null)}
        title="Masukkan ke halaqoh"
        subtitle={movingSiswa ? `Pilih kelompok untuk ${movingSiswa.nama_siswa}.` : undefined}
        size="sm"
        busy={isSavingMove}
      >
        <div className="p-5 space-y-2">
          {halaqohList.length === 0 ? (
            <p className="text-xs text-slate-600">
              Belum ada halaqoh di kelas ini. Tutup dialog lalu buat halaqoh terlebih dahulu.
            </p>
          ) : (
            halaqohList.map((h) => {
              const jumlah = (anggotaPerHalaqoh[h.id] ?? []).length;
              return (
                <button
                  key={h.id}
                  type="button"
                  disabled={isSavingMove}
                  onClick={() => handleMove(h.id)}
                  className="w-full min-h-11 flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:border-primary-400 hover:bg-primary-50/50 transition text-left disabled:opacity-50"
                >
                  <span className="text-xs font-semibold text-slate-900">{h.nama}</span>
                  <span className="text-2xs text-slate-500 shrink-0">{jumlah} siswa</span>
                </button>
              );
            })
          )}
        </div>
      </FormModal>

      {/* Modal: buat / ubah nama halaqoh */}
      <FormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingHalaqoh(null);
        }}
        title={editingHalaqoh ? 'Ubah Nama Halaqoh' : 'Tambah Halaqoh'}
        subtitle={
          editingHalaqoh
            ? 'Nama kelompok yang dikenali guru di lapangan.'
            : `Kelompok baru di kelas ${selectedKelas?.label ?? ''}.`
        }
        size="sm"
        busy={isSavingForm}
        onSubmit={handleSaveForm}
        footer={(formId) => (
          <>
            <span />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingHalaqoh(null);
                }}
                className={formStyles.ghostBtn}
              >
                Batal
              </button>
              <button type="submit" form={formId} disabled={isSavingForm} className={formStyles.primaryBtn}>
                <Check className="w-3.5 h-3.5" />
                {isSavingForm ? 'Menyimpan…' : editingHalaqoh ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </>
        )}
      >
        <div className="p-5 space-y-4">
          <div>
            <label
              htmlFor="halaqoh-nama"
              className="block text-2xs font-semibold text-slate-600 mb-1.5"
            >
              Nama Halaqoh <span className="text-rose-600">*</span>
            </label>
            <input
              id="halaqoh-nama"
              type="text"
              autoFocus
              required
              maxLength={60}
              placeholder="Contoh: Halaqoh 1"
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
              className={`${formStyles.input} min-h-11`}
            />
            <p className="mt-1.5 text-2xs text-slate-500">
              Nama harus berbeda dari halaqoh lain di kelas ini.
            </p>
          </div>
        </div>
      </FormModal>

      {/* Konfirmasi: keluarkan anggota */}
      <ConfirmDialog
        isOpen={Boolean(selectedAnggota)}
        onClose={() => setSelectedAnggota(null)}
        onConfirm={confirmRemove}
        isLoading={isRemoving}
        title="Keluarkan dari halaqoh?"
        message={
          selectedAnggota
            ? `${selectedAnggota.nama_siswa} akan dikeluarkan dari kelompoknya. Ia tidak dihapus — hanya kembali ke daftar "belum masuk kelompok" agar bisa ditempatkan ulang.`
            : ''
        }
        confirmText="Keluarkan"
      />

      {/* Konfirmasi: hapus kelompok (menyebut dampak jadwal) */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Hapus halaqoh?"
        message={
          deleteTarget
            ? deleteTarget.jadwal > 0
              ? `Halaqoh "${deleteTarget.halaqoh.nama}" akan dihapus. PERHATIAN: ${deleteTarget.jadwal} baris jadwal yang menunjuk kelompok ini ikut terhapus, dan bagian jurnal yang sudah tertulis untuknya juga. Tindakan ini tidak bisa dibatalkan.`
              : `Halaqoh "${deleteTarget.halaqoh.nama}" akan dihapus. Belum ada baris jadwal yang menunjuk kelompok ini, jadi tidak ada jadwal yang ikut terhapus.`
            : ''
        }
        confirmText="Hapus"
      />
    </div>
  );
};

/**
 * Satu kartu kelompok beserta anggotanya.
 *
 * Dipisah jadi komponen sendiri supaya daftar kelompok dengan anggotanya tidak
 * membuat fungsi halaman ini sulit dibaca — dan supaya React tidak membangun
 * ulang seluruh daftar saat satu anggota dikeluarkan.
 */
const HalaqohCard: React.FC<{
  halaqoh: Halaqoh;
  anggota: AnggotaHalaqoh[];
  onEdit: () => void;
  onDelete: () => void;
  onRemoveAnggota: (a: AnggotaHalaqoh) => void;
}> = ({ halaqoh, anggota, onEdit, onDelete, onRemoveAnggota }) => {
  const [expanded, setExpanded] = useState<boolean>(true);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 min-h-11 text-left"
          aria-expanded={expanded}
        >
          <Layers className="w-4 h-4 text-primary-600 shrink-0" />
          <span className="text-sm font-bold text-slate-900">{halaqoh.nama}</span>
          <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
            {anggota.length}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Ubah nama ${halaqoh.nama}`}
            title="Ubah nama"
            className="p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Hapus ${halaqoh.nama}`}
            title="Hapus halaqoh"
            className="p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div>
          {anggota.length === 0 ? (
            <p className="px-4 py-4 text-2xs text-slate-500">
              Belum ada anggota. Pindahkan siswa dari daftar &ldquo;belum masuk kelompok&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {anggota.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{a.nama_siswa}</p>
                    <p className="text-2xs font-mono text-slate-500">{a.nis || '—'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAnggota(a)}
                    aria-label={`Keluarkan ${a.nama_siswa}`}
                    title="Keluarkan dari kelompok"
                    className="p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition shrink-0"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
