import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { localDateString } from '../utils/date';
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
} from 'lucide-react';

interface RiwayatAgendaProps {
  onEditAgenda: (agenda: FullAgenda) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

/** Jumlah kartu yang ditampilkan sekali jalan. */
const PAGE_SIZE = 20;

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

const formatDateIndo = (dateStr: string) => {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatDateTimeIndo = (iso?: string) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
};

const monthKey = (dateStr: string) => dateStr.slice(0, 7); // "2026-09"

const formatMonthIndo = (key: string) => {
  try {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return key;
  }
};

const isBreakRow = (jamKe: string) => jamKe === 'Istirahat' || jamKe === 'Isoma';

/** Ringkasan mapel pada satu agenda — dipakai di bagian kartu yang selalu tampak. */
const subjectSummary = (agenda: FullAgenda) =>
  Array.from(
    new Set(
      agenda.kbm
        .filter((k) => !isBreakRow(k.jam_ke))
        .map((k) => k.mapel)
        .filter(Boolean)
    )
  ).join(' · ');

export const RiwayatAgenda: React.FC<RiwayatAgendaProps> = ({ onEditAgenda, showToast }) => {
  const { activeTeacherName, isAdmin } = useAuth();
  const [agendas, setAgendas] = useState<FullAgenda[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<FullAgenda | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activePhoto, setActivePhoto] = useState<ActivePhoto | null>(null);

  const todayStr = localDateString();

  const fetchRiwayat = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      // Penyaringan guru terjadi di server (lihat `getRekapAgenda`), jadi yang
      // terunduh hanya agenda milik guru ini — bukan seluruh riwayat sekolah.
      const data = await getRekapAgenda({
        nama_guru: activeTeacherName || undefined,
      });
      setAgendas(data);
      setVisibleCount(PAGE_SIZE);
    } catch (err) {
      console.error(err);
      setLoadError(true);
      showToast('error', 'Gagal memuat riwayat agenda.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTeacherName, showToast]);

  useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  /** Bulan yang benar-benar ada datanya — tidak menawarkan pilihan kosong. */
  const availableMonths = useMemo(() => {
    const keys = new Set(agendas.map((a) => monthKey(a.header.tanggal)));
    return Array.from(keys).sort().reverse();
  }, [agendas]);

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
    const visible = filtered.slice(0, visibleCount);
    const map = new Map<string, FullAgenda[]>();
    for (const agenda of visible) {
      const key = monthKey(agenda.header.tanggal);
      const bucket = map.get(key);
      if (bucket) bucket.push(agenda);
      else map.set(key, [agenda]);
    }
    return Array.from(map.entries());
  }, [filtered, visibleCount]);

  const hasFilter = search.trim() !== '' || monthFilter !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setMonthFilter('ALL');
    setVisibleCount(PAGE_SIZE);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteAgenda(pendingDelete.header.id);
      showToast('success', 'Agenda berhasil dihapus.');
      setPendingDelete(null);
      fetchRiwayat();
    } catch {
      showToast('error', 'Gagal menghapus agenda.');
    } finally {
      setIsDeleting(false);
    }
  };

  /* ------------------------------- Render ------------------------------- */

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header + kendali pencarian */}
      <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Riwayat Agenda Saya
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Daftar agenda yang diisi oleh{' '}
              <strong className="text-slate-800">{activeTeacherName}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={fetchRiwayat}
            disabled={isLoading}
            className="text-xs px-3 py-2 min-h-10 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-semibold border border-slate-300 rounded-lg transition flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Segarkan</span>
          </button>
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
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
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
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              aria-label="Saring berdasarkan bulan"
              className="w-full pl-9 pr-3 py-2.5 min-h-10 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 transition cursor-pointer"
            >
              <option value="ALL">Semua bulan</option>
              {availableMonths.map((key) => (
                <option key={key} value={key}>
                  {formatMonthIndo(key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isLoading && !loadError && agendas.length > 0 && (
          <p className="text-xs text-slate-600" role="status" aria-live="polite">
            Menampilkan <strong className="text-slate-800">{filtered.length}</strong> dari{' '}
            {agendas.length} agenda
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
            onRetry={fetchRiwayat}
          />
        </div>
      ) : agendas.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-xl">
          <EmptyState
            title="Belum ada catatan agenda"
            description="Agenda yang Anda isi akan muncul di sini. Mulai dari menu Isi Agenda."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-xl">
          <EmptyState
            isFiltered
            onReset={resetFilters}
            description={`Tidak ada agenda yang cocok dengan pencarian${
              search.trim() ? ` "${search.trim()}"` : ''
            }.`}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([month, items]) => (
            <section key={month} className="space-y-3">
              {/* Judul bulan lengket di bawah header aplikasi agar guru selalu
                  tahu sedang melihat periode mana saat menggulir. */}
              <h3 className="sticky top-[3.25rem] sm:top-16 z-10 flex items-center justify-between gap-2 py-2 px-3 bg-slate-100/95 backdrop-blur-xs border border-slate-200 rounded-lg">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {formatMonthIndo(month)}
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {items.length} agenda
                </span>
              </h3>

              {items.map((agenda) => {
                const id = agenda.header.id;
                const isToday = agenda.header.tanggal === todayStr;
                return (
                  <RiwayatCard
                    key={id}
                    agenda={agenda}
                    isOpen={expanded.has(id)}
                    isToday={isToday}
                    canEdit={isToday || isAdmin}
                    isAdmin={isAdmin}
                    absentCount={agenda.absensi?.length || 0}
                    subjects={subjectSummary(agenda)}
                    hasEvidence={Boolean(agenda.evidence?.storage_path)}
                    onToggle={() => toggleExpanded(id)}
                    onEdit={() => onEditAgenda(agenda)}
                    onDelete={() => setPendingDelete(agenda)}
                    onOpenPhoto={(photo) => setActivePhoto(photo)}
                  />
                );
              })}
            </section>
          ))}

          {filtered.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
              <span>
                Muat {Math.min(PAGE_SIZE, filtered.length - visibleCount)} agenda lagi
              </span>
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
            ? `Agenda ${pendingDelete.header.kelas} tanggal ${formatDateIndo(
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
  isOpen: boolean;
  isToday: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  absentCount: number;
  subjects: string;
  hasEvidence: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenPhoto: (photo: ActivePhoto) => void;
}

/**
 * Satu kartu agenda — SATU pohon JSX untuk semua ukuran layar.
 *
 * Sebelumnya isi kartu ini ditulis dua kali (versi HP dan versi desktop)
 * dengan istilah yang berbeda untuk bagian yang sama, sehingga setiap
 * perbaikan harus dilakukan dua kali dan guru melihat nama bagian yang
 * berubah saat berpindah perangkat. Sekarang perbedaannya murni CSS:
 * tabel KBM dibungkus `ScrollArea` yang sudah menangani layar sempit.
 */
const RiwayatCard: React.FC<RiwayatCardProps> = ({
  agenda,
  isOpen,
  isToday,
  canEdit,
  isAdmin,
  absentCount,
  subjects,
  hasEvidence,
  onToggle,
  onEdit,
  onDelete,
  onOpenPhoto,
}) => {
  const { header, kbm, absensi, kejadian, evidence } = agenda;
  const evidenceUrl = useEvidenceUrl(isOpen ? evidence?.storage_path : null);
  const bodyId = `riwayat-body-${header.id}`;

  return (
    <article className="bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
      {/* Kepala kartu: ringkasan yang selalu tampak + aksi */}
      <div className="p-3.5 sm:p-4 flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={bodyId}
          className="flex-1 min-w-0 text-left rounded-lg focus-visible:outline-none"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="font-bold text-xs px-2 py-0.5 bg-slate-800 text-white rounded">
              {header.kelas}
            </span>
            <span className="text-xs font-semibold text-slate-800">
              {formatDateIndo(header.tanggal)}
            </span>
            {isToday && (
              <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded">
                Hari Ini
              </span>
            )}
          </div>

          {subjects && (
            <p className="mt-1.5 text-sm font-bold text-slate-900 truncate">{subjects}</p>
          )}

          {/* Status ringkas: yang guru cari saat memindai daftar */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  hasEvidence ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                aria-hidden="true"
              />
              {hasEvidence ? 'Bukti foto ada' : 'Tanpa bukti foto'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  absentCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                aria-hidden="true"
              />
              {absentCount === 0 ? 'Semua hadir' : `${absentCount} siswa tidak hadir`}
            </span>
            <span className="text-slate-500">{kbm.length} baris KBM</span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="text-xs px-2.5 py-2 min-h-10 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg flex items-center gap-1.5 transition"
            >
              <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Koreksi / Edit</span>
            </button>
          ) : (
            /* "Terkunci" tanpa alasan membuat guru mengira aplikasinya rusak.
               Sekarang aturannya disebutkan langsung di tempat kejadian. */
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-2 rounded-lg"
              title="Hanya agenda hari yang sama yang bisa dikoreksi sendiri. Untuk hari lain, hubungi administrator."
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Hanya hari yang sama
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
            <p className="sm:hidden flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Hanya agenda hari yang sama yang bisa dikoreksi sendiri. Hubungi administrator
                untuk hari lain.
              </span>
            </p>
          )}

          {/* KBM */}
          <div className="border border-slate-200 rounded-lg">
            <ScrollArea label={`Tabel kegiatan belajar mengajar ${header.kelas}`}>
              <table className="w-full text-left text-xs border-collapse">
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
                        <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-700">
                          {k.jam_ke}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span>{k.nama_guru || '-'}</span>
                            {k.is_badal && (
                              <span className="px-1.5 py-0.5 text-2xs font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
                                Badal
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-800">
                          {k.mapel}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700 leading-relaxed">
                          {k.materi}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{k.tugas_pr || '-'}</td>
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
                    Diunggah {formatDateTimeIndo(evidence.uploaded_at)}
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
            <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              Bukti foto belum tersedia untuk agenda ini.
            </p>
          )}
        </div>
      )}
    </article>
  );
};
