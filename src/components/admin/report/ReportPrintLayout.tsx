import React from 'react';
import { useSchoolName } from '../../../contexts/SettingsContext';

interface ReportPrintLayoutProps {
  title: string;
  subtitle?: string;
  periodInfo: string;
  academicYearName?: string;
  /**
   * Blok tanda tangan khusus laporan. Bila tidak diisi, memakai blok bawaan
   * (Waka Kurikulum + Kepala Sekolah). Log Jurnal punya penandatangan sendiri,
   * jadi dokumen resmi tidak ikut berubah hanya karena diseragamkan.
   */
  signature?: React.ReactNode;
  children: React.ReactNode;
}

export const ReportPrintLayout: React.FC<ReportPrintLayoutProps> = ({
  title,
  subtitle,
  periodInfo,
  academicYearName = '2026/2027',
  signature,
  children,
}) => {
  // Nama sekolah dari Pengaturan (satu sumber untuk seluruh aplikasi).
  const schoolName = useSchoolName();
  const currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="hidden print:block w-full text-slate-900 bg-white p-2">
      {/* Kop Resmi Sekolah */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center relative">
        <div className="flex items-center justify-center gap-3">
          <img
            src="/logo.png"
            alt="Logo Sekolah"
            className="w-14 h-14 object-contain absolute left-2 top-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-900">
              {schoolName}
            </h1>
            <p className="text-xs text-slate-600">
              SISTEM INFORMASI AGENDA DAN JURNAL MENGAJAR (SIAJAR)
            </p>
            <p className="text-[12px] text-slate-500">
              Jl. H. Saadi No. 02, Cikarang Kota, Kec. Cikarang Utara, Kab. Bekasi, Jawa Barat, 17530
            </p>
          </div>
        </div>
      </div>

      {/* Judul Laporan */}
      <div className="text-center mb-5">
        <h2 className="text-sm font-bold uppercase tracking-wide underline text-slate-900">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
        <div className="flex items-center justify-center gap-4 text-[13px] text-slate-600 mt-1">
          <span>
            Periode: <strong className="text-slate-800">{periodInfo}</strong>
          </span>
          <span>&bull;</span>
          <span>
            Tahun Ajaran: <strong className="text-slate-800">{academicYearName}</strong>
          </span>
        </div>
      </div>

      {/* Konten Laporan Tabel */}
      <div className="mb-6">{children}</div>

      {/* Ruang Tanda Tangan */}
      <div className="pt-6 text-xs text-slate-800 break-inside-avoid">
        {signature ?? (
          <div className="flex justify-between items-start px-6">
            {/* Kiri: Mengetahui Waka Kurikulum */}
            <div className="text-center w-56">
              <p>Mengetahui,</p>
              <p className="font-medium">Waka Kurikulum</p>
              <div className="h-16" />
              <p className="font-bold underline">Abdulloh, S.Pd., Gr.</p>
              {/* <p className="text-[12px] text-slate-500">NIP. 198506122010011005</p> */}
            </div>

            {/* Kanan: Kepala Sekolah & Tanggal */}
            <div className="text-center w-56">
              <p>Cikarang, {currentDate}</p>
              <p className="font-medium">Kepala Sekolah</p>
              <div className="h-16" />
              <p className="font-bold underline">Fitri Nurhasanah, S.Pd., Gr.</p>
              {/* <p className="text-[12px] text-slate-500">NIP. 197804152005011003</p> */}
            </div>
          </div>
        )}

        {/* Footer Dokumen */}
        {/* Digabung: ukuran & kontras dari branch ini, nama sekolah dari dev. */}
        <div className="mt-8 pt-2 border-t border-slate-200 text-[12px] text-slate-600 flex justify-between">
          <span>Dicetak otomatis melalui SIAJAR - {schoolName}</span>
          <span>Halaman 1 / 1</span>
        </div>
      </div>
    </div>
  );
};
