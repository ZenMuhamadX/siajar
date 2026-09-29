import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/** Format bulan yang dipakai filter riwayat: `YYYY-MM`. */
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Validasi `?bulan=` — selain format itu dianggap tidak ada. */
export const isValidMonthParam = (value: string | null | undefined): value is string =>
  typeof value === 'string' && MONTH_RE.test(value);

/**
 * Filter riwayat agenda disimpan di URL: `?q=<kata>` dan `?bulan=YYYY-MM`.
 *
 * Sebelumnya keduanya state lokal, sehingga menyegarkan halaman atau menekan
 * Back menghapus filter yang sedang dipakai. Halaman ini justru dipakai untuk
 * menelusuri arsip, dan hasil telusuran wajar ingin dibuka ulang atau dikirim
 * ke rekan — dua hal yang mustahil selama filternya tidak ada di alamat.
 *
 * Ini juga menyelaraskannya dengan halaman lain yang sudah URL-driven:
 * `?date=`/`?slot=`/`?edit=` di agenda, dan `?view=` di Pusat Rekap.
 *
 * Keduanya ditulis dengan `replace`, bukan `push`: menyaring daftar bukan
 * navigasi, jadi tombol Back tetap berarti "keluar dari halaman ini" — bukan
 * "membatalkan satu huruf pencarian". Perbedaan ini disengaja dan berlawanan
 * dengan `?view=`, yang memang navigasi antar tampilan.
 *
 * Nilai kosong dibuang dari URL supaya alamatnya tetap bersih: `/riwayat`,
 * bukan `/riwayat?q=&bulan=`.
 */
export function useRiwayatFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawQ = searchParams.get('q');
  const rawMonth = searchParams.get('bulan');

  const search = rawQ ?? '';
  const monthFilter = isValidMonthParam(rawMonth) ? rawMonth : 'ALL';

  /** Tulis satu parameter; `null` atau string kosong berarti hapus. */
  const write = useCallback(
    (key: 'q' | 'bulan', value: string | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (value === null || value === '') params.delete(key);
          else params.set(key, value);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setSearch = useCallback((next: string) => write('q', next), [write]);

  const setMonthFilter = useCallback(
    (next: string) => write('bulan', next === 'ALL' ? null : next),
    [write]
  );

  const reset = useCallback(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('q');
        params.delete('bulan');
        return params;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  // `?bulan=` ngawur (mis. dari tautan lama) → buang agar URL tidak
  // menampilkan bulan yang berbeda dari yang dibaca halaman. Idempoten:
  // setelah dibuang, kondisinya berhenti sendiri.
  useEffect(() => {
    if (rawMonth === null || isValidMonthParam(rawMonth)) return;
    write('bulan', null);
  }, [rawMonth, write]);

  return { search, setSearch, monthFilter, setMonthFilter, reset };
}

/**
 * `?buka=<id>[,<id>…]` — kartu riwayat yang sedang terbuka.
 *
 * Sebelumnya ini state lokal, sehingga menyegarkan halaman menutup semua kartu
 * yang sedang dibaca, dan satu kartu tidak bisa ditautkan. Karena filternya
 * sudah ada di URL, membiarkan status buka di memori membuat dua hal yang
 * sederajat memakai aturan berbeda.
 *
 * Ditulis dengan `replace`, bukan `push`. Membuka kartu memang terasa seperti
 * navigasi, tetapi `push` di sini berarti setiap kartu yang dibuka menumpuk
 * satu entri riwayat — guru yang memeriksa lima kartu harus menekan Back lima
 * kali sebelum bisa keluar halaman. Yang dibutuhkan dari URL di sini adalah
 * ketahanan saat refresh dan tautan yang bisa dibagikan, dan `replace`
 * memenuhi keduanya tanpa biaya itu. (Bandingkan `?slot=` di halaman agenda,
 * yang memang `push` karena formnya menutupi seluruh layar — di sana Back
 * berarti "tutup form" dan itu memang yang diharapkan.)
 */
export function useRiwayatOpenParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('buka') ?? '';

  const openIds = useMemo(
    () => new Set(raw.split(',').map((s) => s.trim()).filter(Boolean)),
    [raw]
  );

  const toggleOpen = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const current = new Set(
            (params.get('buka') ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          );
          if (current.has(id)) current.delete(id);
          else current.add(id);
          if (current.size === 0) params.delete('buka');
          else params.set('buka', Array.from(current).join(','));
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { openIds, toggleOpen };
}
