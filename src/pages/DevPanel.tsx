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
import { AdminAgendaPage } from './admin/AdminAgendaPage';
import type { FullAgenda } from '../types';

interface DevPanelProps {
  subTab: DevSubTab;
  onSubTabChange: (tab: DevSubTab) => void;
  onStartEditAgenda?: (agenda: FullAgenda) => void;
  onCancelEditAgenda?: () => void;
  editingAgenda?: FullAgenda | null;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export type DevSubTab = AdminTab;

export const DevPanel: React.FC<DevPanelProps> = ({
  subTab,
  onSubTabChange,
  onStartEditAgenda,
  onCancelEditAgenda,
  editingAgenda,
  showToast,
}) => {
  return (
    <AdminLayout
      activeTab={subTab}
      onSelectTab={(tab) => onSubTabChange(tab)}
    >
      {/* 1. Ringkasan Dashboard */}
      {subTab === 'overview' && (
        <DashboardOverview
          onNavigateTab={(tab) => onSubTabChange(tab)}
          showToast={showToast}
        />
      )}

      {subTab === 'agenda' && (
        <AdminAgendaPage
          editData={editingAgenda}
          onCancelEdit={onCancelEditAgenda}
          showToast={showToast}
        />
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
