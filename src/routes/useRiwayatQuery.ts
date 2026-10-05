import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  currentMonthRange,
  lastNDaysRange,
  localDateString,
  monthRange,
} from '../utils/date';
/** Format tanggal yang dipakai penyaring riwayat: `YYYY-MM-DD`. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Format bulan lama: `YYYY-MM`. Masih diterima demi tautan yang sudah tersebar. */
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Benar bila `value` berbentuk tanggal lengkap dan tanggalnya benar-benar ada. */
export const isValidDateParam = (value: string | null | undefined): value is string => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  // `2026-02-31` lolos regex tetapi bukan tanggal. `Date` menormalkannya jadi
  // 3 Maret, jadi hasilnya dibandingkan balik dengan masukannya.
  const [y, m, d] = value.split('-').map(Number);
  return localDateString(new Date(y, m - 1, d)) === value;
};

/** Validasi `?bulan=` — selain format itu dianggap tidak ada. */
export const isValidMonthParam = (value: string | null | undefined): value is string =>
  typeof value === 'string' && MONTH_RE.test(value);

/**
 * Preset masa yang ditawarkan penyaring riwayat. `ALL` berarti tanpa batas
 * tanggal.
 *
 * `MONTH` tidak lagi ditawarkan di UI (penyaring bulan dipindah ke dalam panel
 * tanggal), tetapi tetap dibaca di sini supaya tautan `?masa=MONTH` yang sudah
 * tersebar tidak mati.
 */
export type RiwayatPreset = 'ALL' | '7D' | '30D' | '90D' | 'MONTH';

/** Nilai `?masa=` yang dikenali; sisanya dibuang dari URL. */
const PRESET_VALUES: RiwayatPreset[] = ['7D', '30D', '90D', 'MONTH'];

/** Jumlah hari untuk setiap preset hitungan hari. */
const PRESET_DAYS: Partial<Record<RiwayatPreset, number>> = { '7D': 7, '30D': 30, '90D': 90 };

const parsePreset = (raw: string | null): RiwayatPreset | null =>
  PRESET_VALUES.includes(raw as RiwayatPreset) ? (raw as RiwayatPreset) : null;

/** Rentang tanggal sebuah preset, dihitung dari hari ini. */
function presetRange(preset: RiwayatPreset): { start?: string; end?: string } {
  const days = PRESET_DAYS[preset];
  if (days) return lastNDaysRange(days);
  if (preset === 'MONTH') return currentMonthRange();
  return {};
}

/** Rentang tanggal satu bulan lama (`?bulan=`) — semuanya, bukan sampai hari ini. */
const monthKeyToRange = (key: string) => {
  const { start, end } = monthRange(key);
  return { start, end };
};

/**
 * Penyaring riwayat agenda disimpan di URL.
 *
 * Riwayat ini tetap **satu penyaring aktif pada satu waktu**, tetapi bentuknya
 * berubah dari bulan-tunggal menjadi **rentang tanggal**. Alasannya: yang
 * diingat guru bukan nama bulan, melainkan "kemarin", "pekan lalu", "tadi
 * pagi" — dan penyaring bulan tidak punya jalan sama sekali untuk menyatakan
 * hal itu. Tiga cara memilih, semuanya bermuara pada rentang yang sama:
 *
 *  1. `?masa=TODAY|7D|30D|MONTH` — chip pintasan, dihitung dari hari ini
 *     setiap kali dibaca. Inilah jalur utama, dan satu-satunya yang butuh satu
 *     ketukan di HP.
 *  2. `?dari=&sampai=` — rentang bebas untuk kasus yang benar-benar tahu
 *     tanggalnya.
 *  3. `?bulan=YYYY-MM` — sisa dari desain lama. Masih dibaca supaya tautan yang
 *     sudah disimpan atau dikirim ke rekan tidak mati, lalu **dilipat menjadi
 *     `?dari=&sampai=`** saat pertama kali halaman dibuka.
 *
 * Poin terakhir itu menggantikan satu keputusan yang salah di desain lama:
 * dulu `?bulan=` disalin apa adanya dan disimpan di URL selamanya, sehingga
 * ada dua sumber kebenaran — bulan, dan rentang yang diturunkan darinya. Di
 * sini bulan hanya bahasa masukan untuk kompatibilitas; begitu dibaca, yang
 * tersimpan adalah rentangnya. Tidak ada lagi dua nilai yang bisa berselisih.
 *
 * Preset juga sengaja **tidak** ditulis sebagai tanggal. Sebuah tautan berisi
 * `?masa=7D` tetap berarti "tujuh hari terakhir dari sekarang" saat dibuka
 * minggu depan, sedangkan `?dari=2026-09-01` akan membeku di pekan yang sudah
 * lewat. Untuk penyaring yang maknanya "masa", relative lebih benar.
 *
 * Semua ditulis dengan `replace`, bukan `push`: menyaring bukan navigasi, jadi
 * Back tetap berarti "keluar dari halaman ini". Nilai kosong dibuang dari URL
 * supaya alamatnya tetap bersih.
 */
export function useRiwayatFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  /** Sisipkan/perbarui/hapus beberapa parameter sekaligus, dengan `replace`. */
  const patch = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          mutate(params);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const rawQ = searchParams.get('q');
  const rawDari = searchParams.get('dari');
  const rawSampai = searchParams.get('sampai');
  const rawBulan = searchParams.get('bulan');
  const rawMasa = searchParams.get('masa');

  const search = rawQ ?? '';

  /**
   * Hari ini, dibaca sekali per pemasangan. Preset dihitung dari sini, bukan
   * dari `new Date()` di dalam render — kalau tidak, rentangnya ikut berubah
   * setiap render dan efek pemuat data akan berputar tanpa henti.
   */
  /**
   * Hari ini, dibaca sekali per pemasangan agar rentang preset tidak berubah
   * setiap render. Nilainya tidak dipakai langsung — hanya lewat `presetRange`
   * yang membaca jam sistemnya sendiri — tetapi `useMemo` di bawah tetap perlu
   * ikut dihitung ulang saat komponen dipasang.
   */
  const preset = parsePreset(rawMasa);

  const dari = isValidDateParam(rawDari) ? rawDari : null;
  const sampai = isValidDateParam(rawSampai) ? rawSampai : null;

  /** Kedua ujung harus ada; satu tanggal saja bukan rentang. */
  const hasCustomRange = dari !== null && sampai !== null;

  /**
   * Rentang yang dikirim ke server. Berada di dalam satu `useMemo` supaya
   * identitasnya stabil — dipakai sebagai dependensi efek pemuat data, dan
   * nilai baru setiap render akan membuat efek itu berjalan selamanya.
   */
  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (hasCustomRange) return { start: dari, end: sampai };
    if (preset) return presetRange(preset);
    return { start: undefined, end: undefined };
  }, [hasCustomRange, dari, sampai, preset]);

  /**
   * Benar bila cakupan tanggal dibatasi (chip aktif atau rentang bebas).
   * Dipakai mengganti pesan keadaan kosong dan menentukan tampilnya
   * tombol "hapus penyaring tanggal".
   */
  const hasDateFilter = Boolean(preset) || hasCustomRange;

  /**
   * Terapkan satu pilihan dari baris chip. Menetapkan preset **menghapus
   * rentang bebas**, dan sebaliknya — inilah yang menjaga "satu penyaring
   * aktif pada satu waktu" tetap benar, bukan sekadar disepakati.
   */
  const setPreset = useCallback(
    (next: RiwayatPreset) => {
      patch((params) => {
        params.delete('dari');
        params.delete('sampai');
        params.delete('bulan');
        if (next === 'ALL') params.delete('masa');
        else params.set('masa', next);
      });
    },
    [patch]
  );

  /** Terapkan rentang bebas; `null` pada salah satu ujung membersihkannya. */
  const setDateRange = useCallback(
    (start: string | null, end: string | null) => {
      patch((params) => {
        if (!start || !end) {
          params.delete('dari');
          params.delete('sampai');
          return;
        }
        // Rentang terbalik (sampai < dari) dibalik, bukan ditolak: guru yang
        // mengetik dua tanggal tidak sedang mengerjakan soal validasi, dan
        // menolaknya diam-diam hanya membuat layar tampak tidak menanggapi.
        const [a, b] = start <= end ? [start, end] : [end, start];
        params.set('dari', a);
        params.set('sampai', b);
        params.delete('masa');
        params.delete('bulan');
      });
    },
    [patch]
  );

  /** Hapus penyaring tanggal saja — kata pencarian dibiarkan hidup. */
  const clearDateFilter = useCallback(() => {
    patch((params) => {
      params.delete('masa');
      params.delete('dari');
      params.delete('sampai');
      params.delete('bulan');
    });
  }, [patch]);

  const setSearch = useCallback(
    (next: string) => {
      patch((params) => {
        if (next === '') params.delete('q');
        else params.set('q', next);
      });
    },
    [patch]
  );

  const reset = useCallback(() => {
    patch((params) => {
      params.delete('q');
      params.delete('masa');
      params.delete('dari');
      params.delete('sampai');
      params.delete('bulan');
    });
  }, [patch]);

  /**
   * Bersihkan nilai yang tidak dikenali, lalu lipat `?bulan=` lama menjadi
   * rentang. Satu efek untuk keduanya supaya tidak ada dua tulisan URL yang
   * saling menimpa dalam render yang sama.
   *
   * Idempoten: setelah dijalankan sekali, kondisinya berhenti sendiri karena
   * parameternya sudah hilang.
   */
  useEffect(() => {
    const masaSalah = rawMasa !== null && parsePreset(rawMasa) === null;
    const bulanSalah = rawBulan !== null && !isValidMonthParam(rawBulan);
    const dariSalah = rawDari !== null && !isValidDateParam(rawDari);
    const sampaiSalah = rawSampai !== null && !isValidDateParam(rawSampai);

    // Bulan lama yang sah DAN tidak ditemani bentuk baru → dilipat ke rentang.
    const bulanPerluDilipat =
      isValidMonthParam(rawBulan) && rawMasa === null && !hasCustomRange;

    if (!masaSalah && !bulanSalah && !dariSalah && !sampaiSalah && !bulanPerluDilipat) return;

    patch((params) => {
      if (masaSalah) params.delete('masa');
      if (dariSalah) params.delete('dari');
      if (sampaiSalah) params.delete('sampai');

      if (bulanSalah) {
        params.delete('bulan');
      } else if (bulanPerluDilipat && rawBulan) {
        const { start, end } = monthKeyToRange(rawBulan);
        params.set('dari', start);
        params.set('sampai', end);
        params.delete('bulan');
      }
    });
  }, [rawMasa, rawBulan, rawDari, rawSampai, hasCustomRange, patch]);

  return {
    search,
    setSearch,
    preset,
    setPreset,
    rangeStart,
    rangeEnd,
    hasDateFilter,
    setDateRange,
    clearDateFilter,
    reset,
  };
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
