import React, { useState, useEffect } from 'react';
import type { AcademicYear, AcademicYearStatus } from '../../types/schedule';
import {
  getAcademicYears,
  createAcademicYear,
  setActiveAcademicYear,
  archiveAcademicYear,
} from '../../services/scheduleService';
import { PageHeader } from '../../components/admin/PageHeader';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Archive,
  RefreshCw,
  X,
  CalendarCheck,
} from 'lucide-react';

interface AcademicYearPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const AcademicYearPage: React.FC<AcademicYearPageProps> = ({ showToast }) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal create state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<AcademicYearStatus>('DRAFT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchYears = async () => {
    setIsLoading(true);
    try {
      const data = await getAcademicYears();
      setAcademicYears(data);
    } catch (e: any) {
      showToast('error', 'Gagal memuat tahun ajaran: ' + (e?.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Nama tahun ajaran wajib diisi.');
      return;
    }
    if (!startDate || !endDate) {
      showToast('error', 'Tanggal mulai dan selesai wajib diisi.');
      return;
    }
    if (startDate >= endDate) {
      showToast('error', 'Tanggal mulai harus lebih awal dari tanggal selesai.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createAcademicYear({
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        status,
      });
      showToast('success', `Tahun ajaran ${name} berhasil dibuat.`);
      setName('');
      setStartDate('');
      setEndDate('');
      setStatus('DRAFT');
      setIsModalOpen(false);
      fetchYears();
    } catch (err: any) {
      showToast('error', 'Gagal membuat tahun ajaran: ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = async (ay: AcademicYear) => {
    if (ay.status === 'ACTIVE') return;
    if (
      confirm(
        `Aktifkan Tahun Ajaran "${ay.name}"? Tahun ajaran yang saat ini aktif akan otomatis diarsipkan.`
      )
    ) {
      try {
        await setActiveAcademicYear(ay.id);
        showToast('success', `Tahun ajaran ${ay.name} sekarang ACTIVE.`);
        fetchYears();
      } catch (err: any) {
        showToast('error', 'Gagal mengaktifkan tahun ajaran: ' + (err?.message || ''));
      }
    }
  };

  const handleArchive = async (ay: AcademicYear) => {
    if (ay.status === 'ARCHIVED') return;
    if (confirm(`Arsipkan Tahun Ajaran "${ay.name}"?`)) {
      try {
        await archiveAcademicYear(ay.id);
        showToast('info', `Tahun ajaran ${ay.name} diarsipkan.`);
        fetchYears();
      } catch (err: any) {
        showToast('error', 'Gagal mengarsipkan: ' + (err?.message || ''));
      }
    }
  };

  const activeAY = academicYears.find((y) => y.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tahun Ajaran"
        description="Kelola siklus tahun ajaran sekolah dan status aktif untuk pembelajaran."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchYears}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tahun Ajaran</span>
            </button>
          </div>
        }
      />

      {/* Active banner summary */}
      {activeAY ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Tahun Ajaran Aktif: {activeAY.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Periode operasional: {activeAY.start_date} s/d {activeAY.end_date}
              </p>
            </div>
          </div>
          <span className="text-xs text-emerald-800 font-medium bg-emerald-100/60 px-3 py-1.5 rounded-lg self-start sm:self-auto">
            Digunakan oleh agenda & jadwal harian
          </span>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          Belum ada Tahun Ajaran yang berstatus <strong>ACTIVE</strong>. Silakan pilih salah satu tahun ajaran di bawah untuk diaktifkan.
        </div>
      )}

      {/* Grid of Academic Years */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-xs">
          Daftar Seluruh Tahun Ajaran
        </h3>

        {isLoading ? (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Memuat data tahun ajaran...</p>
          </div>
        ) : academicYears.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center border border-slate-200 text-slate-400 italic text-xs">
            Belum ada data tahun ajaran. Klik tombol "Tambah Tahun Ajaran" untuk memulai.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {academicYears.map((ay) => {
              const isActive = ay.status === 'ACTIVE';
              const isArchived = ay.status === 'ARCHIVED';

              return (
                <div
                  key={ay.id}
                  className={`bg-white rounded-xl border p-4 sm:p-5 flex flex-col justify-between space-y-4 transition ${
                    isActive
                      ? 'border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                      : isArchived
                      ? 'border-slate-200 opacity-75'
                      : 'border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-base sm:text-lg text-slate-900">
                        {ay.name}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : isArchived
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ay.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {ay.start_date} &rarr; {ay.end_date}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {isActive ? 'Sedang berjalan' : isArchived ? 'Arsip historis' : 'Draf persiapan'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!isActive && (
                        <button
                          onClick={() => handleActivate(ay)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Aktifkan</span>
                        </button>
                      )}

                      {!isArchived && !isActive && (
                        <button
                          onClick={() => handleArchive(ay)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1"
                        >
                          <Archive className="w-3.5 h-3.5 text-slate-500" />
                          <span>Arsipkan</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Add Academic Year */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Tambah Tahun Ajaran Baru
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nama Tahun Ajaran (contoh: 2026/2027)
                </label>
                <input
                  type="text"
                  placeholder="2026/2027"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Status Awal
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AcademicYearStatus)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="DRAFT">DRAFT (Dalam persiapan)</option>
                  <option value="ACTIVE">ACTIVE (Langsung aktifkan)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Tahun Ajaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
