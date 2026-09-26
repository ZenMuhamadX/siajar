import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalBehavior } from './useModalBehavior';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-5xl',
};

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nama dialog untuk pembaca layar. Pakai `ariaLabelledBy` bila ada judul. */
  ariaLabel?: string;
  /** `id` elemen judul di dalam modal — lebih baik daripada `ariaLabel`. */
  ariaLabelledBy?: string;
  size?: ModalSize;
  /** Saat true: ESC dimatikan dan klik backdrop tidak menutup (mis. menyimpan). */
  busy?: boolean;
  closeOnBackdrop?: boolean;
  /** Kelas latar gelap. */
  backdropClassName?: string;
  /**
   * Tinggi maksimum kartu. Dipisah dari `cardClassName` karena Tailwind
   * menentukan pemenang antar-utilitas `max-h-*` dari urutan di stylesheet,
   * bukan urutan penulisan class — menaruh dua `max-h-*` di satu elemen berarti
   * hasilnya tidak dapat diprediksi.
   */
  maxHeightClassName?: string;
  /** Kelas tambahan untuk kartu. */
  cardClassName?: string;
  /**
   * `false` (default) — kartu putih terpusat, aman dari overflow.
   * `true` — children mengisi seluruh layar tanpa gaya kartu. Dipakai modal
   * kamera yang memang layar penuh.
   */
  bare?: boolean;
  children: React.ReactNode;
}

/**
 * Shell bersama untuk semua modal aplikasi.
 *
 * Tanggung jawabnya: portal ke `document.body`, latar gelap, kartu, dan
 * semantik dialog (`role`, `aria-modal`, nama). Perilaku keyboard-nya —
 * ESC, perangkap fokus, fokus awal, pengembalian fokus, kunci scroll —
 * ditangani `useModalBehavior`.
 *
 * Portal ke `document.body` bukan pilihan gaya: `position: fixed` ter-anchor ke
 * containing block terdekat yang punya `transform`, dan `<main>` punya
 * `animation: fade-in-up`. Tanpa portal, `fixed inset-0` ikut setinggi isi
 * halaman dan kartu modal terlempar jauh ke bawah layar. Lihat `index.css`.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  size = 'md',
  busy = false,
  closeOnBackdrop = true,
  backdropClassName = 'bg-slate-900/50 backdrop-blur-xs',
  maxHeightClassName = 'max-h-[90vh]',
  cardClassName = '',
  bare = false,
  children,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useModalBehavior({ isOpen, onClose, busy, containerRef: cardRef });

  if (!isOpen) return null;

  const ariaProps = ariaLabelledBy
    ? { 'aria-labelledby': ariaLabelledBy }
    : { 'aria-label': ariaLabel };

  if (bare) {
    return createPortal(
      <div className={`fixed inset-0 z-50 no-print ${backdropClassName}`}>
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          {...ariaProps}
          tabIndex={-1}
          data-modal-card
          className={`w-full h-full outline-none ${cardClassName}`}
        >
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-50 overflow-y-auto p-3 sm:p-4 no-print ${backdropClassName}`}
      onMouseDown={() => {
        if (closeOnBackdrop && !busy) onClose();
      }}
    >
      <div className="flex min-h-full items-start justify-center">
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          {...ariaProps}
          tabIndex={-1}
          data-modal-card
          onMouseDown={(e) => e.stopPropagation()}
          className={`relative w-full ${SIZES[size]} my-auto ${maxHeightClassName} flex flex-col overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-xl outline-none ${cardClassName}`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};
