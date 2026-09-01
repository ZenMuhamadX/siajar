import React, { useState } from 'react';
import type { KotakSaranKategori } from '../types';
import { kirimKotakSaran } from '../services/agendaService';
import { MessageSquarePlus, X, Send, Loader2 } from 'lucide-react';

interface KotakSaranModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTeacherName: string;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const KotakSaranModal: React.FC<KotakSaranModalProps> = ({
  isOpen,
  onClose,
  activeTeacherName,
  showToast,
}) => {
  const [kategori, setKategori] = useState<KotakSaranKategori>('Fasilitas');
  const [isiSaran, setIsSaran] = useState('');
  const [isAnonim, setIsAnonim] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isiSaran.trim()) {
      showToast('error', 'Isi saran tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    try {
      await kirimKotakSaran({
        nama_guru: activeTeacherName,
        kategori,
        isi_saran: isiSaran,
        is_anonim: isAnonim,
      });

      showToast('success', 'Saran berhasil dikirim. Terima kasih atas masukan Anda!');
      setIsSaran('');
      setIsAnonim(false);
      setKategori('Fasilitas');
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Gagal mengirim saran: ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <MessageSquarePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Kotak Saran Guru</h3>
              <p className="text-[11px] text-slate-500">Kirim feedback & masukan pengembangan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kategori Saran
            </label>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value as KotakSaranKategori)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="Fasilitas">Fasilitas Kelas & Sekolah</option>
              <option value="Kurikulum">Kurikulum & Pembelajaran</option>
              <option value="Aplikasi">Aplikasi Agenda Kelas</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Isi Saran / Masukan
            </label>
            <textarea
              required
              rows={4}
              value={isiSaran}
              onChange={(e) => setIsSaran(e.target.value)}
              placeholder="Tuliskan saran atau kendala yang Anda alami secara jelas..."
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <input
              type="checkbox"
              id="anonim-checkbox"
              checked={isAnonim}
              onChange={(e) => setIsAnonim(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="anonim-checkbox" className="text-xs text-slate-700 font-medium cursor-pointer">
              Kirim Sebagai Anonim (Rahasiakan nama pengirim)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Saran</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
