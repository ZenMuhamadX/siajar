import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import {
  Database,
  KeyRound,
  RotateCcw,
  Save,
  ShieldCheck,
  TriangleAlert,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormField, TextInput, SelectInput, formStyles } from '../../components/common';
import {
  FONT_OPTIONS,
  FONT_SIZE_RANGE,
  normalizeSettings,
  stripHash,
  withHash,
  type AppSettings,
} from '../../services/settings/appSettings';

/**
 * Halaman Pengaturan.
 *
 * Sebelumnya halaman ini 100% read-only: tidak ada satu pun field yang bisa
 * diedit, hanya kartu informasi. Sekarang became tempat mengubah identitas
 * sekolah dan gaya file Excel yang di-export.
 *
 * Yang disimpan: nilainya ada di tabel singleton `agenda.app_settings` supaya
 * semua komputer membaca baris yang sama — mengatur di satu komputer langsung berlaku
 * di komputer lain, tanpa harus diatur ulang per device.
 *
 *Prinsip: form memakai draft lokal + tombol Simpan (bukan langsung menerapkan),
 * supaya WYSIWYG di halaman ini tidak setengah jadi kalau admin menekan "Kembali".
 */

const ORIENTATION_OPTIONS = [
  { value: 'landscape', label: 'Landscape (lebar, untuk 6 kelas)' },
  { value: 'portrait', label: 'Portrait (tinggi, untuk kolom sedikit)' },
] as const;

const SEPARATOR_OPTIONS = [
  { value: 'en-dash', label: 'Tanda hubung panjang  08:05–08:40' },
  { value: 'hyphen', label: 'Tanda hubung biasa  08:05-08:40' },
] as const;

const COLOR_FIELDS: Array<{
  key: 'headerColor' | 'bandColor' | 'titleColor' | 'borderColor';
  label: string;
  hint: string;
}> = [
  { key: 'headerColor', label: 'Warna Header Tabel', hint: 'latar baris WAKTU / KELAS' },
  { key: 'bandColor', label: 'Warna Band Hari', hint: 'latar baris SENIN, SELASA, ...' },
  { key: 'titleColor', label: 'Warna Teks Judul', hint: 'JADWAL PELAJARAN & nama sekolah' },
  { key: 'borderColor', label: 'Warna Garis Tabel', hint: 'border tipis antar sel' },
];

const TOGGLES: Array<{
  key:
    | 'showBorders'
    | 'showTeacherName'
    | 'includeDraft'
    | 'repeatHeader'
    | 'fitToWidth';
  label: string;
  hint: string;
}> = [
  {
    key: 'showBorders',
    label: 'Tampilkan garis tabel',
    hint: 'matikan kalau ingin tampilan tanpa border',
  },
  {
    key: 'showTeacherName',
    label: 'Tampilkan nama guru di bawah mata pelajaran',
    hint: 'hanya memakai nama depan saja',
  },
  {
    key: 'includeDraft',
    label: 'Sertakan jadwal berstatus DRAFT',
    hint: 'matikan supaya hanya jadwal yang sudah berlaku',
  },
  {
    key: 'repeatHeader',
    label: 'Ulangi judul & header di setiap halaman cetak',
    hint: 'berguna saat jadwal lebih dari satu halaman',
  },
  {
    key: 'fitToWidth',
    label: 'Sesuaikan lebar ke satu halaman saat dicetak',
    hint: 'menonaktifkan berarti ukuran asli yang dipakai',
  },
];

/** Dua representasi warna: picker native + teks hex, selalu sinkron. */
const ColorField: React.FC<{
  label: string;
  hint: string;
  value: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
}> = ({ label, hint, value, disabled, onChange }) => (
  <div>
    <span className={formStyles.label}>{label}</span>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={withHash(value)}
        disabled={disabled}
        onChange={(e) => onChange(stripHash(e.target.value))}
        className="h-8 w-11 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 disabled:cursor-not-allowed"
        title={label}
      />
      <TextInput
        value={value}
        disabled={disabled}
        maxLength={6}
        onChange={(e) => onChange(stripHash(e.target.value))}
        className="w-24 font-mono uppercase"
        aria-label={`${label} (kode hex)`}
      />
      <span className="text-xs text-slate-600">{hint}</span>
    </div>
  </div>
);

/** Toggle berlabel — memakai checkbox standar, bukan switch kustom. */
const ToggleField: React.FC<{
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, hint, checked, disabled, onChange }) => (
  <label
    className={`flex items-start gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg ${
      disabled ? 'opacity-60' : 'cursor-pointer hover:border-slate-300'
    } transition`}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={`${formStyles.checkbox} mt-0.5`}
    />
    <span>
      <span className="block text-xs font-semibold text-slate-700">{label}</span>
      <span className="block text-xs text-slate-600">{hint}</span>
    </span>
  </label>
);

/**
 * Pratinjau WYSIWYG sederhana. Bukan render Excel sungguhan, tapi memakai
 * warna, font, ukuran, border, dan pemisah waktu yang sama persis, jadi
 * yang sama persis, jadi sudah cukup untuk menangkap kesalahan pengaturan
 * sebelum file diekspor.
 */
const SettingsPreview: React.FC<{ settings: AppSettings }> = ({ settings }) => {
  const { excel, schoolName } = settings;
  const sep = excel.timeSeparator === 'en-dash' ? '\u2013' : '-';
  const border = excel.showBorders
    ? `1px solid #${excel.borderColor}`
    : '1px solid transparent';

  return (
    <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-bold uppercase tracking-wider text-slate-600">
          Pratinjau sheet "Jadwal Mingguan"
        </span>
        <span className="text-2xs font-semibold text-slate-600">
          cetak: {excel.orientation}
        </span>
      </div>

      <div
        className="mx-auto overflow-hidden bg-white"
        style={{
          maxWidth: excel.orientation === 'landscape' ? '100%' : '78%',
          border: border,
        }}
      >
        <div
          className="text-center font-bold"
          style={{
            color: `#${excel.titleColor}`,
            fontFamily: excel.fontFamily,
            fontSize: Math.max(11, Math.round(excel.titleFontSize * 0.62)),
          }}
        >
          JADWAL PELAJARAN
        </div>
        <div
          className="text-center font-bold"
          style={{
            color: `#${excel.titleColor}`,
            fontFamily: excel.fontFamily,
            fontSize: Math.max(10, Math.round(excel.titleFontSize * 0.5)),
          }}
        >
          {schoolName}
        </div>
        <div
          className="text-center font-bold"
          style={{
            color: `#${excel.titleColor}`,
            fontFamily: excel.fontFamily,
            fontSize: Math.max(9, Math.round(excel.titleFontSize * 0.4)),
          }}
        >
          TAHUN PELAJARAN 2026/2027
        </div>

        <div className="h-2" />

        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['WAKTU', 'KELAS 1', 'KELAS 2', 'KELAS 3'].map((h) => (
                <th
                  key={h}
                  className="px-1 py-1 font-bold text-white"
                  style={{
                    backgroundColor: `#${excel.headerColor}`,
                    fontFamily: excel.fontFamily,
                    fontSize: Math.max(8, excel.baseFontSize - 1),
                    border,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={4}
                className="px-1 py-1 text-center font-bold"
                style={{
                  backgroundColor: `#${excel.bandColor}`,
                  color: `#${excel.titleColor}`,
                  fontFamily: excel.fontFamily,
                  fontSize: Math.max(8, excel.baseFontSize - 1),
                  border,
                }}
              >
                SENIN
              </td>
            </tr>
            {[
              { time: `07:15${sep}07:30`, cells: ['UPACARA', '', '', ''] },
              {
                time: `08:05${sep}08:40`,
                cells: [
                  excel.showTeacherName ? 'Matematika\nIkfina' : 'Matematika',
                  'Bahasa Indonesia\nDian',
                  'PAI\nAbdulloh',
                  'PENJAS\nNur',
                ],
              },
              {
                time: `13:05${sep}13:35`,
                cells: ['PKN\nSiti', 'Matematika\nEla', 'IPAS\nDian', 'MTK\nAbdulloh'],
              },
            ].map((row) => (
              <tr key={row.time}>
                <td
                  className="px-1 py-1 text-center"
                  style={{
                    fontFamily: excel.fontFamily,
                    fontSize: Math.max(8, excel.baseFontSize - 2),
                    border,
                  }}
                >
                  {row.time}
                </td>
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    className="px-1 py-1 text-center whitespace-pre-line"
                    style={{
                      fontFamily: excel.fontFamily,
                      fontSize: Math.max(8, excel.baseFontSize - 2),
                      border,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-600 mt-2 text-center">
        Pratinjau gaya saja, bukan hasil render Excel. Coba ekspor untuk melihat
        file sebenarnya.
      </p>
    </div>
  );
};

export const PengaturanPage: React.FC = () => {
  const { activeTeacherName } = useAuth();
  const { settings, offline, save, reset } = useSettings();
  const showToast = useToast();

  const [draft, setDraft] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Ikuti Pengaturan dari database, TAPI hanya kalau pengguna belum mengubah
  // apa pun — supaya hasil edit tidak tertimpa saat halaman lain menyimpan.
  useEffect(() => {
    setDraft((current) =>
      JSON.stringify(current) === JSON.stringify(settings) ? current : settings,
    );
  }, [settings]);

  // Draf yang diedit bisa saja berisi warna cacat (mis. hex setengah ketik),
  // jadi selalu dinormalkan sebelum dibandingkan maupun disimpan.
  const normalized = useMemo(() => normalizeSettings(draft), [draft]);
  const dirty = JSON.stringify(normalized) !== JSON.stringify(settings);

  const patchExcel = <K extends keyof AppSettings['excel']>(
    key: K,
    value: AppSettings['excel'][K],
  ) => {
    setDraft((current) => ({
      ...current,
      excel: { ...current.excel, [key]: value },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await save(normalized);
      if (result.ok) {
        setDraft(normalized);
        showToast('success', 'Pengaturan berhasil disimpan di semua perangkat.');
      } else {
        showToast('error', result.message ?? 'Gagal menyimpan pengaturan.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const result = await reset();
      if (result.ok) {
        showToast('success', 'Pengaturan dikembalikan ke nilai bawaan.');
      } else {
        showToast('error', result.message ?? 'Gagal memulihkan pengaturan.');
      }
    } finally {
      setIsResetting(false);
      setIsResetOpen(false);
    }
  };

  const { excel } = draft;

  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        title="Pengaturan"
        description="Identitas sekolah dan tampilan file Excel yang di-export."
      />

      {offline && (
        <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Pengaturan belum bisa disimpan.</p>
            <p className="mt-0.5">
              Tabel <code className="bg-amber-100 px-1 rounded">agenda.app_settings</code>{' '}
              belum bisa dibaca. Jalankan file <code>supabase/stage_5_3_app_settings.sql</code>{' '}
              di Supabase SQL Editor. Sampai itu dilakukan, aplikasi berjalan dengan
              nilai bawaan.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Identitas sekolah */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Identitas Sekolah</h3>
              <p className="text-xs text-slate-600">
                Dipakai di kop Excel, kop surat resmi, navbar, halaman login, dan
                tanda tangan laporan.
              </p>
            </div>
          </div>

          <FormField
            label="Nama Sekolah"
            htmlFor="set-school-name"
            hint="satu field untuk seluruh aplikasi, mis. SDIT AS-SYIFA"
          >
            <TextInput
              id="set-school-name"
              type="text"
              maxLength={120}
              value={draft.schoolName}
              onChange={(e) => setDraft({ ...draft, schoolName: e.target.value })}
            />
          </FormField>
        </section>

        {/* Tampilan Excel */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Database className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Tampilan Export Excel
              </h3>
              <p className="text-xs text-slate-600">
                Berlaku untuk file jadwal yang di-unduh dari halaman Jadwal Pelajaran.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormField label="Font" htmlFor="set-font">
              <SelectInput
                id="set-font"
                value={excel.fontFamily}
                onChange={(e) => patchExcel('fontFamily', e.target.value)}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField
              label="Ukuran Font Isi"
              htmlFor="set-base-size"
              hint={`${FONT_SIZE_RANGE.base.min}-${FONT_SIZE_RANGE.base.max} pt`}
            >
              <TextInput
                id="set-base-size"
                type="number"
                min={FONT_SIZE_RANGE.base.min}
                max={FONT_SIZE_RANGE.base.max}
                value={excel.baseFontSize}
                onChange={(e) => patchExcel('baseFontSize', Number(e.target.value))}
              />
            </FormField>

            <FormField
              label="Ukuran Font Judul"
              htmlFor="set-title-size"
              hint={`${FONT_SIZE_RANGE.title.min}-${FONT_SIZE_RANGE.title.max} pt`}
            >
              <TextInput
                id="set-title-size"
                type="number"
                min={FONT_SIZE_RANGE.title.min}
                max={FONT_SIZE_RANGE.title.max}
                value={excel.titleFontSize}
                onChange={(e) => patchExcel('titleFontSize', Number(e.target.value))}
              />
            </FormField>

            <FormField label="Orientasi Cetak" htmlFor="set-orientation">
              <SelectInput
                id="set-orientation"
                value={excel.orientation}
                onChange={(e) =>
                  patchExcel(
                    'orientation',
                    e.target.value as AppSettings['excel']['orientation'],
                  )
                }
              >
                {ORIENTATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COLOR_FIELDS.map((field) => (
              <ColorField
                key={field.key}
                label={field.label}
                hint={field.hint}
                value={excel[field.key]}
                onChange={(hex) => patchExcel(field.key, hex)}
              />
            ))}
          </div>

          <FormField
            label="Pemisah Rentang Waktu"
            htmlFor="set-separator"
            hint="hanya berlaku di sheet Jadwal Mingguan"
          >
            <SelectInput
              id="set-separator"
              value={excel.timeSeparator}
              onChange={(e) =>
                patchExcel(
                  'timeSeparator',
                  e.target.value as AppSettings['excel']['timeSeparator'],
                )
              }
            >
              {SEPARATOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {TOGGLES.map((toggle) => (
              <ToggleField
                key={toggle.key}
                label={toggle.label}
                hint={toggle.hint}
                checked={excel[toggle.key]}
                onChange={(checked) => patchExcel(toggle.key, checked)}
              />
            ))}
          </div>
        </section>

        {/* Pratinjau */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Pratinjau</h3>
          <SettingsPreview settings={normalized} />
        </section>

        {/* Informasi sistem (tetap read-only) */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Informasi Sistem</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-slate-500 text-xs">Pengguna saat ini</dt>
              <dd className="font-semibold text-slate-800">
                {activeTeacherName || 'Administrator'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs">Basis Data</dt>
              <dd className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-600" />
                Supabase PostgreSQL (Schema:{' '}
                <code className="bg-slate-200/80 px-1 rounded">agenda</code>)
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs">Metode Autentikasi</dt>
              <dd className="font-semibold text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                Supabase Auth &middot; kode sekolah bersama
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs">Aplikasi</dt>
              <dd className="font-semibold text-slate-800">
                SIAJAR (Sistem Agenda Pembelajaran)
              </dd>
            </div>
          </dl>
          <p className="text-xs text-slate-600 pt-1 border-t border-slate-100">
            Durasi jam pelajaran mengikuti Slot Waktu (JP) yang dikonfigurasi di menu
            Jadwal &gt; Slot Waktu — bukan angka tetap.
          </p>
        </section>
      </div>

      {/* Bilah aksi melayang: Simpan hanya aktif saat ada perubahan. */}
      <div className="fixed bottom-4 right-4 lg:right-8 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 no-print">
        {dirty && (
          <span className="text-xs font-semibold text-amber-600 mr-1">
            Belum disimpan
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsResetOpen(true)}
          disabled={isSaving || isResetting}
          className={`${formStyles.ghostBtn} disabled:opacity-50`}
          title="Kembalikan semua nilai ke bawaan"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Bawaan
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || isSaving || isResetting}
          className={`${formStyles.primaryBtn} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>

      <ConfirmDialog
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onConfirm={handleReset}
        isLoading={isResetting}
        variant="warning"
        title="Kembalikan pengaturan ke bawaan?"
        message="Nama sekolah, font, dan seluruh warna akan dikembalikan ke nilai bawaan SIAJAR. Pengaturan di komputer lain juga ikut berubah."
        confirmText="Kembalikan"
      />
    </div>
  );
};
