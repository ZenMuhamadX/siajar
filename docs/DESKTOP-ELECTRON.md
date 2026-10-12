# SIAJAR Desktop (Electron)

Versi `.exe` dari SIAJAR. Isinya **aplikasi yang sama**: seluruh kode React di
`dist/` berjalan apa adanya, dan Supabase tetap diakses langsung lewat HTTPS.
Yang ditambahkan hanyalah pembungkus Electron — jendela, protokol, izin kamera,
dan dialog simpan berkas.

> **Batas penting.** `.exe` ini **tidak** membuat SIAJAR bisa dipakai offline.
> Supabase tetap berada di jaringan, jadi koneksi internet tetap diperlukan.
> Kalau tujuan Anda adalah pemakaian tanpa internet, itu perubahan lapisan data
> (SQLite lokal + sinkronisasi) — bukan sekadar pengemasan.

---

## 1. Apa yang berubah dari versi web

| Berkas | Perubahan | Alasan |
|---|---|---|
| `electron/main.cjs` | **baru** | Proses utama: jendela, protokol `app://`, izin, unduhan |
| `electron/preload.cjs` | **baru** | Jembatan konfigurasi ke renderer |
| `electron/config.example.json` | **baru** | Contoh konfigurasi runtime per sekolah |
| `electron-builder.yml` | **baru** | Konfigurasi paket (NSIS + portable) |
| `src/lib/runtimeConfig.ts` | **baru** | Membaca konfigurasi runtime, dengan fallback ke `VITE_*` |
| `src/App.tsx` | `BrowserRouter` → `HashRouter` | Rute hidup di belakang `#`, aman dimuat dari protokol lokal |
| `vite.config.ts` | tambah `base: './'` | Path aset relatif, tidak bergantung pada root domain |
| `src/lib/supabase.ts` | baca dari `runtimeConfig` | Agar satu installer bisa dipakai untuk server berbeda |
| `src/services/userAdminService.ts`, `src/pages/SetupPage.tsx` | baca dari `runtimeConfig` | `authDomain` / `adminEmail` ikut konfigurasi runtime |

Tidak ada halaman, komponen, atau service yang ditulis ulang. Versi web tetap
berfungsi seperti sebelumnya — `HashRouter` juga dipakai di sana, hanya bentuk
URL-nya berubah menjadi `#/admin/...`.

---

## 2. Menjalankan di komputer pengembang

```bash
bun install
bun run desktop:dev
```

Perintah itu menjalankan Vite di `http://127.0.0.1:9090` lalu membuka Electron
yang memuat alamat tersebut. Hot reload tetap bekerja untuk kode React; untuk
mengubah `electron/main.cjs` tutup lalu jalankan ulang.

Di mode dev, menu **Tampilan → Toggle Developer Tools** tersedia. Di versi
terpaket menu itu dihilangkan.

---

## 3. Membuat .exe

```bash
# Uji cepat: folder unpacked, tanpa membuat installer
bun run desktop:build      # → release/win-unpacked/SIAJAR.exe

# Rilis: installer NSIS + versi portable
bun run desktop:dist       # → release/SIAJAR-Setup-0.0.0.exe
                           #   release/SIAJAR-0.0.0-x64.exe
```

Keduanya menjalankan `bun run build` lebih dulu (type-check + bundle Vite), jadi
`dist/` selalu segar.

Versi rilis ditentukan `version` di `package.json` dan ikut jadi nama berkas,
jadi naikkan nilainya setiap kali merilis. Aturan versi yang dipakai:

| Perubahan | Naikkan |
|---|---|
| Perbaikan bug, teks, atau tampilan | digit ketiga — `0.1.0` → `0.1.1` |
| Fitur baru yang tidak merusak | digit kedua — `0.1.1` → `0.2.0` |
| Perubahan besar atau tidak kompatibel | digit pertama — `0.2.0` → `1.0.0` |

Jangan rilis ulang dengan nomor yang sama. Guru yang memasang versi baru di
atas versi lama perlu nomor berbeda supaya bisa dibedakan kalau ada keluhan.

Isi paket sengaja **tidak menyertakan `node_modules/`**: seluruh dependensi
renderer sudah dibundel Vite ke `dist/`, sama seperti versi web yang hanya
mengunggah folder `dist/` ke Nginx.

Ikon aplikasi diambil dari `build/icon.png` (512×512). Ganti berkas itu untuk
mengubah ikon installer dan ikon berkas `.exe`.

---

## 3b. Membagikan ke guru

Ada dua berkas di `release/` setelah `bun run desktop:dist`, dan keduanya punya
peran berbeda:

| Berkas | Untuk apa |
|---|---|
| `SIAJAR-Setup-<versi>.exe` | **Yang dibagikan ke guru.** Installer: membuat pintasan desktop, bisa dipilih lokasinya, dan muncul di *Programs and Features* |
| `SIAJAR-<versi>-x64.exe` | Versi portable, jalan tanpa memasang. Simpan di flashdisk sebagai cadangan, atau untuk PC yang tidak boleh dipasangi aplikasi |

Yang perlu dipastikan sebelum dibagikan:

1. **Koneksi ke server.** Aplikasi ini **tidak bisa dipakai tanpa internet** —
   ia menyambung ke Supabase. Pastikan PC guru bisa membuka
   `https://supa.as-syifa.sch.id` (coba lewat peramban dulu). Kalau server itu
   hanya bisa diakses dari jaringan sekolah, aplikasi hanya jalan di dalam
   jaringan tersebut.
2. **Kamera.** Untuk bukti foto, PC harus punya kamera dan izinnya aktif
   (**Pengaturan → Privasi & keamanan → Kamera**).

### Cara membagikan

**Lewat jaringan sekolah / file server (paling praktis).** Taruh
`SIAJAR-Setup-<versi>.exe` di satu folder bersama, lalu kirim tautan atau
shortcut folder itu ke guru. Cara ini cepat dan tidak membebani internet.

**Lewat flashdisk.** Salin berkasnya (satu berkas, ±107 MB), lalu guru menjalankan
installer dari flashdisk. Cocok untuk PC yang tidak tersambung ke folder
bersama.

**Lewat Google Drive / OneDrive.** Bisa, tetapi ingat: setiap guru mengunduh
±107 MB. Untuk 20 guru itu ±2 GB. Jika kuota sekolah terbatas, pilih cara
pertama.

Atau lewat GitHub Releases. Tag rilisnya dibuat lebih dulu dari sisi git, lalu Release-nya
mengacu ke tag itu:

```bash
# sekali saja, kalau memakai CLI (gh belum terpasang secara bawaan)
gh auth login

# setiap kali merilis: tag dulu, baru unggah
git tag -a v1.0.0 -m "SIAJAR v1.0.0"
git push origin v1.0.0

gh release create v1.0.0 \
  "release/SIAJAR-Setup-1.0.0.exe" \
  "release/SIAJAR-1.0.0-x64.exe" \
  --title "SIAJAR 1.0.0" \
  --notes "Ringkasan perubahan di versi ini."
```

Bisa juga tanpa CLI: buat tag lewat git seperti di atas, lalu di web GitHub pilih
*Releases → Draft a new release* dan pilih tag yang sudah ada.

Repositori ini privat, jadi unduhan lewat tautan rilisnya butuh akun GitHub
yang diberi akses. Praktis kalau guru/pengelola memang punya akun; kalau tidak,
pakai folder bersama sekolah.

### Peringatan Windows "Windows protected your PC"

Aplikasi ini **belum ditandatangani secara digital** (code signing), dan sertifikatnya
berbayar. Akibatnya, saat guru menjalankan installer, muncul layar biru
*"Windows protected your PC"*. Ini normal dan tidak berbahaya. Langkahnya:

*Klik **More info** → **Run anyway**.*

Tulis langkah itu di pesan yang Anda kirim ke guru. Kalau penggunaannya sudah
meluas dan Anda ingin layar itu hilang, sertifikat code signing perlu dibeli —
tetapi untuk aplikasi internal sekolah, menuliskan langkahnya biasanya cukup.

### Membarui ke versi yang lebih baru

Tidak ada pembaruan otomatis. Alurnya:

1. Naikkan `version` di `package.json`, jalankan `bun run desktop:dist`.
2. Bagikan installer baru dengan pesan singkat: *"ada versi baru, pasang di
   atas yang lama"*.
3. Guru menjalankan installer baru. Data, sesi login, dan pengaturan mereka
   **tidak hilang** (tersimpan di luar folder aplikasi).

Beri tahu juga kalau ada perubahan yang mengharuskan keluar lalu masuk lagi,
misalnya setelah `schema.sql` dijalankan.

---

## 4. Konfigurasi server per sekolah

Secara bawaan alamat Supabase diambil dari `.env` saat build (`VITE_*`). Untuk
menghindari build ulang per sekolah, aplikasi desktop juga membaca berkas
`siajar-config.json` di luar bundle.

Urutan pencarian — yang pertama ditemukan dipakai:

1. jalur pada variabel lingkungan `SIAJAR_CONFIG`
2. `siajar-config.json` **di sebelah `SIAJAR.exe`** — cocok untuk versi portable
3. `siajar-config.json` di `%APPDATA%\SIAJAR\` — cocok untuk versi NSIS

Formatnya (contoh lengkap ada di `electron/config.example.json`):

```json
{
  "supabaseUrl": "https://supabase.sekolah.sch.id",
  "supabaseAnonKey": "<anon-public-key>",
  "authDomain": "siajar.local",
  "adminEmail": "admin@siajar.local"
}
```

**Nilai runtime menang atas nilai build.** Kolom yang dikosongkan akan jatuh ke
nilai `VITE_*`. Kalau berkasnya tidak ada sama sekali, perilakunya persis versi
web.

Nilai di berkas ini **bukan rahasia** — anon key memang publik, dan keamanan
dijaga RLS di server. Tetap jangan letakkan `service_role` key di sini.

> `siajar-config.json` sudah masuk `.gitignore`. Jangan commit berkas berisi
> alamat server sekolah.

---

## 5. CORS Supabase — langkah yang wajib dicek

Aplikasi desktop **tidak** dimuat dari `file://` (yang membuat `Origin: null`
dan sering ditolak), melainkan dari skema kustom:

```
app://local
```

Skema ini didaftarkan sebagai `standard` + `secure` di `electron/main.cjs`,
sehingga dihitung sebagai secure context (kamera berjalan) dan punya origin
yang tetap dan bisa diprediksi.

**Konsekuensinya:** server Supabase harus mengizinkan origin `app://local`.

Pada Supabase self-hosted, CORS diatur di Kong (`volumes/api/kong.yml`) melalui
plugin `cors`, dan sebagian instalasi sudah memakai `origins: ["*"]` — kalau
begitu tidak ada yang perlu diubah. Kalau tidak:

```yaml
plugins:
  - name: cors
    config:
      origins:
        - "https://siajar.sekolah.sch.id"   # versi web
        - "app://local"                     # versi desktop
      methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
      headers: [Authorization, apikey, Content-Type, X-Client-Info, X-Supabase-Api-Version]
```

Cara memastikan: buka Developer Tools di aplikasi desktop dan lihat tab
Network. Kalau permintaan ke `/auth/v1/token` gagal dengan pesan CORS, berarti
origin belum diizinkan.

Mengizinkan `*` juga aman di sini: keamanan SIAJAR bergantung pada RLS + JWT,
bukan pada CORS. CORS hanya melindungi peramban di origin lain, sementara anon
key memang sudah publik sejak awal.

Login memakai `signInWithPassword` (bukan redirect OAuth), dan klien Supabase
memasang `detectSessionInUrl: false`, jadi **tidak perlu** mengubah Site URL
atau Additional Redirect URLs.

---

## 6. Kamera, mikrofon, dan penyimpanan berkas

- **Kamera** — proses utama hanya mengizinkan `media` dengan tipe kamera;
  permintaan mikrofon selalu ditolak karena aplikasi ini tidak merekam suara.
  Kalau kamera tetap tidak muncul, periksa izin kamera Windows
  (**Pengaturan → Privasi & keamanan → Kamera**) dan pastikan tidak ada
  aplikasi lain yang sedang memakai kamera.
- **Unduhan (ekspor Excel/PDF)** — `file-saver` memicu unduhan lewat tautan
  blob. Di desktop unduhan itu ditangkap dan diarahkan ke dialog
  **Simpan sebagai** bawaan Windows, dengan nama berkas yang sudah disarankan
  dan lokasi awal di folder *Downloads*. Setelah selesai, renderer menerima
  kejadian `siajar:download-done` (lihat `desktop.onDownloadDone`).
- **Tautan keluar** — tautan `http(s)` yang diklik dari dalam aplikasi dibuka di
  peramban bawaan, bukan menggantikan isi jendela.

---

## 7. Yang bisa dibaca kode renderer

`electron/preload.cjs` hanya membuka satu objek ke `window`, dengan
`contextIsolation: true` dan `sandbox: true`:

```ts
import { desktop, runtimeConfig } from './lib/runtimeConfig';

desktop.isDesktop        // true di dalam .exe
desktop.appVersion       // versi aplikasi
desktop.origin           // "app://local"
desktop.onDownloadDone   // (cb) => unsubscribe
desktop.showInFolder     // (path) => Promise<boolean>
desktop.openExternal     // (url)  => Promise<boolean>
runtimeConfig.source     // jalur siajar-config.json bila dipakai
```

Tidak ada `require`, tidak ada akses berkas, dan tidak ada Node.js di renderer.

---

## 8. Daftar uji setelah memasang .exe

1. Aplikasi terbuka tanpa jendela putih (kalau putih: `dist/` belum ada saat
   build — jalankan `bun run build`).
2. Halaman login tampil dan daftar nama guru terisi.
3. Login guru dengan kode pribadi berhasil.
4. Isi Agenda → ambil bukti foto dari kamera.
5. Ekspor rekap Excel dan PDF → dialog **Simpan sebagai** muncul, berkas bisa
   dibuka.
6. Tutup aplikasi, buka lagi → sesi masih aktif (tidak perlu memasukkan kode).
7. Buka aplikasi kedua kali → jendela yang sudah ada yang muncul, bukan dua
   instans.
8. Ganti alamat Supabase lewat `siajar-config.json`, buka ulang → aplikasi
   menyambung ke server baru tanpa build ulang.

---

## 9. Kalau ada masalah

| Gejala | Penyebab yang paling mungkin |
|---|---|
| Jendela putih / "Berkas build tidak ditemukan" | `dist/` tidak ada; jalankan `bun run build` lalu paketkan ulang |
| Aplikasi tidak membuka jendela sama sekali, log menyebut `GPU process isn't usable` | Akselerasi GPU bermasalah (GPU lama, RDP, mesin virtual). Setel `SIAJAR_DISABLE_GPU=1`, atau jalankan `SIAJAR.exe --disable-gpu` |
| Build gagal: `EBUSY: resource busy or locked, unlink '…\release\win-unpacked\resources\app.asar'` | Berkas lama di `release/` masih dipegang proses lain. Lihat bagian "Build gagal karena release/ terkunci" di bawah |
| Login gagal, error CORS di DevTools | `app://local` belum diizinkan di CORS Supabase (bagian 5) |
| Kamera tidak muncul | Izin kamera Windows, atau perangkat dipakai aplikasi lain |
| Masih menyambung ke server lama | `siajar-config.json` belum ditemukan; cek `runtimeConfig.source` |
| Muncul dua instans | Single-instance lock dilewati karena dijalankan dari jalur berbeda |

### Aplikasi tidak mau terbuka di sebagian PC

Kalau ada PC yang sama sekali tidak menampilkan jendela, buka dulu lewat Command
Prompt untuk melihat pesannya:

```bat
"%LOCALAPPDATA%\Programs\SIAJAR\SIAJAR.exe" --disable-gpu
```

Kalau cara itu berhasil, mesin tersebut bermasalah dengan akselerasi GPU.
Jadikan permanen dengan salah satu dari dua cara:

- **Lewat shortcut** — klik kanan shortcut SIAJAR → *Properties* → tambahkan
  ` --disable-gpu` di akhir kolom *Target*.
- **Lewat variabel lingkungan** — setel `SIAJAR_DISABLE_GPU=1` untuk pengguna
  tersebut (Command Prompt: `setx SIAJAR_DISABLE_GPU 1`, lalu buka ulang
  aplikasi).

Tidak ada bedanya dari sisi fitur; hanya tampilan yang digambar oleh CPU
sehingga sedikit lebih lambat pada animasi berat.

### Build gagal karena `release/` terkunci

Gejalanya seperti ini, dan `failedTask=build` menyertainya:

```
⨯ EBUSY: resource busy or locked, unlink
  '…\release\win-unpacked\resources\app.asar'
```

electron-builder selalu membersihkan folder `release/` sebelum menulis ulang,
dan Windows menolak menghapus berkas yang masih dibuka proses lain. Penyebab
yang paling sering:

- **Aplikasi SIAJAR masih berjalan** — tutup dulu, cek juga Task Manager.
- **Antivirus sedang memindai `app.asar`.** Berkas itu besar, jadi pemindaian
  bisa memakan waktu dan menahan handle-nya. Tunggu, lalu ulangi.
- **Klien sinkronisasi cloud** (Synology Drive, OneDrive, Google Drive) yang
  mengawasi folder proyek dan sedang mengunggah berkas besar tersebut.

Langkah perbaikan, dari yang paling ringan:

1. Tutup aplikasi SIAJAR, tunggu sebentar, lalu jalankan ulang build.
2. Hapus folder `release/` lewat File Explorer, lalu build lagi.
3. **Restart Windows.** Ini pasti melepas semua handle. Setelah restart, hapus
   `release/` sekali lagi sebelum build berikutnya.
4. Kalau tidak mau restart sekarang, arahkan hasil build ke folder lain:

   ```bash
   bun run build
   bunx electron-builder --config.directories.output=release-baru
   ```

   Installer akan muncul di `release-baru/`. Pola `release-*/` **sudah ada di
   `.gitignore`**, jadi folder itu tidak akan ikut ter-commit. Tetap hapus setelah
   selesai supaya tidak menumpuk (±370 MB per build).

> **Pencegahan.** Jangan menaruh folder proyek di dalam folder yang
> disinkronkan klien cloud. Selain memicu kunci berkas seperti ini, setiap
> build mengunggah ulang ±370 MB.
