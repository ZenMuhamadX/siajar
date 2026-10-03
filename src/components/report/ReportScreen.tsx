import React from 'react';
import { ReportViewTabs } from './ReportViewTabs';

interface ReportScreenProps {
  /**
   * Tampilan yang aktif. Masing-masing view membawa PageHeader dan bagian
   * `no-print`-nya sendiri, sedangkan dokumen laporan dihasilkan mesin PDF
   * terprogram — jadi shell di sini hanya menyediakan tab serta jarak antar
   * bagian.
   */
  children: React.ReactNode;
}

/**
 * Shell bersama untuk keempat tampilan di `/admin/rekap`.
 *
 * Tanggung jawabnya sengaja kecil: menyatukan tab navigasi dan memberi jarak
 * yang seragam. Logika data tiap tampilan tetap milik masing-masing view.
 */
export const ReportScreen: React.FC<ReportScreenProps> = ({ children }) => {
  return (
    <div className="space-y-4">
      <div className="no-print">
        <ReportViewTabs />
      </div>
      {children}
    </div>
  );
};
