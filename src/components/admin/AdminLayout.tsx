import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileEdit,
  CalendarDays,
  FileSpreadsheet,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Settings,
  Activity,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export type AdminTab =
  | 'overview'
  | 'agenda'
  | 'jadwal'
  | 'rekap'
  | 'siswa'
  | 'guru'
  | 'mapel'
  | 'wali_kelas'
  | 'ekskul'
  | 'tahun_ajaran'
  | 'pengaturan'
  | 'saran';

interface AdminLayoutProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  onBackToApp: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'UTAMA',
    items: [
      { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
      { id: 'agenda', label: 'Agenda', icon: FileEdit },
      { id: 'rekap', label: 'Rekap', icon: FileSpreadsheet },
    ],
  },
  {
    group: 'MASTER DATA',
    items: [
      { id: 'siswa', label: 'Siswa', icon: Users },
      { id: 'guru', label: 'Guru', icon: GraduationCap },
      { id: 'mapel', label: 'Mata Pelajaran', icon: BookOpen },
    ],
  },
  {
    group: 'PENUGASAN',
    items: [
      { id: 'wali_kelas', label: 'Wali Kelas', icon: Award },
      { id: 'jadwal', label: 'Jadwal', icon: CalendarDays },
    ],
  },
  {
    group: 'KEGIATAN',
    items: [
      { id: 'ekskul', label: 'Ekstrakurikuler', icon: Activity },
    ],
  },
  {
    group: 'PENGATURAN',
    items: [
      { id: 'tahun_ajaran', label: 'Tahun Ajaran', icon: Calendar },
      { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
    ],
  },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeTab,
  onSelectTab,
  onBackToApp,
  children,
}) => {
  const { signOut, activeTeacherName } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const getPageTitle = (tab: AdminTab): string => {
    switch (tab) {
      case 'overview':
        return 'Ringkasan Dashboard';
      case 'agenda':
        return 'Agenda Pembelajaran';
      case 'jadwal':
        return 'Jadwal Sekolah';
      case 'rekap':
        return 'Rekapitulasi Agenda';
      case 'siswa':
        return 'Data Siswa';
      case 'guru':
        return 'Data Guru';
      case 'mapel':
        return 'Data Mata Pelajaran';
      case 'wali_kelas':
        return 'Penugasan Wali Kelas';
      case 'ekskul':
        return 'Ekstrakurikuler';
      case 'tahun_ajaran':
        return 'Tahun Ajaran';
      case 'pengaturan':
        return 'Pengaturan Sistem';
      case 'saran':
        return 'Kotak Saran Guru';
      default:
        return 'Panel Administrator';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800 flex font-sans">
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-2xs md:hidden"
        />
      )}

      {/* LEFT SIDEBAR */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200 ease-in-out ${
          isCollapsed ? 'w-18' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top: Brand / Logo */}
        <div>
          <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src="/logo.png"
                alt="Logo SIAJAR"
                className="w-8 h-8 object-contain shrink-0 rounded-lg"
              />
              {!isCollapsed && (
                <div className="truncate">
                  <span className="font-bold text-slate-900 text-sm tracking-tight block leading-tight">
                    SIAJAR
                  </span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    Admin Portal
                  </span>
                </div>
              )}
            </div>

            {/* Collapse toggle (desktop only) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              title={isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

            {/* Close button (mobile only) */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav groups */}
          <nav className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
            {NAV_GROUPS.map((grp) => (
              <div key={grp.group} className="space-y-1">
                {!isCollapsed && (
                  <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {grp.group}
                  </p>
                )}

                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        setIsMobileOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                      title={item.label}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Sidebar: User & Switch / Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
          {!isCollapsed ? (
            <div className="flex items-center justify-between px-2 py-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {activeTeacherName || 'Administrator'}
                  </p>
                  <p className="text-[10px] text-slate-400">Superuser</p>
                </div>
              </div>

              <button
                onClick={signOut}
                title="Keluar / Logout"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                onClick={signOut}
                title="Keluar / Logout"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Button to go back to Teacher Mode */}
          <button
            onClick={onBackToApp}
            className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition flex items-center justify-center gap-1.5 border border-slate-200 ${
              isCollapsed ? 'px-0' : ''
            }`}
            title="Keluar ke Mode Guru"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {!isCollapsed && <span>Mode Guru</span>}
          </button>
        </div>
      </aside>

      {/* RIGHT CONTENT SHELL (TOP HEADER + MAIN) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Page Title */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Admin</span>
                <span>/</span>
                <span className="font-semibold text-slate-800">
                  {getPageTitle(activeTab)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Header: Teacher Mode Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onBackToApp}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Beralih ke Mode Guru</span>
            </button>

            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full border border-slate-200">
              Admin Session
            </span>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
