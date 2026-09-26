import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

/** Label untuk pembaca layar — jenis pesan tidak boleh hanya dibedakan warna. */
const TYPE_LABEL: Record<ToastMessage['type'], string> = {
  success: 'Berhasil',
  error: 'Gagal',
  info: 'Informasi',
};

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    /* Di HP, notifikasi duduk DI ATAS navigasi bawah (`--bottom-nav-h`).
     * Sebelumnya di `bottom-4`, sehingga notifikasi menutupi seluruh navigasi
     * dan tombol tutupnya berada tepat di area ibu jari — guru kehilangan jalan
     * keluar dari halaman tepat saat ada pesan yang harus ditindaklanjuti.
     * Di layar lebar tidak ada navigasi bawah, jadi tetap `bottom-4`.
     *
     * `aria-live="assertive"` untuk galat, `polite` untuk sisanya: kegagalan
     * menyimpan agenda harus diumumkan segera, konfirmasi sukses cukup
     * menunggu pembaca layar selesai dengan kalimatnya. */
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-[calc(var(--bottom-nav-h)+0.75rem)] md:bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none no-print"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border text-sm transition-all duration-300 transform translate-y-0 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          {toast.type === 'info' && (
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="flex-1 font-medium">
            <span className="sr-only">{TYPE_LABEL[toast.type]}: </span>
            {toast.message}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Tutup notifikasi"
            className="text-slate-500 hover:text-slate-700 hover:bg-black/5 p-1.5 -m-1 rounded-lg transition shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};
