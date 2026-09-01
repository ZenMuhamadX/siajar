import React, { useState, useEffect } from 'react';
import type { MataPelajaran } from '../types';
import {
  getDaftarMapel,
  addMapel,
  updateMapel,
  deleteMapel,
} from '../services/agendaService';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Layers,
} from 'lucide-react';

interface DataMapelProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DataMapel: React.FC<DataMapelProps> = ({ showToast }) => {
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form state
  const [namaInput, setNamaInput] = useState<string>('');
  const [editingMapel, setEditingMapel] = useState<MataPelajaran | null>(null);

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

  const handleSaveMapel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaInput.trim()) {
      showToast('error', 'Nama mata pelajaran tidak boleh kosong.');
      return;
    }

    try {
      if (editingMapel) {
        await updateMapel(editingMapel.id, namaInput);
        showToast('success', 'Mata pelajaran berhasil diperbarui.');
        setEditingMapel(null);
      } else {
        await addMapel(namaInput);
        showToast('success', `Mata pelajaran "${namaInput}" berhasil ditambahkan.`);
      }
      setNamaInput('');
      fetchMapel();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan mapel. ' + (err?.message || ''));
    }
  };

  const handleEditClick = (m: MataPelajaran) => {
    setEditingMapel(m);
    setNamaInput(m.nama_mapel);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingMapel(null);
    setNamaInput('');
  };

  const handleDelete = async (id: string, nama: string) => {
    if (confirm(`Yakin ingin menghapus mata pelajaran "${nama}"?`)) {
      try {
        await deleteMapel(id);
        showToast('success', `Mata pelajaran "${nama}" berhasil dihapus.`);
        fetchMapel();
      } catch (err) {
        showToast('error', 'Gagal menghapus mata pelajaran.');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header & Add/Edit Form */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              {editingMapel ? 'Edit Mata Pelajaran' : 'Kelola Mata Pelajaran'}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Daftar mata pelajaran yang dapat dipilih guru saat pengisian agenda kelas
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSaveMapel}
          className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
        >
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            {editingMapel ? (
              <>
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Perbarui Nama Mapel</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>Tambah Mata Pelajaran Baru</span>
              </>
            )}
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-semibold text-slate-600 mb-1">
              Nama Mata Pelajaran
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                required
                placeholder="Contoh: PAI / Matematika / Bahasa Arab"
                value={namaInput}
                onChange={(e) => setNamaInput(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 sm:px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1 shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingMapel ? 'Simpan' : 'Tambah'}</span>
              </button>
              {editingMapel && (
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
        </form>
      </div>

      {/* List Mapel */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Daftar Mata Pelajaran</span>
            <span className="text-[11px] font-semibold px-2 py-0.2 bg-slate-100 text-slate-600 rounded-full">
              {mapelList.length} Mapel
            </span>
          </h3>
        </div>

        {isLoading ? (
          <p className="text-center py-6 text-xs text-slate-500">Memuat data mata pelajaran...</p>
        ) : mapelList.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
            <BookOpen className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-slate-600">
              Belum ada data mata pelajaran.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Gunakan formulir di atas untuk menambahkan mata pelajaran baru.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3 w-12 text-center">No</th>
                    <th className="py-2 px-3">Nama Mata Pelajaran</th>
                    <th className="py-2 px-3 w-20 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mapelList.map((m, idx) => (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50/70 transition ${
                        editingMapel?.id === m.id ? 'bg-amber-50/80 font-medium' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {m.nama_mapel}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditClick(m)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.nama_mapel)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card / List View */}
            <div className="sm:hidden divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {mapelList.map((m, idx) => (
                <div
                  key={m.id}
                  className={`p-2.5 flex items-center justify-between gap-2 text-xs transition ${
                    editingMapel?.id === m.id ? 'bg-amber-50' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-400 text-[10px] font-bold w-5 shrink-0">
                      {idx + 1}.
                    </span>
                    <p className="font-semibold text-slate-800 truncate">
                      {m.nama_mapel}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditClick(m)}
                      className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md border border-slate-200 transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id, m.nama_mapel)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 transition"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
