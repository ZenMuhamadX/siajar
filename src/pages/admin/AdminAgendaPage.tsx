import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DAFTAR_KELAS, type FullAgenda, type Guru } from '../../types';
import { getDaftarGuru } from '../../services/agendaService';
import {
  getSchoolDailyTimelineForDate,
  type TimelineSlot,
} from '../../services/scheduleDetectionService';
import { AgendaDetailForm } from '../../components/agenda/AgendaDetailForm';
import { PageHeader } from '../../components/admin/PageHeader';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Edit3,
  FileEdit,
  Filter,
  Loader2,
  Plus,
} from 'lucide-react';

interface AdminAgendaPageProps {
  editData?: FullAgenda | null;
  onCancelEdit?: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type StatusFilter = 'SEMUA' | 'BELUM' | 'SUDAH';

const statusLabel: Record<TimelineSlot['status'], string> = {
  UPCOMING: 'Belum dimulai',
  IN_PROGRESS: 'Berlangsung',
  OVERDUE: 'Belum diisi',
  COMPLETED: 'Sudah diisi',
};

export const AdminAgendaPage: React.FC<AdminAgendaPageProps> = ({
  editData,
  onCancelEdit,
  showToast,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(editData?.header.tanggal || todayStr);
  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [reason, setReason] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [daftarGuru, setDaftarGuru] = useState<Guru[]>([]);
  const [filterGuru, setFilterGuru] = useState('SEMUA');
  const [filterKelas, setFilterKelas] = useState('SEMUA');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('SEMUA');
  const [selectedSlot, setSelectedSlot] = useState<TimelineSlot | null>(null);
  const [directEdit, setDirectEdit] = useState<FullAgenda | null>(editData || null);

  useEffect(() => {
    getDaftarGuru()
      .then(setDaftarGuru)
      .catch(() => {
        showToast('error', 'Gagal memuat daftar guru.');
      });
  }, [showToast]);

  useEffect(() => {
    if (editData) {
      setDirectEdit(editData);
      if (editData.header.tanggal) {
        setSelectedDate(editData.header.tanggal);
      }
    }
  }, [editData]);

  const fetchSlots = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSchoolDailyTimelineForDate(selectedDate, new Date());
      setSlots(result.slots);
      setReason(result.reason);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memuat jadwal harian sekolah.');
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, showToast]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  useEffect(() => {
    if (!directEdit || selectedSlot || slots.length === 0) return;
    const scheduleId = directEdit.header.schedule_id;
    const match = slots.find((s) =>
      scheduleId
        ? s.schedule.id === scheduleId
        : s.existingAgenda?.header.id === directEdit.header.id
    );
    if (match) setSelectedSlot(match);
  }, [directEdit, selectedSlot, slots]);

  const formatDateIndo = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleSetDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    handleSetDate(d.toISOString().split('T')[0]);
  };

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (filterGuru !== 'SEMUA' && slot.schedule.teacher_name !== filterGuru) return false;
      if (filterKelas !== 'SEMUA' && slot.schedule.class_id !== filterKelas) return false;
      if (filterStatus === 'SUDAH' && slot.status !== 'COMPLETED') return false;
      if (filterStatus === 'BELUM' && slot.status === 'COMPLETED') return false;
      return true;
    });
  }, [slots, filterGuru, filterKelas, filterStatus]);

  const filledCount = slots.filter((s) => s.status === 'COMPLETED').length;
  const emptyCount = slots.length - filledCount;

  const teacherNameForForm =
    selectedSlot?.schedule.teacher_name ||
    directEdit?.kbm?.[0]?.nama_guru ||
    'Administrator';

  const handleOpenSlot = (slot: TimelineSlot) => {
    setSelectedSlot(slot);
    setDirectEdit(slot.existingAgenda);
  };

  const handleCloseForm = () => {
    setSelectedSlot(null);
    setDirectEdit(null);
    onCancelEdit?.();
  };

  const handleSuccessSave = () => {
    handleCloseForm();
    fetchSlots();
  };

  if (selectedSlot || directEdit) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-indigo-900">Mode administrator</p>
            <p className="text-xs text-indigo-800 mt-0.5">
              Mengisi / mengoreksi agenda atas nama{' '}
              <strong>{teacherNameForForm}</strong>
              {selectedSlot ? ` · ${selectedSlot.schedule.class_id}` : directEdit ? ` · ${directEdit.header.kelas}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseForm}
            className="self-start text-xs font-semibold text-indigo-700 hover:text-indigo-900 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white"
          >
            Kembali ke daftar
          </button>
        </div>

        <AgendaDetailForm
          onBack={handleCloseForm}
          slot={selectedSlot}
          targetDate={selectedDate}
          activeTeacherName={teacherNameForForm}
          onSuccessSave={handleSuccessSave}
          showToast={showToast}
          directEditData={directEdit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda Pembelajaran"
        description="Pantau, isi, dan koreksi jurnal harian seluruh guru dari satu meja kerja admin."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Slot jadwal</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{slots.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Sudah diisi</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{filledCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Belum diisi</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{emptyCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Tanggal</p>
          <p className="text-sm font-bold text-slate-900 mt-2 leading-snug">{formatDateIndo(selectedDate)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg"
              title="Hari sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleSetDate(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg"
              title="Hari berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => handleSetDate(todayStr)}
                className="ml-1 px-2.5 py-1 text-[11px] font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Hari ini
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              <Filter className="w-3 h-3" />
              Filter
            </span>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="SEMUA">Semua kelas</option>
              {DAFTAR_KELAS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              value={filterGuru}
              onChange={(e) => setFilterGuru(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white max-w-48"
            >
              <option value="SEMUA">Semua guru</option>
              {daftarGuru.map((g) => (
                <option key={g.id} value={g.nama_guru}>
                  {g.nama_guru}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="SEMUA">Semua status</option>
              <option value="BELUM">Belum diisi</option>
              <option value="SUDAH">Sudah diisi</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            Memuat jadwal harian...
          </div>
        ) : reason === 'WEEKEND' ? (
          <div className="py-14 text-center space-y-2">
            <Coffee className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Akhir pekan</p>
            <p className="text-xs text-slate-500">Tidak ada jadwal reguler pada Sabtu/Minggu.</p>
          </div>
        ) : reason === 'NO_ACTIVE_ACADEMIC_YEAR' ? (
          <div className="py-14 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Belum ada tahun ajaran aktif</p>
            <p className="text-xs text-slate-500">Aktifkan tahun ajaran di menu Pengaturan.</p>
          </div>
        ) : filteredSlots.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Tidak ada slot sesuai filter</p>
            <p className="text-xs text-slate-500">Ubah tanggal atau filter kelas/guru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[720px]">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Waktu</th>
                  <th className="px-4 py-3 font-semibold">Kelas</th>
                  <th className="px-4 py-3 font-semibold">Mapel</th>
                  <th className="px-4 py-3 font-semibold">Guru</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSlots.map((slot) => {
                  const isFilled = slot.status === 'COMPLETED';
                  return (
                    <tr key={slot.schedule.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                        {slot.schedule.start_time.slice(0, 5)} – {slot.schedule.end_time.slice(0, 5)}
                        <span className="block text-[10px] text-slate-400 font-sans">
                          JP {slot.schedule.period_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {slot.schedule.class_id}
                      </td>
                      <td className="px-4 py-3 text-slate-800">{slot.schedule.subject_name}</td>
                      <td className="px-4 py-3 text-slate-600">{slot.schedule.teacher_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                            isFilled
                              ? 'bg-emerald-50 text-emerald-700'
                              : slot.status === 'IN_PROGRESS'
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {isFilled ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <FileEdit className="w-3 h-3" />
                          )}
                          {statusLabel[slot.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenSlot(slot)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                            isFilled
                              ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                              : 'bg-slate-900 text-white hover:bg-slate-700'
                          }`}
                        >
                          {isFilled ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          {isFilled ? 'Koreksi' : 'Isi agenda'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
