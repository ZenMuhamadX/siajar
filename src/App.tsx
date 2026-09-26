import { BrowserRouter } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppRoutes } from './routes';

/**
 * Susunan aplikasi kini berbasis URL (React Router):
 *
 *   /login          halaman login
 *   /               sisi guru (Isi Agenda)
 *   /riwayat        sisi guru (Riwayat Agenda)
 *   /admin/:tab     panel admin (17 halaman, semuanya lazy-loaded)
 *
 * Konsol navigasi lama (`currentView`, `adminSubTab`, `?tab=`, DevPanel) sudah
 * dilepas — lihat `src/routes/index.tsx` untuk peta rute.
 */
export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
