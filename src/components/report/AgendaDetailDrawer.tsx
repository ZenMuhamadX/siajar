import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, BookOpen, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useModalBehavior } from '../common/useModalBehavior';
import { getAgendaById } from '../../services/agendaService';
import { getEvidenceSignedUrl } from '../../services/evidenceService';
import type { FullAgenda } from '../../types';
import { PhotoLightboxModal } from '../PhotoLightboxModal';

interface AgendaDetailDrawerProps {
  agendaId: string | null;
  onClose: () => void;
  /** Handoff ke form koreksi (`/admin/agenda?edit=<id>`). */
  onEdit?: (agendaId: string) => void;
  /** Admin boleh menghapus foto dokumentasi dari drawer. */
  isAdmin?: boolean;
  onAdminDeleteEvidence?: (agendaId: string, storagePath?: string) => void;
}

/**
 * Drawer detail agenda.
 *
 * Prinsipnya *progressive disclosure*: tabel jurnal hanya menampilkan ringkasan
 * (kapan, kelas, guru, mapel, jam, kehadiran, foto), sedangkan isi lengkap —
 * KBM per jam, absensi, catatan kejadian, foto — diambil di sini saat baris
 * diklik. Efeknya tabel bisa dipindai cepat dan jurnal tidak lagi melebar jadi
 * 10 kolom berisi daftar.
 *
 * Detail di-fetch dengan `getAgendaById` (satu agenda penuh) sehingga halaman
 * daftar tidak perlu menarik seluruh isi agenda. Tanda tangan foto dibuat di
 * sini, bukan saat memuat daftar.
 */
export const AgendaDetailDrawer: React.FC<AgendaDetailDrawerProps> = ({
  agendaId,
  onClose,
  onEdit,
  isAdmin = false,
  onAdminDeleteEvidence,
}) => {
  const panelRef = useRef<HTMLElement>(null);

  // Perilaku modal — ESC, kunci scroll, perangkap fokus, fokus awal, dan
  // pengembalian fokus — dipakai bersama lewat hook. Sebelumnya drawer ini
  // hanya menangani ESC dan scroll lock, sehingga Tab masih bisa keluar ke
  // halaman di belakang panel. Lihat `useModalBehavior`.
  useModalBehavior({
    isOpen: Boolean(agendaId),
    onClose,
    containerRef: panelRef,
  });

  if (!agendaId) return null;

  // Portal ke `document.body`. Tanpa ini `top-3 bottom-3` terukur dari kotak
  // `<main>` (yang punya `transform` dari `animation: fade-in-up`), bukan dari
  // viewport — panelnya lalu terlihat "di tengah" area konten. Lihat `index.css`.
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] no-print"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        data-drawer-panel
        className="fixed top-3 right-3 bottom-3 z-50 w-[calc(100%-1.5rem)] sm:w-[520px] max-h-[85vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none no-print"
      >
        {/* `key` membuat state lahir baru setiap agenda dibuka, jadi tidak perlu
            reset manual di dalam effect. */}
        <DrawerContent
          key={agendaId}
          agendaId={agendaId}
          onClose={onClose}
          onEdit={onEdit}
          isAdmin={isAdmin}
          onAdminDeleteEvidence={onAdminDeleteEvidence}
        />
      </aside>
    </>,
    document.body,
  );
};

interface DrawerContentProps {
  agendaId: string;
  onClose: () => void;
  onEdit?: (agendaId: string) => void;
  isAdmin?: boolean;
  onAdminDeleteEvidence?: (agendaId: string, storagePath?: string) => void;
}

const DrawerContent: React.FC<DrawerContentProps> = ({
  agendaId,
  onClose,
  onEdit,
  isAdmin = false,
  onAdminDeleteEvidence,
}) => {
  const [agenda, setAgenda] = useState<FullAgenda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getAgendaById(agendaId);
        if (cancelled) return;
        if (!data) {
          setError('Agenda tidak ditemukan (mungkin sudah dihapus).');
          return;
        }
        setAgenda(data);
        if (data.evidence?.storage_path) {
          const url = await getEvidenceSignedUrl(data.evidence.storage_path);
          if (!cancelled) setPhotoUrl(url || null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Gagal memuat detail agenda.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agendaId]);

  const kbm = [...(agenda?.kbm || [])].sort((a, b) => Number(a.jam_ke) - Number(b.jam_ke));
  const absensi = agenda?.absensi || [];
  const kejadian = agenda?.kejadian || [];
  const guru = agenda?.header.actual_teacher_name || kbm[0]?.nama_guru || '-';
  const isBadal = kbm.some((k) => k.is_badal);

  return (
    <>
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700" />
            Detail Agenda
          </h3>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {agenda ? `${agenda.header.kelas} · ${agenda.header.tanggal}` : 'Memuat…'}
          </p>
        </div>
        <button
          aria-label="Tutup (Esc)"
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-600 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition shrink-0"
          title="Tutup (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
       </div>

      {/* Body */}
      {/* Body — hanya bagian ini yang scroll; `min-h-0` supaya `max-h-[85vh]`
          di panel benar-benar respected, `overscroll-contain` supaya scroll
          tidak diteruskan ke halaman di belakang. */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-5 leading-relaxed">
        {isLoading && (
          <div className="py-10 flex flex-col items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Memuat detail agenda...</span>
          </div>
        )}

        {!isLoading && error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {!isLoading && agenda && (
          <>
            {/* Ringkasan */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[13px] text-slate-500 block">Guru</span>
                <span className="font-semibold text-slate-800">
                  {guru}
                  {isBadal && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[12px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded">
                      Badal
                    </span>
                  )}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[13px] text-slate-500 block">Mata Pelajaran</span>
                <span className="font-semibold text-slate-800">
                  {kbm[0]?.mapel || agenda.header.kelas}
                </span>
              </div>
            </div>

            {/* KBM */}
            <section className="space-y-2">
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-500">
                KBM & Tugas
              </h4>
              {kbm.length === 0 ? (
                <p className="text-xs text-slate-600 italic">Belum ada KBM pada agenda ini.</p>
              ) : (
                <ul className="space-y-2">
                  {kbm.map((k, i) => (
                    <li key={i} className="p-3 bg-white border border-slate-200 rounded-xl text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-100 font-bold text-[12px]">
                          Jam {k.jam_ke}
                        </span>
                        <span className="font-semibold text-slate-800">{k.mapel}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{k.materi || '-'}</p>
                      {k.tugas_pr && (
                        <p className="mt-1 text-slate-500">
                          <span className="font-semibold">Tugas/PR:</span> {k.tugas_pr}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Absensi */}
            <section className="space-y-2">
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-500">
                Kehadiran Siswa
              </h4>
              {absensi.length === 0 ? (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Hadir lengkap
                </p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {absensi.map((a, i) => (
                    <li
                      key={a.id || `${a.siswa_id || 'x'}-${i}`}
                      className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-0"
                    >
                      <span className="text-slate-700">{a.nama_siswa || a.siswa?.nama_siswa || '-'}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[12px] font-bold border ${
                          a.status === 'A'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : a.status === 'I'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {a.status === 'A' ? 'Alpha' : a.status === 'I' ? 'Izin' : 'Sakit'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Kejadian */}
            {kejadian.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-500">
                  Catatan Kejadian
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {kejadian.map((k, i) => (
                    <li key={i} className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      {k.uraian_kejadian}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Foto */}
            {agenda.evidence?.storage_path && (
              <section className="space-y-2">
                <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-500">
                  Dokumentasi Foto
                </h4>
                {photoUrl ? (
                  <button
                    aria-label="Perbesar foto"
                    type="button"
                    onClick={() => setIsPhotoOpen(true)}
                    className="block w-full border border-slate-200 rounded-xl overflow-hidden hover:border-emerald-300 transition"
                    title="Perbesar foto"
                  >
                    <img src={photoUrl} alt="Dokumentasi agenda" className="w-full object-cover" />
                  </button>
                 ) : (
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Foto tidak dapat dimuat
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition"
        >
          Tutup
        </button>
        {agenda && onEdit && (
          <button
            type="button"
            onClick={() => {
              onEdit(agendaId);
              onClose();
            }}
            className="px-3.5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition"
          >
            Koreksi Agenda
          </button>
        )}
      </div>

      {/* Lightbox foto (juga tempat admin menghapus foto dokumentasi) */}
      <PhotoLightboxModal
        isOpen={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        imageUrl={photoUrl || ''}
        title={`Dokumentasi Foto - ${agenda?.header.kelas || ''}`}
        capturedAt={agenda?.evidence?.captured_at}
        uploadedAt={agenda?.evidence?.uploaded_at}
        actualTeacherName={agenda?.header.actual_teacher_name || kbm[0]?.nama_guru}
        isAdmin={isAdmin}
        onAdminDelete={() =>
          onAdminDeleteEvidence?.(agendaId, agenda?.evidence?.storage_path || undefined)
        }
      />
    </>
  );
};
