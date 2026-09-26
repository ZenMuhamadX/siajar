import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  isFiltered?: boolean;
  onResetFilters?: () => void;
  resetLabel?: string;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Cari data...',
  filters,
  actions,
  isFiltered = false,
  onResetFilters,
  resetLabel = 'Reset',
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${className}`}
    >
      {/* Left side: Search & Dropdown Filters */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 sm:flex-initial sm:w-64 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-sm"
                title="Hapus pencarian"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Custom filter dropdowns / inputs */}
        {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}

        {/* Reset button when filters are active */}
        {isFiltered && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition border border-slate-200"
            title="Reset semua filter"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>{resetLabel}</span>
          </button>
        )}
      </div>

      {/* Right side: Action buttons / Views */}
      {actions && (
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
