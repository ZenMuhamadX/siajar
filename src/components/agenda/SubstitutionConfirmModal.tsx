import React, { useState } from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import { SUBSTITUTION_REASONS, type SubstitutionReason } from '../../types';
import { AlertTriangle, Users, X } from 'lucide-react';

interface SubstitutionConfirmModalProps {
  slot: TimelineSlot;
  substituteTeacherName: string; // logged-in teacher
  onConfirm: (reason: string, reasonDetail: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  errorMessage?: string;
}

export const SubstitutionConfirmModal: React.FC<SubstitutionConfirmModalProps> = ({
  slot,
  substituteTeacherName,
  onConfirm,
  onCancel,
  isLoading = false,
  errorMessage,
}) => {
  const { schedule } = slot;
  const [reason, setReason] = useState<SubstitutionReason>('Guru berhalangan');
  const [reasonDetail, setReasonDetail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === 'Lainnya' ? `Lainnya: ${reasonDetail.trim()}` : reason;
    onConfirm(reason, reason === 'Lainnya' ? reasonDetail.trim() : '');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-amber-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Konfirmasi Guru Pengganti</h3>
              <p className="text-[11px] text-slate-500">Badal / Penggantian Guru</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Error */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          {/* Info jadwal */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kelas</p>
                <p className="font-bold text-slate-900">{schedule.class_id}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mata Pelajaran</p>
                <p className="font-bold text-slate-900">{schedule.subject_name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jam</p>
                <p className="font-semibold text-slate-800">
                  {schedule.start_time.slice(0, 5)} – {schedule.end_time.slice(0, 5)} (JP {schedule.period_number})
                </p>
              </div>
            </div>
          </div>

          {/* Perbandingan guru */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guru Terjadwal</p>
              <p className="font-bold text-slate-800">{schedule.teacher_name}</p>
              <span className="inline-block px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-bold rounded">
                Berhalangan
              </span>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Guru Pengganti</p>
              <p className="font-bold text-slate-900">{substituteTeacherName}</p>
              <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded">
                Anda
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Anda akan tercatat sebagai <strong>guru pengganti</strong> untuk{' '}
            <strong>{schedule.teacher_name}</strong>. Jadwal asli tidak akan berubah.
          </p>

          {/* Alasan */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-700">
              Alasan Penggantian
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as SubstitutionReason)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
            >
              {SUBSTITUTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {reason === 'Lainnya' && (
              <input
                type="text"
                placeholder="Jelaskan alasan..."
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                required
                maxLength={200}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Bukan saya
            </button>
            <button
              type="submit"
              disabled={isLoading || (reason === 'Lainnya' && !reasonDetail.trim())}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50"
            >
              {isLoading ? 'Memproses...' : 'Ya, saya guru pengganti'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
