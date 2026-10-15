import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Edit2,
  Layers,
  Plus,
  Search,
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
  setBanyakSiswaHalaqoh,
  setKelasSumberHalaqoh,
  updateHalaqoh,
} from '../../services/halaqohService';
import { resolveAcademicYearId } from '../../services/agendaService';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/admin/PageHeader';
import { DataTable, FilterBar, FormModal, formStyles, type Column } from '../../components/common';

interface HalaqohPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

/**
 * Halaqoh Ummi — kelompok belajar lintas kelas untuk mapel berkelompok.
 *
 * Sejak revisi "halaqoh lintas kelas", satu halaqoh TIDAK lagi milik satu kelas:
 * ia punya DAFTAR KELAS SUMBER (kolam) dan milik satu tahun ajaran. Alur layar:
 *   1. buat halaqoh + pilih kelas sumbernya,
 *   2. klik barisnya untuk membuka panel anggota, lalu isi dari kandidat
 *      (siswa kelas sumber yang belum berhalaqoh).
 *
 * Tampilan memakai TABEL (bukan kartu) agar ringkas dan mudah dipindai. Daftar
 * anggota muncul sebagai PANEL INLINE tepat di bawah baris yang diklik — bukan
 * modal — supaya pengguna tetap melihat konteks daftar saat mengelola.
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

  /** Pencarian daftar halaqoh (nama / kelas sumber). */
  const [searchQuery, setSearchQuery] = useState<string>('');
  /** Baris yang panel anggotanya sedang terbuka. */
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const filteredHalaqoh = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return halaqohList;
    return halaqohList.filter(
      (h) =>
        h.nama.toLowerCase().includes(q) ||
        h.kelas.some((k) => k.toLowerCase().includes(q)),
    );
  }, [halaqohList, searchQuery]);

  const toggleExpanded = (h: HalaqohTerdaftar) => {
    setExpandedId((prev) => (prev === h.id ? null : h.id));
  };

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
      if (expandedId === deleteTarget.halaqoh.id) setExpandedId(null);
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
  const [kandidatQuery, setKandidatQuery] = useState('');
  const [selectedSiswa, setSelectedSiswa] = useState<string[]>([]);
  const [isLoadingKandidat, setIsLoadingKandidat] = useState(false);
  const [isSavingAnggota, setIsSavingAnggota] = useState(false);

  const openAddMembers = async (h: HalaqohTerdaftar) => {
    setAddTarget(h);
    setSelectedSiswa([]);
    setKandidat([]);
    setKandidatQuery('');
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

  const closeAddMembers = () => {
    setAddTarget(null);
    setKandidatQuery('');
  };

  /** Saring kandidat di sisi klien: nama, NIS, atau kelas. */
  const filteredKandidat = useMemo(() => {
    const q = kandidatQuery.trim().toLowerCase();
    if (!q) return kandidat;
    return kandidat.filter(
      (s) =>
        s.nama_siswa.toLowerCase().includes(q) ||
        (s.nis ?? '').toLowerCase().includes(q) ||
        (s.kelas ?? '').toLowerCase().includes(q),
    );
  }, [kandidat, kandidatQuery]);

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
      setExpandedId(addTarget.id);
      closeAddMembers();
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

  const columns: Column<HalaqohTerdaftar>[] = [
    {
      key: 'no',
      header: 'No',
      width: '56px',
      align: 'center',
      accessor: (_h, idx) => <span className="text-slate-600 font-medium">{idx + 1}</span>,
    },
    {
      key: 'nama',
      header: 'Nama Halaqoh',
      align: 'left',
      accessor: (h) => (
        <span className="flex items-center gap-2 min-w-0">
          <ChevronRight
            aria-hidden="true"
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
              expandedId === h.id ? 'rotate-90' : ''
            }`}
          />
          <span className="font-semibold text-slate-900 truncate">{h.nama}</span>
        </span>
      ),
    },
    {
      key: 'kelas',
      header: 'Kelas Sumber',
      align: 'left',
      accessor: (h) =>
        h.kelas.length === 0 ? (
          <span className="text-2xs text-amber-700 italic">tanpa kelas sumber</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {h.kelas.map((k) => (
              <span
                key={k}
                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 text-2xs font-semibold"
              >
                {k}
              </span>
            ))}
          </span>
        ),
    },
    {
      key: 'jumlah',
      header: 'Jumlah Anggota',
      width: '150px',
      align: 'center',
      accessor: (h) => {
        const n = (anggotaPerHalaqoh[h.id] ?? []).length;
        return (
          <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 border border-primary-100">
            <Users className="w-3 h-3" aria-hidden="true" />
            {n}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: '150px',
      align: 'right',
      accessor: (h) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openAddMembers(h);
            }}
            aria-label={`Tambah anggota ke ${h.nama}`}
            title="Tambah anggota"
            className="p-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-md transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(h);
            }}
            aria-label={`Ubah ${h.nama}`}
            title="Ubah halaqoh"
            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(h);
            }}
            aria-label={`Hapus ${h.nama}`}
            title="Hapus halaqoh"
            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  /** Panel anggota inline untuk baris yang sedang terbuka. */
  const renderMembers = (h: HalaqohTerdaftar) => {
    const anggota = anggotaPerHalaqoh[h.id] ?? [];
    return (
      <div
        role="region"
        aria-label={`Anggota ${h.nama}`}
        className="panel-expand px-4 py-3 space-y-3 bg-white border-l-2 border-primary-400"
      >
        <p className="text-2xs font-bold uppercase tracking-wider text-slate-600">
          Anggota {h.nama} · {anggota.length} siswa
        </p>

        {anggota.length === 0 ? (
          <p className="text-2xs text-slate-500 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            Belum ada anggota. Klik tombol + di kolom Aksi untuk memilih dari kelas sumber.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {anggota.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{a.nama_siswa}</p>
                  <p className="text-2xs font-mono text-slate-500">
                    {a.kelas || '—'} · {a.nis || '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAnggota(a)}
                  aria-label={`Keluarkan ${a.nama_siswa}`}
                  title="Keluarkan dari kelompok"
                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Halaqoh Ummi"
        description="Buat kelompok belajar lintas kelas untuk mapel berkelompok. Klik barisnya untuk melihat daftar anggotanya; tambah anggota lewat kolom Aksi. Guru tiap kelompok ditentukan di baris jadwal."
      />

      {!academicYearId && !classesLoading && (
        <p className="text-2xs text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
          Belum ada tahun ajaran aktif. Halaqoh dibuat per tahun ajaran — aktifkan tahun ajaran dulu
          di menu Tahun Ajaran.
        </p>
      )}

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari halaqoh / kelas..."
        searchLabel="Cari halaqoh"
        isFiltered={Boolean(searchQuery.trim())}
        onResetFilters={() => setSearchQuery('')}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
              <Users className="w-4 h-4 text-primary-600" />
              <span>
                {halaqohList.length} halaqoh · {totalAnggota} siswa
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
        }
      />

      <DataTable
        columns={columns}
        data={filteredHalaqoh}
        keyExtractor={(h) => h.id}
        isLoading={isLoading}
        isError={Boolean(loadError)}
        errorMessage={loadError ?? undefined}
        onRetry={loadData}
        isFiltered={Boolean(searchQuery.trim())}
        onResetFilter={() => setSearchQuery('')}
        emptyTitle="Belum ada halaqoh"
        emptyDescription={
          searchQuery.trim()
            ? 'Tidak ada halaqoh yang sesuai pencarian.'
            : isSiap
              ? 'Klik "Tambah Halaqoh" untuk membuat kelompok pertama, lalu pilih kelas sumbernya.'
              : 'Aktifkan tahun ajaran terlebih dahulu.'
        }
        emptyIcon={<Layers className="w-5 h-5" />}
        onRowClick={toggleExpanded}
        isRowExpanded={(h) => expandedId === h.id}
        renderExpandedRow={renderMembers}
        rowClassName={(h) => (expandedId === h.id ? 'bg-slate-50/80' : '')}
        enablePagination={true}
        defaultPageSize={25}
      />

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
                        className={formStyles.checkbox}
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

      {/* Modal: tambah anggota dari kandidat (dengan pencarian) */}
      <FormModal
        isOpen={Boolean(addTarget)}
        onClose={closeAddMembers}
        title="Tambah anggota"
        /* Cegah implicit submission saat Enter di kotak pencarian — tanpa ini,
           Enter di input akan me-reload halaman. Aksi nyata pakai tombol. */
        onSubmit={(e) => e.preventDefault()}
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
              <button type="button" onClick={closeAddMembers} className={formStyles.ghostBtn}>
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
            <p className="text-xs text-slate-600 py-4 text-center">Memuat kandidat…</p>
          ) : kandidat.length === 0 ? (
            <p className="text-xs text-slate-600">
              Tidak ada kandidat. Semua siswa aktif dari kelas sumber sudah masuk halaqoh, atau
              kelas sumber belum diisi.
            </p>
          ) : (
            <>
              <div className="relative mb-3">
                <Search
                  aria-hidden="true"
                  className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="text"
                  autoFocus
                  value={kandidatQuery}
                  onChange={(e) => setKandidatQuery(e.target.value)}
                  placeholder="Cari nama / NIS / kelas..."
                  aria-label="Cari siswa kandidat"
                  className={`${formStyles.input} pl-8`}
                />
              </div>

              {filteredKandidat.length === 0 ? (
                <p className="text-xs text-slate-600 py-4 text-center">
                  Tidak ada siswa yang cocok dengan pencarian.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto -mx-1">
                  {filteredKandidat.map((s) => {
                    const checked = selectedSiswa.includes(s.id);
                    return (
                      <li key={s.id}>
                        <label className="flex items-center gap-3 px-1 py-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSiswa(s.id)}
                            className={formStyles.checkbox}
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
            </>
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
