import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Download, AlertCircle, User, Clock, Trash2 } from 'lucide-react';

interface PhotoLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  uploadedAt?: string;
  capturedAt?: string;
  actualTeacherName?: string;
  title?: string;
  isAdmin?: boolean;
  onAdminDelete?: () => void;
  isDeleting?: boolean;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  uploadedAt,
  capturedAt,
  actualTeacherName,
  title = 'Dokumentasi Foto Mengajar',
  isAdmin = false,
  onAdminDelete,
  isDeleting = false,
}) => {
  // Tutup dengan ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDateTimeIndo = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Portal ke `document.body` — lihat catatan di `index.css` soal `main` yang
  // punya `transform` dari `animation: fade-in-up`.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-xs no-print"
      onClick={onClose}
    >
      <div
        data-modal-card
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {actualTeacherName && (
              <p className="text-[11px] text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3 text-emerald-600" />
                <span>Guru Pengajar: <strong className="text-slate-800">{actualTeacherName}</strong></span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && onAdminDelete && (
              <button
                type="button"
                onClick={onAdminDelete}
                disabled={isDeleting}
                className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                title="Hapus Foto Dokumentasi (Admin)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Hapus Foto'}</span>
              </button>
            )}
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                download="dokumentasi_agenda.webp"
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
                title="Buka / Unduh Foto"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
              title="Tutup (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Gambar */}
        <div className="p-3 sm:p-4 bg-slate-950 flex-1 flex items-center justify-center min-h-[260px] max-h-[68vh] overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Dokumentasi Foto Agenda"
              className="max-h-[64vh] w-auto max-w-full object-contain rounded-lg shadow-md"
            />
          ) : (
            <div className="text-center p-6 text-slate-400 text-xs flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 text-slate-500" />
              <span>Foto tidak dapat dimuat atau sudah dihapus dari server.</span>
            </div>
          )}
        </div>

        {/* Metadata Footer: Diambil & Diunggah */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Diambil: {formatDateTimeIndo(capturedAt || uploadedAt)}</span>
            </span>
            <span className="text-slate-300 hidden sm:inline">&bull;</span>
            <span className="flex items-center gap-1 font-medium">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Diupload: {formatDateTimeIndo(uploadedAt)}</span>
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
            Status: Tersimpan (Final)
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};
