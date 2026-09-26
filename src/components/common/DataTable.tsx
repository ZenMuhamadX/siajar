import React, { useState, useMemo } from 'react';
import { Pagination } from './Pagination';
import { ScrollArea } from './ScrollArea';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { TableSkeleton } from './LoadingState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  accessor?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  isFiltered?: boolean;
  onResetFilter?: () => void;
  enablePagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  /**
   * Paginasi sisi server. Bila diisi, `data` dianggap sudah dipotong oleh
   * pemanggil (satu halaman) dan tabel tidak lagi memotong sendiri.
   *
   * Dipakai Log Jurnal karena satu bulan bisa ratusan agenda — memuat semuanya
   * ke browser sekaligus berat, dan sekarang filternya didorong ke SQL.
   */
  serverPagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
  rowClassName?: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  className?: string;
  headerRightContent?: React.ReactNode;
  tableClassName?: string;
  /** Optional card header: group/section title (e.g. a day, a teacher, a class) */
  title?: React.ReactNode;
  /** Secondary line under `title` (e.g. "12 slot jadwal") */
  subtitle?: React.ReactNode;
  /** Leading visual for `title` (dot, avatar, icon) */
  titleIcon?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  isFiltered = false,
  onResetFilter,
  enablePagination = false,
  defaultPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  serverPagination,
  rowClassName,
  onRowClick,
  className = '',
  headerRightContent,
  tableClassName = '',
  title,
  subtitle,
  titleIcon,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Paginasi server: halaman & ukuran datang dari luar, `data` sudah dipotong.
  const activePage = serverPagination ? serverPagination.page : currentPage;
  const activePageSize = serverPagination ? serverPagination.pageSize : pageSize;
  const totalItems = serverPagination ? serverPagination.total : data.length;

  // If data length changes and current page exceeds total pages, reset to page 1
  const totalPages = Math.ceil(totalItems / activePageSize) || 1;
  const safeCurrentPage = Math.min(activePage, totalPages);

  const paginatedData = useMemo(() => {
    if (!enablePagination || serverPagination) return data;
    const start = (safeCurrentPage - 1) * activePageSize;
    return data.slice(start, start + activePageSize);
  }, [data, enablePagination, serverPagination, safeCurrentPage, activePageSize]);

  const getAlignmentClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col ${className}`}
    >
      {title || subtitle || headerRightContent ? (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2.5">
            {titleIcon}
            {title || subtitle ? (
              <div className="min-w-0">
                {title && (
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight truncate">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            ) : null}
          </div>
          {headerRightContent && (
            <div className="shrink-0 flex items-center gap-2">{headerRightContent}</div>
          )}
        </div>
      ) : null}

      {/* Kontainer tabel dengan isyarat geser horizontal (lihat ScrollArea). */}
      <ScrollArea className="w-full" label="Tabel data">
        {/* Diumumkan ke pembaca layar; `aria-busy` saja tidak selalu dibacakan. */}
        {isLoading && (
          <span role="status" aria-live="polite" className="sr-only">
            Memuat data
          </span>
        )}
        <table
          aria-busy={isLoading}
          className={`w-full border-collapse text-xs ${tableClassName}`}
        >
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-xs">
            <tr>
              {columns.map((col) => {
                const alignClass = getAlignmentClass(col.align);
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={`py-3 px-3 sm:px-4 font-bold ${alignClass} ${col.headerClassName || ''}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>

          {isLoading ? (
            <TableSkeleton columns={columns.length} rows={5} />
          ) : isError ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="py-6">
                  <ErrorState
                    message={errorMessage}
                    onRetry={onRetry}
                  />
                </td>
              </tr>
            </tbody>
          ) : paginatedData.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="py-6">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    icon={emptyIcon}
                    isFiltered={isFiltered}
                    onReset={onResetFilter}
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedData.map((item, index) => {
                const rowKey = keyExtractor(item, index);
                const extraClass = rowClassName ? rowClassName(item, index) : '';
                const isClickable = Boolean(onRowClick);

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick?.(item)}
                    /* Aksesibilitas keyboard: baris yang bisa diklik sebelumnya
                     * hanya punya `onClick`, sehingga pengguna keyboard tidak
                     * bisa mencapainya sama sekali. Ditambahkan `tabIndex` +
                     * Enter/Space.
                     *
                     * `role="button"` sengaja TIDAK dipakai — ia akan
                     * menghapus semantik baris tabel bagi pembaca layar,
                     * sehingga isi sel tidak lagi diumumkan sebagai tabel.
                     * `aria-label` juga tidak dipakai karena akan menggantikan
                     * nama baris, menyembunyikan isi sel. Cukup tabIndex +
                     * keydown; isi baris tetap terbaca, lalu Enter mengaktifkan.
                     */
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick?.(item);
                            }
                          }
                        : undefined
                    }
                    tabIndex={isClickable ? 0 : undefined}
                    className={`transition-colors hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                      isClickable ? 'cursor-pointer' : ''
                    } ${extraClass}`}
                  >
                    {columns.map((col) => {
                      const alignClass = getAlignmentClass(col.align);
                      return (
                        <td
                          key={col.key}
                          style={col.width ? { width: col.width } : undefined}
                          className={`py-3 px-3 sm:px-4 align-middle ${alignClass} ${col.className || ''}`}
                        >
                          {col.accessor
                            ? col.accessor(item, (safeCurrentPage - 1) * activePageSize + index)
                            : (item as any)[col.key]}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </ScrollArea>

      {/* Pagination Bar */}
      {enablePagination && !isLoading && !isError && totalItems > 0 && (
        <Pagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={activePageSize}
          onPageChange={(page) =>
            serverPagination ? serverPagination.onPageChange(page) : setCurrentPage(page)
          }
          onPageSizeChange={(newSize) => {
            if (serverPagination) {
              serverPagination.onPageSizeChange(newSize);
            } else {
              setPageSize(newSize);
              setCurrentPage(1);
            }
          }}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}
