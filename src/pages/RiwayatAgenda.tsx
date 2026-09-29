import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router';
import { useRiwayatFilterParams, useRiwayatOpenParam } from '../routes/useRiwayatQuery';
import {
  localDateString,
  formatDayDate,
  formatDateLong,
  formatDateTimeShort,
  formatMonthYear,
  monthRange,
  recentMonthKeys,
} from '../utils/date';
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

  // Filter bulan & pencarian hidup di URL (`?q=` / `?bulan=`), begitu pula
  // kartu yang sedang terbuka (`?buka=`). Lihat `src/routes/useRiwayatQuery.ts`.
  const {
    search,
    setSearch,
    monthFilter,
    setMonthFilter,
    reset: resetUrlFilters,
  } = useRiwayatFilterParams();
  const { openIds, toggleOpen } = useRiwayatOpenParam();

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
   * Rentang tanggal bulan terpilih — dikirim ke server, bukan disaring di
   * browser. Menyaring di browser hanya benar selama seluruh riwayat sudah
   * terunduh; begitu diambil per halaman, penyaring lokal akan berbohong.
   */
  const rangeStart = monthFilter !== 'ALL' ? monthRange(monthFilter).start : undefined;
  const rangeEnd = monthFilter !== 'ALL' ? monthRange(monthFilter).end : undefined;

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

  // Muat halaman pertama setiap kali cakupan berubah (guru atau bulan terpilih).
  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setLoadError(false);
    setAllLoaded(false);

    fetchPage(0)
      .then((page) => {
        if (alive) setAgendas(page);
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
  }, [fetchPage, showToast]);

  /** Muat ulang paksa — tombol "Segarkan" dan setelah sebuah agenda dihapus. */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    setAllLoaded(false);
    try {
      setAgendas(await fetchPage(0));
    } catch (err) {
      console.error(err);
      setLoadError(true);
      showToast('error', 'Gagal memuat riwayat agenda.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, showToast]);

  /** Halaman berikutnya, ditambahkan di bawah yang sudah ada. */
  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const page = await fetchPage(agendas.length);
      setAgendas((prev) => [...prev, ...page]);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat agenda berikutnya.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [agendas.length, fetchPage, showToast]);

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
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat seluruh riwayat.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeTeacherName, rangeStart, rangeEnd, showToast]);

  /**
   * Pilihan bulan: dua belas bulan terakhir, ditambah bulan apa pun yang muncul
   * di data yang sudah termuat (mis. saat guru memuat jauh ke belakang, atau
   * membuka tautan lama).
   *
   * Sebelumnya daftar ini dibangun dari seluruh data sehingga tidak pernah
   * menawarkan bulan kosong. Sejak pengambilan per halaman, bulan yang punya
   * data tidak lagi bisa diketahui seluruhnya tanpa mengunduh semuanya — jadi
   * rentang yang pasti masuk akal dipakai sebagai dasar. Bulan kosong yang
   * terpilih berakhir di keadaan kosong yang menjelaskan dirinya sendiri,
   * bukan di layar bingung.
   */
  const availableMonths = useMemo(() => {
    const keys = new Set(recentMonthKeys(MONTH_OPTIONS));
    for (const agenda of agendas) keys.add(monthKey(agenda.header.tanggal));
    return Array.from(keys).sort().reverse();
  }, [agendas]);

  /**
   * Bulan yang sedang tersaring tetapi tidak punya data (mis. tautan lama).
   * Tetap ditampilkan sebagai satu pilihan supaya kotak pilihannya tidak tampil
   * kosong tanpa keterangan.
   */
  const staleMonth =
    monthFilter !== 'ALL' && !availableMonths.includes(monthFilter) ? monthFilter : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agendas.filter((agenda) => {
      if (monthFilter !== 'ALL' && monthKey(agenda.header.tanggal) !== monthFilter) {
        return false;
      }
      if (!q) return true;
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
  }, [agendas, search, monthFilter]);

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

  const hasFilter = search.trim() !== '' || monthFilter !== 'ALL';

  const resetFilters = () => resetUrlFilters();

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
              Daftar agenda yang diisi oleh{' '}
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

        {/* Sebelumnya tidak ada kendali apa pun selain "Segarkan", sehingga
            menemukan satu agenda lama berarti menggulir seluruh riwayat. */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
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

          <div className="relative sm:w-56">
            <CalendarDays
              className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Saring berdasarkan bulan"
              className="w-full pl-9 pr-3 py-2.5 min-h-10 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 transition cursor-pointer"
            >
              <option value="ALL">Semua bulan</option>
              {staleMonth && <option value={staleMonth}>{formatMonthYear(staleMonth)}</option>}
              {availableMonths.map((key) => (
                <option key={key} value={key}>
                  {formatMonthYear(key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isLoading && !loadError && agendas.length > 0 && (
          <p className="text-xs text-slate-600" role="status" aria-live="polite">
            Menampilkan <strong className="text-slate-800">{filtered.length}</strong> agenda
            {searchScopeIsPartial && ' · masih ada agenda lama yang belum dimuat'}
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
            message="Riwayat agenda tidak dapat diambil dari server. Periksa koneksi lalu coba lagi."
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
              description={`Pencarian baru menelusuri ${agendas.length} agenda yang sudah dimuat. Muat seluruh riwayat untuk menelusuri sampai ke belakang.`}
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
            <EmptyState
              isFiltered
              onReset={resetFilters}
              description={
                search.trim()
                  ? `Tidak ada agenda yang cocok dengan pencarian "${search.trim()}".`
                  : `Tidak ada agenda pada ${formatMonthYear(monthFilter)}.`
              }
            />
          ) : (
            <EmptyState
              title="Belum ada catatan agenda"
              description="Agenda yang Anda isi akan muncul di sini. Mulai dari menu Isi Agenda."
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
              )} beserta materi, absensi, dan bukti fotonya akan dihapus permanen.`
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
              {header.kelas}
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
              title="Hanya agenda hari yang sama yang bisa dikoreksi sendiri. Buka rincian untuk keterangan."
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">
                Terkunci — hanya agenda hari yang sama yang bisa dikoreksi sendiri
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
                Hanya agenda hari yang sama yang bisa dikoreksi sendiri. Hubungi administrator
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
                    <span>Bukti foto mengajar tersedia</span>
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
              Bukti foto belum tersedia untuk agenda ini.
            </p>
          )}
        </div>
      )}
    </article>
  );
};
