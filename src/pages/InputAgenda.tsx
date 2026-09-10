import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DAFTAR_KELAS,
  getScheduleSlotsForDate,
  type KelasOption,
  type AgendaKBM,
  type Siswa,
  type Guru,
  type MataPelajaran,
  type FullAgenda,
} from '../types';
import {
  getDaftarSiswa,
  getDaftarGuru,
  getDaftarMapel,
  simpanAgenda,
  checkGuruKelas,
  getRekapAgenda,
} from '../services/agendaService';
import {
  uploadAgendaEvidence,
  deleteAgendaEvidence,
  getEvidenceSignedUrl,
} from '../services/evidenceService';
import { PhotoLightboxModal } from '../components/PhotoLightboxModal';
import type { AgendaEvidence } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Trash2,
  Save,
  Check,
  Loader2,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  X,
  Camera,
  Image as ImageIcon,
  Eye,
  RefreshCw,
} from 'lucide-react';

const DRAFT_KEY = 'sdit_agenda_draft';

interface DraftData {
  kelas: KelasOption;
  tanggal: string;
  kbmRows: AgendaKBM[];
  absensiList: AbsensiInputItem[];
  uraianKejadian: string;
  savedAt: string;
}

function saveDraft(data: Omit<DraftData, 'savedAt'>) {
  const draft: DraftData = { ...data, savedAt: new Date().toISOString() };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

interface InputAgendaProps {
  editData?: FullAgenda | null;
  onCancelEdit?: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface AbsensiInputItem {
  siswa_id: string;
  status: 'S' | 'I' | 'A';
}

export const InputAgenda: React.FC<InputAgendaProps> = ({
  editData,
  onCancelEdit,
  onSuccess,
  showToast,
}) => {
  const { activeTeacherName } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  const draft = useRef(editData ? null : loadDraft());
  const [kelas, setKelas] = useState<KelasOption>(
    editData?.header.kelas as KelasOption || draft.current?.kelas || 'KELAS 1'
  );
  const [tanggal, setTanggal] = useState<string>(
    editData?.header.tanggal || draft.current?.tanggal || todayStr
  );

  const [kbmRows, setKbmRows] = useState<AgendaKBM[]>(
    editData
      ? editData.kbm.map((k) => ({
          jam_ke: k.jam_ke,
          nama_guru: k.nama_guru,
          mapel: k.mapel,
          materi: k.materi,
          tugas_pr: k.tugas_pr || '',
          is_badal: Boolean(k.is_badal),
        }))
      : draft.current?.kbmRows || [
          {
            jam_ke: '1-2',
            nama_guru: activeTeacherName || '',
            mapel: '',
            materi: '',
            tugas_pr: '',
            is_badal: false,
          },
          {
            jam_ke: '3-4',
            nama_guru: activeTeacherName || '',
            mapel: '',
            materi: '',
            tugas_pr: '',
            is_badal: false,
          },
        ]
  );

  const [absensiList, setAbsensiList] = useState<AbsensiInputItem[]>(
    editData
      ? editData.absensi.map((a) => ({
          siswa_id: a.siswa_id,
          status: a.status,
        }))
      : draft.current?.absensiList || []
  );
  const [uraianKejadian, setUraianKejadian] = useState<string>(
    editData
      ? editData.kejadian?.[0]?.uraian_kejadian || ''
      : draft.current?.uraianKejadian || ''
  );

  const [siswaKelas, setSiswaKelas] = useState<Siswa[]>([]);
  const [daftarGuru, setDaftarGuru] = useState<Guru[]>([]);
  const [daftarMapel, setDaftarMapel] = useState<MataPelajaran[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(!!draft.current && !editData);

  // Mobile state UX
  const [expandedPrRows, setExpandedPrRows] = useState<Record<number, boolean>>({});
  const [showKejadian, setShowKejadian] = useState<boolean>(() => {
    return Boolean(
      (editData?.kejadian?.[0]?.uraian_kejadian && editData.kejadian[0].uraian_kejadian.trim()) ||
        (draft.current?.uraianKejadian && draft.current.uraianKejadian.trim())
    );
  });

  // Status Guru Pengampu vs Badal
  const [isGuruResmiKelas, setIsGuruResmiKelas] = useState<boolean>(true);
  const [isBadalChecked, setIsBadalChecked] = useState<boolean>(false);
  const [isValidatingGuru, setIsValidatingGuru] = useState<boolean>(false);

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerDraftSave = useCallback(() => {
    if (editData) return; // Don't overwrite draft if editing existing agenda
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft({ kelas, tanggal, kbmRows, absensiList, uraianKejadian });
      setDraftSaved(true);
    }, 400);
  }, [kelas, tanggal, kbmRows, absensiList, uraianKejadian, editData]);

  useEffect(() => {
    triggerDraftSave();
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [triggerDraftSave]);

  // Load Guru & Mapel list
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [guruData, mapelData] = await Promise.all([
          getDaftarGuru(),
          getDaftarMapel(),
        ]);
        setDaftarGuru(guruData);
        setDaftarMapel(mapelData);
      } catch (err) {
        console.warn('Gagal memuat data master:', err);
      }
    }
    loadMasterData();
  }, []);

  // Check Guru Kelas validation
  useEffect(() => {
    async function validateTeacher() {
      if (!activeTeacherName || activeTeacherName === 'Administrator') {
        setIsGuruResmiKelas(true);
        return;
      }
      setIsValidatingGuru(true);
      try {
        const isMatch = await checkGuruKelas(activeTeacherName, kelas);
        setIsGuruResmiKelas(isMatch);
        if (!isMatch) {
          // If not official teacher, check if any row was marked as badal
          const hasBadal = kbmRows.some((k) => k.is_badal);
          setIsBadalChecked(hasBadal);
        } else {
          setIsBadalChecked(false);
        }
      } catch (err) {
        setIsGuruResmiKelas(true);
      } finally {
        setIsValidatingGuru(false);
      }
    }
    validateTeacher();
  }, [kelas, activeTeacherName]);

  // Load Siswa list when Kelas changes
  useEffect(() => {
    async function loadSiswa() {
      try {
        const data = await getDaftarSiswa(kelas);
        setSiswaKelas(data);
        setAbsensiList((prev) =>
          prev.filter((item) => data.some((s) => s.id === item.siswa_id))
        );
      } catch (err) {
        console.warn('Gagal memuat siswa:', err);
      }
    }
    loadSiswa();
  }, [kelas]);

  // Toggle Badal flag
  const handleToggleBadal = (checked: boolean) => {
    setIsBadalChecked(checked);
    setKbmRows((prev) =>
      prev.map((r) =>
        r.jam_ke !== 'Istirahat' && r.jam_ke !== 'Isoma'
          ? { ...r, is_badal: checked }
          : r
      )
    );
  };

  // Evidence Photo States
  const [existingEvidence, setExistingEvidence] = useState<AgendaEvidence | null>(
    editData?.evidence || null
  );
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isDeleteEvidencePending, setIsDeleteEvidencePending] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // File input refs untuk memisahkan Ambil Foto (Kamera) & Galeri
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Load signed URL untuk existing evidence jika ada
  useEffect(() => {
    let isMounted = true;
    async function loadSignedUrl() {
      if (existingEvidence?.storage_path && !existingEvidence.signedUrl) {
        const url = await getEvidenceSignedUrl(existingEvidence.storage_path);
        if (isMounted && url) {
          setExistingEvidence((prev) => (prev ? { ...prev, signedUrl: url } : null));
        }
      }
    }
    loadSignedUrl();
    return () => {
      isMounted = false;
    };
  }, [existingEvidence?.storage_path]);

  // Update existing evidence jika editData berubah
  useEffect(() => {
    if (editData) {
      setExistingEvidence(editData.evidence || null);
      setSelectedPhotoFile(null);
      setPhotoPreviewUrl(null);
      setIsDeleteEvidencePending(false);
    }
  }, [editData]);

  // Auto-fetch existing agenda di database untuk kelas & tanggal terpilih
  const [existingAgendaId, setExistingAgendaId] = useState<string | null>(editData?.header.id || null);

  const refreshAgendaFromDb = useCallback(async () => {
    if (editData) return;
    try {
      const existing: FullAgenda[] = await getRekapAgenda({ kelas, tanggal });
      if (existing && existing.length > 0) {
        const first = existing[0];
        setExistingAgendaId(first.header.id);
        setExistingEvidence(first.evidence || null);
        setSelectedPhotoFile(null);
        setPhotoPreviewUrl(null);
        setIsDeleteEvidencePending(false);

        const slots = getScheduleSlotsForDate(tanggal);
        const existingJams = first.kbm.map((k) => k.jam_ke);
        const nextEmptySlot = slots.find((s) => !existingJams.includes(s.jam_ke) && !s.is_break);

        const rowsFromDb: AgendaKBM[] = first.kbm.map((k: AgendaKBM) => ({
          id: k.id,
          jam_ke: k.jam_ke,
          nama_guru: k.nama_guru,
          mapel: k.mapel,
          materi: k.materi,
          tugas_pr: k.tugas_pr || '',
          is_badal: Boolean(k.is_badal),
          is_saved_db: true,
        }));

        if (nextEmptySlot) {
          rowsFromDb.push({
            id: undefined,
            jam_ke: nextEmptySlot.jam_ke,
            nama_guru: activeTeacherName || '',
            mapel: '',
            materi: '',
            tugas_pr: '',
            is_badal: false,
            is_saved_db: false,
          });
        }

        setKbmRows(rowsFromDb);
        setAbsensiList(
          first.absensi.map((a) => ({
            siswa_id: a.siswa_id,
            status: a.status,
          }))
        );
        if (first.kejadian && first.kejadian.length > 0) {
          setUraianKejadian(first.kejadian[0].uraian_kejadian);
        }
      } else {
        setExistingAgendaId(null);
        setExistingEvidence(null);
        setSelectedPhotoFile(null);
        setPhotoPreviewUrl(null);
        setIsDeleteEvidencePending(false);

        const slots = getScheduleSlotsForDate(tanggal);
        const firstKbmSlot = slots.find((s) => !s.is_break) || slots[0];
        setKbmRows([
          {
            jam_ke: firstKbmSlot.jam_ke,
            nama_guru: activeTeacherName || '',
            mapel: '',
            materi: '',
            tugas_pr: '',
            is_badal: false,
          },
        ]);
      }
    } catch (err) {
      console.warn('Gagal cek agenda eksisting:', err);
    }
  }, [kelas, tanggal, editData, activeTeacherName]);

  useEffect(() => {
    refreshAgendaFromDb();
  }, [refreshAgendaFromDb]);

  // Dapatkan daftar slot jadwal sesuai hari (Senin-Kamis vs Jumat)
  const scheduleSlots = getScheduleSlotsForDate(tanggal);

  // Hanya slot KBM (bukan break) yang bisa dipilih
  const kbmSlots = scheduleSlots.filter((s) => !s.is_break);

  const handleAddKbmRow = () => {
    const usedJams = kbmRows.map((r) => r.jam_ke);
    const availableSlot = kbmSlots.find((s) => !usedJams.includes(s.jam_ke));
    if (!availableSlot) {
      showToast('info', 'Semua jam pelajaran sudah terisi.');
      return;
    }

    const defaultGuru = activeTeacherName || (daftarGuru.length > 0 ? daftarGuru[0].nama_guru : '');
    setKbmRows([
      ...kbmRows,
      {
        jam_ke: availableSlot.jam_ke,
        nama_guru: defaultGuru,
        mapel: '',
        materi: '',
        tugas_pr: '',
        is_badal: isBadalChecked,
      },
    ]);
  };

  const handleRemoveKbmRow = (index: number) => {
    if (kbmRows.length === 1) {
      showToast('info', 'Minimal 1 baris kegiatan pembelajaran.');
      return;
    }
    setKbmRows(kbmRows.filter((_, i) => i !== index));
  };

  const handleKbmChange = (index: number, field: keyof AgendaKBM, value: any) => {
    const updated = [...kbmRows];
    updated[index] = { ...updated[index], [field]: value };
    setKbmRows(updated);
  };

  // Helper: urutkan kbmRows sesuai posisi slot jadwal, sisipkan pemisah istirahat
  const getOrderedRowsWithBreaks = () => {
    // Urutkan baris berdasarkan posisi di scheduleSlots
    const sorted = [...kbmRows].sort((a, b) => {
      const idxA = scheduleSlots.findIndex((s) => s.jam_ke === a.jam_ke);
      const idxB = scheduleSlots.findIndex((s) => s.jam_ke === b.jam_ke);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    // Sisipkan break separator di posisi yang tepat
    const result: Array<{ type: 'kbm'; row: AgendaKBM; originalIdx: number } | { type: 'break'; label: string }> = [];
    const breakSlots = scheduleSlots.filter((s) => s.is_break);

    for (const row of sorted) {
      const rowSlotIdx = scheduleSlots.findIndex((s) => s.jam_ke === row.jam_ke);
      // Cek apakah ada break yang harus disisipkan sebelum baris ini
      for (const brk of breakSlots) {
        const brkIdx = scheduleSlots.findIndex((s) => s.jam_ke === brk.jam_ke);
        if (brkIdx < rowSlotIdx && !result.some((r) => r.type === 'break' && r.label === brk.label)) {
          // Pastikan ada baris sebelum break ini
          const hasRowBefore = sorted.some((r) => {
            const ri = scheduleSlots.findIndex((s) => s.jam_ke === r.jam_ke);
            return ri < brkIdx;
          });
          if (hasRowBefore) {
            result.push({ type: 'break', label: brk.label });
          }
        }
      }
      const originalIdx = kbmRows.indexOf(row);
      result.push({ type: 'kbm', row, originalIdx });
    }

    return result;
  };

  const handleAddAbsensi = () => {
    if (siswaKelas.length === 0) {
      showToast('error', `Belum ada data siswa di ${kelas}. Hubungi admin untuk menambahkan data siswa.`);
      return;
    }
    const unselected = siswaKelas.find(
      (s) => !absensiList.some((a) => a.siswa_id === s.id)
    );
    if (!unselected) {
      showToast('info', 'Semua siswa sudah masuk dalam daftar ketidakhadiran.');
      return;
    }
    setAbsensiList([...absensiList, { siswa_id: unselected.id, status: 'S' }]);
  };

  const handleRemoveAbsensi = (index: number) => {
    setAbsensiList(absensiList.filter((_, i) => i !== index));
  };

  const handleAbsensiChange = (index: number, field: keyof AbsensiInputItem, value: string) => {
    const updated = [...absensiList];
    updated[index] = { ...updated[index], [field]: value };
    setAbsensiList(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if not official teacher and badal is not checked
    if (!isGuruResmiKelas && !isBadalChecked && activeTeacherName !== 'Administrator') {
      showToast(
        'error',
        `Anda tidak terdaftar sebagai guru kelas di ${kelas}. Harap centang status "Guru Badal" untuk melanjutkan.`
      );
      return;
    }

    // Validasi hanya baris KBM (bukan break)
    const invalidKbm = kbmRows.some(
      (r) => !r.jam_ke.trim() || !r.mapel.trim() || !r.materi.trim()
    );
    if (invalidKbm) {
      showToast('error', 'Mohon lengkapi Jam Ke, Mapel, dan Materi pada semua baris KBM.');
      return;
    }

    setIsSubmitting(true);
    try {
      const saveResult = await simpanAgenda({
        agendaId: existingAgendaId || editData?.header.id,
        sekolah: 'SDIT AS-SYIFA',
        kelas,
        tanggal,
        kbm: kbmRows
          .filter((r) => !scheduleSlots.some((s) => s.is_break && s.jam_ke === r.jam_ke))
          .map((r) => ({
            ...r,
            nama_guru: r.nama_guru || activeTeacherName || '-',
            is_badal: Boolean(r.is_badal || isBadalChecked),
          })),
        absensi: absensiList,
        uraian_kejadian: uraianKejadian,
      });

      const savedAgendaId = saveResult.id;
      let photoUploadError = false;

      // Handle Evidence Upload jika user memilih foto baru
      if (selectedPhotoFile && savedAgendaId) {
        try {
          await uploadAgendaEvidence({
            agendaId: savedAgendaId,
            file: selectedPhotoFile,
            tanggal,
            oldStoragePath: existingEvidence?.storage_path,
          });
        } catch (photoErr: any) {
          console.error('Evidence upload error:', photoErr);
          photoUploadError = true;
          showToast(
            'error',
            'Agenda tersimpan, tetapi foto gagal diunggah. Silakan coba unggah lagi via menu Edit.'
          );
        }
      } else if (isDeleteEvidencePending && existingEvidence && savedAgendaId) {
        // Handle Evidence Delete jika user menghapus foto
        try {
          await deleteAgendaEvidence(savedAgendaId, existingEvidence.storage_path);
        } catch (deleteErr: any) {
          console.warn('Gagal menghapus evidence:', deleteErr);
        }
      }

      if (!editData) {
        clearDraft();
        setDraftSaved(false);
      }

      if (!photoUploadError) {
        showToast(
          'success',
          editData
            ? `Koreksi agenda ${kelas} tanggal ${tanggal} berhasil disimpan.`
            : `Agenda ${kelas} tanggal ${tanggal} berhasil disimpan.`
        );
      }

      // Reset file selection states
      setSelectedPhotoFile(null);
      setPhotoPreviewUrl(null);
      setIsDeleteEvidencePending(false);

      // Soft-refresh: muat ulang data dari DB agar baris baru langsung terkunci
      setIsBadalChecked(false);
      await refreshAgendaFromDb();

      onSuccess();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Gagal menyimpan agenda. ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormDisabled =
    !isGuruResmiKelas && !isBadalChecked && activeTeacherName !== 'Administrator';

  return (
    <div className="max-w-4xl mx-auto pb-28 md:pb-6">
      {/* Edit Mode Alert */}
      {editData && (
        <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Mode <strong>Koreksi / Edit Agenda</strong> ({editData.header.kelas} &bull;{' '}
              {editData.header.tanggal})
            </span>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-2.5 py-1 bg-white border border-amber-300 rounded-md font-semibold text-amber-800 hover:bg-amber-100 transition"
            >
              Batal Koreksi
            </button>
          )}
        </div>
      )}

      {/* Unified Single Sheet / Form Container */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 sm:border-slate-300 rounded-2xl sm:rounded-xl shadow-xs overflow-hidden"
      >
        {/* Form Header (Mobile-First) */}
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {editData ? 'Koreksi Jurnal Agenda Kelas' : 'Isi Agenda Kelas'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Guru: <strong className="text-slate-700">{activeTeacherName || 'Guru'}</strong>
              </p>
            </div>
            {draftSaved && !editData && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[11px] font-medium self-start sm:self-auto">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Draft otomatis tersimpan</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pilih Kelas
              </label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value as KelasOption)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-sm font-semibold rounded-xl sm:rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              >
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tanggal Pelaksanaan
              </label>
              <input
                type="date"
                max={todayStr}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-sm rounded-xl sm:rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                {tanggal === todayStr ? 'Hari ini' : 'Agenda tanggal lalu'}
              </span>
            </div>
          </div>

          {/* Validasi Guru Kelas & Konfirmasi Menggantikan Guru (Badal) */}
          {!isValidatingGuru && !isGuruResmiKelas && activeTeacherName !== 'Administrator' && (
            <div className="mt-3.5 p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Perhatian: Anda tidak tercatat mengajar di {kelas}.</p>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    Apakah Anda mengajar untuk menggantikan guru yang berhalangan hadir / tidak masuk?
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-amber-200/70">
                <input
                  type="checkbox"
                  id="badal-switch"
                  checked={isBadalChecked}
                  onChange={(e) => handleToggleBadal(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                />
                <label
                  htmlFor="badal-switch"
                  className="text-xs font-bold text-amber-950 cursor-pointer select-none"
                >
                  Ya, saya menggantikan guru yang berhalangan masuk (Guru Badal)
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 1: Kegiatan Belajar Mengajar (KBM) */}
        <div className={`p-4 sm:p-6 border-b border-slate-200 ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                I. Kegiatan Belajar Mengajar (KBM)
              </h3>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Isi materi pokok untuk setiap jam pelajaran hari ini
              </p>
            </div>
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2 px-2.5 w-20 border-r border-slate-200">Jam Ke</th>
                  <th className="py-2 px-2.5 w-44 border-r border-slate-200">Guru</th>
                  <th className="py-2 px-2.5 w-36 border-r border-slate-200">Mapel</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">Materi / Bahasan</th>
                  <th className="py-2 px-2.5 w-36 border-r border-slate-200">Tugas/PR</th>
                  <th className="py-2 px-2 w-10 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {getOrderedRowsWithBreaks().map((item, renderIdx) => {
                  if (item.type === 'break') {
                    return (
                      <tr key={`break-${renderIdx}`} className="bg-amber-50/60">
                        <td colSpan={6} className="py-1.5 px-3 text-center">
                          <span className="text-[11px] font-semibold text-amber-700 tracking-wide">
                            ☕ {item.label}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  const { row, originalIdx: idx } = item;
                  const isLocked = Boolean(row.is_saved_db && activeTeacherName !== 'Administrator');

                  if (isLocked) {
                    return (
                      <tr key={idx} className="bg-slate-50/80 text-slate-800">
                        <td className="p-2 border-r border-slate-200 font-bold text-center">
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                            {row.jam_ke}
                          </span>
                        </td>
                        <td className="p-2 border-r border-slate-200 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span>{row.nama_guru}</span>
                            {row.is_badal && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
                                Badal
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 border-r border-slate-200 font-bold text-slate-700">
                          {row.mapel}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-800 whitespace-pre-wrap">
                          {row.materi}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-600">
                          {row.tugas_pr || '-'}
                        </td>
                        <td className="p-2 text-center text-slate-400">
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Tersimpan
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={idx} className="bg-white">
                      <td className="p-1.5 border-r border-slate-200">
                        <select
                          required
                          value={row.jam_ke}
                          onChange={(e) => handleKbmChange(idx, 'jam_ke', e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded border border-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white text-slate-800"
                        >
                          {kbmSlots.map((s) => {
                            const isUsedByOtherRow = kbmRows.some(
                              (otherRow, otherIdx) =>
                                otherIdx !== idx && otherRow.jam_ke === s.jam_ke
                            );
                            if (isUsedByOtherRow) return null;

                            return (
                              <option key={s.jam_ke} value={s.jam_ke}>
                                {s.label}
                              </option>
                            );
                          })}
                          {!kbmSlots.some((s) => s.jam_ke === row.jam_ke) && row.jam_ke && (
                            <option value={row.jam_ke}>{row.jam_ke}</option>
                          )}
                        </select>
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        {activeTeacherName && activeTeacherName !== 'Administrator' ? (
                          <div className="space-y-1">
                            <div className="px-2 py-1 text-xs font-semibold text-slate-800 bg-slate-100/80 rounded border border-slate-200">
                              {activeTeacherName}
                            </div>
                            {row.is_badal && (
                              <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
                                Badal
                              </span>
                            )}
                          </div>
                        ) : daftarGuru.length > 0 ? (
                          <div className="space-y-1">
                            <select
                              value={row.nama_guru || activeTeacherName || ''}
                              onChange={(e) => handleKbmChange(idx, 'nama_guru', e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
                            >
                              <option value="">-- Pilih Guru --</option>
                              {daftarGuru.map((g) => (
                                <option key={g.id} value={g.nama_guru}>
                                  {g.nama_guru}
                                </option>
                              ))}
                            </select>
                            {row.is_badal && (
                              <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
                                Badal
                              </span>
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder="Nama Guru"
                            value={row.nama_guru || activeTeacherName || ''}
                            onChange={(e) => handleKbmChange(idx, 'nama_guru', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        )}
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        {daftarMapel.length > 0 ? (
                          <select
                            required
                            value={row.mapel}
                            onChange={(e) => handleKbmChange(idx, 'mapel', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400"
                          >
                            <option value="">-- Pilih Mapel --</option>
                            {daftarMapel.map((m) => (
                              <option key={m.id} value={m.nama_mapel}>
                                {m.nama_mapel}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            placeholder="Mata Pelajaran"
                            value={row.mapel}
                            onChange={(e) => handleKbmChange(idx, 'mapel', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        )}
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <textarea
                          rows={2}
                          required
                          placeholder="Materi pokok pembelajaran..."
                          value={row.materi}
                          onChange={(e) => handleKbmChange(idx, 'materi', e.target.value)}
                          className="w-full p-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-y min-h-[52px]"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <textarea
                          rows={2}
                          placeholder="Tugas/PR (Opsional)"
                          value={row.tugas_pr || ''}
                          onChange={(e) => handleKbmChange(idx, 'tugas_pr', e.target.value)}
                          className="w-full p-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-y min-h-[52px]"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveKbmRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile-First Touch-Friendly Cards (< md) */}
          <div className="md:hidden space-y-3">
            {getOrderedRowsWithBreaks().map((item, renderIdx) => {
              if (item.type === 'break') {
                return (
                  <div
                    key={`break-${renderIdx}`}
                    className="py-2 px-3 bg-amber-50/80 border border-amber-200/70 rounded-xl text-center flex items-center justify-center gap-1.5"
                  >
                    <span className="text-xs font-semibold text-amber-800">
                      ☕ {item.label}
                    </span>
                  </div>
                );
              }

              const { row, originalIdx: idx } = item;
              const isLocked = Boolean(row.is_saved_db && activeTeacherName !== 'Administrator');
              const isPrOpen = Boolean(expandedPrRows[idx] || (row.tugas_pr && row.tugas_pr.trim() !== ''));

              if (isLocked) {
                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs px-2.5 py-1 bg-slate-200 text-slate-800 rounded-md">
                          Jam {row.jam_ke}
                        </span>
                        <span className="font-bold text-slate-800 text-xs">
                          {row.mapel}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Tersimpan
                      </span>
                    </div>

                    <div className="text-slate-600 text-[11px] flex items-center gap-1.5">
                      <span>{row.nama_guru}</span>
                      {row.is_badal && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                          Badal
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 text-xs whitespace-pre-wrap leading-relaxed">
                      {row.materi}
                    </div>

                    {row.tugas_pr && (
                      <div className="text-[11px] text-slate-600 bg-amber-50/70 border border-amber-200/60 rounded-md p-2">
                        <strong>Tugas/PR:</strong> {row.tugas_pr}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3"
                >
                  {/* Card Header: Slot Selector & Action */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase shrink-0">
                        Jam:
                      </label>
                      <select
                        required
                        value={row.jam_ke}
                        onChange={(e) => handleKbmChange(idx, 'jam_ke', e.target.value)}
                        className="flex-1 max-w-[170px] px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-xs bg-slate-50 focus:bg-white text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      >
                        {kbmSlots.map((s) => {
                          const isUsedByOtherRow = kbmRows.some(
                            (otherRow, otherIdx) =>
                              otherIdx !== idx && otherRow.jam_ke === s.jam_ke
                          );
                          if (isUsedByOtherRow) return null;

                          return (
                            <option key={s.jam_ke} value={s.jam_ke}>
                              {s.label}
                            </option>
                          );
                        })}
                        {!kbmSlots.some((s) => s.jam_ke === row.jam_ke) && row.jam_ke && (
                          <option value={row.jam_ke}>{row.jam_ke}</option>
                        )}
                      </select>
                    </div>

                    {kbmRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveKbmRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Hapus jam ini"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </button>
                    )}
                  </div>

                  {/* Field Mata Pelajaran */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Mata Pelajaran
                    </label>
                    {daftarMapel.length > 0 ? (
                      <select
                        required
                        value={row.mapel}
                        onChange={(e) => handleKbmChange(idx, 'mapel', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        <option value="">-- Pilih Mata Pelajaran --</option>
                        {daftarMapel.map((m) => (
                          <option key={m.id} value={m.nama_mapel}>
                            {m.nama_mapel}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Matematika, Tematik..."
                        value={row.mapel}
                        onChange={(e) => handleKbmChange(idx, 'mapel', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    )}
                  </div>

                  {/* Field Guru (Hanya jika admin atau guru non-default) */}
                  {(!activeTeacherName || activeTeacherName === 'Administrator') && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Guru Pengajar
                      </label>
                      {daftarGuru.length > 0 ? (
                        <select
                          value={row.nama_guru || activeTeacherName || ''}
                          onChange={(e) => handleKbmChange(idx, 'nama_guru', e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                          <option value="">-- Pilih Guru --</option>
                          {daftarGuru.map((g) => (
                            <option key={g.id} value={g.nama_guru}>
                              {g.nama_guru}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Nama Guru"
                          value={row.nama_guru || activeTeacherName || ''}
                          onChange={(e) => handleKbmChange(idx, 'nama_guru', e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      )}
                    </div>
                  )}

                  {/* Field Materi Pokok */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Materi Pembelajaran
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Tulis ringkasan materi pokok pembelajaran..."
                      value={row.materi}
                      onChange={(e) => handleKbmChange(idx, 'materi', e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed resize-y"
                    />
                  </div>

                  {/* Field Tugas / PR Collapsible */}
                  <div className="pt-1">
                    {!isPrOpen ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPrRows((prev) => ({ ...prev, [idx]: true }))
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 py-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambahkan Tugas / PR</span>
                      </button>
                    ) : (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-700">
                            Tugas / PR
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              handleKbmChange(idx, 'tugas_pr', '');
                              setExpandedPrRows((prev) => ({ ...prev, [idx]: false }));
                            }}
                            className="text-[11px] text-slate-400 hover:text-rose-600 font-medium flex items-center gap-0.5"
                          >
                            <X className="w-3 h-3" /> Tutup
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Contoh: Latihan hal 42 nomor 1-5..."
                          value={row.tugas_pr || ''}
                          onChange={(e) => handleKbmChange(idx, 'tugas_pr', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddKbmRow}
            className="mt-3.5 w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span>Tambah Jam Pelajaran</span>
          </button>
        </div>

        {/* Section 2: Absensi (Siswa Tidak Hadir) */}
        <div className={`p-4 sm:p-6 border-b border-slate-200 ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                II. Kehadiran Siswa
              </h3>
              <p className="text-[11px] text-slate-500">
                {absensiList.length === 0
                  ? 'Semua siswa hadir (nihil tidak hadir).'
                  : `${absensiList.length} siswa tercatat tidak hadir.`}
              </p>
            </div>

            {/* Quick summary chip */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded-md border border-emerald-200">
                {Math.max(0, siswaKelas.length - absensiList.length)} Hadir
              </span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-semibold rounded-md border border-blue-200">
                {absensiList.filter((a) => a.status === 'S').length} Sakit
              </span>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-semibold rounded-md border border-amber-200">
                {absensiList.filter((a) => a.status === 'I').length} Izin
              </span>
              <span className="px-2 py-0.5 bg-rose-50 text-rose-800 font-semibold rounded-md border border-rose-200">
                {absensiList.filter((a) => a.status === 'A').length} Alpha
              </span>
            </div>
          </div>

          {absensiList.length === 0 ? (
            <div className="py-3 px-4 rounded-xl border border-emerald-200 bg-emerald-50/50 text-xs text-emerald-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Seluruh siswa hadir lengkap ({siswaKelas.length} siswa)</span>
              </div>
              <button
                type="button"
                onClick={handleAddAbsensi}
                className="text-xs font-bold text-emerald-700 underline shrink-0 hover:text-emerald-900"
              >
                + Catat Absen
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {absensiList.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-slate-400 font-bold text-xs w-4 text-center">
                        {idx + 1}.
                      </span>
                      <select
                        value={item.siswa_id}
                        onChange={(e) => handleAbsensiChange(idx, 'siswa_id', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                      >
                        {siswaKelas.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nama_siswa}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Touch Segmented Buttons: Sakit (S), Izin (I), Alpha (A) */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0">
                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => handleAbsensiChange(idx, 'status', 'S')}
                          className={`px-3 py-1 rounded-md transition ${
                            item.status === 'S'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Sakit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAbsensiChange(idx, 'status', 'I')}
                          className={`px-3 py-1 rounded-md transition ${
                            item.status === 'I'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Izin
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAbsensiChange(idx, 'status', 'A')}
                          className={`px-3 py-1 rounded-md transition ${
                            item.status === 'A'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Alpha
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAbsensi(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddAbsensi}
                className="w-full py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Siswa Tidak Hadir</span>
              </button>
            </div>
          )}
        </div>

        {/* Section 3: Catatan Kejadian Khusus (Collapsible di HP bila kosong) */}
        <div className={`p-4 sm:p-6 border-b border-slate-200 ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              III. Catatan Kejadian (Opsional)
            </h3>
            {!showKejadian && (
              <button
                type="button"
                onClick={() => setShowKejadian(true)}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                + Tambah Catatan
              </button>
            )}
          </div>

          {showKejadian ? (
            <div className="mt-2.5 space-y-1.5">
              <textarea
                rows={3}
                value={uraianKejadian}
                onChange={(e) => setUraianKejadian(e.target.value)}
                placeholder="Catatan kendala kelas, kejadian khusus siswa, dsb..."
                className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-800 leading-relaxed"
              />
              {!uraianKejadian && (
                <button
                  type="button"
                  onClick={() => setShowKejadian(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-600"
                >
                  Tutup / Sembunyikan
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-1 italic">
              Tidak ada catatan khusus kelas hari ini.
            </p>
          )}
        </div>

        {/* Section 4: Bukti Foto Mengajar (Opsional) */}
        <div className={`p-4 sm:p-6 border-b border-slate-200 ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  IV. Bukti Foto Mengajar
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                  Opsional
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tambahkan satu foto yang mewakili kegiatan pembelajaran hari ini.
              </p>
            </div>
          </div>

          {/* Hidden File Inputs: Camera & Gallery */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedPhotoFile(file);
                setPhotoPreviewUrl(URL.createObjectURL(file));
                setIsDeleteEvidencePending(false);
              }
              e.target.value = '';
            }}
          />

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedPhotoFile(file);
                setPhotoPreviewUrl(URL.createObjectURL(file));
                setIsDeleteEvidencePending(false);
              }
              e.target.value = '';
            }}
          />

          {/* Render State Foto: Preview Foto / Existing Foto / Tombol Pilih Foto */}
          {photoPreviewUrl || (existingEvidence && !isDeleteEvidencePending) ? (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center max-h-64 sm:max-h-72 border border-slate-300 shadow-xs">
                <img
                  src={photoPreviewUrl || existingEvidence?.signedUrl || ''}
                  alt="Bukti Mengajar"
                  className="w-full h-auto max-h-64 sm:max-h-72 object-contain cursor-pointer hover:opacity-95 transition"
                  onClick={() => setIsLightboxOpen(true)}
                />
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="absolute bottom-2 right-2 px-2.5 py-1 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-medium rounded-md backdrop-blur-xs flex items-center gap-1 transition"
                  title="Lihat ukuran penuh"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Perbesar</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="text-slate-600">
                  {selectedPhotoFile ? (
                    <span className="font-semibold text-emerald-700">
                      ✓ Foto baru dipilih ({selectedPhotoFile.name})
                    </span>
                  ) : existingEvidence?.uploaded_at ? (
                    <span className="text-slate-500">
                      Tersimpan &bull; Diunggah:{' '}
                      <strong>
                        {new Date(existingEvidence.uploaded_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </span>
                  ) : (
                    <span className="text-slate-500">Bukti foto aktif</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative inline-flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg flex items-center gap-1.5 transition text-xs"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ganti Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-2 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center transition sm:hidden"
                      title="Ambil Foto Kamera"
                    >
                      <Camera className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Hapus bukti foto mengajar ini?')) {
                        if (selectedPhotoFile) {
                          setSelectedPhotoFile(null);
                          setPhotoPreviewUrl(null);
                        } else if (existingEvidence) {
                          setIsDeleteEvidencePending(true);
                        }
                      }
                    }}
                    className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg flex items-center gap-1 transition text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-700">Belum ada foto kegiatan</p>
                <p className="text-[11px] text-slate-400">
                  Ambil langsung dengan kamera ponsel atau pilih dari galeri.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Ambil Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pilih Galeri</span>
                </button>
              </div>
            </div>
          )}

          {/* Notifikasi jika penghapusan foto tertunda sebelum simpan */}
          {isDeleteEvidencePending && (
            <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
              <span>Foto akan dihapus permanen saat agenda disimpan.</span>
              <button
                type="button"
                onClick={() => setIsDeleteEvidencePending(false)}
                className="text-amber-900 font-bold underline ml-2"
              >
                Batal Hapus
              </button>
            </div>
          )}
        </div>

        {/* Modal Lightbox untuk Perbesar Foto */}
        <PhotoLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          imageUrl={photoPreviewUrl || existingEvidence?.signedUrl}
          uploadedAt={existingEvidence?.uploaded_at}
          title={`Bukti Foto Mengajar - ${kelas}`}
        />

        {/* Desktop Save Bar (>= md) */}
        <div className="hidden md:flex p-4 sm:p-6 bg-slate-50/70 items-center justify-between gap-4">
          <span className="text-xs text-slate-500">
            Periksa kembali agenda sebelum disimpan ke sistem
          </span>
          <button
            type="submit"
            disabled={isSubmitting || isFormDisabled}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{editData ? 'Simpan Perubahan' : 'Simpan Agenda'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Sticky Mobile Primary Action Bar (< md, tepat di atas bottom nav) */}
      <div className="md:hidden fixed bottom-14 left-0 right-0 z-30 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-4 py-2.5 shadow-lg no-print">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="text-xs leading-tight">
            <span className="font-bold text-slate-800">{kelas}</span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isFormDisabled}
            className="flex-1 max-w-[220px] py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{editData ? 'Simpan Edit' : 'Simpan Agenda'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
