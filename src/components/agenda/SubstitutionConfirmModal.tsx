import React, { useState } from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import { SUBSTITUTION_REASONS, type SubstitutionReason } from '../../types';
import { AlertTriangle } from 'lucide-react';
import {
  FormModal,
  FormField,
  SelectInput,
  TextInput,
  formStyles,
} from '../common';

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
    onConfirm(reason, reason === 'Lainnya' ? reasonDetail.trim() : '');
  };

  return (
    <FormModal
      isOpen
      onClose={onCancel}
      title="Konfirmasi Guru Pengganti"
      subtitle="Badal / Penggantian Guru"
      onSubmit={handleSubmit}
      busy={isLoading}
      footer={(formId) => (
        <>
          <span />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className={formStyles.ghostBtn}
            >
              Bukan saya
            </button>
            <button
              type="submit"
              form={formId}
              disabled={isLoading || (reason === 'Lainnya' && !reasonDetail.trim())}
              className={formStyles.primaryBtn}
            >
              {isLoading ? 'Memproses...' : 'Ya, saya guru pengganti'}
            </button>
          </div>
        </>
      )}
    >
      <div className="p-5 space-y-4">
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
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kelas</p>
              <p className="font-bold text-slate-900">{schedule.class_id}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mata Pelajaran</p>
              <p className="font-bold text-slate-900">{schedule.subject_name}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Jam</p>
              <p className="font-semibold text-slate-800">
                {schedule.start_time.slice(0, 5)} – {schedule.end_time.slice(0, 5)} (JP{' '}
                {schedule.period_number})
              </p>
            </div>
          </div>
        </div>

        {/* Perbandingan guru */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Guru Terjadwal</p>
            <p className="font-bold text-slate-800">{schedule.teacher_name}</p>
            <span className="inline-block px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs font-bold rounded">
              Berhalangan
            </span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Guru Pengganti</p>
            <p className="font-bold text-slate-900">{substituteTeacherName}</p>
            <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">
              Anda
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Anda akan tercatat sebagai <strong>guru pengganti</strong> untuk{' '}
          <strong>{schedule.teacher_name}</strong>. Jadwal asli tidak akan berubah.
        </p>

        {/* Alasan */}
        <FormField label="Alasan Penggantian" htmlFor="sub-alasan" required>
          <SelectInput
            id="sub-alasan"
            value={reason}
            onChange={(e) => setReason(e.target.value as SubstitutionReason)}
          >
            {SUBSTITUTION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectInput>
        </FormField>

        {reason === 'Lainnya' && (
          <FormField label="Jelaskan alasan" htmlFor="sub-alasan-detail" required>
            <TextInput
              id="sub-alasan-detail"
              type="text"
              placeholder="Jelaskan alasan..."
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              required
              maxLength={200}
            />
          </FormField>
        )}
      </div>
    </FormModal>
  );
};
