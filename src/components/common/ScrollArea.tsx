import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  /** Nama area untuk pembaca layar, mis. "Tabel data siswa". */
  label?: string;
}

/**
 * Pembungkus geser horizontal dengan isyarat visual.
 *
 * Masalah yang dipecahkan: tabel lebar di layar sempit sebenarnya bisa digeser
 * ke samping, tetapi tidak ada satu pun petunjuk bahwa masih ada kolom di
 * sebelah kanan. Akibatnya pengguna menyimpulkan datanya memang cuma segitu —
 * dan kolom terakhir tidak pernah dibaca.
 *
 * Solusinya dua lapis:
 *   1. gradien di tepi yang HANYA muncul saat memang ada konten tersembunyi
 *      di sisi tersebut (bukan gradien statis yang selalu tampil), dan
 *   2. petunjuk teks yang hanya tampil di layar kecil saat masih bisa digeser.
 *
 * Area ini juga diberi `tabIndex` saat bisa digeser, supaya pengguna keyboard
 * dapat menggesernya dengan tombol panah — syarat WCAG 2.1.1 untuk konten yang
 * hanya bisa dijangkau lewat scroll.
 */
export const ScrollArea: React.FC<ScrollAreaProps> = ({ children, className = '', label }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(maxScroll > 1 && el.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    update();

    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    // Lebar kontainer bisa berubah tanpa event scroll (sidebar diciutkan,
    // orientasi perangkat berubah) — ResizeObserver menangkap itu.
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    // Isi tabel bisa berganti tanpa mengubah lebar kontainer (filter, halaman
    // berikutnya), sehingga perlu dipantau terpisah.
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [update]);

  const isScrollable = canScrollLeft || canScrollRight;

  return (
    <div className="relative">
      <div
        ref={ref}
        // Fokus hanya saat memang bisa digeser, supaya tidak menambah tab stop
        // yang tidak berguna pada tabel yang sudah muat di layar.
        tabIndex={isScrollable ? 0 : undefined}
        role={isScrollable ? 'region' : undefined}
        aria-label={isScrollable ? label : undefined}
        className={`overflow-x-auto ${className}`}
      >
        {children}
      </div>

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 ${
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 ${
          canScrollRight ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {canScrollRight && (
        <p className="sm:hidden mt-1.5 flex items-center justify-center gap-1.5 text-[12px] text-slate-600">
          <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Geser ke samping untuk kolom lainnya</span>
        </p>
      )}
    </div>
  );
};
