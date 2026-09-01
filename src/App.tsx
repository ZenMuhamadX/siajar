import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar, type MainViewType } from './components/Navbar';
import { InputAgenda } from './pages/InputAgenda';
import { RiwayatAgenda } from './pages/RiwayatAgenda';
import { RekapAgenda } from './pages/RekapAgenda';
import { DevPanel } from './pages/DevPanel';
import { LoginPage } from './pages/LoginPage';
import { KotakSaranModal } from './components/KotakSaranModal';
import { ToastContainer, type ToastMessage } from './components/Toast';
import type { FullAgenda } from './types';
import { Loader2 } from 'lucide-react';

function MainApp() {
  const { activeTeacherName, isAdmin, loading } = useAuth();
  const [currentView, setCurrentView] = useState<MainViewType>('agenda');
  const [editingAgenda, setEditingAgenda] = useState<FullAgenda | null>(null);
  const [isKotakSaranOpen, setIsKotakSaranOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
      {/* Top Header */}
      <Navbar
        currentView={activeView}
        onToggleView={(view) => {
          if (view !== 'agenda') {
            setEditingAgenda(null);
          }
          setCurrentView(view);
        }}
        onOpenKotakSaran={() => setIsKotakSaranOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-6">
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

        {activeView === 'absensi' && (
          <RekapAgenda showToast={showToast} />
        )}

        {activeView === 'dev' && (
          <DevPanel
            onBackToApp={() => setCurrentView('agenda')}
            showToast={showToast}
          />
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-[11px] text-slate-400 no-print mt-auto">
        SDIT AS-SYIFA &bull; Agenda Kelas &copy; {new Date().getFullYear()}
      </footer>

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
