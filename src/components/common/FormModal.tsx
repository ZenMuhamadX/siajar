import React, { useId } from 'react';
import { ModalShell, type ModalSize } from './ModalShell';

/**
 * Shell modal untuk form.
 *
 * Perilaku modal (portal, kunci scroll, ESC, perangkap fokus, fokus awal,
 * pengembalian fokus) sekarang tinggal di `ModalShell` + `useModalBehavior`.
 * Form di sini cukup mengurus susunan kepala–badan–kaki.
 *
 * Yang membuatnya benar-benar scroll-safe:
 *   - **kepala & kaki `shrink-0`** sehingga selalu terlihat; hanya badan scroll.
 *   - **`min-h-0` + `flex-1` pada `<form>`** supaya `max-h` benar-benar berlaku.
 *   - **`overscroll-contain`** supaya scroll di dalam form tidak diteruskan ke
 *     halaman belakang.
 *
 * Footer diberi `formId` lewat render-prop supaya tombol submit di kaki modal
 * tetap terhubung ke `<form>` meski berada di luar elemennya.
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
  size?: ModalSize;
  /** Tutup dikunci (mis. sedang menyimpan). */
  busy?: boolean;
  /** Warna aksen kop; default mengikuti warna aksi utama. */
  tone?: 'primary' | 'emerald' | 'slate';
}

const TONES: Record<NonNullable<FormModalProps['tone']>, string> = {
  primary: 'from-primary-50 to-white',
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
  tone = 'primary',
}) => {
  const formId = useId();
  const titleId = useId();

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      busy={busy}
      size={size}
      ariaLabelledBy={titleId}
    >
      {/* Kepala */}
      <div
        className={`shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-gradient-to-r ${TONES[tone]}`}
      >
        <div>
          <h3 id={titleId} className="font-bold text-slate-900 text-sm sm:text-base">
            {title}
          </h3>
          {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Tutup dialog"
          title="Tutup"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition text-lg leading-none shrink-0 disabled:opacity-50"
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
    </ModalShell>
  );
};
