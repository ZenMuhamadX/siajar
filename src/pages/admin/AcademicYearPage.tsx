import React, { useState, useEffect } from 'react';
import type { AcademicYear, AcademicYearStatus } from '../../types/schedule';
import {
  getAcademicYears,
  createAcademicYear,
  setActiveAcademicYear,
  archiveAcademicYear,
  hapusTahunAjaran,
  cekIsiTahunAjaran,
  type IsiTahunAjaran,
} from '../../services/scheduleService';
import { PageHeader } from '../../components/admin/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  DataTable,
  StatusBadge,
  FormModal,
  FormField,
  TextInput,
  SelectInput,
  formStyles,
  type Column,
} from '../../components/common';
import {
  Plus,
  CheckCircle2,
  Archive,
  RefreshCw,
  CalendarCheck,
  Trash2,
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

  // Dialog konfirmasi (menggantikan confirm() bawaan browser)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'archive' | 'delete';
    ay: AcademicYear;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  /**
   * Isi tahun ajaran yang sedang diperiksa untuk dihapus. `null` = masih memeriksa.
   *
   * Diperiksa lebih dulu supaya dialognya bisa menjelaskan APA yang menghalangi,
   * bukan membiarkan pengguna menekan tombol yang pasti gagal.
   */
  const [isiTahunAjaran, setIsiTahunAjaran] = useState<IsiTahunAjaran | null>(null);

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

  const handleActivate = (ay: AcademicYear) => {
    if (ay.status === 'ACTIVE') return;
    setConfirmAction({ type: 'activate', ay });
  };

  const handleArchive = (ay: AcademicYear) => {
    if (ay.status === 'ARCHIVED') return;
    setConfirmAction({ type: 'archive', ay });
  };

  /**
   * Menghapus tahun ajaran. Isinya diperiksa lebih dulu — kalau belum kosong,
   * dialognya menjelaskan apa yang menghalangi alih-alih membiarkan tombolnya
   * ditekan lalu gagal.
   */
  const handleDelete = async (ay: AcademicYear) => {
    setConfirmAction({ type: 'delete', ay });
    setIsiTahunAjaran(null);
    try {
      setIsiTahunAjaran(await cekIsiTahunAjaran(ay.id));
    } catch (err: any) {
      showToast('error', 'Gagal memeriksa isi tahun ajaran: ' + (err?.message || ''));
      setConfirmAction(null);
    }
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, ay } = confirmAction;
    setIsConfirming(true);
    try {
      if (type === 'activate') {
        await setActiveAcademicYear(ay.id);
        showToast('success', `Tahun ajaran ${ay.name} sekarang ACTIVE.`);
      } else if (type === 'archive') {
        await archiveAcademicYear(ay.id);
        showToast('info', `Tahun ajaran ${ay.name} diarsipkan.`);
      } else {
        await hapusTahunAjaran(ay.id);
        showToast('success', `Tahun ajaran ${ay.name} dihapus.`);
      }
      setConfirmAction(null);
      setIsiTahunAjaran(null);
      fetchYears();
    } catch (err: any) {
      const aksi =
        type === 'activate'
          ? 'mengaktifkan tahun ajaran'
          : type === 'archive'
            ? 'mengarsipkan tahun ajaran'
            : 'menghapus tahun ajaran';
      showToast('error', `Gagal ${aksi}: ` + (err?.message || ''));
    } finally {
      setIsConfirming(false);
    }
  };

  const activeAY = academicYears.find((y) => y.status === 'ACTIVE');

  /**
   * Isi dialog konfirmasi. Dihitung di luar JSX supaya tiga cabangnya tidak
   * berubah menjadi terner bersarang yang sulit dibaca.
   */
  const dialog = (() => {
    if (!confirmAction) return null;
    const { type, ay } = confirmAction;

    if (type === 'activate') {
      return {
        variant: 'warning' as const,
        title: 'Aktifkan Tahun Ajaran?',
        message: `Aktifkan Tahun Ajaran "${ay.name}"? Tahun ajaran yang saat ini aktif akan otomatis diarsipkan.`,
        confirmText: 'Aktifkan',
        disabled: false,
        reason: undefined as string | undefined,
      };
    }

    if (type === 'archive') {
      return {
        variant: 'danger' as const,
        title: 'Arsipkan Tahun Ajaran?',
        message: `Arsipkan Tahun Ajaran "${ay.name}"? Data historis tetap tersimpan.`,
        confirmText: 'Arsipkan',
        disabled: false,
        reason: undefined as string | undefined,
      };
    }

    const kosong = isiTahunAjaran?.kosong === true;
    const rincian = (isiTahunAjaran?.rincian ?? [])
      .map((r) => `${r.jumlah} ${r.label}`)
      .join(', ');

    return {
      variant: 'danger' as const,
      title: 'Hapus Tahun Ajaran?',
      message:
        isiTahunAjaran === null
          ? `Memeriksa isi tahun ajaran "${ay.name}"…`
          : kosong
            ? `Tahun ajaran "${ay.name}" kosong dan akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`
            : `Tahun ajaran "${ay.name}" belum kosong — ada ${rincian}. Batalkan kenaikan kelas dan kosongkan isinya dulu, atau arsipkan saja. Tahun ajaran yang sudah dipakai tidak boleh dihapus karena riwayat agenda dan absensinya ikut hilang.`,
      confirmText: 'Hapus',
      disabled: !kosong,
      reason: kosong ? undefined : 'Tahun ajaran ini belum kosong',
    };
  })();

  const columns: Column<AcademicYear>[] = [
    {
      key: 'name',
      header: 'Tahun Ajaran',
      align: 'left',
      accessor: (ay) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-sm">{ay.name}</span>
          {ay.status === 'ACTIVE' && (
            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
              Aktif Sekarang
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'start_date',
      header: 'Tanggal Mulai',
      align: 'center',
      width: '140px',
      accessor: (ay) => (
        <span className="font-mono text-slate-600 whitespace-nowrap">{ay.start_date}</span>
      ),
    },
    {
      key: 'end_date',
      header: 'Tanggal Selesai',
      align: 'center',
      width: '140px',
      accessor: (ay) => (
        <span className="font-mono text-slate-600 whitespace-nowrap">{ay.end_date}</span>
      ),
    },
    {
      key: 'keterangan',
      header: 'Keterangan',
      align: 'left',
      accessor: (ay) => (
        <span className="text-slate-500">
          {ay.status === 'ACTIVE'
            ? 'Sedang berjalan sebagai TA aktif'
            : ay.status === 'ARCHIVED'
            ? 'Arsip historis'
            : 'Draf persiapan'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '130px',
      accessor: (ay) => <StatusBadge status={ay.status} />,
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      width: '200px',
      accessor: (ay) => {
        const isActive = ay.status === 'ACTIVE';
        const isArchived = ay.status === 'ARCHIVED';
        return (
          <div className="flex items-center justify-end gap-1.5">
            {!isActive && (
              <button
                type="button"
                onClick={() => handleActivate(ay)}
                className="px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Aktifkan</span>
              </button>
            )}
            {!isArchived && !isActive && (
              <button
                type="button"
                onClick={() => handleArchive(ay)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 border border-slate-200"
              >
                <Archive className="w-3.5 h-3.5 text-slate-500" />
                <span>Arsipkan</span>
              </button>
            )}
            {/* Hapus hanya masuk akal untuk tahun ajaran yang belum dipakai.
                Tahun ajaran aktif tidak boleh dihapus sama sekali. */}
            {!isActive && (
              <button
                type="button"
                onClick={() => handleDelete(ay)}
                aria-label={`Hapus tahun ajaran ${ay.name}`}
                title="Hapus tahun ajaran — hanya bisa kalau belum berisi data"
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tahun Ajaran"
        description="Kelola siklus tahun ajaran sekolah dan status aktif untuk pembelajaran."
        action={
          <div className="flex items-center gap-2">
            <button
              aria-label="Refresh"
              onClick={fetchYears}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
             <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tahun Ajaran</span>
            </button>
          </div>
        }
      />

      {/* Active banner summary (KPI / Summary Card) */}
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
                <StatusBadge status="ACTIVE" size="sm" />
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

      {/* Standard Table of Academic Years */}
      <DataTable
        title="Daftar Tahun Ajaran"
        subtitle={`Total ${academicYears.length} tahun ajaran terdaftar`}
        columns={columns}
        data={academicYears}
        keyExtractor={(ay) => ay.id}
        isLoading={isLoading}
        emptyTitle="Belum ada tahun ajaran"
        emptyDescription='Klik tombol "Tambah Tahun Ajaran" untuk memulai.'
        rowClassName={(ay) => (ay.status === 'ACTIVE' ? 'bg-emerald-50/30' : '')}
        enablePagination
        defaultPageSize={10}
      />

      {/* Modal Add Academic Year — FormModal (scroll-safe) */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Tahun Ajaran Baru"
        subtitle="Tahun ajaran aktif dipakai untuk seluruh agenda, jadwal, dan rekap."
        onSubmit={handleCreate}
        busy={isSubmitting}
        footer={(formId) => (
          <>
            <span />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={formStyles.ghostBtn}
              >
                Batal
              </button>
              <button
                type="submit"
                form={formId}
                disabled={isSubmitting}
                className={formStyles.primaryBtn}
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Tahun Ajaran'}
              </button>
            </div>
          </>
        )}
      >
        <div className="p-5 space-y-3.5">
          <FormField
            label="Nama Tahun Ajaran"
            htmlFor="ta-nama"
            hint="contoh: 2026/2027"
            required
          >
            <TextInput
              id="ta-nama"
              type="text"
              required
              autoFocus
              placeholder="2026/2027"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tanggal Mulai" htmlFor="ta-mulai" required>
              <TextInput
                id="ta-mulai"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>
            <FormField label="Tanggal Selesai" htmlFor="ta-selesai" required>
              <TextInput
                id="ta-selesai"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Status Awal" htmlFor="ta-status" required>
            <SelectInput
              id="ta-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AcademicYearStatus)}
            >
              <option value="DRAFT">DRAFT (Dalam persiapan)</option>
              <option value="ACTIVE">ACTIVE (Langsung aktifkan)</option>
            </SelectInput>
          </FormField>
        </div>
      </FormModal>

      {/* Dialog konfirmasi aktifkan / arsipkan / hapus */}
      <ConfirmDialog
        isOpen={Boolean(dialog)}
        onClose={() => {
          setConfirmAction(null);
          setIsiTahunAjaran(null);
        }}
        onConfirm={runConfirmAction}
        isLoading={isConfirming}
        variant={dialog?.variant ?? 'danger'}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmText={dialog?.confirmText}
        confirmDisabled={dialog?.disabled ?? false}
        confirmDisabledReason={dialog?.reason}
      />
    </div>
  );
};
