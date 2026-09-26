import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Memuat data...',
  className = '',
}) => {
  return (
    <div className={`py-12 px-4 flex flex-col items-center justify-center text-center space-y-3 ${className}`}>
      <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      <p className="text-xs text-slate-500 font-medium">{message}</p>
    </div>
  );
};

export const TableSkeleton: React.FC<{ columns: number; rows?: number }> = ({
  columns,
  rows = 4,
}) => {
  return (
    <tbody className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="px-4 py-3.5">
              <div
                className="h-3.5 bg-slate-200/70 rounded-md"
                style={{ width: `${Math.max(45, 85 - (cIdx * 15) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
};
