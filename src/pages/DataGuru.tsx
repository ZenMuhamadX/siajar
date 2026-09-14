import React, { useState, useEffect } from 'react';
import type { Guru } from '../types';
import {
  getDaftarGuru,
  addGuru,
  updateGuru,
  deleteGuru,
} from '../services/agendaService';
import {
  UserCheck,
  UserPlus,
  Edit2,
  Trash2,
  Check,
  X,
  GraduationCap,
} from 'lucide-react';

interface DataGuruProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DataGuru: React.FC<DataGuruProps> = ({ showToast }) => {
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form states for Add / Edit
  const [namaInput, setNamaInput] = useState<string>('');
  const [editingGuru, setEditingGuru] = useState<Guru | null>(null);

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

  useEffect(() => {
    fetchGuru();
  }, []);

  const handleSaveGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaInput.trim()) {
      showToast('error', 'Nama guru tidak boleh kosong.');
      return;
    }

    try {
      if (editingGuru) {
        await updateGuru(
          editingGuru.id,
          editingGuru.nama_guru,
          namaInput
        );
        showToast('success', 'Data guru berhasil diperbarui.');
        setEditingGuru(null);
      } else {
        await addGuru(namaInput);
        showToast(
          'success',
          `Guru ${namaInput} berhasil ditambahkan.`
        );
      }
      setNamaInput('');
      fetchGuru();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan data guru. ' + (err?.message || ''));
    }
  };

  const handleEditClick = (guru: Guru) => {
    setEditingGuru(guru);
    setNamaInput(guru.nama_guru);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingGuru(null);
    setNamaInput('');
  };

  const handleDelete = async (id: string, nama: string) => {
    if (confirm(`Yakin ingin menghapus data guru "${nama}"?`)) {
      try {
        await deleteGuru(id, nama);
        showToast('success', `Guru ${nama} berhasil dihapus.`);
        fetchGuru();
      } catch (err) {
        showToast('error', 'Gagal menghapus data guru.');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header & Add/Edit Form */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              {editingGuru ? 'Edit Data Guru & Kelas' : 'Kelola Data Guru & Penugasan'}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Atur daftar guru beserta penugasan kelas yang diajar
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSaveGuru}
          className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
        >
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            {editingGuru ? (
              <>
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Perbarui Data Guru & Penugasan</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                <span>Tambah Guru Baru</span>
              </>
            )}
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-semibold text-slate-600 mb-1">
              Nama Lengkap Guru (beserta gelar jika ada)
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Abdullah, S.Pd.I / Fatimah, S.Pd"
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-200">
            {editingGuru && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition"
              >
                <X className="w-3.5 h-3.5 inline mr-0.5" />
                Batal
              </button>
            )}
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingGuru ? 'Simpan' : 'Tambah Guru'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* List Guru */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-600" />
            <span>Daftar Guru</span>
            <span className="text-[11px] font-semibold px-2 py-0.2 bg-slate-100 text-slate-600 rounded-full">
              {guruList.length} Guru
            </span>
          </h3>
        </div>

        {isLoading ? (
          <p className="text-center py-6 text-xs text-slate-500">Memuat data guru...</p>
        ) : guruList.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
            <GraduationCap className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-slate-600">
              Belum ada data guru.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Gunakan formulir di atas untuk menambahkan guru baru.
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
                    <th className="py-2 px-3">Nama Guru</th>
                    <th className="py-2 px-3 w-20 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {guruList.map((guru, idx) => (
                    <tr
                      key={guru.id}
                      className={`hover:bg-slate-50/70 transition ${
                        editingGuru?.id === guru.id ? 'bg-amber-50/80 font-medium' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {guru.nama_guru}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditClick(guru)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(guru.id, guru.nama_guru)}
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
              {guruList.map((guru, idx) => (
                <div
                  key={guru.id}
                  className={`p-2.5 space-y-1 text-xs transition ${
                    editingGuru?.id === guru.id ? 'bg-amber-50' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-slate-400 text-[10px] font-bold shrink-0">
                        {idx + 1}.
                      </span>
                      <p className="font-semibold text-slate-800 truncate">
                        {guru.nama_guru}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEditClick(guru)}
                        className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md border border-slate-200 transition"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(guru.id, guru.nama_guru)}
                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 transition"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
