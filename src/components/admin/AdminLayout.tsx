import React, { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBoundary } from '../ErrorBoundary';
import { LoadingState } from '../common';
import {
  ADMIN_NAV_GROUPS,
  adminPath,
  getAdminRouteByPath,
} from '../../routes/adminRoutes';

export type { AdminTab } from '../../routes/adminRoutes';

export const AdminLayout: React.FC = () => {
  const { signOut, activeTeacherName } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Tab aktif & judul breadcrumb diturunkan dari segmen URL (/admin/<segmen>),
  // sehingga deep-link, Back, dan Forward otomatis konsisten.
  const pathSegment = location.pathname.replace(/^\/admin\/?/, '').split('/')[0] ?? '';
  const activeRoute = getAdminRouteByPath(pathSegment);
  const pageTitle = activeRoute?.title ?? 'Panel Administrator';

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
        className={`fixed md:sticky top-0 left-0 h-screen z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ease-in-out no-print ${isCollapsed ? 'w-18' : 'w-64'
          } ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
          }`}
      >
        {/* Top: Brand / Logo */}
        <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between shrink-0">
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
                <span className="text-[12px] text-slate-600 block leading-tight">
                  Admin Portal
                </span>
              </div>
            )}
          </div>

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 text-slate-600 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
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
            className="md:hidden p-1.5 text-slate-600 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 p-3 space-y-5 overflow-y-auto min-h-0">
          {ADMIN_NAV_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 text-[12px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  {grp.group}
                </p>
              )}

              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeRoute?.tab === item.tab;

                // NavLink, bukan <button>: bisa open-in-new-tab / copy link /
                // middle-click seperti navigasi web pada umumnya.
                return (
                  <NavLink
                    key={item.tab}
                    to={adminPath(item.tab)}
                    title={item.label}
                    onClick={() => setIsMobileOpen(false)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${isActive
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Sidebar: User & Switch / Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2 shrink-0">
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
                  <p className="text-[12px] text-slate-600">Superuser</p>
                </div>
              </div>

              <button
                aria-label="Keluar / Logout"
                onClick={signOut}
                title="Keluar / Logout"
                className="p-2.5 min-w-10 min-h-10 inline-flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                aria-label="Keluar / Logout"
                onClick={signOut}
                title="Keluar / Logout"
                className="p-2.5 min-w-10 min-h-10 inline-flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
             </div>
          )}
        </div>
      </aside>

      {/* RIGHT CONTENT SHELL (TOP HEADER + MAIN) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs no-print">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              aria-label="Buka Menu"
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

             {/* Breadcrumb / Page Title */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>Admin</span>
                <span>/</span>
                <span className="font-semibold text-slate-800">
                  {pageTitle}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[13px] font-bold rounded-full border border-slate-200">
              Admin
            </span>
          </div>
        </header>

        {/* MAIN CONTENT AREA — halaman aktif dirender oleh <Route> di bawah /admin */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<LoadingState message="Memuat halaman..." />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
