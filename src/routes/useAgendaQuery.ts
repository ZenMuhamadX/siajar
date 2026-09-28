import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';

/** Format tanggal yang dipakai seluruh aplikasi: `YYYY-MM-DD`. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validasi `?date=` — selain format itu dianggap tidak ada. */
export const isValidDateParam = (value: string | null | undefined): value is string =>
  typeof value === 'string' && DATE_RE.test(value);

/**
 * Apakah formulir isi agenda sedang terbuka (`?slot=` atau `?edit=`).
 *
 * Fungsi murni, bukan hook, karena dipakai di dua tempat yang tidak boleh
 * saling menyimpang: `Navbar` menyembunyikan bar navigasi bawah dan tombol
 * saran mengambang, sementara `TeacherShell` menyesuaikan ruang bawah `<main>`.
 * Kalau keduanya menghitung sendiri-sendiri, cepat atau lambat keduanya
 * berbeda pendapat dan muncul celah kosong — atau konten tertutup bar.
 *
 * Halaman Riwayat tidak pernah punya formulir agenda, jadi selalu `false`.
 */
export function isAgendaFormOpen(pathname: string, search: string): boolean {
  if (pathname.startsWith('/riwayat')) return false;
  const params = new URLSearchParams(search);
  return params.has('slot') || params.has('edit');
}

/**
 * `?date=YYYY-MM-DD` — tanggal aktif timeline agenda (sisi guru & admin).
 *
 * Sebelumnya tanggal disimpan sebagai state lokal, jadi refresh selalu kembali
 * ke hari ini. Kini URL yang jadi sumber kebenaran:
 *
 * - `date`  : nilai dari URL bila valid, selain itu `fallback` (URL tidak
 *             dipaksa selalu punya `?date=` supaya tetap bersih).
 * - `setDate`: ganti tanggal dengan `replace` — navigasi tanggal bukan entri
 *             history — sekaligus membuang `?slot=`, karena form isian selalu
 *             milik satu tanggal.
 * - `pin`   : kunci tanggal tertentu ke URL. Dipakai saat `?edit=` aktif,
 *             supaya setelah keluar mode edit timeline tetap berada di tanggal
 *             agenda, bukan melompat ke hari ini (perilaku lama dipertahankan).
 *
 * Sengaja satu hook untuk dua kebutuhan supaya halaman guru dan admin memakai
 * aturan URL yang sama persis.
 */
export function useAgendaDateParam(fallback: string, pin?: string | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawDate = searchParams.get('date');
  const date = isValidDateParam(rawDate) ? rawDate : fallback;

  const setDate = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('date', next);
          params.delete('slot');
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Buang `?date=` berformat salah agar URL tidak menampilkan tanggal yang
  // berbeda dari yang dibaca halaman (idempoten: setelah dibuang efek berhenti).
  useEffect(() => {
    if (rawDate === null || isValidDateParam(rawDate)) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('date');
        return params;
      },
      { replace: true }
    );
  }, [rawDate, setSearchParams]);

  useEffect(() => {
    if (!isValidDateParam(pin) || searchParams.get('date') === pin) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('date', pin);
        return params;
      },
      { replace: true }
    );
  }, [pin, searchParams, setSearchParams]);

  return { date, setDate };
}

/**
 * `?slot=<schedule_id>` — form isi agenda dibuka untuk slot jadwal itu, lengkap
 * dengan `?date=` tanggalnya. Tanpa ini, link `/` (atau `/admin/agenda`) yang
 * dibuka di tab baru selalu menampilkan daftar timeline, bukan form isian.
 *
 * - `openSlot` : **push** — tombol Back browser menutup form dan kembali ke
 *                timeline, sama seperti tombol "Kembali" di dalam form.
 * - `closeSlot`: **replace** — menutup/menyimpan form tidak menumpuk entri
 *                history, `?date=` tetap tertinggal di URL.
 *
 * Kedua helper sengaja no-op bila parameternya tidak ada. Alasannya: satu event
 * handler tidak boleh memanggil `setSearchParams` dua kali — setter react-router
 * menghitung dari snapshot render terakhir, sehingga tulisan kedua akan menimpa
 * tulisan pertama. Dengan no-op ini, hanya satu tulisan yang benar-benar jalan.
 */
export function useAgendaSlotParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const slotId = searchParams.get('slot');

  const openSlot = useCallback(
    (scheduleId: string, date: string) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('slot', scheduleId);
        params.set('date', date);
        return params;
      });
    },
    [setSearchParams]
  );

  const closeSlot = useCallback(() => {
    if (!searchParams.has('slot')) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('slot');
        return params;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

  return { slotId, openSlot, closeSlot };
}
