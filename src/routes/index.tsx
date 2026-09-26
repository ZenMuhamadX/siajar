import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';
import { Navbar } from '../components/Navbar';
import { KotakSaranModal } from '../components/KotakSaranModal';
import { TeacherScheduleModal } from '../components/TeacherScheduleModal';
import { AdminLayout } from '../components/admin/AdminLayout';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingState } from '../components/common';
import { LoginPage } from '../pages/LoginPage';
import { NotFound } from '../pages/NotFound';
import { useAuth } from '../contexts/AuthContext';
import { useToast, type ShowToast } from '../contexts/ToastContext';
import { ADMIN_TAB_IDS, adminPath, type AdminTab } from './adminRoutes';
import type { ReportView } from './useReportQueryParam';
import { AuthLoading, RequireAdmin, RequireAuth } from './guards';
import { useEditAgendaParam } from './useEditAgenda';

/* -------------------------------------------------------------------------- */
/* Lazy imports — tiap halaman jadi chunk sendiri (sebelumnya 1 bundle ~729 kB) */
/* -------------------------------------------------------------------------- */

const LazyInputAgenda = lazy(() =>
  import('../pages/InputAgenda').then((m) => ({ default: m.InputAgenda }))
);
const LazyRiwayatAgenda = lazy(() =>
  import('../pages/RiwayatAgenda').then((m) => ({ default: m.RiwayatAgenda }))
);
const LazyDashboardOverview = lazy(() =>
  import('../pages/admin/DashboardOverview').then((m) => ({ default: m.DashboardOverview }))
);
const LazyAdminAgendaPage = lazy(() =>
  import('../pages/admin/AdminAgendaPage').then((m) => ({ default: m.AdminAgendaPage }))
);
const LazyScheduleManagement = lazy(() =>
  import('../pages/admin/ScheduleManagement').then((m) => ({ default: m.ScheduleManagement }))
);
const LazyReportCenterPage = lazy(() =>
  import('../pages/admin/report/ReportCenterPage').then((m) => ({ default: m.ReportCenterPage }))
);
const LazyDataSiswa = lazy(() =>
  import('../pages/DataSiswa').then((m) => ({ default: m.DataSiswa }))
);
const LazyDataGuru = lazy(() =>
  import('../pages/DataGuru').then((m) => ({ default: m.DataGuru }))
);
const LazyDataMapel = lazy(() =>
  import('../pages/DataMapel').then((m) => ({ default: m.DataMapel }))
);
const LazyHomeroomManagement = lazy(() =>
  import('../pages/admin/HomeroomManagement').then((m) => ({ default: m.HomeroomManagement }))
);
const LazyPeriodTemplatePage = lazy(() =>
  import('../pages/admin/PeriodTemplatePage').then((m) => ({ default: m.PeriodTemplatePage }))
);
const LazySubstitusiPage = lazy(() =>
  import('../pages/admin/SubstitusiPage').then((m) => ({ default: m.SubstitusiPage }))
);
const LazyEkskulPage = lazy(() =>
  import('../pages/admin/EkskulPage').then((m) => ({ default: m.EkskulPage }))
);
const LazyAcademicYearPage = lazy(() =>
  import('../pages/admin/AcademicYearPage').then((m) => ({ default: m.AcademicYearPage }))
);
const LazyPengaturanPage = lazy(() =>
  import('../pages/admin/PengaturanPage').then((m) => ({ default: m.PengaturanPage }))
);
const LazyKotakSaranList = lazy(() =>
  import('../pages/admin/KotakSaranList').then((m) => ({ default: m.KotakSaranList }))
);

/* -------------------------------------------------------------------------- */
/* Helper                                                                     */
/* -------------------------------------------------------------------------- */

const PageFallback: React.FC<{ message?: string }> = ({
  message = 'Memuat halaman...',
}) => <LoadingState message={message} />;

/**
 * Pindah antar tab admin lewat segmen URL (`/admin/jadwal`).
 * `view` hanya dipakai Pusat Rekap: `navigate('rekap', 'harian')` →
 * `/admin/rekap?view=harian`.
 */
function useAdminTabNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (tab: AdminTab, view?: ReportView) =>
      navigate(view ? `${adminPath(tab)}?view=${view}` : adminPath(tab)),
    [navigate]
  );
}

/**
 * Wrapper untuk halaman admin yang cuma butuh prop `showToast`.
 * Nilai diambil dari `ToastContext`, jadi halaman tidak perlu diubah.
 * (Pola hibrida: prop masih ada, bisa dihapus per halaman dengan `useToast()`.)
 */
function ToastPage<P extends { showToast: ShowToast }>(
  props: { component: React.ComponentType<P> } & Omit<P, 'showToast'>
) {
  const { component: Component, ...rest } = props;
  const showToast = useToast();
  return <Component {...(rest as unknown as P)} showToast={showToast} />;
}

/** Reset posisi scroll ke atas setiap pindah halaman (bukan restoration). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Guard: admin tidak melihat tampilan guru (dan sebaliknya)                  */
/* -------------------------------------------------------------------------- */

/** Hanya untuk non-admin — admin yang membuka `/` dialihkan ke panel admin. */
function RequireNonAdmin() {
  const { isAdmin } = useAuth();
  if (isAdmin) return <Navigate to="/admin/overview" replace />;
  return <Outlet />;
}

/** `/login`: bila sudah login, langsung lempar ke tujuan yang benar. */
function LoginRoute() {
  const { activeTeacherName, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;

  if (activeTeacherName) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from || (isAdmin ? '/admin/overview' : '/')} replace />;
  }

  return <LoginPage />;
}

/**
 * Back-compat: bookmark lama `/admin?tab=jadwal` → `/admin/jadwal`.
 * Tab tidak dikenal jatuh ke `overview`.
 * `rekap_harian|mingguan|bulanan` diarahkan ke Pusat Rekap dengan `?view=`.
 */
const LEGACY_TAB_VIEW: Record<string, string> = {
  rekap_harian: 'harian',
  rekap_mingguan: 'mingguan',
  rekap_bulanan: 'bulanan',
};

function AdminIndexRedirect() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const legacyView = tab ? LEGACY_TAB_VIEW[tab] : undefined;
  if (legacyView) return <Navigate to={`/admin/rekap?view=${legacyView}`} replace />;
  const target = tab && (ADMIN_TAB_IDS as string[]).includes(tab) ? tab : 'overview';
  return <Navigate to={`/admin/${target}`} replace />;
}

/* -------------------------------------------------------------------------- */
/* Wrapper per halaman (gateway ke context: toast, navigate, ?edit=)          */
/* -------------------------------------------------------------------------- */

function OverviewRoute() {
  const showToast = useToast();
  const goTab = useAdminTabNavigate();
  return <LazyDashboardOverview onNavigateTab={goTab} showToast={showToast} />;
}
function JadwalRoute() {
  const showToast = useToast();
  const goTab = useAdminTabNavigate();
  return (
    <LazyScheduleManagement
      showToast={showToast}
      onNavigateTab={(tab) => goTab(tab as AdminTab)}
    />
  );
}

function AdminAgendaRoute() {
  const showToast = useToast();
  const { editAgenda, isEditLoading, clearEdit } = useEditAgendaParam();

  // Tunggu fetch ?edit= selesai dulu, agar halaman mount dengan editData siap.
  if (isEditLoading) return <PageFallback message="Memuat agenda untuk diedit..." />;

  return (
    <LazyAdminAgendaPage
      editData={editAgenda}
      onCancelEdit={clearEdit}
      showToast={showToast}
    />
  );
}

/**
 * Pusat Rekap: satu halaman, empat tampilan lewat `?view=`.
 * `onEditAgenda` dipakai tampilan Log Jurnal untuk handoff ke form koreksi.
 */
function ReportCenterRoute() {
  const showToast = useToast();
  const navigate = useNavigate();
  return (
    <LazyReportCenterPage
      showToast={showToast}
      onEditAgenda={(agenda) =>
        navigate(`/admin/agenda?edit=${encodeURIComponent(agenda.header.id)}`)
      }
    />
  );
}

function TeacherAgendaRoute() {
  const showToast = useToast();
  const { editAgenda, isEditLoading, clearEdit } = useEditAgendaParam();

  if (isEditLoading) return <PageFallback message="Memuat agenda untuk diedit..." />;

  return (
    <LazyInputAgenda
      editData={editAgenda}
      onCancelEdit={clearEdit}
      onSuccess={clearEdit}
      showToast={showToast}
    />
  );
}

function TeacherHistoryRoute() {
  const showToast = useToast();
  const navigate = useNavigate();
  return (
    <LazyRiwayatAgenda
      showToast={showToast}
      onEditAgenda={(agenda) =>
        navigate(`/?edit=${encodeURIComponent(agenda.header.id)}`)
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

/** Shell sisi guru: Navbar + konten + footer + modal global. */
function TeacherShell() {
  const { activeTeacherName } = useAuth();
  const showToast = useToast();
  const location = useLocation();
  const [isKotakSaranOpen, setIsKotakSaranOpen] = useState(false);
  const [isTeacherScheduleOpen, setIsTeacherScheduleOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      <Navbar
        onOpenKotakSaran={() => setIsKotakSaranOpen(true)}
        onOpenSchedule={() => setIsTeacherScheduleOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 pb-24 md:pb-6">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="border-t border-slate-200 bg-white py-3 text-center text-[11px] text-slate-400 no-print mt-auto hidden md:block">
        SDIT AS-SYIFA &bull; Agenda Pembelajaran &copy; {new Date().getFullYear()}
      </footer>

      <KotakSaranModal
        isOpen={isKotakSaranOpen}
        onClose={() => setIsKotakSaranOpen(false)}
        activeTeacherName={activeTeacherName || ''}
        showToast={showToast}
      />

      <TeacherScheduleModal
        isOpen={isTeacherScheduleOpen}
        onClose={() => setIsTeacherScheduleOpen(false)}
        teacherName={activeTeacherName || ''}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Peta rute                                                                  */
/* -------------------------------------------------------------------------- */

export function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />

        <Route element={<RequireAuth />}>
          {/* ---------------- SISI GURU ---------------- */}
          <Route element={<RequireNonAdmin />}>
            <Route element={<TeacherShell />}>
              <Route path="/" element={<TeacherAgendaRoute />} />
              <Route path="/riwayat" element={<TeacherHistoryRoute />} />
            </Route>
          </Route>

          {/* ---------------- SISI ADMIN ---------------- */}
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminIndexRedirect />} />
              <Route path="overview" element={<OverviewRoute />} />
              <Route path="agenda" element={<AdminAgendaRoute />} />
              <Route path="jadwal" element={<JadwalRoute />} />
              {/* Pusat Rekap: 4 tampilan lewat ?view= */}
              <Route path="rekap" element={<ReportCenterRoute />} />
              {/* Back-compat: URL lama 4 halaman laporan → Pusat Rekap */}
              <Route path="rekap_harian" element={<Navigate to="/admin/rekap?view=harian" replace />} />
              <Route
                path="rekap_mingguan"
                element={<Navigate to="/admin/rekap?view=mingguan" replace />}
              />
              <Route
                path="rekap_bulanan"
                element={<Navigate to="/admin/rekap?view=bulanan" replace />}
              />
              <Route path="siswa" element={<ToastPage component={LazyDataSiswa} />} />
              <Route path="guru" element={<ToastPage component={LazyDataGuru} />} />
              <Route path="mapel" element={<ToastPage component={LazyDataMapel} />} />
              <Route
                path="wali_kelas"
                element={<ToastPage component={LazyHomeroomManagement} />}
              />
              <Route
                path="slot_waktu"
                element={<ToastPage component={LazyPeriodTemplatePage} />}
              />
              <Route
                path="badal"
                element={<ToastPage component={LazySubstitusiPage} />}
              />
              <Route path="ekskul" element={<LazyEkskulPage />} />
              <Route
                path="tahun_ajaran"
                element={<ToastPage component={LazyAcademicYearPage} />}
              />
              <Route path="saran" element={<ToastPage component={LazyKotakSaranList} />} />
              <Route path="pengaturan" element={<LazyPengaturanPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default AppRoutes;
