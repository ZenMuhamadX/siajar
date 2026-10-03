import React, { useId } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { ModalShell } from './common/ModalShell';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  /**
   * Matikan tombol konfirmasi tanpa menutup dialog.
   *
   * Dipakai saat tindakannya sudah diketahui tidak akan berhasil — mis. menghapus
   * tahun ajaran yang ternyata masih berisi data. Lebih baik menjelaskan alasannya
   * di dalam dialog daripada membiarkan pengguna menekan tombol yang pasti gagal.
   */
  confirmDisabled?: boolean;
  /** Keterangan singkat kenapa tombolnya mati — muncul sebagai tooltip. */
  confirmDisabledReason?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Hapus',
  cancelText = 'Batal',
  variant = 'danger',
  isLoading = false,
  confirmDisabled = false,
  confirmDisabledReason,
}) => {
  const titleId = useId();
  const isDanger = variant === 'danger';

  // Sebelumnya dialog ini punya markup portal sendiri tanpa `role="dialog"`,
  // tanpa ESC, dan tanpa perangkap fokus — Tab bisa bocor ke halaman di
  // belakangnya. Sekarang seluruh perilaku itu disediakan `ModalShell`.
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      busy={isLoading}
      size="sm"
      ariaLabelledBy={titleId}
      maxHeightClassName="max-h-none"
      cardClassName="p-5 sm:p-6 space-y-4"
    >
      {/* Header with Icon */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isDanger
                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                : 'bg-amber-50 text-amber-600 border border-amber-100'
            }`}
          >
            {isDanger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h3 id={titleId} className="text-sm font-bold text-slate-900">
              {title}
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Tutup dialog"
          title="Tutup"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition shrink-0 disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading || confirmDisabled}
          title={confirmDisabled ? confirmDisabledReason : undefined}
          className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{confirmText}</span>
        </button>
      </div>
    </ModalShell>
  );
};
