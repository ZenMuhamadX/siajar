import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router';
import {
  useRiwayatFilterParams,
  useRiwayatOpenParam,
  type RiwayatPreset,
} from '../routes/useRiwayatQuery';
import {
  localDateString,
  formatDayDate,
  formatDateLong,
  formatDateCompact,
  formatDateShort,
  formatDateTimeShort,
  formatMonthYear,
  formatDateRange,
  monthRange,
  recentMonthKeys,
} from '../utils/date';
import { labelKelasKelompok } from '../utils/halaqohLabel';
import { useAuth } from '../contexts/AuthContext';
import { getRekapAgenda, deleteAgenda } from '../services/agendaService';
import { getEvidenceDisplayUrl } from '../services/evidenceService';
import { PhotoLightboxModal } from '../components/PhotoLightboxModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScrollArea, EmptyState, ErrorState } from '../components/common';
import type { FullAgenda } from '../types';
import {
  Edit2,
  Trash2,
  RefreshCw,
  Camera,
  Eye,
  Search,
  ChevronDown,
  Lock,
  CalendarDays,
  CalendarRange,
  UserX,
  Loader2,
} from 'lucide-react';

/**
 * Konteks dari `TeacherShell` (lihat `src/routes/index.tsx`).
 *
 * Dipakai untuk membuka modal "Jadwal Saya" dari halaman ini. Sebelumnya
 * tombolnya hanya ada di Navbar versi desktop dan di halaman Isi Agenda versi
 * HP, sehingga guru yang membuka Riwayat dari HP tidak punya jalan sama sekali
 * untuk melihat jadwal mengajarnya. Opsional supaya halaman tetap bisa
 * dirender di luar shell (mis. uji).
 */
type TeacherShellContext = { onOpenSchedule?: () => void };

function useTeacherShellContext(): TeacherShellContext {
  return useOutletContext<TeacherShellContext | null>() ?? {};
}

interface RiwayatAgendaProps {
  onEditAgenda: (agenda: FullAgenda) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

/**
 * Jumlah agenda per permintaan ke server.
 *
 * Halaman ini dulu mengunduh SELURUH riwayat guru (lengkap dengan KBM,
 * absensi, catatan kejadian, dan bukti foto setiap baris) lalu hanya
 * menampilkan dua puluh — jadi biaya unduhnya tumbuh terus seiring waktu
 * terpakai, tanpa satu pun manfaat yang terlihat. Sekarang yang diunduh hanya
 * sebanyak yang ditampilkan.
 */
const PAGE_SIZE = 20;

/** Jumlah bulan yang selalu ditawarkan penyaring bulan (lihat `availableMonths`). */
const MONTH_OPTIONS = 12;

/**
 * Batas atas hari yang dihitung ulang saat penyaring tanggal dipasang.
 *
 * Rentang bebas secara teori tak terhingga (`?dari=1990-01-01`), dan
 * menghitung klasifikasi untuk rentang sedekade berarti puluhan ribu iterasi
 * setiap kali penyaring disentuh. Lewat batas ini angkanya dilaporkan sebagai
 * "±" — keterangan yang jujur, bukan angka yang diam-diam salah.
 */
const MAX_CLASSIFIED_DAYS = 400;

/**
 * Sebanyak apa tanggal kosong yang dirinci sebelum diringkas jadi
 * "dan N hari lain". Satu baris sudah cukup memberi arah; daftar tiga puluh
 * tanggal kosong justru mengubur hal yang perlu ditindak.
 */
const CLASSIFY_BUFFER = 6;

/** Kelas dasar kepingan penyaring — satu sumber untuk kedua kepingan. */
const chipBase =
  'inline-flex items-center gap-1.5 min-h-10 rounded-full border text-xs font-semibold transition shrink-0';
const chipIdle = 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100';
const chipActive = 'bg-primary-600 border-primary-600 text-white';

/**
 * `select` yang dipakai sebagai kepingan: tampilannya disamakan dengan tombol
 * di sebelahnya, jadi deretannya terbaca sebagai satu kelompok penyaring —
 * bukan sebagai kotak formulir yang terselip di antara tombol.
 *
 * Padding-nya dihitung agar dua kepingan tetap muat satu baris di lebar isi
 * kartu HP (294px): label terpanjang "Semua tanggal" + "s.d. 10 Sep 2026"
 * berjumlah 298px pada padding awal (pl-8 pr-7), jadi 4px lebihnya membuat
 * baris kedua muncul hanya demi empat piksel. Padding dikecilkan sedikit
 * supaya semua keadaan muat — dan itu diukur, bukan diperkirakan.
 */
const countSelectBase =
  'appearance-none pl-7 pr-6 min-h-10 rounded-full border text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-600';


interface ActivePhoto {
  url: string;
  uploadedAt?: string;
  capturedAt?: string;
  actualTeacherName?: string;
  title: string;
}

/**
 * URL foto dimuat saat kartu benar-benar dibuka, bukan saat halaman dimuat.
 *
 * Sebelumnya seluruh riwayat memanggil `getEvidenceSignedUrl` sekaligus lewat
 * `Promise.all` — satu permintaan per agenda, semuanya bersamaan, padahal
 * hanya satu-dua foto yang benar-benar dilihat guru. Di jaringan sekolah itu
 * membuat halaman "Riwayat" jadi layar paling lambat di aplikasi.
 *
 * Hasilnya disimpan bersama `path`-nya lalu dicocokkan saat render, bukan
 * dikosongkan lewat `setState` di dalam efek — sehingga kartu yang ditutup
 * langsung berhenti menampilkan URL lama tanpa render tambahan.
 *
 * `getEvidenceDisplayUrl` mengembalikan object URL dari blob yang diunduh
 * sekali, jadi pratinjau tidak ikut mati saat signed URL kedaluwarsa.
 */
function useEvidenceUrl(storagePath?: string | null): string | null {
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!storagePath) return;
    let alive = true;
    getEvidenceDisplayUrl(storagePath).then((url) => {
      if (alive) setLoaded({ path: storagePath, url: url || null });
    });
    return () => {
      alive = false;
    };
  }, [storagePath]);

  return loaded && storagePath && loaded.path === storagePath ? loaded.url : null;
}

const monthKey = (dateStr: string) => dateStr.slice(0, 7); // "2026-09"

const isBreakRow = (jamKe: string) => jamKe === 'Istirahat' || jamKe === 'Isoma';

export const RiwayatAgenda: React.FC<RiwayatAgendaProps> = ({ onEditAgenda, showToast }) => {
  const { activeTeacherName, isAdmin } = useAuth();
  const { onOpenSchedule } = useTeacherShellContext();

  // Penyaring hidup di URL. Bentuknya rentang tanggal, dipilih lewat chip
  // pintasan atau isian rentang bebas; kartu yang sedang terbuka juga di URL
  // (`?buka=`). Lihat `src/routes/useRiwayatQuery.ts` untuk alasannya.
  const {
    search,
    setSearch,
    preset,
    setPreset,
    rangeStart,
    rangeEnd,
    hasDateFilter,
    setDateRange,
    clearDateFilter,
    reset: resetUrlFilters,
  } = useRiwayatFilterParams();
  const { openIds, toggleOpen } = useRiwayatOpenParam();

  /**
   * Panel rentang tanggal.
   *
   * Sengaja TIDAK terbuka otomatis hanya karena `?dari=`/`?sampai=` ada di
   * alamat. Membukanya otomatis berarti membuka Riwayat dari tautan bersama
   * langsung menyajikan dua pemilih tanggal — padahal guru yang menerima
   * tautan itu paling sering hanya ingin membaca hasilnya. Karena rentangnya
   * sudah diringkas jadi label chip, panel bisa tetap tertutup: informasi
   * rentang tetap terbaca, tanpa memakan satu baris penuh di atas daftar.
   *
   * Konsekuensinya kotak tanggal bisa kosong saat rentang sebenarnya aktif;
   * itu ditangani dengan merancah nilainya saat panel dibuka, bukan dengan
   * membuka panelnya lebih awal.
   */
  const [rangePanelOpen, setRangePanelOpen] = useState(false);
  const isCustomRange = preset === null && rangeStart !== undefined;

  /** Nilai kotak tanggal: rentang aktif bila ada, kalau tidak biarkan kosong. */
  const [draftFrom, setDraftFrom] = useState(isCustomRange ? (rangeStart ?? '') : '');
  const [draftTo, setDraftTo] = useState(isCustomRange ? (rangeEnd ?? '') : '');

  const rangePanelRef = useRef<HTMLDivElement | null>(null);

  /**
   * Buka panel rentang, dan segarkan isiannya dari rentang yang sedang aktif.
   *
   * Tanpa penyegaran ini, guru yang sudah menyaring "7 hari" lalu membuka
   * panel akan melihat dua kotak kosong — seolah tidak ada rentang yang
   * berlaku, padahal chip di sebelahnya baru saja menyatakan sebaliknya.
   */
  const openRangePanel = useCallback(() => {
    setDraftFrom(rangeStart ?? '');
    setDraftTo(rangeEnd ?? '');
    setRangePanelOpen(true);
  }, [rangeStart, rangeEnd]);

  const [agendas, setAgendas] = useState<FullAgenda[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  /** Masih ada halaman berikutnya di server. */
  const [hasMore, setHasMore] = useState(false);
  /** Seluruh baris dalam cakupan sekarang sudah ada di memori. */
  const [allLoaded, setAllLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FullAgenda | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activePhoto, setActivePhoto] = useState<ActivePhoto | null>(null);

  const todayStr = localDateString();

  /**
   * Rentang tanggal terakhir yang sudah dimuat, plus penandanya.
   *
   * Tanpa ini, membuka riwayat dengan `?masa=7D` membuat halaman itu TAMPAK
   * seperti riwayat penuh: judul kelompok bulan tetap muncul, tetapi baru
   * sebagian yang termuat, dan guru menyimpulkan datanya hilang. Sebelumnya
   * gejala yang sama muncul dari paginasi; sekarang dari penyaring tanggal, dan
   * obatnya tetap sama — keterangan yang menyebut rentangnya.
   */
  const rangeKey = rangeStart && rangeEnd ? `${rangeStart}~${rangeEnd}` : '';
  const [loadedRanges, setLoadedRanges] = useState<Record<string, string[]>>({});
  const loadedRange = rangeKey ? loadedRanges[rangeKey] : undefined;

  /**
   * Ambil satu halaman.
   *
   * `PAGE_SIZE + 1` baris diminta agar keberadaan halaman berikutnya bisa
   * diketahui tanpa query hitung terpisah: kalau yang kembali lebih banyak dari
   * yang diminta, berarti masih ada sisa. Satu baris ekstra jauh lebih murah
   * daripada `count: 'exact'` pada query berelasi.
   */
  const fetchPage = useCallback(
    async (offset: number): Promise<FullAgenda[]> => {
      const rows = await getRekapAgenda({
        nama_guru: activeTeacherName || undefined,
        startDate: rangeStart,
        endDate: rangeEnd,
        limit: PAGE_SIZE + 1,
        offset,
      });
      setHasMore(rows.length > PAGE_SIZE);
      return rows.slice(0, PAGE_SIZE);
    },
    [activeTeacherName, rangeStart, rangeEnd]
  );

  /**
   * Catat hari-hari yang sudah termuat untuk rentang ini, supaya penyaring
   * tanggal terbit/lama tahu hari mana yang masih kosong tanpa memuat semuanya.
   * Digabung dengan `Set`, bukan ditimpa: `loadMore` dan `loadAll` menambahkan
   * hari ke yang sudah ada.
   */
  const trackLoaded = useCallback(
    (rows: FullAgenda[]) => {
      if (!rangeKey) return;
      setLoadedRanges((prev) => {
        const merged = new Set(prev[rangeKey] ?? []);
        for (const r of rows) merged.add(r.header.tanggal);
        return { ...prev, [rangeKey]: Array.from(merged) };
      });
    },
    [rangeKey]
  );

  // Muat halaman pertama setiap kali cakupan berubah (guru atau rentang tanggal).
  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setLoadError(false);
    setAllLoaded(false);

    fetchPage(0)
      .then((page) => {
        if (!alive) return;
        setAgendas(page);
        trackLoaded(page);
      })
      .catch((err) => {
        console.error(err);
        if (!alive) return;
        setLoadError(true);
        showToast('error', 'Gagal memuat riwayat agenda.');
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [fetchPage, showToast, trackLoaded]);

  /** Muat ulang paksa — tombol "Segarkan" dan setelah sebuah agenda dihapus. */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    setAllLoaded(false);
    try {
      const page = await fetchPage(0);
      setAgendas(page);
      trackLoaded(page);
    } catch (err) {
      console.error(err);
      setLoadError(true);
      showToast('error', 'Gagal memuat riwayat agenda.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, showToast, trackLoaded]);

  /** Halaman berikutnya, ditambahkan di bawah yang sudah ada. */
  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const page = await fetchPage(agendas.length);
      setAgendas((prev) => [...prev, ...page]);
      trackLoaded(page);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat agenda berikutnya.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [agendas.length, fetchPage, showToast, trackLoaded]);

  /**
   * Muat seluruh baris dalam cakupan sekarang, sekaligus.
   *
   * Pencarian berjalan di sisi klien karena mencakup materi, tugas, dan catatan
   * kejadian — tiga kolom bersarang yang tidak bisa dicari bersama kolom lain
   * dalam satu query. Supaya pencarian tidak diam-diam hanya menelusuri halaman
   * yang kebetulan sudah termuat, tombol "Telusuri seluruh riwayat" (muncul di
   * keadaan kosong) memuat semuanya lebih dulu.
   *
   * Jadi biayanya sama seperti sebelum ada paginasi — tetapi kini dibayar saat
   * guru memang sedang mencari jauh ke belakang, bukan setiap kali halaman
   * dibuka.
   */
  const loadAll = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const rows = await getRekapAgenda({
        nama_guru: activeTeacherName || undefined,
        startDate: rangeStart,
        endDate: rangeEnd,
      });
      setAgendas(rows);
      setHasMore(false);
      setAllLoaded(true);
      trackLoaded(rows);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat seluruh riwayat.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeTeacherName, rangeStart, rangeEnd, showToast, trackLoaded]);

  /**
   * Bulan yang punya data menurut cap "hari terlama yang sudah dimuat".
   *
   * Tidak lagi dibangun dari daftar hari di rentang cakupan: rentang bebas
   * bisa mencakup tahun-tahun yang tidak pernah diisi guru, dan menawarkan dua
   * belas bulan kosong hanya menambah pilihan yang tidak berguna.
   */
  const availableMonths = useMemo(() => {
    const keys = new Set(recentMonthKeys(MONTH_OPTIONS));
    for (const agenda of agendas) keys.add(monthKey(agenda.header.tanggal));
    return Array.from(keys).sort().reverse();
  }, [agendas]);

  /**
   * Bulan yang sedang dipilih, bila rentang aktif ternyata persis satu bulan
   * penuh (`?bulan=` lama, atau pilihan dari kotak ini sendiri).
   *
   * `null` saat rentang aktif bukan satu bulan penuh — mis. "7 hari" atau
   * rentang bebas. Kotak bulan lalu menampilkan "Pilih bulan…", bukan bulan
   * yang kebetulan termuat dari data.
   */
  const selectedMonth = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;
    const key = monthKey(rangeStart);
    const { start, end } = monthRange(key);
    return rangeStart === start && rangeEnd === end ? key : null;
  }, [rangeStart, rangeEnd]);

  /**
   * Klasifikasi setiap hari di rentang yang sedang dilihat.
   *
   * Inilah yang memberi arti pada penyaring tanggal. Sebelumnya rentang hanya
   * menyembunyikan data di luar rentang, dan hasilnya kosong hanya bisa
   * dijawab dengan "tidak ada agenda" — yang mudah disalahartikan sebagai
   * "riwayat saya hilang". Padahal tiga sebabnya berbeda jauh:
   *
   *  - `FUTURE`    — hari yang belum terjadi. "Hari ini" di hari Minggu dan
   *                  "7 hari terakhir" yang menyentuh ujung pekan masuk ke
   *                  sini: rentangnya sah, isinya memang nol.
   *  - `WEEKEND`   — Sabtu/Minggu. Tidak ada jadwal reguler, jadi nol.
   *  - `EMPTY`     — hari sekolah yang benar-benar belum diisi.
   *  - `FILLED`    — ada agenda.
   *
   * Batasnya dua: `MAX_CLASSIFIED_DAYS` menjaga loop tetap terbatas (rentang
   * sepuluh tahun tidak akan dihitung 3.650 kali), dan `CLASSIFY_BUFFER`
   * menjaga daftar "belum diisi" tetap sependek satu baris di layar. Yang
   * dibutuhkan guru adalah arah, bukan laporan lengkap.
   */
  const daySummary = useMemo(() => {
    if (!loadedRange) return null;
    const filled = new Set(loadedRange);
    const start = rangeStart!;
    const end = rangeEnd!;
    let hasMoreDays = false;

    // Kalender: tanggal lahirnya, tanpa jam, supaya penjumlahan hari aman.
    const p = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const startD = p(start);
    const endD = p(end);
    const total = Math.min(Math.round((+endD - +startD) / 86_400_000) + 1, MAX_CLASSIFIED_DAYS);
    if (Math.round((+endD - +startD) / 86_400_000) + 1 > MAX_CLASSIFIED_DAYS) hasMoreDays = true;

    let filledCount = 0;
    let schoolDays = 0;
    let weekendDays = 0;
    let lastFilled: string | null = null;
    const emptyDays: string[] = [];
    const pendingDays: string[] = [];

    for (let i = 0; i < total; i += 1) {
      const d = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + i);
      const ds = localDateString(d);
      const dow = d.getDay();

      if (filled.has(ds)) {
        filledCount += 1;
        lastFilled = ds;
        continue;
      }
      // Batas atas "belum diisi" sengaja bukan cakupan tanggal, melainkan
      // `todayStr`: guru tidak "tertinggal" mengisi agenda Jumat besok.
      if (ds > todayStr) pendingDays.push(ds);
      else if (dow === 0 || dow === 6) weekendDays += 1;
      else {
        schoolDays += 1;
        if (emptyDays.length < CLASSIFY_BUFFER) emptyDays.push(ds);
      }
    }

    return {
      total,
      filledCount,
      schoolDays,
      weekendDays,
      emptyDays,
      lastFilled,
      pendingDays,
      hasMoreDays,
    };
  }, [loadedRange, rangeStart, rangeEnd, todayStr]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agendas;
    return agendas.filter((agenda) => {
      return (
        agenda.header.kelas.toLowerCase().includes(q) ||
        agenda.header.tanggal.includes(q) ||
        agenda.kbm.some(
          (k) =>
            (k.mapel || '').toLowerCase().includes(q) ||
            (k.materi || '').toLowerCase().includes(q) ||
            (k.tugas_pr || '').toLowerCase().includes(q)
        ) ||
        (agenda.kejadian || []).some((e) =>
          (e.uraian_kejadian || '').toLowerCase().includes(q)
        )
      );
    });
  }, [agendas, search]);

  /** Dikelompokkan per bulan supaya guru memindai posisi, bukan membaca satu per satu. */
  const grouped = useMemo(() => {
    const map = new Map<string, FullAgenda[]>();
    for (const agenda of filtered) {
      const key = monthKey(agenda.header.tanggal);
      const bucket = map.get(key);
      if (bucket) bucket.push(agenda);
      else map.set(key, [agenda]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const hasFilter = search.trim() !== '' || hasDateFilter;

  const resetFilters = () => resetUrlFilters();

  /**
   * Terapkan rentang dari isian, lalu buka lipatannya.
   *
   * Dijalankan saat `onChange` kedua kotak — bukan menunggu tombol "Terapkan".
   * Memilih tanggal itu tindakan tunggal, dan tombol konfirmasi hanya menambah
   * satu ketukan serta satu kesempatan lupa menekannya.
   */
  const commitRange = (from: string, to: string) => {
    if (!from || !to) return;
    setDateRange(from, to);
  };

  /**
   * "Hari ini" (lokal) — sengaja dibekukan saat komponen dipasang.
   *
   * `useMemo` dengan daftar dependensi kosong, bukan `new Date()` di badan
   * render: nilainya dipakai sebagai batas atas kalender dan sebagai pembagi
   * "belum diisi" vs "belum tiba", dan `new Date()` yang dihitung ulang setiap
   * render membuat keduanya ikut berubah tanpa sebab.
   */
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const todayIso = useMemo(() => localDateString(), []);

  /**
   * Preset yang berupa hitungan hari — nilai yang ditampilkan di kepingan
   * "Terbaru". Preset bulan (`MONTH`) sengaja tidak ikut: ia punya kepingan
   * sendiri di dalam panel tanggal, dan menampilkannya di sini akan membuat
   * dua kontrol menyatakan hal yang sama.
   */
  const countPreset =
    preset && (preset === '7D' || preset === '30D' || preset === '90D') ? preset : null;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteAgenda(pendingDelete.header.id);
      showToast('success', 'Agenda berhasil dihapus.');
      setPendingDelete(null);
      await refresh();
    } catch {
      showToast('error', 'Gagal menghapus agenda.');
    } finally {
      setIsDeleting(false);
    }
  };

  /** Benar bila pencarian baru menelusuri sebagian riwayat, belum semuanya. */
  const searchScopeIsPartial = hasMore && !allLoaded;

  /* ------------------------------- Render ------------------------------- */

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header + kendali pencarian */}
      <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* `h1`, bukan `h2`. Nama sekolah di header sudah tidak lagi
                menjadi heading, sehingga judul halaman ini adalah satu-satunya
                `<h1>` di halaman — sama seperti halaman guru lainnya. */}
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Riwayat Agenda Saya
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Agenda yang diisi{' '}
              <strong className="text-slate-800">{activeTeacherName}</strong>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* "Jadwal Saya" hanya di HP/tablet (`lg:hidden`) — mulai `lg`
                tombol yang sama sudah ada di header atas, jadi tidak diulang.
                Tanpa tombol ini, guru yang membuka Riwayat dari HP tidak punya
                jalan sama sekali untuk melihat jadwal mengajarnya. Labelnya
                disingkat "Jadwal" di layar sempit agar judul halaman tetap muat
                satu baris. */}
            {onOpenSchedule && (
              <button
                type="button"
                onClick={onOpenSchedule}
                title="Lihat jadwal mengajar saya"
                className="lg:hidden inline-flex items-center gap-1.5 px-2.5 min-h-10 bg-white border border-slate-300 rounded-lg text-xs font-bold text-primary-700 hover:bg-primary-50 transition"
              >
                <CalendarDays className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">Jadwal</span>
                <span className="hidden sm:inline">Jadwal Saya</span>
              </button>
            )}

            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              aria-label="Segarkan riwayat agenda"
              title="Segarkan"
              className="text-xs px-2.5 sm:px-3 py-2 min-h-10 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-semibold border border-slate-300 rounded-lg transition flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>

        {/* Pencarian teks. Tetap terpisah dari baris chip di bawahnya: kata
            kunci dan rentang tanggal adalah dua pertanyaan berbeda, dan
            menggabungkannya jadi satu baris membuat keduanya lebih sempit
            tanpa menghemat apa pun. */}
        <div className="relative">
          <Search
            className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kelas, mapel, materi, atau catatan…"
            aria-label="Cari riwayat agenda"
            className="w-full pl-9 pr-3 py-2.5 min-h-10 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 transition"
          />
        </div>

        {/* Penyaring tanggal — DUA kepingan saja, satu penyaring aktif.
            Bentuknya sengaja dirampingkan. Versi pertama rancangan ini menumpuk
            lima chip ("Hari ini" / "7 hari" / "30 hari" / "Bulan ini" /
            "Rentang…") plus pemilih bulan; di layar 360px itu berarti 3–4 baris
            kepingan berjajar, dan yang terbaca bukan lagi penyaring melainkan
            deretan tombol yang saling bersaing. Yang dipakai berulang kali cuma
            dua: "lihat yang terbaru" dan "cari tanggal tertentu".

            Yang tersisa:
              · "Semua tanggal / N hari terakhir" — satu `select`. Inilah yang
                benar-benar dicari guru ("pekan lalu"), dan satu ketukan cukup.
              · "Tanggal" — membuka panel: rentang bebas + pemilih bulan.

            Label "Periode" dan chip "Semua tanggal" dihapus: yang pertama
            menghabiskan satu baris sendiri di lebar isi kartu 294px, yang kedua
            mubazir karena melepas penyaring sudah bisa dari nilai kosong. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Rentang hari. Mengetuk nilai yang sedang aktif melepas
              penyaringnya, jadi tidak perlu tombol "semua" tersendiri. */}
          <div className="relative shrink-0">
            <CalendarRange
              className={`w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${
                countPreset ? 'text-white/80' : 'text-slate-500'
              }`}
              aria-hidden="true"
            />
            <select
              value={countPreset ?? ''}
              onChange={(e) => setPreset((e.target.value || 'ALL') as RiwayatPreset)}
              aria-label="Saring berdasarkan jumlah hari terakhir"
              className={`${countSelectBase} ${countPreset ? chipActive : chipIdle}`}
            >
              <option value="">Semua tanggal</option>
              <option value="7D">7 hari terakhir</option>
              <option value="30D">30 hari terakhir</option>
              <option value="90D">90 hari terakhir</option>
            </select>
            <ChevronDown
              className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${
                countPreset ? 'text-white/80' : 'text-slate-500'
              }`}
              aria-hidden="true"
            />
          </div>

          {/* Tanggal tertentu, atau label rentang yang sedang aktif. Saat
              rentang aktif, chip ini yang menampilkan rentangnya sekaligus
              menjadi jalan untuk menggantinya — tidak ada teks status
              tambahan yang perlu dibaca terpisah. */}
          <button
            type="button"
            onClick={openRangePanel}
            aria-pressed={isCustomRange}
            aria-expanded={rangePanelOpen}
            className={`${chipBase} px-3 min-w-0 flex-1 justify-center ${
              isCustomRange ? chipActive : chipIdle
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {/* Rentang bebas sengaja hanya menampilkan tanggal AKHIR, bukan
                "4 Sep 2026 – 10 Sep 2026". Di lebar isi kartu 294px, label
                lengkapnya selebar 187px dan memaksa kepingan ini turun ke baris
                kedua. Tanggal akhir sudah cukup untuk mengingatkan rentang mana
                yang sedang dilihat, dan rentang lengkapnya tetap terbaca di
                baris "Menampilkan N agenda pada …" di bawah serta di kedua
                kotak tanggal saat panelnya dibuka. */}
            <span className="truncate">
              {isCustomRange && rangeStart && rangeEnd
                ? rangeStart === rangeEnd
                  ? formatDateShort(rangeStart)
                  : `s.d. ${formatDateShort(rangeEnd)}`
                : 'Tanggal'}
            </span>
          </button>
        </div>

        {/* Isian rentang bebas dan pemilih bulan. Muncul hanya saat chip
            "Rentang…" dipakai, jadi ia tidak pernah ikut memakan lebar saat
            guru memakai chip pintasan.
            Pemilih bulan dulu berdiri sendiri di baris chip selebar 14rem;
            di layar 360px kepingan itu sendirian menghabiskan satu baris
            penuh, dan yang ditawarkannya justru bulan-bulan yang paling jarang
            dicari (dua belas bulan terakhir, terbaru lebih dulu). Dipindah ke
            sini ia muncul tepat saat guru memang sedang memilih periode
            tertentu — tempat ia berguna, bukan sekadar tersedia. */}
        {rangePanelOpen && (
          <div
            ref={rangePanelRef}
            className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
          >
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-32">
                <span className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Dari
                </span>
                <input
                  type="date"
                  value={draftFrom}
                  max={todayIso}
                  onChange={(e) => {
                    setDraftFrom(e.target.value);
                    commitRange(e.target.value, draftTo);
                  }}
                  className="w-full px-2.5 py-2 min-h-10 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 transition"
                />
              </label>

              <label className="flex-1 min-w-32">
                <span className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Sampai
                </span>
                <input
                  type="date"
                  value={draftTo}
                  max={todayIso}
                  onChange={(e) => {
                    setDraftTo(e.target.value);
                    commitRange(draftFrom, e.target.value);
                  }}
                  className="w-full px-2.5 py-2 min-h-10 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 transition"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  if (isCustomRange) clearDateFilter();
                  setDraftFrom('');
                  setDraftTo('');
                  setRangePanelOpen(false);
                }}
                className="px-3 py-2 min-h-10 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Tutup
              </button>
            </div>

            {/* Jalan pintas ke bulan tertentu. Menuliskan rentang penuh bulan
                itu — sama seperti bentuk `?bulan=` dari desain lama, sehingga
                tautan lama dan pilihan di sini berakhir pada rentang yang
                persis sama. */}
            <div className="flex items-center gap-2">
              <label htmlFor="riwayat-bulan" className="text-2xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
                Atau bulan
              </label>
              <div className="relative flex-1">
                <select
                  id="riwayat-bulan"
                  value={selectedMonth ?? ''}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const { start, end } = monthRange(e.target.value);
                    setDraftFrom(start);
                    setDraftTo(end);
                    setDateRange(start, end);
                  }}
                  className="appearance-none w-full pl-3 pr-8 py-2 min-h-10 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 transition cursor-pointer"
                >
                  <option value="">Pilih bulan…</option>
                  {availableMonths.map((key) => (
                    <option key={key} value={key}>
                      {formatMonthYear(key)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </div>

            <p className="text-2xs text-slate-500">
              Rentang berlaku setelah kedua tanggal terisi. Kalender dibatasi sampai hari ini.
            </p>
          </div>
        )}

        {!isLoading && !loadError && agendas.length > 0 && (
          <p className="text-xs text-slate-600" role="status" aria-live="polite">
            Menampilkan <strong className="text-slate-800">{filtered.length}</strong> agenda
            {isCustomRange && rangeStart && rangeEnd && (
              <>
                {' pada '}
                <strong className="text-slate-800">{formatDateRange(rangeStart, rangeEnd)}</strong>
              </>
            )}
            {searchScopeIsPartial && ' · masih ada agenda lama yang belum dimuat'}
            {hasMore && !allLoaded && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={loadAll}
                  disabled={isLoadingMore}
                  className="font-semibold text-primary-700 underline hover:text-primary-900 disabled:opacity-60"
                >
                  Muat semua
                </button>
              </>
            )}
            {hasFilter && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="font-semibold text-primary-700 underline hover:text-primary-900"
                >
                  Reset pencarian
                </button>
              </>
            )}
          </p>
        )}

        {/* Tanpa baris ini, guru yang memilih "7 hari" dan mendapat halaman
            sepi tidak punya cara tahu bahwa rentangnya memang cuma sepekan,
            atau hari mana yang bolong. Angka-angka di sini dihitung dari data
            yang sudah dimuat, bukan dari seluruh arsip — dan itu dinyatakan
            apa adanya. */}
        {!isLoading && !loadError && daySummary && (
          <p className="text-xs text-slate-600 border-t border-slate-200 pt-2.5">
            {daySummary.total > 0 ? (
              <>
                <strong className="text-slate-800">{daySummary.filledCount}</strong> dari{' '}
                {daySummary.hasMoreDays && '±'}
                <strong className="text-slate-800">{daySummary.total}</strong> hari terisi
              </>
            ) : (
              'Tidak ada hari dalam rentang ini'
            )}
            {daySummary.lastFilled && (
              <> · Terakhir {formatDateCompact(daySummary.lastFilled)}</>
            )}
            {daySummary.schoolDays > 0 && (
              <>
                {' · '}
                <span className="text-amber-700 font-medium">
                  {daySummary.schoolDays} hari belum diisi
                </span>
              </>
            )}
            {daySummary.weekendDays > 0 && <> · {daySummary.weekendDays} akhir pekan</>}
            {daySummary.pendingDays.length > 0 && (
              <> · {daySummary.pendingDays.length} hari belum tiba</>
            )}          </p>
        )}

        {/* "Tanggal A, B, C belum diisi" — menyebut hari yang bolong, bukan
            hanya menghitungnya. Hanya saat penyaring tanggal dipakai, supaya
            tampilan bawaan tetap sesederhana sebelumnya. */}
        {!isLoading &&
          !loadError &&
          hasDateFilter &&
          daySummary &&
          daySummary.emptyDays.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <p className="text-xs text-amber-900">
                <span className="font-bold">Belum ada agenda pada:</span>{' '}
                {daySummary.emptyDays.map((d) => formatDateCompact(d)).join(', ')}
                {daySummary.schoolDays > daySummary.emptyDays.length && (
                  <>
                    {' '}
                    dan {daySummary.schoolDays - daySummary.emptyDays.length} hari lain
                  </>
                )}
              </p>
            </div>
          )}
      </div>

      {/* Konten */}
      {isLoading ? (
        <div
          className="bg-white border border-slate-300 rounded-xl p-10 text-center text-xs text-slate-600"
          role="status"
          aria-live="polite"
        >
          <RefreshCw
            className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-500"
            aria-hidden="true"
          />
          Memuat riwayat agenda…
        </div>
      ) : loadError ? (
        <div className="bg-white border border-slate-300 rounded-xl">
          <ErrorState
            title="Gagal memuat riwayat"
            message="Riwayat agenda tidak bisa dimuat. Periksa koneksi lalu coba lagi."
            onRetry={refresh}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-xl">
          {/* Tiga sebab yang berbeda, tiga pesan yang berbeda. Sebelumnya
              "belum ada catatan agenda" juga muncul saat guru baru saja
              menyaring ke bulan yang kebetulan kosong — pesannya menyalahkan
              riwayat yang sebenarnya ada, dan menyarankan mulai mengisi agenda
              padahal masalahnya cuma penyaring. */}
          {searchScopeIsPartial ? (
            /* Keadaan kosong adalah tempat guru paling mungkin mencari jalan
               keluar, jadi tombol "telusuri lebih jauh" ditaruh di sini —
               bukan di baris keterangan di atas yang mudah terlewat. */
            <EmptyState
              isFiltered
              onReset={resetFilters}
              title="Belum ditemukan di agenda terbaru"
              description={`Pencarian baru menelusuri ${agendas.length} agenda yang sudah dimuat. Muat semua untuk menelusuri lebih jauh.`}
              action={
                <button
                  type="button"
                  onClick={loadAll}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition"
                >
                  {isLoadingMore ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{isLoadingMore ? 'Menelusuri…' : 'Telusuri seluruh riwayat'}</span>
                </button>
              }
            />
          ) : hasFilter ? (
            /* Empat sebab yang berbeda, empat pesan yang berbeda. Sebelumnya
               "belum ada catatan agenda" juga muncul saat guru baru saja
               menyaring ke bulan yang kebetulan kosong — pesannya menyalahkan
               riwayat yang sebenarnya ada, dan menyarankan mulai mengisi
               agenda padahal masalahnya cuma penyaring. */
            daySummary && daySummary.schoolDays > 0 ? (
              <EmptyState
                isFiltered
                onReset={resetFilters}
                title="Belum ada agenda pada rentang ini"
                description={`Tidak ada agenda pada ${formatDateRange(
                  rangeStart!,
                  rangeEnd!
                )}. Rentang ini hanya memuat hari yang belum diisi.`}
              />
            ) : daySummary && daySummary.total > 0 && daySummary.schoolDays === 0 ? (
              <EmptyState
                isFiltered
                onReset={resetFilters}
                title="Rentang ini tidak memuat hari sekolah"
                description={`${formatDateRange(
                  rangeStart!,
                  rangeEnd!
                )} hanya memuat akhir pekan${
                  daySummary.pendingDays.length > 0 ? ' dan hari yang belum tiba' : ''
                }. Pilih rentang lain.`}
              />
            ) : (
              <EmptyState
                isFiltered
                onReset={resetFilters}
                description={
                  search.trim()
                    ? `Tidak ada agenda yang cocok dengan "${search.trim()}".`
                    : 'Tidak ada agenda pada penyaring ini.'
                }
              />
            )
          ) : (
            <EmptyState
              title="Belum ada agenda"
              description="Isi agenda melalui menu Isi Agenda."
            />
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([month, items]) => (
            <section key={month} className="space-y-3">
              {/* Judul bulan lengket di bawah header aplikasi agar guru selalu
                  tahu sedang melihat periode mana saat menggulir. Offset-nya
                  harus sama persis dengan tinggi header guru (`h-12 sm:h-16`),
                  bukan ditebak — selisih 4px membuat judul tampak mengambang.
                  Karena bulan sudah dinyatakan di sini, kartu di bawahnya tidak
                  perlu mengulanginya lagi. */}
              <h3 className="sticky top-12 sm:top-16 z-10 flex items-center justify-between gap-2 py-2 px-3 bg-slate-100/95 backdrop-blur-xs border border-slate-200 rounded-lg">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {formatMonthYear(month)}
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {items.length} agenda
                </span>
              </h3>

              {items.map((agenda, index) => (
                <RiwayatCard
                  key={agenda.header.id}
                  agenda={agenda}
                  index={index}
                  isOpen={openIds.has(agenda.header.id)}
                  isToday={agenda.header.tanggal === todayStr}
                  canEdit={agenda.header.tanggal === todayStr || isAdmin}
                  isAdmin={isAdmin}
                  onToggle={() => toggleOpen(agenda.header.id)}
                  onEdit={() => onEditAgenda(agenda)}
                  onDelete={() => setPendingDelete(agenda)}
                  onOpenPhoto={(photo) => setActivePhoto(photo)}
                />
              ))}
            </section>
          ))}

          {searchScopeIsPartial && (
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="w-full py-3 bg-white hover:bg-slate-50 disabled:opacity-60 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Memuat…</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  <span>Muat {PAGE_SIZE} agenda lagi</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Hapus agenda ini?"
        message={
          pendingDelete
            ? `Agenda ${pendingDelete.header.kelas} tanggal ${formatDateLong(
                pendingDelete.header.tanggal
              )} beserta materi, absensi, dan foto akan dihapus permanen.`
            : ''
        }
        confirmText="Ya, hapus"
        cancelText="Batal"
      />

      <PhotoLightboxModal
        isOpen={!!activePhoto}
        onClose={() => setActivePhoto(null)}
        imageUrl={activePhoto?.url}
        uploadedAt={activePhoto?.uploadedAt}
        capturedAt={activePhoto?.capturedAt}
        actualTeacherName={activePhoto?.actualTeacherName}
        title={activePhoto?.title}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Kartu agenda                                                               */
/* -------------------------------------------------------------------------- */

interface RiwayatCardProps {
  agenda: FullAgenda;
  /** Urutan di dalam bulannya — hanya untuk menjeda animasi masuk. */
  index?: number;
  isOpen: boolean;
  isToday: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenPhoto: (photo: ActivePhoto) => void;
}

/**
 * Satu baris riwayat — SATU pohon JSX untuk semua ukuran layar.
 *
 * Bentuknya sengaja dibuat seringkas mungkin karena ini halaman memindai, bukan
 * halaman membaca. Tiga keputusan yang menyusunnya:
 *
 *  1. **Tanggal memimpin, tanpa mengulang bulan.** Judul kelompok bulan di
 *     atasnya sudah menyatakan bulan dan tahun, jadi menuliskannya lagi di
 *     tiap baris hanya menambah derau dua puluh kali per layar. Sebelumnya
 *     chip kelas justru elemen paling mencolok (`bg-slate-800`) sementara
 *     tanggalnya paling lemah — padahal untuk arsip berurut waktu, tanggal
 *     yang dicari lebih dulu.
 *
 *  2. **Materi ikut terlihat saat terlipat.** Dulu yang tampak hanya nama
 *     mata pelajaran, sehingga hampir setiap baris harus dibuka untuk tahu apa
 *     yang diajarkan. Cuplikan materi membuat sebagian besar baris sudah cukup
 *     dibaca tanpa dibuka.
 *
 *  3. **Status hanya muncul saat ada masalah.** Bukti foto wajib ada sebelum
 *     agenda bisa disimpan, dan "semua hadir" adalah keadaan biasa — jadi
 *     menuliskan keduanya di setiap baris berarti memakan hampir sepertiga
 *     lebar untuk mengabarkan bahwa semuanya normal. Yang ditampilkan hanya
 *     pengecualiannya: tanpa foto, atau ada siswa tidak hadir.
 *
 * Sebelumnya juga ada "N baris KBM" yang angkanya TIDAK menyaring baris
 * istirahat, sehingga "3 baris" bisa berarti dua jam pelajaran plus satu
 * istirahat — guru membacanya sebagai tiga jam, dan itu keliru. Angka itu
 * dihapus dari ringkasan; jumlah jam yang sebenarnya terlihat utuh di tabel
 * rincian.
 */
const RiwayatCard: React.FC<RiwayatCardProps> = ({
  agenda,
  index = 0,
  isOpen,
  isToday,
  canEdit,
  isAdmin,
  onToggle,
  onEdit,
  onDelete,
  onOpenPhoto,
}) => {
  const { header, kbm, absensi, kejadian, evidence } = agenda;
  const evidenceUrl = useEvidenceUrl(isOpen ? evidence?.storage_path : null);
  const bodyId = `riwayat-body-${header.id}`;

  /** Baris pelajaran sebenarnya — baris istirahat tidak ikut. */
  const lessons = kbm.filter((k) => !isBreakRow(k.jam_ke));
  const subjects = Array.from(
    new Set(lessons.map((k) => k.mapel).filter(Boolean))
  ).join(' · ');
  const materiPreview = lessons
    .map((k) => k.materi)
    .filter(Boolean)
    .join(' · ');
  const absentCount = absensi?.length || 0;
  const hasPhoto = Boolean(evidence?.storage_path);

  /**
   * Nama kelompok untuk lencana ringkas. Dipakai HANYA bila agenda ini benar-
   * benar berkelompok (mapel Ummi), yang bisa diketahui dari baris KBM-nya.
   * Pengulangan nama kelas dibuang lewat `labelKelasKelompok`.
   */
  const namaKelompok = lessons.find((k) => (k.halaqoh || '').trim().length > 0)?.halaqoh;
  const labelKelas = labelKelasKelompok(header.kelas, namaKelompok);

  return (
    <article
      style={{ animationDelay: `${60 + Math.min(index, 6) * 30}ms` }}
      className="card-press stagger-in bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden"
    >
      {/* Baris ringkas: ringkasan yang selalu tampak + aksi */}
      <div className="p-3 sm:p-3.5 flex items-start gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={bodyId}
          className="card-hit flex-1 min-w-0 text-left rounded-lg focus-visible:outline-none"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {formatDayDate(header.tanggal)}
            </span>
            <span className="text-2xs font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
              {labelKelas}
            </span>
            {isToday && (
              <span className="text-2xs font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded">
                Hari Ini
              </span>
            )}

            {/* Pengecualian saja — lihat catatan di atas komponen ini. */}
            {!hasPhoto && (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                <Camera className="w-3 h-3 shrink-0" aria-hidden="true" />
                Tanpa foto
              </span>
            )}
            {absentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                <UserX className="w-3 h-3 shrink-0" aria-hidden="true" />
                {absentCount} tidak hadir
              </span>
            )}
          </div>

          {(subjects || materiPreview) && (
            <p className="mt-1 text-xs text-slate-600 truncate">
              {subjects && <span className="font-semibold text-slate-800">{subjects}</span>}
              {subjects && materiPreview && <span className="text-slate-400"> · </span>}
              {materiPreview}
            </p>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {canEdit ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Koreksi agenda ${header.kelas} tanggal ${header.tanggal}`}
              title="Koreksi / Edit agenda"
              className="text-xs px-2 sm:px-2.5 py-2 min-h-10 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg flex items-center gap-1.5 transition"
            >
              <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Koreksi</span>
            </button>
          ) : (
            /* Ikon gembok, bukan teks. Penjelasan lengkapnya ada di rincian
               kartu — di baris ringkas, satu kalimat penuh akan mendorong
               tanggal dan kelas keluar dari layar. */
            <span
              className="p-2 min-w-10 min-h-10 inline-flex items-center justify-center text-slate-500"
              title="Hanya agenda hari ini yang bisa dikoreksi sendiri. Buka rincian untuk keterangan."
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">
                Terkunci — hanya agenda hari ini yang bisa dikoreksi sendiri
              </span>
            </span>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Hapus agenda ${header.kelas} tanggal ${header.tanggal}`}
              title="Hapus agenda"
              className="p-2 min-w-10 min-h-10 inline-flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={bodyId}
            aria-label={isOpen ? 'Tutup rincian agenda' : 'Buka rincian agenda'}
            title={isOpen ? 'Tutup rincian' : 'Buka rincian'}
            className="p-2 min-w-10 min-h-10 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Rincian */}
      {isOpen && (
        <div id={bodyId} className="border-t border-slate-200 p-3.5 sm:p-4 space-y-3.5">
          {!canEdit && (
            <p className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Hanya agenda hari ini yang bisa dikoreksi sendiri. Hubungi administrator
                untuk hari lain.
              </span>
            </p>
          )}

          {/* KBM — satu markup untuk dua tata letak.
              Kelas `kbm-table` (lihat `index.css`) mengubah tiap baris menjadi
              blok bertumpuk di bawah `sm`, memakai `data-label` sebagai nama
              kolom. Dengan begitu Materi — kolom terpenting di sini — terbaca
              penuh tanpa perlu menggeser tabel ke samping. */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <ScrollArea label={`Tabel kegiatan belajar mengajar ${header.kelas}`}>
              <table className="kbm-table w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                    <th scope="col" className="py-2 px-3 w-20 border-r border-slate-200">
                      Jam
                    </th>
                    <th scope="col" className="py-2 px-3 w-40 border-r border-slate-200">
                      Guru
                    </th>
                    <th scope="col" className="py-2 px-3 w-36 border-r border-slate-200">
                      Mapel
                    </th>
                    <th scope="col" className="py-2 px-3 w-28 border-r border-slate-200">
                      Kelompok
                    </th>
                    <th scope="col" className="py-2 px-3 border-r border-slate-200">
                      Materi
                    </th>
                    <th scope="col" className="py-2 px-3 w-32">
                      Tugas/PR
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {kbm.map((k, idx) => {
                    const brk = isBreakRow(k.jam_ke);
                    return (
                      <tr key={idx} className={brk ? 'bg-slate-50 text-slate-500' : 'bg-white'}>
                        <td
                          data-label="Jam"
                          className="py-2 px-3 border-r border-slate-200 font-bold text-slate-700"
                        >
                          {k.jam_ke}
                        </td>
                        <td
                          data-label="Guru"
                          className="py-2 px-3 border-r border-slate-200 font-medium text-slate-800"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{k.nama_guru || '-'}</span>
                            {k.is_badal && (
                              <span className="px-1.5 py-0.5 text-2xs font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
                                Badal
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          data-label="Mapel"
                          className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-800"
                        >
                          {k.mapel}
                        </td>
                        {/*
                          Kelompok: tanpa kolom ini, dua halaqoh pada kelas &
                          jam yang sama tampil sebagai baris yang identik.
                        */}
                        <td
                          data-label="Kelompok"
                          className="py-2 px-3 border-r border-slate-200 text-slate-600 font-medium"
                        >
                          {k.halaqoh || <span className="text-slate-400">—</span>}
                        </td>
                        <td
                          data-label="Materi"
                          className="py-2 px-3 border-r border-slate-200 text-slate-700 leading-relaxed"
                        >
                          {k.materi}
                        </td>
                        <td data-label="Tugas / PR" className="py-2 px-3 text-slate-600">
                          {k.tugas_pr || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </div>

          {/* Kehadiran — istilah disamakan dengan form pengisian */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs font-bold text-slate-700 block mb-1.5">
              Siswa Tidak Hadir
            </span>
            {absensi && absensi.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {absensi.map((ab, abIdx) => (
                  <span
                    key={abIdx}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 flex items-center gap-1.5"
                  >
                    <span>{ab.nama_siswa || 'Siswa'}</span>
                    <span
                      className={`font-bold px-1.5 rounded text-2xs ${
                        ab.status === 'S'
                          ? 'bg-blue-100 text-blue-800'
                          : ab.status === 'I'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {ab.status === 'S' ? 'Sakit' : ab.status === 'I' ? 'Izin' : 'Alpa'}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-emerald-700 font-medium">Semua siswa hadir.</span>
            )}
          </div>

          {/* Catatan kejadian — istilah disamakan dengan form pengisian */}
          {kejadian?.[0]?.uraian_kejadian && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs font-bold text-slate-700 block mb-1.5">
                Catatan Kejadian
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {kejadian[0].uraian_kejadian}
              </p>
            </div>
          )}

          {/* Bukti foto — URL dimuat hanya setelah kartu dibuka */}
          {evidence?.storage_path ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {evidenceUrl ? (
                  <img
                    src={evidenceUrl}
                    alt={`Bukti foto mengajar ${header.kelas}`}
                    className="w-14 h-14 rounded-lg object-cover border border-slate-300 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                    <Camera className="w-5 h-5" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Bukti foto tersedia</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Diunggah {formatDateTimeShort(evidence.uploaded_at)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!evidenceUrl}
                onClick={() =>
                  onOpenPhoto({
                    url: evidenceUrl!,
                    uploadedAt: evidence.uploaded_at,
                    capturedAt: evidence.captured_at,
                    actualTeacherName:
                      evidence.actual_teacher_name ||
                      header.actual_teacher_name ||
                      kbm?.[0]?.nama_guru,
                    title: `Dokumentasi Foto - ${header.kelas}`,
                  })
                }
                className="px-3 py-2 min-h-10 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 shrink-0 transition"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                <span>{evidenceUrl ? 'Buka Foto' : 'Memuat…'}</span>
              </button>
            </div>
          ) : (
            <p className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              Belum ada bukti foto untuk agenda ini.
            </p>
          )}
        </div>
      )}
    </article>
  );
};
