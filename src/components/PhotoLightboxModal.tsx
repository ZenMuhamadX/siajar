import React, { useId } from 'react';
import { X, Calendar, Download, AlertCircle, User, Clock, Trash2 } from 'lucide-react';
import { ModalShell } from './common/ModalShell';

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
  const titleId = useId();

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

  // Handler ESC lokal sudah dihapus — `ModalShell` menanganinya, sekaligus
  // menambahkan perangkap fokus dan `role="dialog"` yang sebelumnya tidak ada.
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      ariaLabelledBy={titleId}
      backdropClassName="bg-slate-950/85 backdrop-blur-xs"
      maxHeightClassName="max-h-[94vh]"
      cardClassName="shadow-2xl border-0"
    >
      {/* Header Modal */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h3 id={titleId} className="text-sm font-bold text-slate-900">
            {title}
          </h3>
          {actualTeacherName && (
            <p className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 text-emerald-600" aria-hidden="true" />
              <span>
                Guru Pengajar: <strong className="text-slate-800">{actualTeacherName}</strong>
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isAdmin && onAdminDelete && (
            <button
              aria-label="Hapus Foto Dokumentasi (Admin)"
              type="button"
              onClick={onAdminDelete}
              disabled={isDeleting}
              className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
              title="Hapus Foto Dokumentasi (Admin)"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isDeleting ? 'Menghapus...' : 'Hapus Foto'}</span>
            </button>
           )}
          {imageUrl && (
            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              download="dokumentasi_agenda.webp"
              aria-label="Buka atau unduh foto"
              title="Buka / Unduh Foto"
              className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau foto"
            title="Tutup (ESC)"
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body Gambar */}
      <div className="p-3 sm:p-4 bg-slate-950 flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Dokumentasi foto agenda mengajar"
            className="max-h-[64vh] w-auto max-w-full object-contain rounded-lg shadow-md"
          />
        ) : (
          <div className="text-center p-6 text-slate-300 text-xs flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 text-slate-400" aria-hidden="true" />
            <span>Foto tidak bisa dimuat atau sudah dihapus dari server.</span>
          </div>
        )}
      </div>

      {/* Metadata Footer: Diambil & Diunggah */}
      <div className="shrink-0 px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3 text-slate-500" aria-hidden="true" />
            <span>Diambil: {formatDateTimeIndo(capturedAt || uploadedAt)}</span>
          </span>
          <span className="text-slate-500 hidden sm:inline" aria-hidden="true">
            &bull;
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Calendar className="w-3 h-3 text-slate-500" aria-hidden="true" />
            <span>Diupload: {formatDateTimeIndo(uploadedAt)}</span>
          </span>
        </div>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
          Status: Tersimpan (Final)
        </span>
      </div>
    </ModalShell>
  );
};
