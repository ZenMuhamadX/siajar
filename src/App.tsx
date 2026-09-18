import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar, type MainViewType } from './components/Navbar';
import { InputAgenda } from './pages/InputAgenda';
import { RiwayatAgenda } from './pages/RiwayatAgenda';
import { DevPanel } from './pages/DevPanel';
import { LoginPage } from './pages/LoginPage';
import { KotakSaranModal } from './components/KotakSaranModal';
import { TeacherScheduleModal } from './components/TeacherScheduleModal';
import { ToastContainer, type ToastMessage } from './components/Toast';
import type { FullAgenda } from './types';
import type { AdminTab } from './components/admin/AdminLayout';
import { Loader2 } from 'lucide-react';

function MainApp() {
  const { activeTeacherName, isAdmin, loading } = useAuth();
  const [currentView, setCurrentView] = useState<MainViewType>(() => {
    return window.location.pathname === '/admin' ? 'dev' : 'agenda';
  });
  const [adminSubTab, setAdminSubTab] = useState<AdminTab>('overview');
  const [editingAgenda, setEditingAgenda] = useState<FullAgenda | null>(null);
  const [isKotakSaranOpen, setIsKotakSaranOpen] = useState(false);
  const [isTeacherScheduleOpen, setIsTeacherScheduleOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Synchronize browser history / URL path (/admin vs /)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        setCurrentView('dev');
      } else {
        setCurrentView('agenda');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleStartEditAgenda = (agenda: FullAgenda) => {
    setEditingAgenda(agenda);
    setCurrentView('agenda');
  };

  const handleCancelEdit = () => {
    setEditingAgenda(null);
  };

  const handleNavigateView = (view: MainViewType) => {
    if (view !== 'agenda') {
      setEditingAgenda(null);
    }
    setCurrentView(view);
    const targetPath = view === 'dev' ? '/admin' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="w-6 h-6 text-slate-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Memeriksa sesi...</p>
        </div>
      </div>
    );
  }

  if (!activeTeacherName) {
    return <LoginPage />;
  }

  // Non-admin cannot stay in dev view
  const activeView: MainViewType = !isAdmin && currentView === 'dev' ? 'agenda' : currentView;

  if (activeView === 'dev') {
    return (
      <>
        <DevPanel
          subTab={adminSubTab}
          onSubTabChange={(tab) => setAdminSubTab(tab as any)}
          onBackToApp={() => handleNavigateView('agenda')}
          onStartEditAgenda={(agenda) => {
            handleStartEditAgenda(agenda);
            const targetPath = '/';
            if (window.location.pathname !== targetPath) {
              window.history.pushState({}, '', targetPath);
            }
          }}
          showToast={showToast}
        />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Top Header Mode Guru */}
      <Navbar
        currentView={activeView}
        onToggleView={handleNavigateView}
        onOpenKotakSaran={() => setIsKotakSaranOpen(true)}
        onOpenSchedule={() => setIsTeacherScheduleOpen(true)}
      />

      {/* Main Content Guru */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 pb-24 md:pb-6">
        {activeView === 'agenda' && (
          <InputAgenda
            editData={editingAgenda}
            onCancelEdit={handleCancelEdit}
            onSuccess={() => {
              setEditingAgenda(null);
            }}
            showToast={showToast}
          />
        )}

        {activeView === 'riwayat' && (
          <RiwayatAgenda
            onEditAgenda={handleStartEditAgenda}
            showToast={showToast}
          />
        )}
      </main>

      {/* Clean Minimal Footer Mode Guru */}
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-[11px] text-slate-400 no-print mt-auto hidden md:block">
        SDIT AS-SYIFA &bull; Agenda Pembelajaran &copy; {new Date().getFullYear()}
      </footer>

      {/* Kotak Saran Modal */}
      <KotakSaranModal
        isOpen={isKotakSaranOpen}
        onClose={() => setIsKotakSaranOpen(false)}
        activeTeacherName={activeTeacherName}
        showToast={showToast}
      />

      {/* Modal Jadwal Mengajar Guru */}
      <TeacherScheduleModal
        isOpen={isTeacherScheduleOpen}
        onClose={() => setIsTeacherScheduleOpen(false)}
        teacherName={activeTeacherName || ''}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
