import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryText?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Gagal memuat data',
  message = 'Terjadi kendala saat mengambil data dari sistem. Silakan coba beberapa saat lagi.',
  onRetry,
  retryText = 'Coba Lagi',
  className = '',
}) => {
  return (
    <div
      className={`py-10 px-4 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-3 ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
        <AlertCircle className="w-5 h-5" />
      </div>

      <div className="space-y-1">
        <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">{title}</h4>
        <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">{message}</p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{retryText}</span>
        </button>
      )}
    </div>
  );
};
