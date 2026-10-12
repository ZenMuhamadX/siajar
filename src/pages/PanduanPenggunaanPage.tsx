import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  User,
  Shield,
  GraduationCap,
  CalendarDays,
  ClipboardList,
  FileText,
  Users,
  School,
  BookMarked,
  LayoutGrid,
  MessageSquare,
  Settings,
  ArrowUpCircle,
  Clock,
  Camera,
  BarChart3,
  Layers,
  Lock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Lightbulb,
  Ban,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Tipe                                                                       */
/* -------------------------------------------------------------------------- */

type Role = 'guru' | 'admin' | 'kurikulum';

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

/* -------------------------------------------------------------------------- */
/*  Helper: accordion item                                                     */
/* -------------------------------------------------------------------------- */

function AccordionItem({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-primary-600">{icon}</span>
          <span className="font-semibold text-slate-800 text-sm">{title}</span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-4 pb-4 text-sm text-slate-700 leading-relaxed">{children}</div>}
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 mb-4 last:mb-0">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold mt-0.5">
        {number}
      </div>
      <div>
        <p className="font-semibold text-slate-800 text-sm mb-1">{title}</p>
        <div className="text-slate-600 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
      <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
      <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Konten per peran                                                           */
/* -------------------------------------------------------------------------- */

const guruSections: Section[] = [
  {
    id: 'login-guru',
    title: 'Cara Masuk (Login)',
    icon: <LogInIcon />,
    content: (
      <div>
        <Step number={1} title="Pilih tab Guru">
          Di halaman login, pastikan tab <strong>Guru</strong> aktif (bukan Staf).
        </Step>
        <Step number={2} title="Pilih nama Anda">
          Klik dropdown <strong>Masuk sebagai</strong> lalu pilih nama Anda dari daftar.
          Kalau nama belum muncul, hubungi admin untuk mendaftarkan Anda di menu <strong>Data Guru</strong>.
        </Step>
        <Step number={3} title="Masukkan kode">
          Ketik <strong>kode pribadi</strong> yang diberikan admin. Kode bersifat rahasia — jangan dibagikan.
        </Step>
        <Step number={4} title="Klik Masuk">
          Setelah berhasil, Anda langsung masuk ke halaman <strong>Isi Agenda</strong>.
        </Step>
        <Tip>
          Lupa kode? Hubungi admin. Admin bisa mengatur ulang kode Anda dari menu Data Guru → ikon kunci.
        </Tip>
      </div>
    ),
  },
  {
    id: 'halaman-utama',
    title: 'Halaman Utama — Isi Agenda',
    icon: <LayoutGrid className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Halaman ini menampilkan <strong>jadwal mengajar Anda hari ini</strong> besok, dan lusa. Setiap kartu
          jadwal berisi informasi:
        </p>
        <ul className="list-disc list-inside space-y-1 mb-3 text-slate-700">
          <li>Hari, tanggal, dan jam</li>
          <li>Kelas atau kelompok halaqoh</li>
          <li>Mata pelajaran</li>
          <li>Status: <em>Belum diisi</em> atau <em>Sudah diisi</em></li>
        </ul>
        <Step number={1} title="Pilih kartu jadwal">
          Klik kartu jadwal yang ingin diisi. Kartu dengan status <em>Belum diisi</em> memiliki tanda warna.
        </Step>
        <Step number={2} title="Isi formulir agenda">
          Formulir akan terbuka. Lengkapi semua bagian (lihat bagian <em>Mengisi Agenda</em> di bawah).
        </Step>
        <Step number={3} title="Simpan">
          Klik tombol <strong>Simpan</strong>. Setelah tersimpan, kartu jadwal menunjukkan status <em>Sudah diisi</em>.
        </Step>
        <Tip>
          Anda bisa mengisi agenda untuk hari lain dengan memilih tanggal di bagian atas halaman.
        </Tip>
      </div>
    ),
  },
  {
    id: 'mengisi-agenda',
    title: 'Mengisi Agenda (Detail)',
    icon: <BookOpen className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Formulir agenda terdiri dari beberapa bagian. Wajib diisi sebelum bisa disimpan:
        </p>
        <AccordionItem title="1. Absensi Siswa" icon={<Users className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Daftar siswa muncul otomatis sesuai kelas atau kelompok halaqoh jadwal tersebut.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline mr-1" />
                <strong>Hadir</strong> — siswa mengikuti pembelajaran (default)
              </li>
              <li>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 inline mr-1" />
                <strong>Sakit</strong> — siswa tidak masuk karena sakit
              </li>
              <li>
                <AlertCircle className="w-3.5 h-3.5 text-blue-500 inline mr-1" />
                <strong>Izin</strong> — siswa tidak masuk dengan izin
              </li>
              <li>
                <XCircle className="w-3.5 h-3.5 text-rose-500 inline mr-1" />
                <strong>Alfa</strong> — siswa tidak masuk tanpa keterangan
              </li>
            </ul>
            <Tip>
              Klik tombol <strong>Pilih Semua Hadir</strong> untuk mempercepat jika semua siswa hadir.
            </Tip>
          </div>
        </AccordionItem>
        <div className="h-2" />
        <AccordionItem title="2. Materi & Capaian" icon={<BookOpen className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Isi dengan ringkasan materi yang diajarkan hari ini.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Materi:</strong> topik atau bab yang dipelajari
              </li>
              <li>
                <strong>Capaian:</strong> indikator ketercapaian atau kompetensi dasar (opsional)
              </li>
              <li>
                <strong>Refleksi:</strong> catatan tambahan tentang kendala atau hal menonjol (opsional)
              </li>
            </ul>
          </div>
        </AccordionItem>
        <div className="h-2" />
        <AccordionItem title="3. Foto Bukti" icon={<Camera className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>
              Anda bisa mengunggah hingga <strong>3 foto</strong> sebagai bukti pembelajaran (maks. 5 MB per foto).
            </p>
            <Step number={1} title="Klik tombol kamera">
              Pilih <strong>Ambil Foto</strong> untuk menggunakan kamera perangkat, atau <strong>Pilih File</strong> untuk mengunggah dari galeri.
            </Step>
            <Step number={2} title="Pratinjau & Hapus">
              Foto yang diunggah akan muncul sebagai pratinjau. Klik ikon <strong>×</strong> untuk menghapus foto sebelum disimpan.
            </Step>
            <Note>
              Foto akan tersimpan di server dan bisa dilihat oleh admin serta waka kurikulum melalui laporan rekap.
            </Note>
          </div>
        </AccordionItem>
        <div className="h-2" />
        <AccordionItem title="4. Tanda Tangan Digital" icon={<Lock className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>
              Sebelum menyimpan, Anda akan diminta <strong>menandatangani</strong> secara digital sebagai bukti keaslian entri.
            </p>
            <p>Tanda tangan bersifat wajib dan tidak bisa diubah setelah disimpan.</p>
          </div>
        </AccordionItem>
      </div>
    ),
  },
  {
    id: 'riwayat',
    title: 'Riwayat Agenda',
    icon: <Clock className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Menu <strong>Riwayat</strong> (di navigasi bawah) menampilkan semua agenda yang pernah Anda isi.
        </p>
        <Step number={1} title="Filter & Cari">
          Gunakan filter tanggal atau kelas untuk menemukan agenda tertentu. Anda juga bisa mencari berdasarkan nama mapel.
        </Step>
        <Step number={2} title="Lihat Detail">
          Klik baris agenda untuk melihat detail lengkap — absensi, materi, foto, dan tanda tangan.
        </Step>
        <Step number={3} title="Edit atau Hapus">
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>
              <strong>Edit:</strong> klik ikon pensil. Hanya agenda <em>hari ini dan sebelumnya</em> dalam batas waktu tertentu yang bisa diedit.
            </li>
            <li>
              <strong>Hapus:</strong> klik ikon tempat sampah. Penghapusan bersifat permanen dan tidak bisa dibatalkan.
            </li>
          </ul>
        </Step>
        <Step number={4} title="Cetak / Unduh PDF">
          Klik tombol <strong>PDF</strong> untuk mencetak atau mengunduh laporan agenda individu dalam format PDF.
        </Step>
        <Tip>
          Riwayat terbatas pada agenda milik Anda sendiri. Anda tidak bisa melihat agenda guru lain.
        </Tip>
      </div>
    ),
  },
  {
    id: 'kotak-saran',
    title: 'Kotak Saran',
    icon: <MessageSquare className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Jika menemukan kendala atau punya saran perbaikan, gunakan <strong>Kotak Saran</strong> di navigasi bawah.
        </p>
        <Step number={1} title="Buka Kotak Saran">
          Klik tombol <strong>Kotak Saran</strong> di navigasi bawah layar.
        </Step>
        <Step number={2} title="Isi Formulir">
          Tulis judul dan deskripsi saran/kendala Anda. Sertakan detail yang memudahkan admin memahami masalahnya.
        </Step>
        <Step number={3} title="Kirim">
          Klik <strong>Kirim</strong>. Saran akan masuk ke panel admin dan bisa dilihat oleh admin.
        </Step>
        <Note>
          Anda tidak akan menerima notifikasi balasan, tapi admin bisa menghubungi Anda langsung jika diperlukan.
        </Note>
      </div>
    ),
  },
  {
    id: 'tips-guru',
    title: 'Tips & Troubleshooting',
    icon: <HelpCircle className="w-4 h-4" />,
    content: (
      <div className="space-y-3">
        <div>
          <p className="font-semibold text-slate-800 text-sm">Sesi berakhir sendiri?</p>
          <p className="text-slate-600 text-sm">
            Sesi aktif selama <strong>30 hari</strong>. Jika logout sendiri, kemungkinan cookies dibersihkan atau perangkat diganti.
            Login ulang dengan kode yang sama.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">Foto tidak bisa diunggah?</p>
          <p className="text-slate-600 text-sm">
            Pastikan ukuran foto di bawah 5 MB. Coba kompres foto terlebih dahulu. Jika kamera tidak muncul,
            pastikan izin kamera diberikan pada peramban.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">Jadwal tidak muncul?</p>
          <p className="text-slate-600 text-sm">
            Pastikan admin sudah membuat jadwal untuk Anda di menu <strong>Jadwal Pembelajaran</strong>.
            Jadwal dibuat per semester dan harus diperbarui tiap tahun ajaran.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">Halaqoh (metode Ummi) — daftar siswa kosong?</p>
          <p className="text-slate-600 text-sm">
            Pastikan admin sudah: (1) membuat master halaqoh, (2) memilih kelas sumber, (3) memilih anggota siswa,
            dan (4) membuat jadwal Ummi yang menghubungkan halaqoh dengan guru Anda.
          </p>
        </div>
      </div>
    ),
  },
];

const adminSections: Section[] = [
  {
    id: 'login-admin',
    title: 'Cara Masuk (Login Admin)',
    icon: <LogInIcon />,
    content: (
      <div>
        <Step number={1} title="Pilih tab Staf">
          Di halaman login, pilih tab <strong>Staf</strong>.
        </Step>
        <Step number={2} title="Masukkan email">
          Ketik email akun admin Anda (contoh: <code>admin@sekolah.sch.id</code>).
        </Step>
        <Step number={3} title="Masukkan sandi">
          Sandi akun admin diatur saat pembuatan akun atau bisa diganti di menu Pengaturan.
        </Step>
        <Step number={4} title="Klik Masuk">
          Setelah berhasil, Anda masuk ke panel <strong>Admin</strong>.
        </Step>
        <Note>
          Akun admin pertama dibuat melalui layar <strong>Setup</strong> saat instalasi awal.
          Admin berikutnya dibuat dari menu <strong>Data Guru</strong> dengan mencentang peran Admin.
        </Note>
      </div>
    ),
  },
  {
    id: 'dashboard',
    title: 'Dashboard / Ringkasan',
    icon: <BarChart3 className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Halaman <strong>Ringkasan</strong> adalah beranda admin yang menampilkan statistik dan grafik agenda harian.
        </p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li>
            <strong>Ringkasan Hari Ini:</strong> jumlah agenda yang sudah/belum diisi per kelas
          </li>
          <li>
            <strong>Grafik:</strong> visualisasi keterisian agenda dalam seminggu terakhir
          </li>
          <li>
            <strong>Filter:</strong> pilih tanggal atau rentang tanggal untuk melihat data historis
          </li>
        </ul>
        <Tip>
          Gunakan filter tanggal untuk memantau keterisian agenda pada hari-hari sebelumnya.
        </Tip>
      </div>
    ),
  },
  {
    id: 'master-data',
    title: 'Master Data',
    icon: <DatabaseIcon />,
    content: (
      <div className="space-y-3">
        <p>Menu Master Data terdiri dari 4 bagian utama:</p>

        <AccordionItem title="Data Siswa" icon={<GraduationCap className="w-4 h-4" />}>
          <div className="space-y-2">
            <Step number={1} title="Tambah Siswa">
              Klik <strong>Tambah Siswa</strong>, isi NISN, nama, kelas, dan status (Aktif/Nonaktif/Pindah Keluar).
            </Step>
            <Step number={2} title="Import Excel">
              Siapkan file Excel dengan kolom: NISN, Nama, Kelas. Klik <strong>Import</strong> untuk unggah massal.
            </Step>
            <Step number={3} title="Edit & Hapus">
              Klik ikon pensil untuk edit, atau tempat sampah untuk hapus. Data siswa yang sudah punya agenda tidak bisa dihapus.
            </Step>
            <Note>
              Status siswa bersifat <strong>per tahun ajaran</strong>. Siswa kelas 6 yang aktif pada tahun ajaran lalu
              akan otomatis ditandai <em>Lulus</em> saat kenaikan kelas.
            </Note>
          </div>
        </AccordionItem>
        <div className="h-2" />

        <AccordionItem title="Data Guru" icon={<User className="w-4 h-4" />}>
          <div className="space-y-2">
            <Step number={1} title="Tambah Guru">
              Isi nama guru dan mata pelajaran yang diampu (opsional, untuk referensi).
            </Step>
            <Step number={2} title="Buat Akun & Kode">
              Klik ikon <strong>kunci</strong> pada baris guru. Isi kode akses (atau klik <strong>Acak</strong> untuk generate otomatis).
              Klik <strong>Simpan</strong> untuk membuatkan akun login.
            </Step>
            <Step number={3} title="Atur Peran">
              Saat membuat akun, centang <strong>Admin</strong> atau <strong>Kurikulum</strong> jika guru tersebut juga menjadi staf.
            </Step>
            <Step number={4} title="Nonaktifkan">
              Klik ikon kunci lagi → pilih <strong>Nonaktifkan Akun</strong> untuk menonaktifkan login guru tanpa menghapus datanya.
            </Step>
            <Tip>
              Kode guru disimpan ter-enkripsi di server. Admin tidak bisa melihat kode lama — hanya bisa mengatur kode baru.
            </Tip>
          </div>
        </AccordionItem>
        <div className="h-2" />

        <AccordionItem title="Data Mapel" icon={<BookMarked className="w-4 h-4" />}>
          <div className="space-y-2">
            <Step number={1} title="Tambah Mapel">
              Isi nama mata pelajaran (contoh: Matematika, Bahasa Indonesia).
            </Step>
            <Step number={2} title="Atur Warna">
              Pilih warna untuk setiap mapel. Warna ini akan muncul di jadwal dan rekap untuk memudahkan identifikasi.
            </Step>
            <Step number={3} title="Edit & Hapus">
              Mapel yang sudah dipakai di jadwal tidak bisa dihapus — hapus jadwalnya dulu.
            </Step>
          </div>
        </AccordionItem>
        <div className="h-2" />

        <AccordionItem title="Data Kelas" icon={<School className="w-4 h-4" />}>
          <div className="space-y-2">
            <Step number={1} title="Tambah Kelas">
              Isi nama kelas (contoh: 1A, 1B, 2A) dan pilih tingkat (1–6).
            </Step>
            <Step number={2} title="Atur Wali Kelas">
              Di menu terpisah <strong>Wali Kelas</strong>, pilih guru yang ditugaskan sebagai wali kelas untuk setiap kelas.
            </Step>
            <Note>
              Nama kelas digunakan di seluruh aplikasi — jadwal, agenda, dan rekap. Pastikan penamaan konsisten.
            </Note>
          </div>
        </AccordionItem>
      </div>
    ),
  },
  {
    id: 'jadwal',
    title: 'Jadwal Pembelajaran',
    icon: <CalendarDays className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Menu ini untuk membuat dan mengatur jadwal mengajar harian. Jadwal adalah fondasi aplikasi — tanpa jadwal,
          guru tidak bisa mengisi agenda.
        </p>
        <Step number={1} title="Tambah Jadwal">
          Klik <strong>Tambah Jadwal</strong>. Pilih:
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Hari (Senin–Jumat)</li>
            <li>Jam mulai & selesai</li>
            <li>Kelas (atau pilih halaqoh untuk metode Ummi)</li>
            <li>Mata pelajaran</li>
            <li>Guru pengajar</li>
          </ul>
        </Step>
        <Step number={2} title="Jadwal Halaqoh (Ummi)">
          Jika memilih mapel <strong>Ummi</strong>, pilihan kelas berubah menjadi daftar <strong>halaqoh</strong>.
          Setiap halaqoh akan menghasilkan satu baris jadwal dengan kelas sumbernya masing-masing.
        </Step>
        <Step number={3} title="Cek Bentrok">
          Sistem otomatis menolak jadwal yang bentrok:
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Guru sama di jam yang sama</li>
            <li>Kelas sama di jam yang sama (kecuali halaqoh yang memang dipecah)</li>
            <li>Halaqoh vs pelajaran seluruh kelas dari kelas sumbernya</li>
          </ul>
        </Step>
        <Step number={4} title="Edit & Hapus">
          Klik ikon pensil untuk ubah, tempat sampah untuk hapus. Hapus jadwal tidak menghapus agenda yang sudah diisi.
        </Step>
        <Tip>
          Gunakan filter di atas tabel untuk mencari jadwal per kelas, guru, atau hari.
        </Tip>
      </div>
    ),
  },
  {
    id: 'agenda-admin',
    title: 'Agenda (Melihat & Mengedit)',
    icon: <ClipboardList className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Menu <strong>Agenda</strong> menampilkan <strong>semua agenda</strong> yang diisi oleh seluruh guru.
          Anda bisa melihat, mengedit, atau menghapus agenda dari sini.
        </p>
        <Step number={1} title="Filter">
          Gunakan filter tanggal, kelas, atau guru untuk menyaring data.
        </Step>
        <Step number={2} title="Lihat Detail">
          Klik baris agenda untuk melihat detail lengkap — absensi, materi, foto, dan tanda tangan guru.
        </Step>
        <Step number={3} title="Edit">
          Klik ikon pensil. Anda bisa mengubah absensi, materi, atau foto. Tanda tangan tetap milik guru asli.
        </Step>
        <Step number={4} title="Hapus">
          Klik ikon tempat sampah untuk menghapus agenda. Aksi ini permanen.
        </Step>
        <Note>
          Agenda yang diedit oleh admin akan tercatat jejaknya — siapa admin yang mengubah dan kapan waktunya.
        </Note>
      </div>
    ),
  },
  {
    id: 'rekap',
    title: 'Pusat Rekap (Laporan)',
    icon: <FileText className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Pusat Rekap menyediakan 4 jenis laporan. Semua laporan bisa diunduh dalam format <strong>PDF</strong>.
        </p>

        <AccordionItem title="Rekap Harian" icon={<CalendarDays className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Laporan per hari per kelas. Menampilkan seluruh sesi pembelajaran pada tanggal dan kelas tertentu.</p>
            <Step number={1} title="Pilih tanggal dan kelas" />
            <Step number={2} title="Klik Unduh PDF" />
            <Tip>
              Sesi halaqoh lintas kelas akan muncul di rekap <strong>setiap kelas sumbernya</strong>.
            </Tip>
          </div>
        </AccordionItem>
        <div className="h-2" />

        <AccordionItem title="Rekap Mingguan" icon={<Layers className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Laporan per guru per minggu. Menampilkan ringkasan agenda yang diisi oleh setiap guru dalam rentang tanggal tertentu.</p>
            <Step number={1} title="Pilih rentang tanggal (Senin–Jumat)" />
            <Step number={2} title="Pilih guru (opsional, kosongkan untuk semua)" />
            <Step number={3} title="Klik Unduh PDF" />
          </div>
        </AccordionItem>
        <div className="h-2" />

        <AccordionItem title="Rekap Bulanan" icon={<BarChart3 className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Laporan per guru per bulan. Agregat jumlah mengajar, jam pelajaran, dan ringkasan mapel.</p>
            <Step number={1} title="Pilih bulan dan tahun" />
            <Step number={2} title="Pilih guru (opsional)" />
            <Step number={3} title="Klik Unduh PDF" />
          </div>
        </AccordionItem>
        <div className="h-2" />

        <AccordionItem title="Log Jurnal" icon={<BookOpen className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Daftar lengkap semua agenda per kelas per tanggal. Bisa difilter per kelas, guru, atau tanggal.</p>
            <Step number={1} title="Pilih filter (kelas/guru/tanggal)" />
            <Step number={2} title="Klik baris untuk melihat detail" />
            <Step number={3} title="Klik Unduh PDF untuk ekspor" />
            <Tip>
              Log Jurnal adalah laporan paling detail — menampilkan absensi per siswa, materi, foto, dan tanda tangan.
            </Tip>
          </div>
        </AccordionItem>
      </div>
    ),
  },
  {
    id: 'halaqoh',
    title: 'Halaqoh Lintas Kelas (Metode Ummi)',
    icon: <Users className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Halaqoh adalah kelompok belajar yang mencakup <strong>beberapa kelas sekaligus</strong> (metode Ummi).
        </p>
        <Step number={1} title="Buat Master Halaqoh">
          Menu <strong>Master Data → Halaqoh</strong>. Klik <strong>Tambah Halaqoh</strong>:
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Isi nama halaqoh (contoh: Halaqoh A)</li>
            <li>Pilih <strong>kelas sumber</strong> (bisa lebih dari satu, misal 3A dan 4A)</li>
            <li>Simpan</li>
          </ul>
        </Step>
        <Step number={2} title="Pilih Anggota">
          Klik <strong>Anggota</strong> pada kartu halaqoh. Pilih siswa dari daftar kandidat (hanya siswa dari kelas sumber).
          Satu siswa hanya boleh masuk <strong>satu halaqoh</strong> per tahun ajaran.
        </Step>
        <Step number={3} title="Buat Jadwal Ummi">
          Menu <strong>Jadwal → Tambah Jadwal</strong>:
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Pilih mapel <strong>Ummi</strong></li>
            <li>Pilih halaqoh (bukan kelas)</li>
            <li>Isi guru pengajar</li>
            <li>Simpan</li>
          </ul>
        </Step>
        <Step number={4} title="Agenda Halaqoh">
          Guru yang ditugaskan akan melihat jadwal Ummi di halaman utamanya. Saat mengisi agenda, daftar absensi
          hanya menampilkan <strong>anggota halaqoh tersebut</strong>.
        </Step>
        <Note>
          Halaqoh dibuat <strong>dari nol tiap tahun ajaran</strong>. Tidak ada fitur salin dari tahun lalu.
        </Note>
      </div>
    ),
  },
  {
    id: 'wali-kelas',
    title: 'Wali Kelas & Substitusi',
    icon: <User className="w-4 h-4" />,
    content: (
      <div>
        <AccordionItem title="Wali Kelas" icon={<Shield className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Menu <strong>Wali Kelas</strong> untuk menugaskan guru sebagai wali kelas.</p>
            <Step number={1} title="Pilih Kelas" />
            <Step number={2} title="Pilih Guru" />
            <Step number={3} title="Simpan" />
            <Note>
              Satu kelas hanya punya satu wali kelas aktif per tahun ajaran.
            </Note>
          </div>
        </AccordionItem>
        <div className="h-2" />
        <AccordionItem title="Substitusi (Badal)" icon={<ArrowUpCircle className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Menu <strong>Badal</strong> untuk mengatur guru pengganti saat guru asli berhalangan.</p>
            <Step number={1} title="Pilih jadwal guru yang berhalangan" />
            <Step number={2} title="Pilih guru pengganti" />
            <Step number={3} title="Tentukan rentang tanggal substitusi" />
            <Step number={4} title="Simpan" />
            <Tip>
              Guru pengganti akan melihat jadwal substitusi di halaman utamanya dan bisa mengisi agenda atas nama guru asli.
            </Tip>
          </div>
        </AccordionItem>
      </div>
    ),
  },
  {
    id: 'kenaikan-kelas',
    title: 'Kenaikan Kelas & Tahun Ajaran',
    icon: <ArrowUpCircle className="w-4 h-4" />,
    content: (
      <div>
        <AccordionItem title="Tahun Ajaran" icon={<CalendarDays className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Menu <strong>Tahun Ajaran</strong> untuk mengelola periode akademik.</p>
            <Step number={1} title="Tambah Tahun Ajaran">
              Isi nama (contoh: 2026/2027) dan pilih status <strong>Aktif</strong>.
            </Step>
            <Step number={2} title="Ubah Tahun Aktif">
              Klik tombol aktif pada baris tahun ajaran untuk menjadikannya tahun yang sedang berjalan.
            </Step>
            <Note>
              Seluruh data agenda, jadwal, dan halaqoh terikat pada tahun ajaran aktif.
            </Note>
          </div>
        </AccordionItem>
        <div className="h-2" />
        <AccordionItem title="Kenaikan Kelas" icon={<GraduationCap className="w-4 h-4" />}>
          <div className="space-y-2">
            <p>Menu <strong>Kenaikan Kelas</strong> untuk memindahkan siswa ke kelas baru di tahun ajaran berikutnya.</p>
            <Step number={1} title="Pilih Tahun Ajaran Tujuan">
              Tahun ajaran tujuan harus sudah dibuat dan aktif.
            </Step>
            <Step number={2} title="Lihat Pratinjau">
              Sistem menampilkan daftar siswa yang akan naik kelas, lulus (kelas 6), atau dilewati (nonaktif/pindah).
            </Step>
            <Step number={3} title="Konfirmasi">
              Klik <strong>Proses Kenaikan Kelas</strong>. Aksi ini membuat penempatan siswa di tahun ajaran baru.
            </Step>
            <Note>
              Siswa kelas 6 yang aktif akan ditandai <strong>Lulus</strong> tanpa penempatan baru.
              Siswa nonaktif/pindah akan dilewati.
            </Note>
          </div>
        </AccordionItem>
      </div>
    ),
  },
  {
    id: 'pengaturan',
    title: 'Pengaturan',
    icon: <Settings className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">Menu <strong>Pengaturan</strong> berisi konfigurasi aplikasi:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Nama Sekolah:</strong> ubah nama yang tampil di login dan footer
          </li>
          <li>
            <strong>Logo:</strong> unggah logo sekolah (tampil di halaman login)
          </li>
          <li>
            <strong>Keamanan Akun:</strong> ganti sandi admin. Sandi lama wajib dimasukkan sebagai verifikasi.
          </li>
          <li>
            <strong>Kotak Saran:</strong> lihat masukan yang dikirim guru
          </li>
        </ul>
        <Tip>
          Logo disimpan di Supabase Storage. Pastikan ukuran tidak terlalu besar (di bawah 500 KB).
        </Tip>
      </div>
    ),
  },
];

const kurikulumSections: Section[] = [
  {
    id: 'login-kurikulum',
    title: 'Cara Masuk (Waka Kurikulum)',
    icon: <LogInIcon />,
    content: (
      <div>
        <Step number={1} title="Pilih tab Staf">
          Sama seperti admin, pilih tab <strong>Staf</strong> di halaman login.
        </Step>
        <Step number={2} title="Masukkan email & sandi">
          Gunakan email dan sandi akun yang sudah dibuatkan admin.
        </Step>
        <Step number={3} title="Masuk">
          Setelah berhasil, Anda masuk ke panel dengan akses terbatas.
        </Step>
        <Note>
          Akun waka kurikulum dibuat oleh admin dari menu <strong>Data Guru</strong> dengan mencentang peran Kurikulum.
        </Note>
      </div>
    ),
  },
  {
    id: 'hak-akses',
    title: 'Hak Akses Waka Kurikulum',
    icon: <Shield className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Waka Kurikulum memiliki akses <strong>hampir sama dengan Admin</strong>, kecuali beberapa menu sensitif:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
            <p className="font-semibold text-emerald-800 text-sm mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Bisa Diakses
            </p>
            <ul className="text-xs text-emerald-700 space-y-1">
              <li>Data Siswa, Guru, Mapel, Kelas</li>
              <li>Jadwal Pembelajaran</li>
              <li>Agenda (lihat & edit)</li>
              <li>Pusat Rekap (semua laporan)</li>
              <li>Halaqoh</li>
              <li>Wali Kelas & Substitusi</li>
              <li>Tahun Ajaran</li>
              <li>Kotak Saran</li>
            </ul>
          </div>
          <div className="border border-rose-200 bg-rose-50 rounded-lg p-3">
            <p className="font-semibold text-rose-800 text-sm mb-2 flex items-center gap-2">
              <Ban className="w-4 h-4" /> Tidak Bisa
            </p>
            <ul className="text-xs text-rose-700 space-y-1">
              <li>Kenaikan Kelas</li>
              <li>Pengaturan (keamanan akun)</li>
              <li>Membuat/menghapus akun admin</li>
            </ul>
          </div>
        </div>
        <Note>
          Meskipun bisa mengedit agenda, jejak edit tetap tercatat — siapa yang mengubah dan kapan.
        </Note>
      </div>
    ),
  },
  {
    id: 'kurikulum-master',
    title: 'Master Data',
    icon: <DatabaseIcon />,
    content: (
      <div>
        <p className="mb-3">
          Cara penggunaan menu Master Data oleh waka kurikulum <strong>sama persis dengan admin</strong>.
          Lihat bagian <em>Master Data</em> di panduan Admin untuk detail lengkapnya.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Data Siswa — tambah, edit, import, hapus</li>
          <li>Data Guru — tambah, edit (tapi tidak bisa buat akun admin)</li>
          <li>Data Mapel — tambah, atur warna</li>
          <li>Data Kelas — tambah, edit</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'kurikulum-rekap',
    title: 'Pusat Rekap',
    icon: <FileText className="w-4 h-4" />,
    content: (
      <div>
        <p className="mb-3">
          Waka kurikulum bisa mengakses <strong>seluruh laporan</strong> di Pusat Rekap:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>
            <strong>Rekap Harian</strong> — per kelas per hari
          </li>
          <li>
            <strong>Rekap Mingguan</strong> — per guru per minggu
          </li>
          <li>
            <strong>Rekap Bulanan</strong> — per guru per bulan
          </li>
          <li>
            <strong>Log Jurnal</strong> — daftar detail semua agenda
          </li>
        </ul>
        <p className="mt-3 text-sm">
          Semua laporan bisa diunduh dalam format <strong>PDF</strong> untuk keperluan arsip atau rapat.
        </p>
        <Tip>
          Gunakan filter tanggal dan kelas untuk memantau keterisian agenda secara rutin.
        </Tip>
      </div>
    ),
  },
  {
    id: 'kurikulum-tips',
    title: 'Tips Khusus Waka Kurikulum',
    icon: <HelpCircle className="w-4 h-4" />,
    content: (
      <div className="space-y-3 text-sm">
        <div>
          <p className="font-semibold text-slate-800">Memantau Keterisian Agenda</p>
          <p className="text-slate-600">
            Buka <strong>Pusat Rekap → Log Jurnal</strong>, filter per tanggal. Agenda yang kosong berarti
            guru belum mengisi — bisa ditindaklanjuti.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-800">Mengecek Data Jadwal</p>
          <p className="text-slate-600">
            Buka <strong>Jadwal Pembelajaran</strong>, filter per kelas atau guru untuk memastikan tidak ada jadwal yang terlewat.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-800">Mengelola Halaqoh</p>
          <p className="text-slate-600">
            Pastikan setiap halaqoh sudah punya anggota dan jadwal sebelum semester dimulai.
            Siswa tanpa halaqoh tidak akan muncul di agenda Ummi.
          </p>
        </div>
      </div>
    ),
  },
];

/* -------------------------------------------------------------------------- */
/*  Ikon helper sederhana                                                      */
/* -------------------------------------------------------------------------- */

function LogInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" x2="3" y1="12" y2="12" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Halaman utama                                                              */
/* -------------------------------------------------------------------------- */

export const PanduanPenggunaanPage: React.FC = () => {
  const [activeRole, setActiveRole] = useState<Role>('guru');

  const roleConfig: Record<
    Role,
    { label: string; icon: React.ReactNode; sections: Section[]; color: string; bg: string }
  > = {
    guru: {
      label: 'Guru',
      icon: <User className="w-4 h-4" />,
      sections: guruSections,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50 border-emerald-200',
    },
    admin: {
      label: 'Administrator',
      icon: <Shield className="w-4 h-4" />,
      sections: adminSections,
      color: 'text-primary-700',
      bg: 'bg-primary-50 border-primary-200',
    },
    kurikulum: {
      label: 'Waka Kurikulum',
      icon: <GraduationCap className="w-4 h-4" />,
      sections: kurikulumSections,
      color: 'text-violet-700',
      bg: 'bg-violet-50 border-violet-200',
    },
  };

  const current = roleConfig[activeRole];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            to="/login"
            className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Kembali ke login"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Panduan Penggunaan</h1>
            <p className="text-xs text-slate-500">SIAJAR — Sistem Agenda Pembelajaran</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Intro */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 mb-2">Selamat Datang</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Dokumen ini berisi panduan lengkap penggunaan <strong>SIAJAR</strong> untuk tiga peran utama:
            Guru, Administrator, dan Waka Kurikulum. Pilih tab di bawah sesuai peran Anda.
          </p>
        </div>

        {/* Role Tabs */}
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
          {(Object.keys(roleConfig) as Role[]).map((role) => {
            const cfg = roleConfig[role];
            const active = activeRole === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                  active
                    ? `${cfg.bg} ${cfg.color} border`
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {current.sections.map((section) => (
            <AccordionItem key={section.id} title={section.title} icon={section.icon}>
              {section.content}
            </AccordionItem>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 py-4">
          SIAJAR &bull; Panduan Penggunaan &bull; {new Date().getFullYear()}
        </div>
      </main>
    </div>
  );
};

export default PanduanPenggunaanPage;
