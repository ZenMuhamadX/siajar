import React from 'react';
import { SearchX, Inbox, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  isFiltered?: boolean;
  onReset?: () => void;
  resetText?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  isFiltered = false,
  onReset,
  resetText = 'Reset Filter',
  action,
  className = '',
}) => {
  const defaultTitle = isFiltered ? 'Data tidak ditemukan' : 'Belum ada data';
  const defaultDesc = isFiltered
    ? 'Tidak ada record yang sesuai dengan kata kunci atau filter yang dipilih.'
    : 'Belum ada rekaman data pada tabel ini.';

  return (
    <div
      className={`py-12 px-4 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-3 ${className}`}
    >
      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-600">
        {icon || (isFiltered ? <SearchX className="w-5 h-5" /> : <Inbox className="w-5 h-5" />)}
      </div>

      <div className="space-y-1">
        <h4 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
          {title || defaultTitle}
        </h4>
        <p className="text-[13px] sm:text-xs text-slate-500 leading-relaxed">
          {description || defaultDesc}
        </p>
      </div>

      {isFiltered && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition border border-slate-200"
        >
          <RefreshCw className="w-3 h-3 text-slate-500" />
          <span>{resetText}</span>
        </button>
      )}

      {action && <div className="pt-1">{action}</div>}
    </div>
  );
};
