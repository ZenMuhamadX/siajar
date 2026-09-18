import React from 'react';
import { AdminLayout, type AdminTab } from '../components/admin/AdminLayout';
import { DashboardOverview } from './admin/DashboardOverview';
import { ScheduleManagement } from './admin/ScheduleManagement';
import { AcademicYearPage } from './admin/AcademicYearPage';
import { RekapAgenda } from './RekapAgenda';
import { RekapHarianPage } from './admin/report/RekapHarianPage';
import { RekapMingguanPage } from './admin/report/RekapMingguanPage';
import { RekapBulananPage } from './admin/report/RekapBulananPage';
import { DataSiswa } from './DataSiswa';
import { DataGuru } from './DataGuru';
import { DataMapel } from './DataMapel';
import { HomeroomManagement } from './admin/HomeroomManagement';
import { KotakSaranList } from './admin/KotakSaranList';
import { EkskulPage } from './admin/EkskulPage';
import { PengaturanPage } from './admin/PengaturanPage';
import { PeriodTemplatePage } from './admin/PeriodTemplatePage';
import { SubstitusiPage } from './admin/SubstitusiPage';
import { PageHeader } from '../components/admin/PageHeader';
import type { FullAgenda } from '../types';
import { FileEdit } from 'lucide-react';

interface DevPanelProps {
  subTab: DevSubTab;
  onSubTabChange: (tab: DevSubTab) => void;
  onBackToApp: () => void;
  onStartEditAgenda?: (agenda: FullAgenda) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export type DevSubTab = AdminTab;

export const DevPanel: React.FC<DevPanelProps> = ({
  subTab,
  onSubTabChange,
  onBackToApp,
  onStartEditAgenda,
  showToast,
}) => {
  return (
    <AdminLayout
      activeTab={subTab}
      onSelectTab={(tab) => onSubTabChange(tab)}
      onBackToApp={onBackToApp}
    >
      {/* 1. Ringkasan Dashboard */}
      {subTab === 'overview' && (
        <DashboardOverview
          onNavigateTab={(tab) => onSubTabChange(tab)}
          showToast={showToast}
        />
      )}

      {/* 2. Form Agenda Superuser */}
      {subTab === 'agenda' && (
        <div className="space-y-6 max-w-4xl">
          <PageHeader
            title="Agenda Pembelajaran"
            description="Entri jurnal harian atau koreksi agenda seluruh kelas oleh administrator."
          />

          <div className="bg-white rounded-xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Pengisian Agenda Mengajar
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sebagai Administrator, Anda memiliki otorisasi penuh untuk mengisi, meninjau, ataupun mengoreksi data agenda kelas guru manapun secara langsung melalui form agenda utama.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onBackToApp}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-2 shadow-xs"
              >
                <FileEdit className="w-4 h-4" />
                <span>Buka Form Input Agenda</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Jadwal */}
      {subTab === 'jadwal' && (
        <ScheduleManagement
          showToast={showToast}
          onNavigateTab={(tab) => onSubTabChange(tab as AdminTab)}
        />
      )}

      {/* 4. Rekap Harian */}
      {subTab === 'rekap_harian' && <RekapHarianPage showToast={showToast} />}

      {/* 5. Rekap Mingguan */}
      {subTab === 'rekap_mingguan' && <RekapMingguanPage showToast={showToast} />}

      {/* 6. Rekap Bulanan */}
      {subTab === 'rekap_bulanan' && <RekapBulananPage showToast={showToast} />}

      {/* 7. Rekap Log Jurnal Agenda */}
      {subTab === 'rekap' && (
        <RekapAgenda
          showToast={showToast}
          onEditAgenda={onStartEditAgenda}
        />
      )}

      {/* 5. Siswa */}
      {subTab === 'siswa' && <DataSiswa showToast={showToast} />}

      {/* 6. Guru */}
      {subTab === 'guru' && <DataGuru showToast={showToast} />}

      {/* 7. Mapel */}
      {subTab === 'mapel' && <DataMapel showToast={showToast} />}

      {/* 8. Wali Kelas */}
      {subTab === 'wali_kelas' && <HomeroomManagement showToast={showToast} />}

      {/* 9. Slot Waktu JP */}
      {subTab === 'slot_waktu' && <PeriodTemplatePage showToast={showToast} />}

      {/* 10. Ekstrakurikuler */}
      {subTab === 'ekskul' && <EkskulPage />}

      {/* 9. Tahun Ajaran */}
      {subTab === 'tahun_ajaran' && <AcademicYearPage showToast={showToast} />}

      {/* 10. Pengaturan */}
      {subTab === 'pengaturan' && <PengaturanPage />}

      {/* 11. Kotak Saran */}
      {subTab === 'saran' && <KotakSaranList showToast={showToast} />}

      {/* 12. Guru Pengganti / Badal */}
      {subTab === 'badal' && <SubstitusiPage showToast={showToast} />}
    </AdminLayout>
  );
};
