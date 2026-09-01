import React, { useState, useEffect } from 'react';
import { DAFTAR_KELAS, type KelasOption, type Siswa } from '../types';
import {
  getDaftarSiswa,
  addSiswa,
  updateSiswa,
  deleteSiswa,
} from '../services/agendaService';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Check,
  X,
  Filter,
  GraduationCap,
} from 'lucide-react';

interface DataSiswaProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DataSiswa: React.FC<DataSiswaProps> = ({ showToast }) => {
  const [selectedFilterKelas, setSelectedFilterKelas] = useState<string>('KELAS 1');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form states for Add / Edit
  const [namaInput, setNamaInput] = useState<string>('');
  const [kelasInput, setKelasInput] = useState<KelasOption>('KELAS 1');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchSiswa = async () => {
    setIsLoading(true);
    try {
      const data = await getDaftarSiswa(
        selectedFilterKelas === 'SEMUA' ? undefined : selectedFilterKelas
      );
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

    try {
      if (editingId) {
        await updateSiswa(editingId, namaInput, kelasInput);
        showToast('success', 'Data siswa berhasil diperbarui.');
        setEditingId(null);
      } else {
        await addSiswa(namaInput, kelasInput);
        showToast('success', `Siswa ${namaInput} berhasil ditambahkan.`);
      }
      setNamaInput('');
      fetchSiswa();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan siswa. ' + (err?.message || ''));
    }
  };

  const handleEditClick = (siswa: Siswa) => {
    setEditingId(siswa.id);
    setNamaInput(siswa.nama_siswa);
    setKelasInput(siswa.kelas as KelasOption);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNamaInput('');
    setKelasInput('KELAS 1');
  };

  const handleDelete = async (id: string, nama: string) => {
    if (confirm(`Yakin ingin menghapus data siswa "${nama}"?`)) {
      try {
        await deleteSiswa(id);
        showToast('success', `Siswa ${nama} berhasil dihapus.`);
        fetchSiswa();
      } catch (err) {
        showToast('error', 'Gagal menghapus siswa.');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header & Add/Edit Form */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {editingId ? 'Edit Data Siswa' : 'Kelola Data Siswa'}
            </h2>
            <p className="text-xs text-slate-500">
              Daftar siswa digunakan untuk pengisian absensi harian pada agenda kelas
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSiswa} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            {editingId ? (
              <>
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Perbarui Data Siswa</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tambah Siswa Baru</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Tingkat Kelas
              </label>
              <select
                value={kelasInput}
                onChange={(e) => setKelasInput(e.target.value as KelasOption)}
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nama Lengkap Siswa
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Contoh: Muhammad Fatih Al-Ayyubi"
                  value={namaInput}
                  onChange={(e) => setNamaInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingId ? 'Simpan' : 'Tambah'}
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
          </div>
        </form>
      </div>

      {/* List Siswa */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              Daftar Siswa
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                {siswaList.length} Siswa
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            <select
              value={selectedFilterKelas}
              onChange={(e) => setSelectedFilterKelas(e.target.value)}
              className="bg-slate-50 border border-slate-300 font-bold text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="SEMUA">Semua Kelas</option>
              {DAFTAR_KELAS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center py-8 text-xs text-slate-500">Memuat data siswa...</p>
        ) : siswaList.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              Belum ada siswa terdaftar di {selectedFilterKelas}.
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Silakan isi formulir di atas untuk menambahkan siswa baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3 w-12 text-center">No</th>
                  <th className="py-2.5 px-3">Nama Lengkap Siswa</th>
                  <th className="py-2.5 px-3 w-28 text-center">Kelas</th>
                  <th className="py-2.5 px-3 w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaList.map((siswa, idx) => (
                  <tr
                    key={siswa.id}
                    className={`hover:bg-slate-50/70 transition ${
                      editingId === siswa.id ? 'bg-amber-50/80 font-medium' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {siswa.nama_siswa}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded-md border border-emerald-200 text-[11px]">
                        {siswa.kelas}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditClick(siswa)}
                          className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(siswa.id, siswa.nama_siswa)}
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
