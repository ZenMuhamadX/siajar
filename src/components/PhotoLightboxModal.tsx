import React, { useEffect } from 'react';
import { X, Calendar, Download, AlertCircle } from 'lucide-react';

interface PhotoLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  uploadedAt?: string;
  title?: string;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  uploadedAt,
  title = 'Bukti Foto Mengajar',
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
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs no-print"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {uploadedAt && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Diunggah: {formatDateTimeIndo(uploadedAt)}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                download="bukti_mengajar.webp"
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
        <div className="p-3 sm:p-4 bg-slate-900 flex-1 flex items-center justify-center min-h-[260px] max-h-[75vh] overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Bukti Foto Mengajar"
              className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md"
            />
          ) : (
            <div className="text-center p-6 text-slate-400 text-xs flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 text-slate-500" />
              <span>Foto tidak dapat dimuat atau sudah tidak tersedia di server.</span>
            </div>
          )}
        </div>

        {/* Footer info audit */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500">
          Waktu unggah tercatat resmi di sistem server &bull; SDIT AS-SYIFA
        </div>
      </div>
    </div>
  );
};
