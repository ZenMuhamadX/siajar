import React, { useState } from 'react';
import type { KotakSaranKategori } from '../types';
import { kirimKotakSaran } from '../services/agendaService';
import { Send, Loader2 } from 'lucide-react';
import {
  FormModal,
  FormField,
  SelectInput,
  TextAreaInput,
  formStyles,
} from './common';

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
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Kotak Saran Guru"
      subtitle="Kirim feedback & masukan pengembangan"
      tone="emerald"
      onSubmit={handleSubmit}
      busy={isSubmitting}
      footer={(formId) => (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="anonim-checkbox"
              checked={isAnonim}
              onChange={(e) => setIsAnonim(e.target.checked)}
              className={formStyles.checkbox}
            />
            <span className="text-xs text-slate-700 font-medium cursor-pointer">
              Kirim sebagai anonim
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={formStyles.ghostBtn}>
              Batal
            </button>
            <button
              type="submit"
              form={formId}
              disabled={isSubmitting}
              className={formStyles.primaryBtn}
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
        </>
      )}
    >
      <div className="p-5 space-y-3.5">
        <FormField label="Kategori Saran" htmlFor="saran-kategori" required>
          <SelectInput
            id="saran-kategori"
            value={kategori}
            onChange={(e) => setKategori(e.target.value as KotakSaranKategori)}
            className="font-medium"
          >
            <option value="Fasilitas">Fasilitas Kelas & Sekolah</option>
            <option value="Kurikulum">Kurikulum & Pembelajaran</option>
            <option value="Aplikasi">Aplikasi Agenda Pembelajaran</option>
            <option value="Lainnya">Lainnya</option>
          </SelectInput>
        </FormField>

        <FormField label="Isi Saran / Masukan" htmlFor="saran-isi" required>
          <TextAreaInput
            id="saran-isi"
            required
            rows={5}
            value={isiSaran}
            onChange={(e) => setIsSaran(e.target.value)}
            placeholder="Tuliskan saran atau kendala yang Anda alami secara jelas..."
          />
        </FormField>
      </div>
    </FormModal>
  );
};
