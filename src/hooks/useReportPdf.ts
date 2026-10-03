import { useCallback, useRef, useState } from 'react';
import type { PrintReportModel } from '../services/report/printReportModel';
import {
  downloadReportPdf,
  ReportPdfExportError,
} from '../services/export/reportPdfExport';
import { mapFriendlyError } from '../utils/friendlyError';
import { formatDateLong, localDateString } from '../utils/date';

/**
 * Satu pintu unduh PDF untuk seluruh halaman rekap (K-06, K-11, K-14).
 *
 * Mengapa hook ini ada
 * --------------------
 * Sebelumnya tiga halaman memanggil `window.print()` mentah lewat
 * `useReportPrint`. Kini dokumen dihasilkan mesin PDF terprogram
 * (`reportPdfExport.ts`) — tetapi tiga halaman itu tetap butuh hal yang sama:
 *   - guard supaya tidak mengekspor saat data masih dimuat (K-06),
 *   - guard supaya tidak mengekspor saat fetch gagal (K-11),
 *   - status "Menyiapkan…" pada tombol, karena membangun PDF butuh waktu,
 *   - dan pesan error Indonesia, bukan `err.message` mentah (K-12).
 *
 * Semua itu dipusatkan di sini supaya tidak ditulis ulang tiga kali — persis
 * alasan `useReportPrint` dulu dibuat, hanya dengan output yang berbeda.
 */

export interface UseReportPdfOptions {
  /** Model dokumen yang akan ditulis. Dibangun murni di halaman pemanggil. */
  model: PrintReportModel;
  /** Nama sekolah dari Pengaturan (kop + footer). */
  schoolName: string;
  /** Boleh mengekspor? Biasanya `!isLoading && !loadError`. */
  canExport: boolean;
  /** Callback opsional: memberi tahu mengapa ekspor diblokir. */
  onBlocked?: (reason: string) => void;
  /** Callback opsional: nama berkas yang berhasil diunduh. */
  onSuccess?: (fileName: string) => void;
  /** Callback opsional: pesan kegagalan yang sudah ramah. */
  onError?: (message: string) => void;
}

export interface UseReportPdfResult {
  /** Pemicu unduhan. Aman dipanggil berkali-kali; permintaan ganda diabaikan. */
  downloadPdf: () => Promise<void>;
  /** True selama dokumen sedang dibangun — pakai untuk label tombol. */
  isPreparing: boolean;
}

export function useReportPdf(options: UseReportPdfOptions): UseReportPdfResult {
  const { model, schoolName, canExport, onBlocked, onSuccess, onError } = options;
  const [isPreparing, setIsPreparing] = useState(false);

  // Penjaga klik ganda. State `isPreparing` belum tentu ter-flush saat dua klik
  // terjadi dalam satu frame, jadi ref-lah yang menjadi sumber kebenaran.
  const busyRef = useRef(false);

  const downloadPdf = useCallback(async () => {
    if (busyRef.current) return;

    if (!canExport) {
      onBlocked?.(
        'Dokumen belum siap dibuat. Tunggu data selesai dimuat, atau pastikan tidak ada kegagalan muat data.',
      );
      return;
    }

    busyRef.current = true;
    setIsPreparing(true);
    try {
      const fileName = await downloadReportPdf(model, {
        schoolName,
        // Tanggal dokumen: hari ini, memakai formatter terpusat (WIB-safe).
        dateLabel: formatDateLong(localDateString()),
      });
      onSuccess?.(fileName);
    } catch (err) {
      console.error('Gagal membuat dokumen PDF:', err);
      // Error domain PDF sudah punya pesan Indonesia; sisanya dipetakan.
      const message =
        err instanceof ReportPdfExportError
          ? err.message
          : mapFriendlyError(err, { subject: 'dokumen PDF' });
      onError?.(message);
    } finally {
      busyRef.current = false;
      setIsPreparing(false);
    }
  }, [canExport, model, onBlocked, onError, onSuccess, schoolName]);

  return { downloadPdf, isPreparing };
}
