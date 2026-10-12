'use strict';

/**
 * Jembatan antara proses utama dan renderer.
 *
 * Renderer tetap terisolasi (contextIsolation: true, sandbox: true). Satu-satunya
 * hal yang bocor ke `window` adalah objek `siajarDesktop` yang berisi konfigurasi
 * runtime dan beberapa pembantu. Nilai ini diambil secara sinkron supaya
 * `src/lib/runtimeConfig.ts` bisa membacanya saat modul pertama dievaluasi —
 * klien Supabase dibuat di sana, sebelum ada kesempatan `await`.
 */

const { contextBridge, ipcRenderer } = require('electron');

const bootstrap = ipcRenderer.sendSync('siajar:get-bootstrap') || {};

const clean = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const rawConfig = bootstrap.config || null;

const config = rawConfig
  ? {
      supabaseUrl: clean(rawConfig.supabaseUrl),
      supabaseAnonKey: clean(rawConfig.supabaseAnonKey),
      authDomain: clean(rawConfig.authDomain),
      adminEmail: clean(rawConfig.adminEmail),
      source: clean(rawConfig.source),
    }
  : null;

contextBridge.exposeInMainWorld('siajarDesktop', {
  isDesktop: true,
  platform: process.platform,
  appVersion: bootstrap.appVersion ?? null,
  electronVersion: bootstrap.electronVersion ?? null,
  origin: bootstrap.origin ?? null,
  config,

  /** Dipanggil setiap unduhan (ekspor Excel/PDF) selesai. Mengembalikan fungsi lepas-langganan. */
  onDownloadDone: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('siajar:download-done', listener);
    return () => ipcRenderer.removeListener('siajar:download-done', listener);
  },

  /** Membuka folder dan menyorot berkas hasil ekspor. */
  showInFolder: (filePath) => ipcRenderer.invoke('siajar:show-in-folder', filePath),

  /** Membuka tautan di peramban bawaan. */
  openExternal: (url) => ipcRenderer.invoke('siajar:open-external', url),
});
