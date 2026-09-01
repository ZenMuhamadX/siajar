import React, { useState, useEffect } from 'react';
import { getDaftarKotakSaran, deleteKotakSaran } from '../../services/agendaService';
import type { KotakSaran } from '../../types';
import {
  MessageSquare,
  Trash2,
  RefreshCw,
  Filter,
  User,
  Calendar,
} from 'lucide-react';

interface KotakSaranListProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const KotakSaranList: React.FC<KotakSaranListProps> = ({ showToast }) => {
  const [saranList, setSaranList] = useState<KotakSaran[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedKategori, setSelectedKategori] = useState<string>('SEMUA');

  const fetchSaran = async () => {
    setIsLoading(true);
    try {
      const data = await getDaftarKotakSaran();
      setSaranList(data);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat kotak saran.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSaran();
  }, []);

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (confirm('Hapus masukan/saran ini?')) {
      try {
        await deleteKotakSaran(id);
        showToast('success', 'Saran berhasil dihapus.');
        fetchSaran();
      } catch (err) {
        showToast('error', 'Gagal menghapus saran.');
      }
    }
  };

  const formatDateIndo = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const filteredList =
    selectedKategori === 'SEMUA'
      ? saranList
      : saranList.filter((s) => s.kategori === selectedKategori);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-slate-700" />
            <span>Kotak Saran & Masukan Guru</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            Total {saranList.length} masukan tersimpan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="SEMUA">Semua Kategori</option>
              <option value="Fasilitas">Fasilitas</option>
              <option value="Kurikulum">Kurikulum</option>
              <option value="Aplikasi">Aplikasi</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          <button
            onClick={fetchSaran}
            title="Refresh"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* List Masukan */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400">
          <RefreshCw className="w-5 h-5 text-slate-500 animate-spin mx-auto mb-2" />
          Memuat masukan...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-slate-400">Belum ada saran atau masukan di kategori ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700">
                    {item.kategori}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    {item.is_anonim ? 'Anonim' : item.nama_guru}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-300" />
                    {formatDateIndo(item.created_at)}
                  </span>
                  {item.id && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Hapus Saran"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {item.isi_saran}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
