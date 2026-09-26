/**
 * Token gaya bersama untuk seluruh form di area admin.
 *
 * Sebelumnya tiap halaman Master Data punya gaya sendiri: DataGuru ungu,
 * DataMapel biru, PeriodTemplate indigo, tinggi input `py-1.5` vs `py-2`, dan
 * fokus `ring-1` vs `ring-2`. Semua perbedaan itu dikumpulkan di sini supaya
 * form baru cukup memakai `formStyles.*` dan tidak pernah menyimpang lagi.
 *
 * Standar yang dipakai: input netral (border slate, fokus slate) + aksi utama
 * indigo, mengikuti komponen yang sudah ada seperti `FilterBar`.
 */
export const formStyles = {
  /** Label field. */
  label: 'block text-xs font-semibold text-slate-600 mb-1.5',
  /** Teks bantuan di bawah field. */
  hint: 'text-[11px] text-slate-400 mt-1',
  /** Pesan error. */
  error: 'text-[11px] text-rose-600 mt-1',
  /** Input teks/angka/date/time. */
  input:
    'w-full px-2.5 py-1.5 text-xs bg-white text-slate-800 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition',
  /** Select. */
  select:
    'w-full px-2.5 py-1.5 text-xs bg-white text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition',
  /** Area teks. */
  textarea:
    'w-full px-2.5 py-2 text-xs bg-white text-slate-800 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition',
  /** Checkbox/radio. */
  checkbox: 'w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-1 focus:ring-slate-400',
  /** Tombol aksi utama. */
  primaryBtn:
    'inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs transition',
  /** Tombol sekunder. */
  ghostBtn:
    'inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold rounded-lg text-xs transition',
  /** Tombol hapus. */
  dangerBtn:
    'inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs transition',
  /** Judul seksi di dalam form. */
  sectionTitle: 'text-[10px] font-bold uppercase tracking-widest text-indigo-500',
  /** Garis pemisah seksi. */
  sectionRule: 'flex-1 h-px bg-indigo-100',
  /** Panel pembungkus form. */
  card: 'bg-white rounded-xl border border-slate-200 shadow-xs',
} as const;
