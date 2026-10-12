import { HashRouter } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { ClassProvider } from './contexts/ClassContext';
import { SettingsProvider } from './contexts/SettingsContext';
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
 * `SettingsProvider` duduk tepat di bawah `AuthProvider` karena ia butuh nama
 * guru untuk mengisi kolom `updated_by`, dan ia mengisi cache Pengaturan yang
 * dibaca service lain (export, simpan agenda) secara sinkron.
 *
 * `ClassProvider` juga butuh sesi login (RLS master kelas hanya untuk anggota),
 * jadi ia duduk di dalam `AuthProvider`. Ia memuat daftar kelas sekali lalu
 * membagikannya ke seluruh halaman — menggantikan konstanta `DAFTAR_KELAS`.
 *
 * Konsol navigasi lama (`currentView`, `adminSubTab`, `?tab=`, DevPanel) sudah
 * dilepas — lihat `src/routes/index.tsx` untuk peta rute.
 *
 * **HashRouter, bukan BrowserRouter.** Di SIAJAR Desktop bundle dimuat dari
 * protokol `app://local`, dan URL-nya tidak punya server yang bisa menuliskan
 * ulang rute tak dikenal menjadi `index.html`. Dengan hash, seluruh rute hidup
 * di belakang `#` sehingga memuat ulang di halaman mana pun selalu aman —
 * sekaligus membuat path aset relatif (`base: './'`) tetap benar. Di web
 * perilakunya identik; hanya bentuk URL-nya yang berubah menjadi `#/admin/...`.
 */
export function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ClassProvider>
          <ToastProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </ToastProvider>
        </ClassProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
