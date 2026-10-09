import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Edit2,
  Layers,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { AnggotaHalaqoh, HalaqohTerdaftar, SiswaTerdaftar } from '../../types';
import { useClasses } from '../../contexts/ClassContext';
import {
  addHalaqoh,
  countJadwalHalaqoh,
  deleteHalaqoh,
  getAnggotaSemuaHalaqoh,
  getHalaqohByTahunAjaran,
  getKandidatAnggota,
  keluarkanSiswaDariHalaqoh,
  salinHalaqohDariTahunLalu,
  setBanyakSiswaHalaqoh,
  setKelasSumberHalaqoh,
  updateHalaqoh,
} from '../../services/halaqohService';
import { resolveAcademicYearId } from '../../services/agendaService';
import { ConfirmDialog } from '../../components/ConfirmDialog';
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
 * Halaqoh Ummi — kelompok belajar lintas kelas untuk mapel berkelompok.
 *
 * Sejak revisi "halaqoh lintas kelas", satu halaqoh TIDAK lagi milik satu kelas:
 * ia punya DAFTAR KELAS SUMBER (kolam) dan milik satu tahun ajaran. Alur layar:
 *   1. buat halaqoh + pilih kelas sumbernya,
 *   2. isi anggotanya dari kandidat (siswa kelas sumber yang belum berhalaqoh).
 *
 * Kenapa kelas sumber penting: ia menyaring siapa yang boleh dipilih jadi
 * anggota. Satu kelas boleh menyuplai beberapa halaqoh, dan satu halaqoh boleh
 * menarik dari beberapa kelas.
 */
export const HalaqohPage: React.FC<HalaqohPageProps> = ({ showToast }) => {
  const { classes, loading: classesLoading } = useClasses();

  const [academicYearId, setAcademicYearId] = useState<string>('');

  const [halaqohList, setHalaqohList] = useState<HalaqohTerdaftar[]>([]);
  const [anggotaPerHalaqoh, setAnggotaPerHalaqoh] = useState<Record<string, AnggotaHalaqoh[]>>({});

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

  const loadData = useCallback(async () => {
    if (!academicYearId) {
      setHalaqohList([]);
      setAnggotaPerHalaqoh({});
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const halaqoh = await getHalaqohByTahunAjaran(academicYearId);
      const ids = halaqoh.map((h) => h.id);
      const anggota = await getAnggotaSemuaHalaqoh(ids, academicYearId);
      setHalaqohList(halaqoh);
      setAnggotaPerHalaqoh(anggota);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data halaqoh.');
    } finally {
      setIsLoading(false);
    }
  }, [academicYearId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalAnggota = useMemo(
    () => Object.values(anggotaPerHalaqoh).reduce((n, arr) => n + arr.length, 0),
    [anggotaPerHalaqoh],
  );

  // ----------------- Kelola kelompok (buat / ubah / hapus) -----------------

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHalaqoh, setEditingHalaqoh] = useState<HalaqohTerdaftar | null>(null);
  const [namaInput, setNamaInput] = useState('');
  const [kelasInput, setKelasInput] = useState<string[]>([]);
  const [isSavingForm, setIsSavingForm] = useState(false);

  const openCreate = () => {
    setEditingHalaqoh(null);
    setNamaInput('');
    setKelasInput([]);
    setIsFormOpen(true);
  };

  const openEdit = (h: HalaqohTerdaftar) => {
    setEditingHalaqoh(h);
    setNamaInput(h.nama);
    setKelasInput(h.kelas_ids);
    setIsFormOpen(true);
  };

  const toggleKelas = (kelasId: string) => {
    setKelasInput((prev) =>
      prev.includes(kelasId) ? prev.filter((k) => k !== kelasId) : [...prev, kelasId],
    );
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaInput.trim()) {
      showToast('error', 'Nama halaqoh tidak boleh kosong.');
      return;
    }
    if (kelasInput.length === 0) {
      showToast('error', 'Pilih minimal satu kelas sumber.');
      return;
    }
    setIsSavingForm(true);
    try {
      if (editingHalaqoh) {
        await updateHalaqoh(editingHalaqoh.id, { nama: namaInput });
        await setKelasSumberHalaqoh(editingHalaqoh.id, kelasInput);
        showToast('success', 'Halaqoh diperbarui.');
      } else {
        await addHalaqoh({ academicYearId, nama: namaInput, kelasIds: kelasInput });
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
   * `schedule.halaqoh_id` memakai ON DELETE CASCADE, jadi menghapus kelompok ikut
   * membuang baris jadwalnya. Jumlahnya disebut di dialog konfirmasi.
   */
  const [deleteTarget, setDeleteTarget] = useState<{ halaqoh: HalaqohTerdaftar; jadwal: number } | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = async (h: HalaqohTerdaftar) => {
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

  // ----------------- Isi anggota (kandidat dari kelas sumber) -----------------

  const [addTarget, setAddTarget] = useState<HalaqohTerdaftar | null>(null);
  const [kandidat, setKandidat] = useState<SiswaTerdaftar[]>([]);
  const [selectedSiswa, setSelectedSiswa] = useState<string[]>([]);
  const [isLoadingKandidat, setIsLoadingKandidat] = useState(false);
  const [isSavingAnggota, setIsSavingAnggota] = useState(false);

  const openAddMembers = async (h: HalaqohTerdaftar) => {
    setAddTarget(h);
    setSelectedSiswa([]);
    setKandidat([]);
    setIsLoadingKandidat(true);
    try {
      const list = await getKandidatAnggota(h.id, academicYearId);
      setKandidat(list);
    } catch (err) {
      showToast('error', 'Gagal memuat kandidat. ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoadingKandidat(false);
    }
  };

  const toggleSiswa = (siswaId: string) => {
    setSelectedSiswa((prev) =>
      prev.includes(siswaId) ? prev.filter((s) => s !== siswaId) : [...prev, siswaId],
    );
  };

  const handleAddSelected = async () => {
    if (!addTarget || selectedSiswa.length === 0) return;
    setIsSavingAnggota(true);
    try {
      await setBanyakSiswaHalaqoh(selectedSiswa, addTarget.id, academicYearId);
      showToast('success', `${selectedSiswa.length} siswa dimasukkan ke ${addTarget.nama}.`);
      setAddTarget(null);
      await loadData();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menambah anggota.');
    } finally {
      setIsSavingAnggota(false);
    }
  };

  const [selectedAnggota, setSelectedAnggota] = useState<AnggotaHalaqoh | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const confirmRemove = async () => {
    if (!selectedAnggota) return;
    setIsRemoving(true);
    try {
      await keluarkanSiswaDariHalaqoh(selectedAnggota.siswa_id, academicYearId);
      showToast(
        'info',
        `${selectedAnggota.nama_siswa} dikeluarkan dari kelompok. Ia kembali ke daftar kandidat.`,
      );
      setSelectedAnggota(null);
      await loadData();
    } catch (err) {
      showToast('error', 'Gagal mengeluarkan siswa. ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsRemoving(false);
    }
  };

  const isSiap = Boolean(academicYearId);

  /**
   * Salin kerangka halaqoh dari tahun lalu (nama + kelas sumber, tanpa anggota).
   *
   * Berguna tepat setelah kenaikan kelas: kelompoknya sudah ada, guru tinggal
   * mengisi anggotanya. Roster sengaja tidak disalin — ia berubah tiap tahun.
   */
  const [isSalin, setIsSalin] = useState(false);
  const handleSalin = async () => {
    if (!academicYearId) return;
    setIsSalin(true);
    try {
      const { jumlah, dari } = await salinHalaqohDariTahunLalu(academicYearId);
      showToast(
        'success',
        `${jumlah} halaqoh disalin dari ${dari ?? 'tahun lain'}. Isi anggotanya dulu sebelum dipakai.`,
      );
      await loadData();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyalin halaqoh.');
    } finally {
      setIsSalin(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Halaqoh Ummi"
        description="Buat kelompok belajar lintas kelas untuk mapel berkelompok. Kelas sumber menentukan siapa yang boleh jadi anggota; guru tiap kelompok ditentukan di baris jadwal."
      />

      {/* Ringkasan + tambah */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-2xs text-slate-600 font-semibold min-h-11">
            <Users className="w-4 h-4 text-primary-600" />
            <span>
              {halaqohList.length} halaqoh · {totalAnggota} siswa berhalaqoh
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
            Belum ada tahun ajaran aktif. Halaqoh dibuat per tahun ajaran — aktifkan tahun ajaran
            dulu di menu Tahun Ajaran.
          </p>
        )}
      </div>

      {isLoading ? (
        <LoadingState message="Memuat halaqoh…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadData} />
      ) : halaqohList.length === 0 ? (
        <EmptyState
          title="Belum ada halaqoh"
          description={
            isSiap
              ? 'Klik "Tambah Halaqoh" untuk membuat kelompok pertama, lalu pilih kelas sumbernya.'
              : 'Aktifkan tahun ajaran terlebih dahulu.'
          }
          icon={<Layers className="w-5 h-5" />}
          action={
            isSiap ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={openCreate} className={formStyles.primaryBtn}>
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Halaqoh
                </button>
                <button
                  type="button"
                  onClick={handleSalin}
                  disabled={isSalin}
                  className={`${formStyles.ghostBtn} disabled:opacity-40`}
                >
                  {isSalin ? 'Menyalin…' : 'Salin dari tahun lalu'}
                </button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {halaqohList.map((h) => (
            <HalaqohCard
              key={h.id}
              halaqoh={h}
              anggota={anggotaPerHalaqoh[h.id] ?? []}
              onEdit={() => openEdit(h)}
              onDelete={() => handleDeleteClick(h)}
              onAddMembers={() => openAddMembers(h)}
              onRemoveAnggota={setSelectedAnggota}
            />
          ))}
        </div>
      )}

      {/* Modal: buat / ubah halaqoh (nama + kelas sumber) */}
      <FormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingHalaqoh(null);
        }}
        title={editingHalaqoh ? 'Ubah Halaqoh' : 'Tambah Halaqoh'}
        subtitle={
          editingHalaqoh
            ? 'Ubah nama dan/atau kelas sumber kelompok ini.'
            : 'Kelompok baru untuk tahun ajaran ini. Pilih kelas sumbernya.'
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
              placeholder="Contoh: Halaqoh A"
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
              className={`${formStyles.input} min-h-11`}
            />
            <p className="mt-1.5 text-2xs text-slate-500">
              Nama harus berbeda dari halaqoh lain di tahun ajaran ini.
            </p>
          </div>

          <div>
            <span className="block text-2xs font-semibold text-slate-600 mb-1.5">
              Kelas sumber <span className="text-rose-600">*</span>
            </span>
            <p className="mb-2 text-2xs text-slate-500">
              Anggota halaqoh ini nanti dipilih dari kelas-kelas berikut. Satu kelas boleh masuk
              ke beberapa halaqoh.
            </p>
            {classesLoading ? (
              <p className="text-2xs text-slate-500">Memuat kelas…</p>
            ) : classes.length === 0 ? (
              <p className="text-2xs text-amber-700">Belum ada kelas di master data.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {classes.map((k) => {
                  const checked = kelasInput.includes(k.id);
                  return (
                    <label
                      key={k.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                        checked
                          ? 'border-primary-400 bg-primary-50/60'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleKelas(k.id)}
                        className="accent-primary-600"
                      />
                      <span className="text-xs font-semibold text-slate-800">{k.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </FormModal>

      {/* Modal: tambah anggota dari kandidat */}
      <FormModal
        isOpen={Boolean(addTarget)}
        onClose={() => setAddTarget(null)}
        title="Tambah anggota"
        subtitle={
          addTarget
            ? `Pilih siswa dari kelas sumber ${addTarget.kelas.join(', ') || '—'} untuk ${addTarget.nama}.`
            : undefined
        }
        size="md"
        busy={isSavingAnggota}
        footer={(formId) => (
          <>
            <span className="text-2xs text-slate-500">
              {selectedSiswa.length > 0 ? `${selectedSiswa.length} dipilih` : ''}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAddTarget(null)} className={formStyles.ghostBtn}>
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddSelected}
                disabled={isSavingAnggota || selectedSiswa.length === 0}
                className={`${formStyles.primaryBtn} disabled:opacity-40`}
                form={formId}
              >
                <UserPlus className="w-3.5 h-3.5" />
                {isSavingAnggota ? 'Menyimpan…' : 'Masukkan terpilih'}
              </button>
            </div>
          </>
        )}
      >
        <div className="p-5">
          {isLoadingKandidat ? (
            <LoadingState message="Memuat kandidat…" />
          ) : kandidat.length === 0 ? (
            <p className="text-xs text-slate-600">
              Tidak ada kandidat. Semua siswa aktif dari kelas sumber sudah masuk halaqoh, atau
              kelas sumber belum diisi.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto -mx-1">
              {kandidat.map((s) => {
                const checked = selectedSiswa.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className="flex items-center gap-3 px-1 py-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSiswa(s.id)}
                        className="accent-primary-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-900 truncate">
                          {s.nama_siswa}
                        </span>
                        <span className="block text-2xs font-mono text-slate-500">
                          {s.kelas || '—'} · {s.nis || '—'}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
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
            ? `${selectedAnggota.nama_siswa} akan dikeluarkan dari kelompoknya. Ia tidak dihapus — hanya kembali ke daftar kandidat agar bisa ditempatkan ulang.`
            : ''
        }
        confirmText="Keluarkan"
      />

      {/* Konfirmasi: hapus kelompok */}
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
 * membuat fungsi halaman ini sulit dibaca.
 */
const HalaqohCard: React.FC<{
  halaqoh: HalaqohTerdaftar;
  anggota: AnggotaHalaqoh[];
  onEdit: () => void;
  onDelete: () => void;
  onAddMembers: () => void;
  onRemoveAnggota: (a: AnggotaHalaqoh) => void;
}> = ({ halaqoh, anggota, onEdit, onDelete, onAddMembers, onRemoveAnggota }) => {
  const [expanded, setExpanded] = useState<boolean>(true);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
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
          <span className="text-2xs font-semibold text-slate-500">
            {halaqoh.kelas.length > 0 ? `kelas ${halaqoh.kelas.join(', ')}` : 'tanpa kelas sumber'}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddMembers}
            className={`${formStyles.ghostBtn} shrink-0`}
            title="Tambah anggota"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Anggota
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Ubah ${halaqoh.nama}`}
            title="Ubah halaqoh"
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
            <p className="px-4 py-4 text-2xs text-slate-500 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              Belum ada anggota. Klik &ldquo;Anggota&rdquo; untuk memilih dari kelas sumber.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {anggota.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{a.nama_siswa}</p>
                    <p className="text-2xs font-mono text-slate-500">
                      {a.kelas || '—'} · {a.nis || '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAnggota(a)}
                    aria-label={`Keluarkan ${a.nama_siswa}`}
                    title="Keluarkan dari kelompok"
                    className="p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
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
