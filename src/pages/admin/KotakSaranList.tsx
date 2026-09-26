import React, { useState, useEffect } from 'react';
import { getDaftarKotakSaran, deleteKotakSaran } from '../../services/agendaService';
import type { KotakSaran } from '../../types';
import { PageHeader } from '../../components/admin/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState, FilterBar, LoadingState } from '../../components/common';
import {
  MessageSquare,
  Trash2,
  RefreshCw,
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

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (id?: string) => {
    if (!id) return;
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteKotakSaran(deleteTarget);
      showToast('success', 'Saran berhasil dihapus.');
      setDeleteTarget(null);
      fetchSaran();
    } catch (err) {
      showToast('error', 'Gagal menghapus saran.');
    } finally {
      setIsDeleting(false);
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

  const isFiltered = selectedKategori !== 'SEMUA';

  const filteredList =
    selectedKategori === 'SEMUA'
      ? saranList
      : saranList.filter((s) => s.kategori === selectedKategori);

  return (
    <div className="space-y-6">
      {/* Header standar + aksi refresh */}
      <PageHeader
        title="Kotak Saran & Masukan Guru"
        description={`Total ${saranList.length} masukan tersimpan`}
        action={
          <button
            onClick={fetchSaran}
            title="Refresh"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* Filter kategori standar */}
      <FilterBar
        isFiltered={isFiltered}
        onResetFilters={() => setSelectedKategori('SEMUA')}
        filters={
          <select
            value={selectedKategori}
            onChange={(e) => setSelectedKategori(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none"
          >
            <option value="SEMUA">Semua Kategori</option>
            <option value="Fasilitas">Fasilitas</option>
            <option value="Kurikulum">Kurikulum</option>
            <option value="Aplikasi">Aplikasi</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        }
      />

      {/* Daftar masukan (kartu) dengan loading/empty standar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-4">
        {isLoading ? (
          <LoadingState message="Memuat masukan..." />
        ) : filteredList.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-5 h-5" />}
            title={
              isFiltered
                ? 'Tidak ada masukan pada kategori ini'
                : 'Belum ada saran atau masukan'
            }
            description={
              isFiltered
                ? 'Coba pilih kategori lain atau reset filter untuk melihat semua masukan.'
                : 'Belum ada saran atau masukan yang dikirimkan oleh guru.'
            }
            isFiltered={isFiltered}
            onReset={() => setSelectedKategori('SEMUA')}
          />
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

      {/* Dialog konfirmasi hapus saran */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Hapus masukan/saran ini?"
        message="Saran yang sudah dihapus tidak dapat dikembalikan."
        confirmText="Hapus"
      />
    </div>
  );
};
