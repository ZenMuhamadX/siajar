/**
 * Bentuk & normalisasi Pengaturan — MURNI, tanpa Supabase, tanpa DOM, tanpa React.
 *
 * Semua field di sini punya satu sumber kebenaran: `DEFAULT_SETTINGS`. Nilai
 * default-nya sengaja dibuat identik dengan hasil Stage 5.2 yang sudah
 * disetujui, sehingga sampai ada yang mengubah Pengaturan, file Excel yang
 * dihasilkan tidak berubah satu byte pun.
 *
 * `normalizeSettings()` adalah penjaga. Data bisa datang dari database yang
 * salah diedit, versi lama, atau apa pun yang tersimpan di sana — dan
 * Pengaturan yang rusak TIDAK BOLEH menjatuhkan aplikasi. Aturannya: field
 * tidak dikenal dibuang, field salah jenis diabaikan, angka diklem, enum
 * di-whitelist, warna divalidasi sebagai 6 digit hex.
 */

export type ExcelOrientation = 'landscape' | 'portrait';
export type TimeSeparator = 'en-dash' | 'hyphen';

export interface ExcelSettings {
  fontFamily: string;
  /** Ukuran font isi tabel (pt). */
  baseFontSize: number;
  /** Ukuran font judul (pt). */
  titleFontSize: number;
  orientation: ExcelOrientation;
  /** 6 digit hex tanpa '#', mis. "1F3864". */
  headerColor: string;
  bandColor: string;
  titleColor: string;
  borderColor: string;
  showBorders: boolean;
  /** Tampilkan nama depan guru di bawah mata pelajaran. */
  showTeacherName: boolean;
  timeSeparator: TimeSeparator;
  /** Ekspor juga slot berstatus DRAFT. */
  includeDraft: boolean;
  /** Ulangi judul + header tabel di setiap halaman cetak. */
  repeatHeader: boolean;
  /** Sesuaikan lebar ke satu halaman saat dicetak. */
  fitToWidth: boolean;
}

export interface AppSettings {
  /** Nama sekolah — satu field, dipakai di seluruh aplikasi. */
  schoolName: string;
  excel: ExcelSettings;
}

export const FONT_OPTIONS = [
  'Bookman Old Style',
  'Times New Roman',
  'Georgia',
  'Arial',
  'Calibri',
] as const;

export const BASE_FONT_MIN = 6;
export const BASE_FONT_MAX = 24;
export const TITLE_FONT_MIN = 10;
export const TITLE_FONT_MAX = 40;

export const DEFAULT_SETTINGS: AppSettings = {
  schoolName: 'SDIT AS-SYIFA',
  excel: {
    fontFamily: 'Bookman Old Style',
    baseFontSize: 11,
    titleFontSize: 20,
    orientation: 'landscape',
    headerColor: '1F3864',
    bandColor: 'D9E2F3',
    titleColor: '1F3864',
    borderColor: '9CA3AF',
    showBorders: true,
    showTeacherName: true,
    timeSeparator: 'en-dash',
    includeDraft: true,
    repeatHeader: true,
    fitToWidth: true,
  },
};

/** Batas vertikal untuk pratinjau di halaman Pengaturan. */
export const FONT_SIZE_RANGE = {
  base: { min: BASE_FONT_MIN, max: BASE_FONT_MAX },
  title: { min: TITLE_FONT_MIN, max: TITLE_FONT_MAX },
} as const;

const HEX_COLOR = /^[0-9A-Fa-f]{6}$/;

/** Bersihkan & uppercase warna; return null bila tidak bisa dipakai. */
export function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().replace(/^#/, '').toUpperCase();
  return HEX_COLOR.test(cleaned) ? cleaned : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Nama sekolah tidak boleh kosong; spasi berlebih dirapikan. */
function schoolName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed.slice(0, 120) : fallback;
}

const ORIENTATIONS: readonly ExcelOrientation[] = ['landscape', 'portrait'];
const SEPARATORS: readonly TimeSeparator[] = ['en-dash', 'hyphen'];

/**
 * Terima apa pun (null, objek acak, Versi lama, hasil parse JSON gagal) dan
 * kembalikan `AppSettings` yang dijamin valid. Tidak pernah melempar exception.
 */
export function normalizeSettings(raw: unknown): AppSettings {
  const d = DEFAULT_SETTINGS;
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ex = (root.excel && typeof root.excel === 'object' ? root.excel : {}) as Record<
    string,
    unknown
  >;

  return {
    schoolName: schoolName(root.schoolName, d.schoolName),
    excel: {
      fontFamily:
        typeof ex.fontFamily === 'string' && ex.fontFamily.trim().length > 0
          ? ex.fontFamily.trim().slice(0, 60)
          : d.excel.fontFamily,
      baseFontSize: clampInt(
        ex.baseFontSize,
        BASE_FONT_MIN,
        BASE_FONT_MAX,
        d.excel.baseFontSize,
      ),
      titleFontSize: clampInt(
        ex.titleFontSize,
        TITLE_FONT_MIN,
        TITLE_FONT_MAX,
        d.excel.titleFontSize,
      ),
      orientation: oneOf(ex.orientation, ORIENTATIONS, d.excel.orientation),
      headerColor: normalizeColor(ex.headerColor, d.excel.headerColor),
      bandColor: normalizeColor(ex.bandColor, d.excel.bandColor),
      titleColor: normalizeColor(ex.titleColor, d.excel.titleColor),
      borderColor: normalizeColor(ex.borderColor, d.excel.borderColor),
      showBorders: bool(ex.showBorders, d.excel.showBorders),
      showTeacherName: bool(ex.showTeacherName, d.excel.showTeacherName),
      timeSeparator: oneOf(ex.timeSeparator, SEPARATORS, d.excel.timeSeparator),
      includeDraft: bool(ex.includeDraft, d.excel.includeDraft),
      repeatHeader: bool(ex.repeatHeader, d.excel.repeatHeader),
      fitToWidth: bool(ex.fitToWidth, d.excel.fitToWidth),
    },
  };
}

/** Ubah ke bentuk kolom database (snake_case). */
export function toRow(settings: AppSettings, updatedBy: string | null): Record<string, unknown> {
  return {
    id: 1,
    school_name: settings.schoolName,
    excel_font_family: settings.excel.fontFamily,
    excel_base_font_size: settings.excel.baseFontSize,
    excel_title_font_size: settings.excel.titleFontSize,
    excel_orientation: settings.excel.orientation,
    excel_header_color: settings.excel.headerColor,
    excel_band_color: settings.excel.bandColor,
    excel_title_color: settings.excel.titleColor,
    excel_border_color: settings.excel.borderColor,
    excel_show_borders: settings.excel.showBorders,
    excel_show_teacher_name: settings.excel.showTeacherName,
    excel_time_separator: settings.excel.timeSeparator,
    excel_include_draft: settings.excel.includeDraft,
    excel_repeat_header: settings.excel.repeatHeader,
    excel_fit_to_width: settings.excel.fitToWidth,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
}

/** Baca baris database (snake_case) menjadi `AppSettings`. */
export function fromRow(row: unknown): AppSettings {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
  return normalizeSettings({
    schoolName: r.school_name,
    excel: {
      fontFamily: r.excel_font_family,
      baseFontSize: r.excel_base_font_size,
      titleFontSize: r.excel_title_font_size,
      orientation: r.excel_orientation,
      headerColor: r.excel_header_color,
      bandColor: r.excel_band_color,
      titleColor: r.excel_title_color,
      borderColor: r.excel_border_color,
      showBorders: r.excel_show_borders,
      showTeacherName: r.excel_show_teacher_name,
      timeSeparator: r.excel_time_separator,
      includeDraft: r.excel_include_draft,
      repeatHeader: r.excel_repeat_header,
      fitToWidth: r.excel_fit_to_width,
    },
  });
}

/** "1F3864" -> "#1F3864" untuk input[type=color] & pratinjau. */
export function withHash(hex: string): string {
  return `#${hex.replace(/^#/, '')}`;
}

/** "#1f3864" / "1F3864" -> "1F3864" dari input[type=color]. */
export function stripHash(hex: string): string {
  return normalizeColor(hex, DEFAULT_SETTINGS.excel.headerColor);
}
