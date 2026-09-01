import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar, type MainViewType } from './components/Navbar';
import { InputAgenda } from './pages/InputAgenda';
import { RiwayatAgenda } from './pages/RiwayatAgenda';
import { DevPanel } from './pages/DevPanel';
import { LoginPage } from './pages/LoginPage';
import { KotakSaranModal } from './components/KotakSaranModal';
import { ToastContainer, type ToastMessage } from './components/Toast';
import type { FullAgenda } from './types';
import {
  Loader2,
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  GraduationCap,
  BookOpen,
  MessageSquare,
} from 'lucide-react';

function MainApp() {
  const { activeTeacherName, isAdmin, loading } = useAuth();
  const [currentView, setCurrentView] = useState<MainViewType>(() => {
    return window.location.pathname === '/admin' ? 'dev' : 'agenda';
  });
  const [adminSubTab, setAdminSubTab] = useState<'overview' | 'agenda' | 'rekap' | 'siswa' | 'guru' | 'mapel' | 'saran'>('overview');
  const [editingAgenda, setEditingAgenda] = useState<FullAgenda | null>(null);
  const [isKotakSaranOpen, setIsKotakSaranOpen] = useState(false);
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

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Top Header (Hanya muncul jika BUKAN di panel admin) */}
      {activeView !== 'dev' && (
        <Navbar
          currentView={activeView}
          onToggleView={handleNavigateView}
          onOpenKotakSaran={() => setIsKotakSaranOpen(true)}
        />
      )}

      {/* Main Content */}
      <main className={`flex-1 max-w-7xl w-full mx-auto ${activeView === 'dev' ? 'p-2 sm:p-4 lg:p-6 pb-20 md:pb-6' : 'p-3 sm:p-5 lg:p-6 pb-20 md:pb-6'}`}>
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

        {activeView === 'dev' && (
          <DevPanel
            subTab={adminSubTab}
            onSubTabChange={(tab) => setAdminSubTab(tab)}
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
        )}
      </main>

      {/* Clean Minimal Footer (Disembunyikan di mobile saat admin aktif agar tidak bentrok) */}
      <footer className={`border-t border-slate-200 bg-white py-3 text-center text-[11px] text-slate-400 no-print mt-auto ${activeView === 'dev' ? 'hidden md:block' : ''}`}>
        SDIT AS-SYIFA &bull; Agenda Kelas &copy; {new Date().getFullYear()}
      </footer>

      {/* Bottom Navigation Bar KHUSUS ADMIN untuk HP / Mobile (Fixed Sticky Bottom Screen) */}
      {activeView === 'dev' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 text-white border-t border-slate-800 shadow-2xl px-1 py-1 flex items-center justify-around no-print">
          <button
            onClick={() => setAdminSubTab('overview')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              adminSubTab === 'overview'
                ? 'text-purple-400 font-bold bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Ringkas</span>
          </button>

          <button
            onClick={() => setAdminSubTab('rekap')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              adminSubTab === 'rekap'
                ? 'text-purple-400 font-bold bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Rekap</span>
          </button>

          <button
            onClick={() => setAdminSubTab('siswa')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              adminSubTab === 'siswa'
                ? 'text-purple-400 font-bold bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Siswa</span>
          </button>

          <button
            onClick={() => setAdminSubTab('guru')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              adminSubTab === 'guru'
                ? 'text-purple-400 font-bold bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Guru</span>
          </button>

          <button
            onClick={() => setAdminSubTab('mapel')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              adminSubTab === 'mapel'
                ? 'text-purple-400 font-bold bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Mapel</span>
          </button>

          <button
            onClick={() => setAdminSubTab('saran')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              adminSubTab === 'saran'
                ? 'text-purple-400 font-bold bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Saran</span>
          </button>
        </nav>
      )}

      {/* Kotak Saran Modal */}
      <KotakSaranModal
        isOpen={isKotakSaranOpen}
        onClose={() => setIsKotakSaranOpen(false)}
        activeTeacherName={activeTeacherName}
        showToast={showToast}
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
