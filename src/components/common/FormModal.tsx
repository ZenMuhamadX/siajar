import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shell modal untuk form.
 *
 * Yang membuatnya benar-benar scroll-safe:
 *   - **di-portal ke `document.body`**. Ini wajib, bukan opsional: `position:
 *     fixed` dianchor ke *containing block* terdekat yang punya `transform`,
 *     `filter`, `backdrop-filter`, `will-change`, atau `contain`. Kalau ada
 *     leluhur seperti itu, `fixed inset-0` tidak lagi berarti "seluruh layar" —
 *     overlay ikut jadi setinggi kotak leluhur itu. Di app ini `<main>` punya
 *     `animation: fade-in-up` (lihat `index.css`), jadi tanpa portal modal akan
 *     setinggi isi halaman: kartu terpusat jauh di bawah layar dan yang terlihat
 *     hanya backdrop-nya. Portal menutup kelas bug ini untuk selamanya.
 *   - **backdrop yang memegang scroll** (`overflow-y-auto` + `min-h-full`).
 *   - **`items-start` + `my-auto` pada kartu**, bukan `items-center`. Auto margin
 *     menyerap ruang positif (kartu terpusat) dan jadi 0 saat ruang negatif
 *     (kartu menempel atas) — jadi kepala modal selalu terjangkau. Dengan
 *     `items-center`, bagian atas meluber ke arah yang tidak bisa di-scroll.
 *   - **`min-h-0` + `flex-1` pada `<form>`** supaya `max-h` benar-benar berlaku.
 *   - **kepala & kaki `shrink-0`** sehingga selalu terlihat; hanya badan scroll.
 *   - **`overscroll-contain`** supaya scroll di dalam form tidak diteruskan ke
 *     halaman belakang.
 *   - **body scroll lock** selama modal terbuka.
 *
 * Footer diberi `formId` lewat render-prop supaya tombol submit di kaki modal
 * tetap terhubung ke `<form>` Though berada di luar elemennya.
 */
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  /** Badan form; satu-satunya area yang scroll. */
  children: React.ReactNode;
  /** Aksi di kaki modal. Boleh fungsi agar bisa memakai `form={formId}`. */
  footer?: React.ReactNode | ((formId: string) => React.ReactNode);
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  size?: 'sm' | 'md' | 'lg';
  /** Tutup dikunci (mis. sedang menyimpan). */
  busy?: boolean;
  /** Warna aksen kop; default indigo sesuai halaman admin. */
  tone?: 'indigo' | 'emerald' | 'slate';
}

const SIZES: Record<NonNullable<FormModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

const TONES: Record<NonNullable<FormModalProps['tone']>, string> = {
  indigo: 'from-indigo-50 to-white',
  emerald: 'from-emerald-50 to-white',
  slate: 'from-slate-50 to-white',
};

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  onSubmit,
  size = 'md',
  busy = false,
  tone = 'indigo',
}) => {
  const formId = useId();

  // Body scroll lock: tanpa ini halaman di belakang ikut bergeser.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 no-print"
      onMouseDown={() => !busy && onClose()}
    >
      <div className="flex min-h-full items-start justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          data-modal-card
          onMouseDown={(e) => e.stopPropagation()}
          className={`relative w-full ${SIZES[size]} my-auto max-h-[90vh] flex flex-col overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-xl`}
        >
          {/* Kepala */}
          <div
            className={`shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-gradient-to-r ${TONES[tone]}`}
          >
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition text-lg leading-none shrink-0 disabled:opacity-50"
              title="Tutup"
            >
              &times;
            </button>
          </div>

          {/* Badan — satu-satunya area scroll */}
          <form
            id={formId}
            onSubmit={onSubmit}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          >
            {children}
          </form>

          {/* Kaki */}
          {footer && (
            <div className="shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              {typeof footer === 'function' ? footer(formId) : footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
