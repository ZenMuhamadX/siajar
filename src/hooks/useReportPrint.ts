import { useCallback, useEffect, useRef } from 'react';
import type { PrintOrientation } from '../services/report/printReportModel';

/**
 * Satu pintu cetak untuk seluruh dokumen rekap (K-06, K-11, K-14, K-15).
 *
 * Mengapa hook ini ada
 * --------------------
 * Sebelumnya empat halaman memanggil `window.print()` mentah. Akibatnya:
 *   - tidak ada pemetaan data sebelum dicetak (K-14),
 *   - tombol aktif saat data masih dimuat, sehingga dokumen kosong bisa
 *     tercetak (K-06),
 *   - kegagalan fetch tidak memblokir cetak (K-11),
 *   - dan orientasi kertas tak pernah disetel, sehingga tabel 10 kolom
 *     terpotong (K-15).
 *
 * Hook ini memusatkan semua itu. Komponen halaman TIDAK boleh menyentuh
 * `window.print()` langsung — cukup memanggil `print()` dari sini.
 *
 * Catatan desain: dialog cetak tetap milik browser (print-to-PDF), jadi
 * `window.print()` memang masih dipakai — tetapi HANYA di dalam modul ini,
 * setelah data divalidasi dan orientasi disetel.
 */

export interface UseReportPrintOptions {
  /** Orientasi lembar; menentukan `@page` yang disisipkan sebelum mencetak. */
  orientation: PrintOrientation;
  /**
   * Dokumen siap dicetak? Biasanya `rows.length > 0 && !isLoading && !error`.
   * Bila `false`, `print()` menolak dan mengembalikan alasan kegagalan.
   */
  canPrint: boolean;
  /** Callback opsional untuk memberi tahu pengguna mengapa cetak diblokir. */
  onBlocked?: (reason: string) => void;
}

export interface UseReportPrintResult {
  /** Pemicu cetak. Mengembalikan `true` bila dialog cetak dibuka. */
  print: () => boolean;
}

/**
 * Menyisipkan `<style>@page { size: A4 <orientation>; ... }</style>` sementara
 * ke `<head>` lalu membuangnya setelah selesai. Ini cara paling andal untuk
 * mengubah orientasi per-dokumen karena `@page` tidak bisa memakai variabel CSS.
 */
function withPageSize(orientation: PrintOrientation, run: () => void): void {
  const style = document.createElement('style');
  style.setAttribute('data-siajar-print-page', orientation);
  style.textContent = `@page { size: A4 ${orientation}; margin: 12mm 12mm 14mm 12mm; }`;
  document.head.appendChild(style);
  try {
    run();
  } finally {
    // `afterprint` lebih tepat timingnya, tapi pada sebagian browser tidak
    // terpicu (mis. cetak dibatalkan) — jadi pembersihan dijadwalkan juga.
    window.setTimeout(() => style.remove(), 1000);
  }
}

export function useReportPrint(options: UseReportPrintOptions): UseReportPrintResult {
  const { orientation, canPrint, onBlocked } = options;

  // Simpan nilai terbaru di ref supaya `print` stabil (useCallback tanpa deps
  // yang berubah) — sehingga tidak memicu re-render anak yang memakainya.
  const canPrintRef = useRef(canPrint);
  const orientationRef = useRef(orientation);
  const onBlockedRef = useRef(onBlocked);

  useEffect(() => {
    canPrintRef.current = canPrint;
    orientationRef.current = orientation;
    onBlockedRef.current = onBlocked;
  });

  return {
    print: useCallback(() => {
      if (!canPrintRef.current) {
        onBlockedRef.current?.(
          'Dokumen belum siap dicetak. Tunggu data selesai dimuat, atau pastikan ada baris untuk dicetak.'
        );
        return false;
      }

      // Beri satu frame agar perubahan orientasi sempat diterapkan sebelum
      // dialog cetak membuka.
      withPageSize(orientationRef.current, () => {
        window.requestAnimationFrame(() => window.print());
      });
      return true;
    }, []),
  };
}
