'use strict';

/**
 * Proses utama SIAJAR Desktop.
 *
 * Aplikasi ini tetap SPA yang sama seperti versi web: seluruh kode React di
 * `dist/` berjalan apa adanya, dan Supabase tetap diakses langsung lewat
 * HTTPS. Berkas ini hanya menyediakan "rumah" bagi bundle itu — jendela,
 * protokol, izin kamera, dan dialog simpan berkas.
 *
 * Catatan penting: `.exe` ini TIDAK membuat aplikasi bisa dipakai offline.
 * Supabase tetap berada di jaringan, jadi koneksi internet masih diperlukan.
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// ---------------------------------------------------------------------------
// Konstanta
// ---------------------------------------------------------------------------

/**
 * Bundle dimuat lewat skema kustom `app://local/`, bukan `file://`.
 *
 * Alasannya ada tiga:
 *   1. `file://` membuat header Origin menjadi `null`; Supabase Auth menolak
 *      permintaan seperti itu karena tidak bisa dicocokkan dengan daftar
 *      origin yang diizinkan.
 *   2. Skema kustom yang ditandai `secure` dihitung sebagai secure context,
 *      sehingga `getUserMedia` (kamera bukti foto) berjalan tanpa akal-akalan.
 *   3. Origin-nya tetap dan bisa diprediksi, jadi cukup didaftarkan sekali di
 *      konfigurasi CORS Supabase. Lihat docs/DESKTOP-ELECTRON.md.
 */
const APP_SCHEME = 'app';
const APP_HOST = 'local';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const APP_ENTRY = `${APP_ORIGIN}/index.html`;

const DEV_SERVER_URL = process.env.SIAJAR_DEV_SERVER_URL || 'http://127.0.0.1:9090';

const isDev = !app.isPackaged;
const useDevServer = isDev && process.env.SIAJAR_DEV_SERVER === '1';

/**
 * Katup pengaman untuk PC yang akselerasi GPU-nya bermasalah — GPU lama, sesi
 * Remote Desktop, atau mesin virtual. Di mesin seperti itu proses GPU Chromium
 * bisa berhenti seketika dan Electron keluar dengan "GPU process isn't usable"
 * tanpa jendela sama sekali.
 *
 * Setel `SIAJAR_DISABLE_GPU=1` untuk mematikan akselerasi perangkat keras
 * (render sepenuhnya oleh CPU). Cara lain yang setara: jalankan dengan
 * argumen `--disable-gpu`, mis. dari shortcut Windows.
 *
 * Harus dipanggil sebelum `app.whenReady()`.
 */
if (process.env.SIAJAR_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
}

const DIST_DIR = path.join(__dirname, '..', 'dist');
// Ikon jendela memakai logo yang sudah ikut ter-copy ke `dist/` oleh Vite.
// Ikon berkas .exe sendiri diatur electron-builder dari `build/icon.png`.
const ICON_PATH = path.join(DIST_DIR, 'logo.png');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
};

// ---------------------------------------------------------------------------
// Konfigurasi runtime
// ---------------------------------------------------------------------------

/**
 * Alamat Supabase dibaca dari berkas JSON di luar bundle supaya satu installer
 * bisa dipasang di sekolah dengan server berbeda tanpa build ulang.
 *
 * Urutan pencarian (yang pertama ditemukan dipakai):
 *   1. jalur pada variabel lingkungan SIAJAR_CONFIG
 *   2. `siajar-config.json` di sebelah berkas .exe (cocok untuk versi portable)
 *   3. `siajar-config.json` di folder data pengguna (cocok untuk versi NSIS)
 *
 * Kalau tidak ada satu pun, aplikasi memakai nilai yang tertanam saat build
 * (VITE_* dari `.env`) — perilaku versi web.
 */
let runtimeConfig = null;

function candidateConfigPaths() {
  const paths = [];
  if (process.env.SIAJAR_CONFIG) paths.push(process.env.SIAJAR_CONFIG);
  if (app.isPackaged) {
    paths.push(path.join(path.dirname(app.getPath('exe')), 'siajar-config.json'));
  }
  paths.push(path.join(app.getPath('userData'), 'siajar-config.json'));
  return paths;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function loadRuntimeConfig() {
  for (const filePath of candidateConfigPaths()) {
    let raw;
    try {
      if (!fs.existsSync(filePath)) continue;
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.warn('[siajar] tidak bisa membaca', filePath, err.message);
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      const config = {
        supabaseUrl: pickString(parsed.supabaseUrl, parsed.VITE_SUPABASE_URL),
        supabaseAnonKey: pickString(parsed.supabaseAnonKey, parsed.VITE_SUPABASE_ANON_KEY),
        authDomain: pickString(parsed.authDomain, parsed.VITE_AUTH_DOMAIN),
        adminEmail: pickString(parsed.adminEmail, parsed.VITE_ADMIN_EMAIL),
        source: filePath,
      };
      if (!config.supabaseUrl && !config.supabaseAnonKey && !config.authDomain && !config.adminEmail) {
        console.warn('[siajar] berkas konfigurasi kosong, dilewati:', filePath);
        continue;
      }
      console.log('[siajar] konfigurasi runtime dipakai dari', filePath);
      return config;
    } catch (err) {
      console.warn('[siajar] JSON tidak valid di', filePath, err.message);
    }
  }

  console.log('[siajar] tidak ada konfigurasi runtime; memakai nilai VITE_* hasil build.');
  return null;
}

// ---------------------------------------------------------------------------
// Protokol app://
// ---------------------------------------------------------------------------

// Harus dipanggil sebelum `app.whenReady()`.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function resolveInsideDist(urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const relative = path.normalize(decoded).replace(/^[/\\]+/, '');
  const target = path.join(DIST_DIR, relative);
  // Tolak percobaan keluar dari folder dist.
  if (target !== DIST_DIR && !target.startsWith(DIST_DIR + path.sep)) return null;
  return target;
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    let pathname = '/';
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      /* URL aneh → pakai root */
    }

    let target = resolveInsideDist(pathname === '/' ? '/index.html' : pathname);

    // Rute SPA tanpa ekstensi (mis. /admin/rekap-bulanan) tidak punya berkas
    // fisik. Serahkan ke index.html seperti `try_files ... /index.html`.
    if (!target || !isFile(target)) target = path.join(DIST_DIR, 'index.html');

    if (!isFile(target)) {
      return new Response(
        'Berkas build tidak ditemukan.\n\nJalankan `bun run build` lebih dulu, ' +
          'lalu buka ulang aplikasi.',
        { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } }
      );
    }

    const contentType =
      MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';

    try {
      const fileResponse = await net.fetch(pathToFileURL(target).toString());
      const headers = new Headers(fileResponse.headers);
      headers.set('content-type', contentType);
      return new Response(fileResponse.body, { status: fileResponse.status, headers });
    } catch (err) {
      console.warn('[siajar] net.fetch gagal, membaca berkas langsung:', err.message);
      return new Response(fs.readFileSync(target), {
        status: 200,
        headers: { 'content-type': contentType },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Jendela
// ---------------------------------------------------------------------------

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'SIAJAR',
    backgroundColor: '#f8fafc',
    autoHideMenuBar: !isDev,
    icon: isFile(ICON_PATH) ? ICON_PATH : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Navigasi keluar dari aplikasi (mis. tautan di dalam jurnal) dibuka di
  // peramban bawaan, bukan menggantikan isi jendela.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedPrefix = useDevServer ? DEV_SERVER_URL : APP_ORIGIN;
    if (url.startsWith(allowedPrefix)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (useDevServer) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadURL(APP_ENTRY);
  }

  return mainWindow;
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

// ---------------------------------------------------------------------------
// Sesi: izin, unduhan
// ---------------------------------------------------------------------------

function hardenSession(targetSession) {
  // Kamera untuk bukti foto. Mikrofon ditolak karena tidak dipakai.
  targetSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    if (permission === 'media') {
      const mediaTypes = details?.mediaTypes ?? [];
      const wantsAudio = mediaTypes.includes('audio');
      return callback(!wantsAudio);
    }
    if (permission === 'fullscreen' || permission === 'clipboard-sanitized-write') {
      return callback(true);
    }
    return callback(false);
  });

  targetSession.setPermissionCheckHandler((_contents, permission, _origin, details) => {
    if (permission === 'media') return details?.mediaType !== 'audio';
    return permission === 'fullscreen' || permission === 'clipboard-sanitized-write';
  });

  // `file-saver` (ekspor Excel/PDF) memicu unduhan lewat tautan blob. Di
  // desktop kita arahkan ke dialog "Simpan sebagai" bawaan Windows supaya guru
  // bisa memilih sendiri lokasi berkasnya.
  targetSession.on('will-download', (_event, item) => {
    const filename = item.getFilename() || 'unduhan';
    item.setSaveDialogOptions({
      title: 'Simpan berkas',
      defaultPath: path.join(app.getPath('downloads'), filename),
    });

    item.once('done', (_doneEvent, state) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('siajar:download-done', {
        state,
        filename,
        path: state === 'completed' ? item.getSavePath() : null,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

function buildMenu() {
  if (!isDev) {
    Menu.setApplicationMenu(null);
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Tampilan',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Jendela',
        submenu: [{ role: 'minimize' }, { role: 'close' }],
      },
    ])
  );
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

ipcMain.on('siajar:get-bootstrap', (event) => {
  // Sinkron: preload harus sudah punya konfigurasi sebelum modul renderer
  // pertama dievaluasi (klien Supabase dibuat saat modul dimuat).
  event.returnValue = {
    isDesktop: true,
    platform: process.platform,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    origin: APP_ORIGIN,
    config: runtimeConfig,
  };
});

ipcMain.handle('siajar:show-in-folder', (_event, filePath) => {
  if (typeof filePath === 'string' && filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('siajar:open-external', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

// ---------------------------------------------------------------------------
// Daur hidup
// ---------------------------------------------------------------------------

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);

  app.whenReady().then(() => {
    runtimeConfig = loadRuntimeConfig();

    registerAppProtocol();
    hardenSession(session.defaultSession);
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // Kegagalan tak terduga pada proses utama ditampilkan, bukan hilang diam-diam.
  process.on('uncaughtException', (err) => {
    console.error('[siajar] uncaughtException', err);
    try {
      dialog.showErrorBox('SIAJAR berhenti karena galat', String(err?.stack || err));
    } catch {
      /* tidak ada yang bisa dilakukan lagi */
    }
  });
}
