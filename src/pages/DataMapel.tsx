import React, { useState, useEffect, useMemo } from 'react';
import type { MataPelajaran } from '../types';
import {
  getDaftarMapel,
  addMapel,
  updateMapel,
  deleteMapel,
} from '../services/agendaService';
import {
  SUBJECT_PALETTE,
  buildSubjectFillResolver,
  normalizeOptionalColor,
} from '../services/export/subjectPalette';
import { withHash } from '../services/settings/appSettings';
import {
  Edit2,
  Trash2,
  Check,
  BookOpen,
  Plus,
  RotateCcw,
  Wand2,
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

interface DataMapelProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DataMapel: React.FC<DataMapelProps> = ({ showToast }) => {
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form state
  const [namaInput, setNamaInput] = useState<string>('');
  /**
   * Warna disimpan sebagai teks mentah (bukan hanya hex valid) supaya pengguna
   * bisa mengetik sebagian tanpa field-nya "dibersihkan" di tengah jalan.
   * Normalisasi ke hex 6 digit dilakukan sekali saat menyimpan.
   */
  const [warnaInput, setWarnaInput] = useState<string>('');
  /**
   * Penanda mapel berkelompok (halaqoh). Disimpan di master mapel — bukan
   * disimpulkan dari nama — supaya sekolah bisa memutuskan sendiri mapel mana
   * yang berkelompok tanpa terikat teks nama mapel.
   */
  const [isHalaqohInput, setIsHalaqohInput] = useState<boolean>(false);
  const [editingMapel, setEditingMapel] = useState<MataPelajaran | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

  /**
   * Satu resolver untuk seluruh daftar, dipakai tabel DAN pratinjau form.
   * Perhitungannya sama persis dengan penulis Excel (`subjectPalette.ts`),
   * jadi warna di layar tidak akan pernah berbeda dengan warna di file.
   */
  const fillFor = useMemo(() => buildSubjectFillResolver(mapelList), [mapelList]);

  const handleSaveMapel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaInput.trim()) {
      showToast('error', 'Nama mata pelajaran tidak boleh kosong.');
      return;
    }

    setIsSaving(true);
    try {
      // Kosong = "otomatis", disimpan sebagai NULL di database.
      const warna = normalizeOptionalColor(warnaInput);
      if (editingMapel) {
        await updateMapel(editingMapel.id, namaInput, warna, isHalaqohInput);
        showToast('success', 'Mata pelajaran berhasil diperbarui.');
        setEditingMapel(null);
      } else {
        await addMapel(namaInput, warna, isHalaqohInput);
        showToast('success', `Mata pelajaran ${namaInput} berhasil ditambahkan.`);
      }
      setNamaInput('');
      setWarnaInput('');
      setIsHalaqohInput(false);
      setIsFormOpen(false);
      fetchMapel();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan mata pelajaran. ' + (err?.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingMapel(null);
    setNamaInput('');
    setWarnaInput('');
    setIsHalaqohInput(false);
    setIsFormOpen(true);
  };

  const handleEditClick = (mapel: MataPelajaran) => {
    setEditingMapel(mapel);
    setNamaInput(mapel.nama_mapel);
    setWarnaInput(mapel.warna ?? '');
    setIsHalaqohInput(Boolean(mapel.is_halaqoh));
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingMapel(null);
    setNamaInput('');
    setWarnaInput('');
    setIsHalaqohInput(false);
  };

  /** Pilih acak dari palet — hanya untuk memberi titik awal, bukan nilai final. */
  const pickRandomColor = () => {
    const next = SUBJECT_PALETTE[Math.floor(Math.random() * SUBJECT_PALETTE.length)];
    setWarnaInput(next);
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

  const warnaManual = normalizeOptionalColor(warnaInput);

  /**
   * Pratinjau harus mencerminkan hasil akhir. Karena itu mapel yang sedang
   * diedit — atau mapel baru yang belum ada di daftar — ikut dihitung BERSAMA
   * daftar, bukan dihitung sendirian. Kalau dihitung sendirian, mapel baru
   * bisa tampil dengan warna yang sudah dipakai mapel lain.
   */
  const previewFill = useMemo(() => {
    const draft = {
      id: editingMapel?.id ?? '__draft__',
      nama_mapel: namaInput,
      warna: warnaManual,
    };
    const list = editingMapel
      ? mapelList.map((m) => (m.id === editingMapel.id ? draft : m))
      : [...mapelList, draft];
    return buildSubjectFillResolver(list)(draft.id, draft.nama_mapel);
  }, [mapelList, editingMapel, namaInput, warnaManual]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mata Pelajaran"
        description="Daftar mata pelajaran yang diajarkan pada kegiatan KBM."
      />

      {/* List Mapel */}
      <div className="space-y-3">
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari nama mata pelajaran..."
          isFiltered={Boolean(searchQuery.trim())}
          onResetFilters={() => setSearchQuery('')}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                <BookOpen className="w-4 h-4 text-primary-600" />
                <span>{mapelList.length} Mata Pelajaran</span>
              </div>
              <button type="button" onClick={handleOpenCreate} className={formStyles.primaryBtn}>
                <Plus className="w-3.5 h-3.5" />
                Tambah Mapel
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
              key: 'warna',
              header: 'Warna Excel',
              width: '150px',
              align: 'left',
              accessor: (item) => {
                const manual = Boolean(normalizeOptionalColor(item.warna));
                const fill = fillFor(item.id, item.nama_mapel);
                return (
                  <div className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 shrink-0 rounded border border-slate-300"
                      style={{ backgroundColor: `#${fill}` }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[11px] uppercase text-slate-600">
                      {manual ? fill : 'Otomatis'}
                    </span>
                  </div>
                );
              },
            },
            {
              key: 'cara_ajar',
              header: 'Cara Ajar',
              width: '150px',
              align: 'center',
              accessor: (item) => (
                <StatusBadge
                  status={item.is_halaqoh ? 'BADAL' : 'AKTIF'}
                  label={item.is_halaqoh ? 'Berkelompok' : 'Seluruh Kelas'}
                />
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
                    aria-label="Edit Mata Pelajaran"
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                    title="Edit Mata Pelajaran"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                   <button
                     aria-label="Hapus Mata Pelajaran"
                    type="button"
                    onClick={() => handleDelete(item.id, item.nama_mapel)}
                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
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
              : 'Klik "Tambah Mapel" untuk menambahkan mata pelajaran baru.'
          }
          rowClassName={(item) =>
            editingMapel?.id === item.id ? 'bg-amber-50/80 font-medium' : ''
          }
          enablePagination={true}
          defaultPageSize={25}
        />
      </div>

      {/* Modal Tambah / Edit Mata Pelajaran */}
      <FormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingMapel ? 'Perbarui Data Mapel' : 'Tambah Mata Pelajaran Baru'}
        subtitle={
          editingMapel
            ? 'Perbarui nama dan warna mata pelajaran yang sudah terdaftar.'
            : 'Mata pelajaran ini akan tersedia pada agenda dan jadwal.'
        }
        size="sm"
        onSubmit={handleSaveMapel}
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
                {isSaving ? 'Menyimpan...' : editingMapel ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </>
        )}
      >
        <div className="p-5 space-y-4">
          <FormField label="Nama Mata Pelajaran" htmlFor="mapel-nama" required>
            <TextInput
              id="mapel-nama"
              type="text"
              required
              autoFocus
              placeholder="Contoh: Matematika, Bahasa Indonesia, PAI..."
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
            />
          </FormField>

          <FormField
            label="Warna Latar di Excel"
            htmlFor="mapel-warna"
            hint={
              warnaManual
                ? `Warna ini akan dipakai untuk sel ${namaInput || 'mata pelajaran ini'} di file Excel.`
                : `Belum diatur — Excel memakai warna otomatis (${previewFill}).`
            }
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="mapel-warna"
                  type="color"
                  value={withHash(previewFill)}
                  onChange={(e) => setWarnaInput(e.target.value.replace('#', '').toUpperCase())}
                  className="h-8 w-11 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  title="Pilih warna"
                  aria-label="Pilih warna mata pelajaran"
                />
                <TextInput
                  value={warnaInput}
                  maxLength={6}
                  placeholder="Otomatis"
                  onChange={(e) =>
                    setWarnaInput(
                      e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 6),
                    )
                  }
                  className="min-w-0 flex-1 font-mono uppercase"
                  aria-label="Kode hex warna"
                />
                <button
                  type="button"
                  onClick={() => setWarnaInput('')}
                  className={formStyles.ghostBtn}
                  title="Kembalikan ke warna otomatis"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Otomatis
                </button>
                <button
                  type="button"
                  onClick={pickRandomColor}
                  className={formStyles.ghostBtn}
                  title="Pilih warna acak dari palet"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Acak
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SUBJECT_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setWarnaInput(c)}
                    title={`#${c}`}
                    aria-label={`Pilih warna ${c}`}
                    className={`h-6 w-6 rounded-md border transition ${
                      warnaInput === c
                        ? 'border-slate-800 ring-2 ring-slate-300'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                    style={{ backgroundColor: `#${c}` }}
                  />
                ))}
              </div>
            </div>
          </FormField>

          {/*
            Penanda halaqoh. Hanya berpengaruh pada formulir jadwal: baris jadwal
            mapel ini WAJIB menunjuk satu kelompok (halaqoh), bukan seluruh kelas.
          */}
          <label
            htmlFor="mapel-halaqoh"
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-primary-300 hover:bg-primary-50/40"
          >
            <input
              id="mapel-halaqoh"
              type="checkbox"
              checked={isHalaqohInput}
              onChange={(e) => setIsHalaqohInput(e.target.checked)}
              className={formStyles.checkbox}
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-800">
                Diajarkan berkelompok (halaqoh)
              </span>
              <span className="mt-0.5 block text-2xs leading-relaxed text-slate-500">
                Aktifkan untuk mapel seperti Ummi, yang siswanya dibagi menjadi
                beberapa kelompok kecil dengan guru berbeda pada jam yang sama.
              </span>
            </span>
          </label>
        </div>
      </FormModal>

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
