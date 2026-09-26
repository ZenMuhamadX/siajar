import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useToast } from '../contexts/ToastContext';
import { getAgendaById } from '../services/agendaService';
import type { FullAgenda } from '../types';

/**
 * Handoff edit agenda lewat URL: `/admin/agenda?edit=<id>` / `/?edit=<id>`.
 *
 * Kenapa URL, bukan state? Supaya refresh / tombol Back / link yang dishare ke
 * sesama guru tetap membuka mode edit yang sama, bukan kembali ke tampilan
 * biasa.
 *
 * - `editAgenda`   : agenda hasil fetch, `null` bila bukan mode edit
 * - `isEditLoading`: true selama fetch — komponen halaman sebaiknya menampilkan
 *                    `<LoadingState/>` dulu supaya baru mount ketika `editData`
 *                    sudah siap (state awal halaman dihitung dari `editData`)
 * - `clearEdit`    : keluar mode edit (tombol Batal & setelah sukses simpan)
 */
export function useEditAgendaParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const showToast = useToast();
  const editId = searchParams.get('edit');

  /** Hasil fetch terakhir, disimpan berikut id-nya agar bisa dicocokkan dengan URL. */
  const [result, setResult] = useState<{ id: string; agenda: FullAgenda | null } | null>(null);

  const clearEdit = useCallback(() => {
    // No-op bila tidak sedang mode edit. Penting supaya tulisan URL lain di
    // event handler yang sama (mis. membuang `?slot=`) tidak tertimpa: setter
    // react-router menghitung dari snapshot render, bukan dari hasil tulisan
    // sebelumnya.
    if (!searchParams.has('edit')) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('edit');
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!editId) return;

    let cancelled = false;

    (async () => {
      try {
        const agenda = await getAgendaById(editId);
        if (cancelled) return;

        if (agenda) {
          setResult({ id: editId, agenda });
        } else {
          // Link basi / agenda sudah dihapus: beri tahu user, lalu buang query.
          showToast('info', 'Agenda tidak ditemukan (mungkin sudah dihapus).');
          clearEdit();
        }
      } catch (err: any) {
        if (cancelled) return;
        showToast('error', `Gagal memuat agenda: ${err?.message || 'kesalahan jaringan'}`);
        clearEdit();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editId, clearEdit, showToast]);

  // Semua state di bawah diturunkan dari URL — tanpa setState sinkron di effect.
  const matched = result && result.id === editId ? result : null;

  return {
    editAgenda: matched ? matched.agenda : null,
    isEditLoading: Boolean(editId) && !matched,
    clearEdit,
  };
}
