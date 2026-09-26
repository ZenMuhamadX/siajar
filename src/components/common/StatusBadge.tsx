import React from 'react';

export type StatusType =
  | 'ACTIVE'
  | 'Aktif'
  | 'aktif'
  | 'INACTIVE'
  | 'Nonaktif'
  | 'nonaktif'
  | 'DRAFT'
  | 'Draft'
  | 'draft'
  | 'ARCHIVED'
  | 'Arsip'
  | 'Diarsipkan'
  | 'PUBLISHED'
  | 'SELESAI'
  | 'Selesai'
  | 'SUDAH'
  | 'Sudah diisi'
  | 'COMPLETED'
  | 'BELUM DIISI'
  | 'Belum diisi'
  | 'BELUM'
  | 'OVERDUE'
  | 'Terlewat'
  | 'IN_PROGRESS'
  | 'Berlangsung'
  | 'UPCOMING'
  | 'Belum dimulai'
  | 'BADAL'
  | 'Badal'
  | 'Dibatalkan'
  | 'CANCELLED'
  | string;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  showDot = true,
  className = '',
}) => {
  const norm = (status || '').toUpperCase().trim();

  // Semantic styles mapping
  let bgClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotClass = 'bg-slate-400';
  let displayLabel = label || status;

  if (['ACTIVE', 'AKTIF', 'SUDAH', 'SUDAH DIISI', 'COMPLETED', 'SELESAI', 'PUBLISHED'].includes(norm)) {
    bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    dotClass = 'bg-emerald-500';
    if (!label) {
      if (norm === 'ACTIVE') displayLabel = 'Aktif';
      else if (norm === 'SUDAH') displayLabel = 'Sudah Diisi';
    }
  } else if (['DRAFT', 'BELUM', 'BELUM DIISI', 'OVERDUE', 'TERLEWAT', 'WARNING'].includes(norm)) {
    bgClass = 'bg-amber-50 text-amber-700 border-amber-200/80';
    dotClass = 'bg-amber-500';
    if (!label) {
      if (norm === 'BELUM') displayLabel = 'Belum Diisi';
    }
  } else if (['BADAL', 'SUBSTITUTE'].includes(norm)) {
    bgClass = 'bg-purple-50 text-purple-700 border-purple-200/80';
    dotClass = 'bg-purple-500';
    if (!label && norm === 'BADAL') displayLabel = 'Badal';
  } else if (['IN_PROGRESS', 'BERLANGSUNG'].includes(norm)) {
    bgClass = 'bg-blue-50 text-blue-700 border-blue-200/80';
    dotClass = 'bg-blue-500 animate-pulse';
  } else if (['ARCHIVED', 'ARSIP', 'DIARSIPKAN', 'INACTIVE', 'NONAKTIF', 'UPCOMING', 'BELUM DIMULAI', 'DIBATALKAN', 'CANCELLED'].includes(norm)) {
    bgClass = 'bg-slate-100 text-slate-600 border-slate-200';
    dotClass = 'bg-slate-400';
    if (!label && norm === 'ARCHIVED') displayLabel = 'Diarsipkan';
    if (!label && norm === 'CANCELLED') displayLabel = 'Dibatalkan';
  } else if (['ERROR', 'DITOLAK', 'REJECTED', 'DANGER'].includes(norm)) {
    bgClass = 'bg-rose-50 text-rose-700 border-rose-200/80';
    dotClass = 'bg-rose-500';
  }

  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5 font-medium'
      : 'text-xs px-2.5 py-1 font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border tracking-tight shrink-0 transition-colors ${sizeClasses} ${bgClass} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
};
