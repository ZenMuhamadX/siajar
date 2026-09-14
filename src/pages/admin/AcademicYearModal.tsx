import React, { useState } from 'react';
import type { AcademicYear, AcademicYearStatus } from '../../types/schedule';
import {
  createAcademicYear,
  setActiveAcademicYear,
  archiveAcademicYear,
} from '../../services/scheduleService';
import { X, Calendar, Plus } from 'lucide-react';

interface AcademicYearModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYears: AcademicYear[];
  onRefresh: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const AcademicYearModal: React.FC<AcademicYearModalProps> = ({
  isOpen,
  onClose,
  academicYears,
  onRefresh,
  showToast,
}) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<AcademicYearStatus>('DRAFT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

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
      onRefresh();
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
        onRefresh();
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
        onRefresh();
      } catch (err: any) {
        showToast('error', 'Gagal mengarsipkan: ' + (err?.message || ''));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              Kelola Tahun Ajaran
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Create Form */}
          <form onSubmit={handleCreate} className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-purple-600" />
              Tambah Tahun Ajaran Baru
            </h4>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nama Tahun Ajaran (contoh: 2026/2027)
              </label>
              <input
                type="text"
                placeholder="2026/2027"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Mulai
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Selesai
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600 text-[11px]">Status Awal:</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AcademicYearStatus)}
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-hidden"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg transition shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </form>

          {/* List of Academic Years */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Daftar Tahun Ajaran
            </h4>

            {academicYears.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-3 text-center">
                Belum ada tahun ajaran. Buat tahun ajaran di atas.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {academicYears.map((ay) => {
                  const isActive = ay.status === 'ACTIVE';
                  const isArchived = ay.status === 'ARCHIVED';

                  return (
                    <div
                      key={ay.id}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-2 transition ${
                        isActive
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : isArchived
                          ? 'border-slate-200 bg-slate-50 opacity-70'
                          : 'border-amber-200 bg-amber-50/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-800">
                            {ay.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : isArchived
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ay.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {ay.start_date} s/d {ay.end_date}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isActive && (
                          <button
                            onClick={() => handleActivate(ay)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition"
                            title="Jadikan Tahun Ajaran Aktif"
                          >
                            Aktifkan
                          </button>
                        )}
                        {!isArchived && !isActive && (
                          <button
                            onClick={() => handleArchive(ay)}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] font-medium transition"
                            title="Arsipkan"
                          >
                            Arsipkan
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
