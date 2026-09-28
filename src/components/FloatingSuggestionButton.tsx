import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';

/**
 * Tombol "Saran" mengambang yang bisa digeser.
 *
 * Sebelumnya ini adalah tab keempat di navigasi bawah. Tab statis memakan
 * lebar bar sepanjang waktu padahal kotak saran dipakai sesekali saja — jadi
 * ia dipindahkan ke tombol bulat yang bisa diletakkan guru di mana pun.
 *
 * Aturan perilaku:
 * - Digeser dengan jari/mouse; posisinya DIINGAT antar-sesi.
 * - Saat dilepas, tombol menempel ke tepi kiri atau kanan terdekat — supaya
 *   tidak berhenti di tengah layar dan menutupi isi.
 * - Posisi vertikal bebas, tetapi tidak pernah masuk ke bawah navigasi bawah.
 * - Ketukan (gerak < 6px) membuka kotak saran; gerakan lebih dari itu dianggap
 *   geseran dan tidak memicu pembukaan.
 */

const STORAGE_KEY = 'siajar.fab.saran';
/** Sisi tombol (px) — harus sama dengan `w-14 h-14` di kelas. */
const SIZE = 56;
/** Jarak dari tepi layar saat menempel. */
const MARGIN = 16;
/** Ambang gerak: di bawah ini dianggap ketukan, bukan geseran. */
const DRAG_THRESHOLD = 6;

type Side = 'left' | 'right';

interface SavedPos {
  side: Side;
  /** Jarak dari dasar layar ke bawah tombol. Lebih tahan terhadap perubahan
   *  ukuran layar/rotasi daripada menyimpan koordinat `y` mentah. */
  bottom: number;
}

const readSaved = (): SavedPos | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPos;
    if (parsed?.side !== 'left' && parsed?.side !== 'right') return null;
    if (typeof parsed.bottom !== 'number' || !Number.isFinite(parsed.bottom)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeSaved = (pos: SavedPos) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* mode privat / kuota penuh — posisi dilewati, bukan kegagalan */
  }
};

/** Tinggi navigasi bawah dari token CSS, dengan cadangan bila belum terpasang. */
const navHeight = () => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-h');
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed * (raw.trim().endsWith('rem') ? 16 : 1) : 60;
};

interface FloatingSuggestionButtonProps {
  onClick: () => void;
}

export const FloatingSuggestionButton: React.FC<FloatingSuggestionButtonProps> = ({ onClick }) => {
  const clamp = useCallback((x: number, y: number) => {
    // Batas bawah: dasar tombol tidak boleh masuk ke area navigasi.
    const maxY = window.innerHeight - SIZE - (navHeight() + 8);
    const maxX = window.innerWidth - SIZE - 8;
    return {
      x: Math.min(Math.max(8, x), Math.max(8, maxX)),
      y: Math.min(Math.max(8, y), Math.max(8, maxY)),
    };
  }, []);

  const positionFor = useCallback(
    (saved: SavedPos) => {
      const x = saved.side === 'right' ? window.innerWidth - SIZE - MARGIN : MARGIN;
      const y = window.innerHeight - SIZE - saved.bottom;
      return clamp(x, y);
    },
    [clamp]
  );

  /**
   * Posisi tersimpan dibaca SEKALI lewat penginisialisasi malas, bukan lewat
   * efek. Efek akan menulis state tepat setelah render pertama (satu render
   * tambahan yang tidak perlu), dan nilainya memang hanya bisa diketahui di
   * klien — `window` dan `localStorage` tidak ada saat render di server.
   */
  const [saved, setSaved] = useState<SavedPos>(
    () => readSaved() ?? { side: 'right', bottom: navHeight() + MARGIN }
  );
  const [pos, setPos] = useState<{ x: number; y: number }>(() => positionFor(saved));
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{ offsetX: number; offsetY: number; moved: boolean } | null>(null);
  /** Ketukan palsu setelah geseran — `click` tetap dipancarkan browser. */
  const suppressClickRef = useRef(false);

  // Layar berubah (rotasi / jendela diubah): hitung ulang dari posisi tersimpan,
  // supaya tombol tidak pernah tertinggal di luar layar.
  useEffect(() => {
    const onResize = () => setPos(positionFor(saved));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [positionFor, saved]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = e.clientX - drag.offsetX;
    const y = e.clientY - drag.offsetY;
    if (!drag.moved && Math.hypot(e.movementX, e.movementY) > 0) {
      // Penanda: begitu jari bergerak cukup jauh, ini geseran, bukan ketukan.
      const rect = e.currentTarget.getBoundingClientRect();
      if (Math.hypot(x - rect.left, y - rect.top) > DRAG_THRESHOLD) drag.moved = true;
    }
    setPos(clamp(x, y));
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!drag) return;

    if (drag.moved) {
      suppressClickRef.current = true;
      // Menempel ke tepi terdekat supaya tidak berhenti menutupi isi di tengah.
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const side: Side = centerX < window.innerWidth / 2 ? 'left' : 'right';
      const next: SavedPos = {
        side,
        bottom: Math.max(8, window.innerHeight - (rect.top + rect.height)),
      };
      setSaved(next);
      writeSaved(next);
      setPos(positionFor(next));
    }
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-label="Buka kotak saran — dapat digeser"
      title="Kotak Saran (bisa digeser)"
      style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
      className={`lg:hidden fixed z-40 w-14 h-14 rounded-full inline-flex items-center justify-center shadow-lg border no-print transition-colors ${
        isDragging
          ? 'bg-primary-700 border-primary-700 text-white cursor-grabbing'
          : 'bg-white border-slate-300 text-primary-700 hover:bg-primary-50 cursor-grab'
      }`}
    >
      <MessageSquarePlus className="w-6 h-6" aria-hidden="true" />
    </button>
  );
};
