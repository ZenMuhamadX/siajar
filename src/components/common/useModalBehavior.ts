import { useEffect, useRef, type RefObject } from 'react';

/** Elemen yang bisa menerima fokus keyboard di dalam modal. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Tumpukan modal yang sedang terbuka, dari yang paling bawah ke paling atas.
 *
 * Ini bukan kemewahan arsitektur — ini kebutuhan. `AgendaDetailDrawer` bisa
 * membuka `PhotoLightboxModal` di atasnya. Tanpa tumpukan, handler ESC kedua
 * modal sama-sama menyala, dan satu tekan Escape akan menutup keduanya
 * sekaligus (drawer ikut hilang di belakang lightbox).
 *
 * Karena itu hanya modal teratas yang boleh merespons ESC dan menahan fokus.
 */
const modalStack: symbol[] = [];

interface ModalBehaviorOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Saat true, ESC dimatikan dan fokus tidak ditahan (mis. sedang menyimpan). */
  busy?: boolean;
  /** Elemen pembatas fokus — biasanya kartu modal. */
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * Perilaku bersama semua modal: kunci scroll, ESC, perangkap fokus,
 * fokus awal, dan pengembalian fokus.
 *
 * Diekstrak supaya modal baru tidak lagi bisa "lupa" memasang salah satunya —
 * sebelumnya `FormModal` sudah benar sementara `ConfirmDialog` dan kawan-kawan
 * tidak punya satupun, dan tidak ada cara memaksanya dari luar.
 */
export function useModalBehavior({
  isOpen,
  onClose,
  busy = false,
  containerRef,
}: ModalBehaviorOptions): void {
  const stackId = useRef<symbol | null>(null);

  // Daftarkan modal ke tumpukan selagi terbuka.
  useEffect(() => {
    if (!isOpen) return;
    const id = Symbol('modal');
    stackId.current = id;
    modalStack.push(id);
    return () => {
      const index = modalStack.indexOf(id);
      if (index !== -1) modalStack.splice(index, 1);
      stackId.current = null;
    };
  }, [isOpen]);

  const isTopmost = () => stackId.current !== null && modalStack[modalStack.length - 1] === stackId.current;

  // Kunci scroll halaman di belakang selama modal terbuka.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Fokus awal saat terbuka, dan kembalikan ke pemicu saat ditutup.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Satu frame ditunggu supaya isi modal (termasuk elemen yang dirender
    // bersyarat) sudah ada di DOM sebelum dicari.
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      // Kalau modal tidak punya elemen fokusable, kontainernya sendiri yang
      // difokuskan supaya ESC dan Tab tetap tertangkap.
      (first ?? container).focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(raf);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen, containerRef]);

  // ESC untuk menutup + perangkap fokus (Tab tidak boleh bocor ke halaman).
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost()) return;

      if (e.key === 'Escape') {
        if (busy) return;
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const items = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.getClientRects().length > 0);

      if (items.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    // Fase capture dipakai supaya ESC tetap tertangkap walau ada komponen di
    // dalam modal yang memanggil stopPropagation.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
    // `isTopmost` membaca state modul, jadi nilainya selalu segar tanpa
    // perlu masuk dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, busy, onClose, containerRef]);
}
