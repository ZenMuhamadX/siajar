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
      // `role="alert"` membuat kegagalan memuat langsung diumumkan pembaca layar.
      role="alert"
      className={`py-10 px-4 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-3 ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
        <AlertCircle className="w-5 h-5" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">{title}</h4>
        <p className="text-[13px] sm:text-xs text-slate-600 leading-relaxed">{message}</p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg text-xs transition shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{retryText}</span>
        </button>
      )}
    </div>
  );
};
