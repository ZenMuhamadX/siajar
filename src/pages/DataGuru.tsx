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
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchGuru = async () => {
    setIsLoading(true);
    try {
      const data = await getDaftarGuru();
      setGuruList(data);
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
      if (editingId) {
        await updateGuru(editingId, namaInput);
        showToast('success', 'Data guru berhasil diperbarui.');
        setEditingId(null);
      } else {
        await addGuru(namaInput);
        showToast('success', `Guru ${namaInput} berhasil ditambahkan.`);
      }
      setNamaInput('');
      fetchGuru();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan data guru. ' + (err?.message || ''));
    }
  };

  const handleEditClick = (guru: Guru) => {
    setEditingId(guru.id);
    setNamaInput(guru.nama_guru);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNamaInput('');
  };

  const handleDelete = async (id: string, nama: string) => {
    if (confirm(`Yakin ingin menghapus data guru "${nama}"?`)) {
      try {
        await deleteGuru(id);
        showToast('success', `Guru ${nama} berhasil dihapus.`);
        fetchGuru();
      } catch (err) {
        showToast('error', 'Gagal menghapus data guru.');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header & Add/Edit Form */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {editingId ? 'Edit Data Guru' : 'Kelola Data Guru'}
            </h2>
            <p className="text-xs text-slate-500">
              Daftar guru akan otomatis muncul sebagai pilihan dropdown saat pengisian jadwal KBM
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveGuru} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            {editingId ? (
              <>
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Perbarui Nama Guru</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                <span>Tambah Guru Baru</span>
              </>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Nama Lengkap Guru (beserta gelar jika ada)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Contoh: Ustadz Abdullah, S.Pd.I / Ustadzah Fatimah, S.Pd"
                value={namaInput}
                onChange={(e) => setNamaInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                {editingId ? 'Simpan' : 'Tambah Guru'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* List Guru */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-600" />
            Daftar Guru Pengampu
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
              {guruList.length} Guru
            </span>
          </h3>
        </div>

        {isLoading ? (
          <p className="text-center py-8 text-xs text-slate-500">Memuat data guru...</p>
        ) : guruList.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
            <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              Belum ada data guru yang terdaftar.
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Silakan isi formulir di atas untuk menambahkan guru baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3 w-12 text-center">No</th>
                  <th className="py-2.5 px-3">Nama Guru Pengampu</th>
                  <th className="py-2.5 px-3 w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {guruList.map((guru, idx) => (
                  <tr
                    key={guru.id}
                    className={`hover:bg-slate-50/70 transition ${
                      editingId === guru.id ? 'bg-amber-50/80 font-medium' : ''
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
        )}
      </div>
    </div>
  );
};
