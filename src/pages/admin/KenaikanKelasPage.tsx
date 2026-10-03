import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, GraduationCap, RotateCcw } from 'lucide-react';
import type { AcademicYear } from '../../types/schedule';
import { getAcademicYears } from '../../services/scheduleService';
import {
  batalkanKenaikanKelas,
  cekTahunAjaranTujuanBersih,
  getBatchForTahunAjaran,
  getBatchRingkasan,
  getPromotionPreview,
  jalankanKenaikanKelas,
  type BatchRingkasan,
  type PromotionPreview,
  type PromotionResult,
  type RollbackResult,
} from '../../services/promotionService';
import { getKelas } from '../../services/classService';
import type { Kelas } from '../../types';
import { DataTable, StatusBadge, formStyles, type Column } from '../../components/common';
import { PageHeader } from '../../components/admin/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface KenaikanKelasPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface PreviewRow {
  key: string;
  kelasFrom: string;
  kelasTo: string;
  naik: number;
  lulus: number;
  dilewati: number;
  tanpaTujuan: number;
}

/**
 * Kenaikan Kelas.
 *
 * Halaman ini hanya menyiapkan dan memicu. Seluruh penulisan dikerjakan satu
 * fungsi transaksional di server (`agenda.kenaikan_kelas`), sehingga tidak ada
 * keadaan setengah jadi kalau koneksi putus di tengah proses.
 *
 * Pratinjau dihitung di klien supaya admin bisa melihat akibatnya sebelum
 * menekan tombol — bukan sesudahnya.
 */
export const KenaikanKelasPage: React.FC<KenaikanKelasPageProps> = ({ showToast }) => {
  /**
   * Wizard perlu SEMUA kelas, termasuk yang sudah nonaktif: kelas asal bisa saja
   * sudah ditutup sementara siswanya masih tercatat di sana. `useClasses()`
   * sengaja hanya berisi kelas aktif karena ia dipakai untuk dropdown.
   */
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');

  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [tujuan, setTujuan] = useState<{ bersih: boolean; jumlah: number } | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);

  const [result, setResult] = useState<PromotionResult | null>(null);
  const [rollback, setRollback] = useState<RollbackResult | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchRingkasan, setBatchRingkasan] = useState<BatchRingkasan | null>(null);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);
  const [isRollbackConfirmOpen, setIsRollbackConfirmOpen] = useState<boolean>(false);

  // 1. Muat tahun ajaran, lalu pilih bawaan yang masuk akal:
  //    asal = yang ACTIVE, tujuan = DRAFT pertama.
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [list, semuaKelas] = await Promise.all([
          getAcademicYears(),
          getKelas({ includeInactive: true }),
        ]);
        setAcademicYears(list);
        setClasses(semuaKelas);
        setFromId(list.find((a) => a.status === 'ACTIVE')?.id ?? list[0]?.id ?? '');
        setToId(list.find((a) => a.status === 'DRAFT')?.id ?? '');
      } catch (err: any) {
        showToast('error', 'Gagal memuat tahun ajaran. ' + (err?.message || ''));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [showToast]);

  const labelOf = useCallback(
    (id: string) => academicYears.find((a) => a.id === id)?.name ?? '—',
    [academicYears],
  );

  const tahunAjaranTujuan = useMemo(
    () => academicYears.find((a) => a.id === toId),
    [academicYears, toId],
  );

  // 2. Pratinjau + pemeriksaan kebersihan TA tujuan.
  const muatPratinjau = useCallback(async () => {
    if (!fromId || !toId || fromId === toId) {
      setPreview(null);
      setTujuan(null);
      return;
    }
    setIsPreviewing(true);
    try {
      const [p, cek, batch] = await Promise.all([
        getPromotionPreview(fromId, classes),
        cekTahunAjaranTujuanBersih(toId),
        getBatchForTahunAjaran(toId),
      ]);
      setPreview(p);
      setTujuan(cek);
      setBatchId(batch);
      // Dimuat supaya dialog pembatalan bisa menyebut angka, bukan kalimat umum.
      setBatchRingkasan(batch ? await getBatchRingkasan(batch) : null);
    } catch (err: any) {
      setPreview(null);
      setTujuan(null);
      showToast('error', 'Gagal menghitung pratinjau. ' + (err?.message || ''));
    } finally {
      setIsPreviewing(false);
    }
  }, [fromId, toId, classes, showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await muatPratinjau();
    })();
    return () => {
      cancelled = true;
    };
  }, [muatPratinjau]);

  const rows: PreviewRow[] = useMemo(
    () =>
      (preview?.rows ?? []).map((r) => ({
        key: r.kelasFrom.id,
        kelasFrom: r.kelasFrom.label,
        kelasTo: r.kelasFrom.tingkat >= 6 ? 'LULUS' : (r.kelasTo?.label ?? '—'),
        naik: r.naik,
        lulus: r.lulus,
        dilewati: r.dilewati,
        tanpaTujuan: r.tanpaTujuan,
      })),
    [preview],
  );

  const adaKelasTujuanHilang = (preview?.kelasTujuanHilang.length ?? 0) > 0;
  const adaSiswaTanpaKelasSumber = (preview?.siswaTanpaKelasSumber ?? 0) > 0;
  const adaSiswa = (preview?.totalNaik ?? 0) + (preview?.totalLulus ?? 0) > 0;
  const bolehJalankan =
    Boolean(fromId) &&
    Boolean(toId) &&
    fromId !== toId &&
    tahunAjaranTujuan?.status === 'DRAFT' &&
    tujuan?.bersih === true &&
    !adaKelasTujuanHilang &&
    !adaSiswaTanpaKelasSumber &&
    adaSiswa &&
    !isRunning;

  const handleJalankan = async () => {
    setIsConfirmOpen(false);
    setIsRunning(true);
    try {
      const res = await jalankanKenaikanKelas(fromId, toId);
      setResult(res);
      setRollback(null);
      setBatchId(res.batch_id);
      showToast(
        'success',
        `Kenaikan kelas selesai: ${res.naik} siswa naik, ${res.lulus} lulus.`,
      );
      await muatPratinjau();
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal menjalankan kenaikan kelas.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleRollback = async () => {
    setIsRollbackConfirmOpen(false);
    if (!batchId) return;
    setIsRollingBack(true);
    try {
      const res = await batalkanKenaikanKelas(batchId);
      setRollback(res);
      setResult(null);
      setBatchId(null);
      showToast('success', `Kenaikan kelas dibatalkan: ${res.penempatan_dihapus} penempatan dihapus.`);
      await muatPratinjau();
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal membatalkan kenaikan kelas.');
    } finally {
      setIsRollingBack(false);
    }
  };

  const columns: Column<PreviewRow>[] = [
    {
      key: 'kelasFrom',
      header: 'Kelas Asal',
      width: '120px',
      align: 'left',
      accessor: (r) => <span className="font-semibold text-slate-900">{r.kelasFrom}</span>,
    },
    {
      key: 'arrow',
      header: '',
      width: '40px',
      align: 'center',
      accessor: () => <ArrowRight className="w-3.5 h-3.5 text-slate-400 mx-auto" />,
    },
    {
      key: 'kelasTo',
      header: 'Kelas Tujuan',
      width: '120px',
      align: 'left',
      accessor: (r) => (
        <span
          className={
            r.tanpaTujuan > 0
              ? 'font-semibold text-rose-700'
              : 'font-semibold text-slate-900'
          }
        >
          {r.kelasTo}
        </span>
      ),
    },
    {
      key: 'naik',
      header: 'Naik',
      width: '80px',
      align: 'center',
      accessor: (r) => <span className="text-emerald-700 font-semibold">{r.naik || '—'}</span>,
    },
    {
      key: 'lulus',
      header: 'Lulus',
      width: '80px',
      align: 'center',
      accessor: (r) => <span className="text-blue-700 font-semibold">{r.lulus || '—'}</span>,
    },
    {
      key: 'dilewati',
      header: 'Dilewati',
      width: '90px',
      align: 'center',
      accessor: (r) => (
        <span className="text-slate-500 font-semibold" title="Statusnya bukan Aktif">
          {r.dilewati || '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kenaikan Kelas"
        description="Naikkan seluruh siswa satu tingkat sekaligus, dan salin penugasan wali kelas ke tahun ajaran baru."
      />

      {/* Langkah 1 — pilih tahun ajaran */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">1. Pilih tahun ajaran</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="promo-from" className="text-xs text-slate-600 font-semibold">
              Tahun ajaran asal
            </label>
            <select
              id="promo-from"
              value={fromId}
              disabled={isLoading || isRunning}
              onChange={(e) => setFromId(e.target.value)}
              className={formStyles.select}
            >
              <option value="">— pilih —</option>
              {academicYears.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="promo-to" className="text-xs text-slate-600 font-semibold">
              Tahun ajaran tujuan
            </label>
            <select
              id="promo-to"
              value={toId}
              disabled={isLoading || isRunning}
              onChange={(e) => setToId(e.target.value)}
              className={formStyles.select}
            >
              <option value="">— pilih —</option>
              {academicYears.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Tahun ajaran tujuan harus berstatus <strong>DRAFT</strong> dan belum dipakai. Buat dulu
          di halaman <strong>Tahun Ajaran</strong> kalau belum ada.
        </p>
      </div>

      {/* Peringatan yang menghalangi eksekusi */}
      {tahunAjaranTujuan && tahunAjaranTujuan.status !== 'DRAFT' && (
        <Peringatan tone="merah">
          Tahun ajaran tujuan berstatus <strong>{tahunAjaranTujuan.status}</strong>, bukan DRAFT.
          Kenaikan kelas tidak bisa dijalankan ke tahun ajaran yang sudah aktif atau diarsipkan.
        </Peringatan>
      )}

      {/*
        Pembatalan hanya diblokir oleh tahun ajaran yang SEDANG AKTIF — DRAFT dan
        ARCHIVED sama-sama boleh. Ini penting: tahun ajaran menjadi ARCHIVED secara
        otomatis begitu admin mengaktifkan tahun lain, jadi kalau pembatalan
        dikunci ke DRAFT saja, jendelanya tertutup oleh tindakan yang tidak ada
        hubungannya dengan kenaikan kelas.
      */}
      {batchId && tahunAjaranTujuan?.status === 'ACTIVE' && (
        <Peringatan tone="merah">
          Tahun ajaran tujuan sedang <strong>AKTIF</strong>, jadi datanya mungkin sudah dipakai.
          Aktifkan tahun ajaran lain dulu — tahun ini akan otomatis diarsipkan — baru kenaikan
          kelasnya bisa dibatalkan.
        </Peringatan>
      )}

      {tujuan && !tujuan.bersih && (
        <Peringatan tone="merah">
          Tahun ajaran tujuan belum bersih — ada <strong>{tujuan.jumlah}</strong> baris penempatan
          atau wali kelas di dalamnya. {batchId
            ? 'Batalkan kenaikan kelas sebelumnya dulu lewat tombol di bawah.'
            : 'Kosongkan dulu tahun ajaran itu sebelum dipakai.'}
        </Peringatan>
      )}

      {adaKelasTujuanHilang && (
        <Peringatan tone="merah">
          Kelas tujuan <strong>{preview!.kelasTujuanHilang.join(', ')}</strong> belum ada — atau
          sudah dinonaktifkan — di master data. Tambahkan dulu di halaman{' '}
          <strong>Data Kelas</strong>. Wizard tidak membuat kelas baru sendiri supaya master data
          tetap satu pintu.
        </Peringatan>
      )}

      {adaSiswaTanpaKelasSumber && (
        <Peringatan tone="merah">
          Ada <strong>{preview!.siswaTanpaKelasSumber}</strong> siswa yang kelasnya tidak dikenali
          sama sekali. Mereka akan dilewati tanpa muncul di pratinjau di bawah, jadi periksa dulu
          penempatannya di halaman <strong>Data Siswa</strong> sebelum melanjutkan.
        </Peringatan>
      )}

      {/* Langkah 2 — pratinjau */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">2. Periksa akibatnya</h2>
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={(r) => r.key}
          isLoading={isLoading || isPreviewing}
          emptyTitle="Belum ada yang bisa dinaikkan"
          emptyDescription={
            fromId && toId
              ? 'Tahun ajaran asal belum punya penempatan siswa, atau tahun ajaran belum dipilih.'
              : 'Pilih tahun ajaran asal dan tujuan di atas.'
          }
          enablePagination={false}
        />

        {preview && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge
              status={`${preview.totalNaik} siswa naik`}
              label={`${preview.totalNaik} naik`}
            />
            <StatusBadge
              status={`${preview.totalLulus} lulus`}
              label={`${preview.totalLulus} lulus`}
            />
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">
              {preview.totalDilewati} dilewati (status bukan Aktif)
            </span>
          </div>
        )}
      </div>

      {/* Langkah 3 — jalankan */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">3. Jalankan</h2>
        <p className="text-xs text-slate-500">
          Seluruh proses berjalan dalam satu transaksi di server. Kalau ada yang gagal, tidak ada
          yang tersimpan setengah.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!bolehJalankan}
            onClick={() => setIsConfirmOpen(true)}
            className={`${formStyles.primaryBtn} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            {isRunning ? 'Menjalankan…' : 'Jalankan Kenaikan Kelas'}
          </button>

          {batchId && (
            <button
              type="button"
              disabled={isRollingBack}
              onClick={() => setIsRollbackConfirmOpen(true)}
              className={`${formStyles.ghostBtn} text-rose-700`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isRollingBack ? 'Membatalkan…' : 'Batalkan kenaikan ini'}
            </button>
          )}
        </div>
      </div>

      {/* Hasil */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Kenaikan kelas selesai
          </h2>
          <ul className="text-xs text-emerald-900 space-y-0.5">
            <li>{result.naik} siswa mendapat penempatan di tahun ajaran baru</li>
            <li>{result.lulus} siswa tingkat 6 ditandai Lulus</li>
            <li>{result.dilewati} siswa dilewati karena statusnya bukan Aktif</li>
            <li>{result.wali_kelas} penugasan wali kelas disalin</li>
          </ul>
          <p className="text-xs text-emerald-800 pt-1">
            Langkah berikutnya: periksa wali kelas di halaman <strong>Wali Kelas</strong>, lalu
            aktifkan tahun ajaran barunya di halaman <strong>Tahun Ajaran</strong>. Setelah
            diaktifkan, kenaikan ini tidak bisa dibatalkan lagi.
          </p>
        </div>
      )}

      {rollback && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
          <h2 className="text-sm font-semibold text-slate-800">Kenaikan kelas dibatalkan</h2>
          <p className="text-xs text-slate-600">
            {rollback.penempatan_dihapus} penempatan dihapus, {rollback.status_dikembalikan} status
            siswa dikembalikan, {rollback.wali_dihapus} penugasan wali kelas dihapus.
          </p>
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleJalankan}
        isLoading={isRunning}
        title="Jalankan kenaikan kelas?"
        message={
          `Seluruh siswa aktif dari ${labelOf(fromId)} akan ditempatkan ke ${labelOf(toId)}, ` +
          `siswa tingkat 6 ditandai Lulus, dan penugasan wali kelas disalin. ` +
          `Pastikan tahun ajaran tujuan masih kosong.`
        }
        confirmText="Jalankan"
      />

      <ConfirmDialog
        isOpen={isRollbackConfirmOpen}
        onClose={() => setIsRollbackConfirmOpen(false)}
        onConfirm={handleRollback}
        isLoading={isRollingBack}
        title="Batalkan kenaikan kelas?"
        message={
          batchRingkasan
            ? `Kenaikan kelas ke ${batchRingkasan.tahunTujuan} akan dibatalkan: ` +
              `${batchRingkasan.naik} penempatan siswa dihapus, ` +
              `${batchRingkasan.lulus} siswa yang ditandai Lulus dikembalikan menjadi Aktif, ` +
              `dan seluruh penugasan wali kelas di tahun itu dihapus. ` +
              `Tindakan ini tidak bisa dibatalkan.`
            : 'Seluruh penempatan dan penugasan wali kelas yang dibuat proses ini akan dihapus, dan status siswa yang ditandai Lulus dikembalikan menjadi Aktif.'
        }
        confirmText="Batalkan"
      />
    </div>
  );
};

const Peringatan: React.FC<{ tone: 'merah'; children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900">
    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
    <p>{children}</p>
  </div>
);
