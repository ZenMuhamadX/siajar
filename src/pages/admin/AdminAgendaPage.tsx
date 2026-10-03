import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { localDateString } from '../../utils/date';
import { useAgendaDateParam, useAgendaSlotParam } from '../../routes/useAgendaQuery';
import { type FullAgenda, type Guru } from '../../types';
import { useClassLabels } from '../../contexts/ClassContext';
import { getDaftarGuru } from '../../services/agendaService';
import {
  getSchoolDailyTimelineForDate,
  type TimelineSlot,
} from '../../services/scheduleDetectionService';
import { AgendaDetailForm } from '../../components/agenda/AgendaDetailForm';
import { PageHeader } from '../../components/admin/PageHeader';
import { DataTable, FilterBar, StatusBadge, type Column } from '../../components/common';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Edit3,
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
  // Sumber kelas: master data, bukan konstanta hardcoded.
  const kelasLabels = useClassLabels();

  const todayStr = localDateString();

  // Tanggal & form isian kini diturunkan dari URL (`?date=` / `?slot=`) supaya
  // refresh, tombol Back, dan link yang dibuka di tab baru tetap membuka
  // tampilan yang sama. Lihat src/routes/useAgendaQuery.ts.
  const { date: selectedDate, setDate } = useAgendaDateParam(
    editData?.header.tanggal || todayStr,
    editData?.header.tanggal || null
  );
  const { slotId, openSlot, closeSlot } = useAgendaSlotParam();

  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [reason, setReason] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  /** Tanggal yang benar-benar sudah dimuat — penanda daftar slot sudah "settle". */
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const strippedSlotRef = useRef<string | null>(null);
  const [daftarGuru, setDaftarGuru] = useState<Guru[]>([]);
  const [filterGuru, setFilterGuru] = useState('SEMUA');
  const [filterKelas, setFilterKelas] = useState('SEMUA');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('SEMUA');

  useEffect(() => {
    getDaftarGuru()
      .then(setDaftarGuru)
      .catch(() => {
        showToast('error', 'Gagal memuat daftar guru.');
      });
  }, [showToast]);

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
      setLoadedDate(selectedDate);
    }
  }, [selectedDate, showToast]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // ------------------------------------------------------------------ //
  // Turunan dari URL — tanpa duplikasi state lokal                       //
  // ------------------------------------------------------------------ //

  /** Slot yang dibuka lewat `?slot=`. */
  const resolvedSlot = useMemo(
    () => (slotId ? (slots.find((s) => s.schedule.id === slotId) ?? null) : null),
    [slotId, slots]
  );

  /**
   * Konteks jadwal untuk mode `?edit=` — dulu efek + state lokal `selectedSlot`,
   * kini turunan murni dari slots yang sudah dimuat.
   */
  const editSlot = useMemo(() => {
    if (!editData || slots.length === 0) return null;
    const scheduleId = editData.header.schedule_id;
    return (
      slots.find((s) =>
        scheduleId
          ? s.schedule.id === scheduleId
          : s.existingAgenda?.header.id === editData.header.id
      ) ?? null
    );
  }, [editData, slots]);

  const selectedSlot = resolvedSlot ?? editSlot;
  /** `?edit=` menang; selain itu agenda yang sudah terisi ikut terbuka. */
  const directEdit = editData ?? resolvedSlot?.existingAgenda ?? null;
  const isFormOpen = Boolean(directEdit || resolvedSlot);

  /** Daftar slot sudah menampilkan data untuk tanggal yang diminta URL. */
  const slotsSettled = !isLoading && loadedDate === selectedDate;

  // Buang `?slot=` yang tidak bisa dipakai: `?edit=` selalu menang, atau link
  // basi / tanggalnya tidak punya jadwal. Setelah dibuang kondisi di atas jadi
  // false sehingga efek ini berhenti — aman dijalankan dua kali oleh StrictMode.
  useEffect(() => {
    if (!slotId) {
      strippedSlotRef.current = null;
      return;
    }
    if (editData) {
      closeSlot();
      return;
    }
    if (!slotsSettled || resolvedSlot) return;
    if (strippedSlotRef.current === slotId) return;
    strippedSlotRef.current = slotId;
    showToast('info', 'Slot jadwal tidak ditemukan pada tanggal ini (tautan mungkin sudah kedaluwarsa).');
    closeSlot();
  }, [slotId, editData, slotsSettled, resolvedSlot, showToast, closeSlot]);

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
    setDate(date); // tulis ?date= (replace) dan buang ?slot=
  };

  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    handleSetDate(localDateString(d));
  };

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (filterGuru !== 'SEMUA' && slot.schedule.teacher_name !== filterGuru) return false;
      if (filterKelas !== 'SEMUA' && slot.schedule.kelas !== filterKelas) return false;
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
    openSlot(slot.schedule.id, selectedDate); // push: ?slot=<id>&date=<tanggal>
  };

  const handleCloseForm = () => {
    closeSlot(); // buang ?slot= (replace), ?date= tetap
    onCancelEdit?.(); // buang ?edit= — no-op bila bukan mode edit
  };

  const handleSuccessSave = () => {
    handleCloseForm();
    fetchSlots();
  };

  const isFiltered =
    filterGuru !== 'SEMUA' || filterKelas !== 'SEMUA' || filterStatus !== 'SEMUA';

  const handleResetFilters = () => {
    setFilterGuru('SEMUA');
    setFilterKelas('SEMUA');
    setFilterStatus('SEMUA');
  };

  // Kondisi khusus (akhir pekan / belum ada TA aktif) -> ditampilkan sebagai EmptyState khusus
  const notice =
    reason === 'WEEKEND'
      ? {
          icon: <Coffee className="w-6 h-6 text-amber-500" />,
          title: 'Akhir pekan',
          description: 'Tidak ada jadwal reguler pada Sabtu/Minggu.',
        }
      : reason === 'NO_ACTIVE_ACADEMIC_YEAR'
        ? {
            icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
            title: 'Belum ada tahun ajaran aktif',
            description: 'Aktifkan tahun ajaran di menu Pengaturan.',
          }
        : null;

  const columns: Column<TimelineSlot>[] = [
    {
      key: 'waktu',
      header: 'Waktu',
      align: 'left',
      accessor: (slot) => (
        <div className="font-mono text-slate-700 whitespace-nowrap">
          {slot.schedule.start_time.slice(0, 5)} – {slot.schedule.end_time.slice(0, 5)}
          <span className="block text-xs text-slate-600 font-sans">
            JP {slot.schedule.period_number}
          </span>
        </div>
      ),
    },
    {
      key: 'kelas',
      header: 'Kelas',
      align: 'left',
      accessor: (slot) => (
        <span className="font-semibold text-slate-900 whitespace-nowrap">
          {slot.schedule.kelas}
        </span>
      ),
    },
    {
      key: 'mapel',
      header: 'Mapel',
      align: 'left',
      accessor: (slot) => <span className="text-slate-800">{slot.schedule.subject_name}</span>,
    },
    {
      key: 'guru',
      header: 'Guru',
      align: 'left',
      accessor: (slot) => <span className="text-slate-600">{slot.schedule.teacher_name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'left',
      accessor: (slot) => <StatusBadge status={slot.status} label={statusLabel[slot.status]} />,
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      accessor: (slot) => {
        const isFilled = slot.status === 'COMPLETED';
        return (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => handleOpenSlot(slot)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                isFilled
                  ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {isFilled ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {isFilled ? 'Koreksi' : 'Isi agenda'}
            </button>
          </div>
        );
      },
    },
  ];

  if (isFormOpen) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-primary-900">Mode administrator</p>
            <p className="text-xs text-primary-800 mt-0.5">
              Mengisi / mengoreksi agenda atas nama{' '}
              <strong>{teacherNameForForm}</strong>
              {selectedSlot ? ` · ${selectedSlot.schedule.kelas}` : directEdit ? ` · ${directEdit.header.kelas}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseForm}
            className="self-start text-xs font-semibold text-primary-700 hover:text-primary-900 px-3 py-1.5 rounded-lg border border-primary-200 bg-white"
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
          <p className="text-xs font-medium text-slate-500">Slot jadwal</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{slots.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Sudah diisi</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{filledCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Belum diisi</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{emptyCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Tanggal</p>
          <p className="text-sm font-bold text-slate-900 mt-2 leading-snug">{formatDateIndo(selectedDate)}</p>
        </div>
      </div>

      {/* Toolbar standar: navigasi tanggal + filter kelas/guru/status */}
      <FilterBar
        isFiltered={isFiltered}
        onResetFilters={handleResetFilters}
        filters={
          <>
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                aria-label="Hari sebelumnya"
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
                  className="text-xs font-bold text-slate-800 bg-transparent border-none cursor-pointer"
                />
              </div>
              <button
                aria-label="Hari berikutnya"
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
                  className="ml-1 px-2.5 py-1 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Hari ini
                </button>
              )}
            </div>

            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="SEMUA">Semua kelas</option>
              {kelasLabels.map((k) => (
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
          </>
        }
      />

      {/* Satu DataTable: loading, empty (akhir pekan/TA/filter), dan tabel slot */}
      <DataTable
        title="Slot Agenda Harian"
        subtitle={
          isLoading
            ? 'Memuat jadwal harian...'
            : `${filteredSlots.length} dari ${slots.length} slot ditampilkan`
        }
        columns={columns}
        data={notice ? [] : filteredSlots}
        keyExtractor={(slot) => slot.schedule.id}
        isLoading={isLoading}
        isFiltered={notice ? false : isFiltered}
        onResetFilter={handleResetFilters}
        emptyIcon={notice?.icon}
        emptyTitle={
          notice?.title ?? (isFiltered ? 'Tidak ada slot sesuai filter' : 'Belum ada slot jadwal')
        }
        emptyDescription={
          notice?.description ??
          (isFiltered
            ? 'Ubah tanggal atau filter kelas/guru.'
            : 'Tidak ada jadwal reguler untuk tanggal yang dipilih.')
        }
        enablePagination
        defaultPageSize={25}
      />
    </div>
  );
};
