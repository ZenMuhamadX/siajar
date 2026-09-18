import React, { useState, useEffect, useRef } from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import type { Siswa, AgendaEvidence, FullAgenda, Substitution } from '../../types';
import { getDaftarSiswa, simpanAgenda } from '../../services/agendaService';
import {
  uploadAgendaEvidence,
  getEvidenceSignedUrl,
} from '../../services/evidenceService';
import { PhotoLightboxModal } from '../PhotoLightboxModal';
import {
  ArrowLeft,
  Save,
  Loader2,
  Clock,
  BookOpen,
  UserCheck,
  Plus,
  Trash2,
  Camera,
  Eye,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface AbsensiInputItem {
  siswa_id: string;
  status: 'S' | 'I' | 'A';
}

interface AgendaDetailFormProps {
  onBack: () => void;
  slot: TimelineSlot | null;
  targetDate: string;
  activeTeacherName: string;
  onSuccessSave: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  directEditData?: FullAgenda | null;
  /** Set true when the logged-in teacher is a substitute (badal) */
  isSubstitute?: boolean;
  /** Substitution record (created before opening this form) */
  substitution?: Substitution | null;
}

export const AgendaDetailForm: React.FC<AgendaDetailFormProps> = ({
  onBack,
  slot,
  targetDate,
  activeTeacherName,
  onSuccessSave,
  showToast,
  directEditData,
  isSubstitute = false,
  substitution = null,
}) => {
  const schedule = slot?.schedule;
  const existingAgenda = directEditData || slot?.existingAgenda;

  // Determine Class, Subject, Time, Teacher
  const kelas = schedule?.class_id || existingAgenda?.header.kelas || 'KELAS 1';
  const subjectName = schedule?.subject_name || existingAgenda?.kbm?.[0]?.mapel || '-';
  // scheduledTeacherName = guru yang tercatat di jadwal (tidak berubah)
  const scheduledTeacherName = schedule?.teacher_name || activeTeacherName || '-';
  // teacherName = untuk KBM row nama_guru: jika badal → guru pengganti, else → guru terjadwal
  const teacherName = isSubstitute ? activeTeacherName : scheduledTeacherName;
  const actualTeacherId = isSubstitute
    ? substitution?.substitute_teacher_id || null
    : schedule?.teacher_id || null;
  const startTime = schedule?.start_time ? schedule.start_time.slice(0, 5) : '-';
  const endTime = schedule?.end_time ? schedule.end_time.slice(0, 5) : '-';
  const periodNumber = schedule?.period_number || 1;

  // Form states
  const [materi, setMateri] = useState<string>('');
  const [tugasPr, setTugasPr] = useState<string>('');
  const [absensiList, setAbsensiList] = useState<AbsensiInputItem[]>([]);
  const [uraianKejadian, setUraianKejadian] = useState<string>('');
  const [siswaKelas, setSiswaKelas] = useState<Siswa[]>([]);
  const [isLoadingSiswa, setIsLoadingSiswa] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Evidence states
  const [existingEvidence, setExistingEvidence] = useState<AgendaEvidence | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize data when form opens or slot changes
  useEffect(() => {
    if (existingAgenda) {
      const firstKbm = existingAgenda.kbm?.[0];
      setMateri(firstKbm?.materi || '');
      setTugasPr(firstKbm?.tugas_pr || '');
      setAbsensiList(
        (existingAgenda.absensi || []).map((a) => ({
          siswa_id: a.siswa_id,
          status: a.status,
        }))
      );
      setUraianKejadian(existingAgenda.kejadian?.[0]?.uraian_kejadian || '');
      setExistingEvidence(existingAgenda.evidence || null);
    } else {
      setMateri('');
      setTugasPr('');
      setAbsensiList([]);
      setUraianKejadian('');
      setExistingEvidence(null);
    }
  }, [existingAgenda, slot]);

  // Load Siswa list for this class
  useEffect(() => {
    let isMounted = true;
    async function loadSiswa() {
      if (!kelas) return;
      setIsLoadingSiswa(true);
      try {
        const list = await getDaftarSiswa(kelas);
        if (isMounted) {
          setSiswaKelas(list);
        }
      } catch (err) {
        console.warn('Gagal memuat data siswa:', err);
      } finally {
        if (isMounted) setIsLoadingSiswa(false);
      }
    }
    loadSiswa();
    return () => {
      isMounted = false;
    };
  }, [kelas]);

  // Load signed url for existing evidence
  useEffect(() => {
    let isMounted = true;
    async function loadPhotoUrl() {
      if (existingEvidence?.storage_path && !existingEvidence.signedUrl) {
        const url = await getEvidenceSignedUrl(existingEvidence.storage_path);
        if (isMounted && url) {
          setExistingEvidence((prev) => (prev ? { ...prev, signedUrl: url } : null));
        }
      }
    }
    loadPhotoUrl();
    return () => {
      isMounted = false;
    };
  }, [existingEvidence?.storage_path]);

  // Attendance handlers
  const handleAddAbsensi = () => {
    if (siswaKelas.length === 0) {
      showToast('error', `Belum ada data siswa di ${kelas}.`);
      return;
    }
    const unselected = siswaKelas.find((s) => !absensiList.some((a) => a.siswa_id === s.id));
    if (!unselected) {
      showToast('info', 'Semua siswa sudah masuk dalam daftar tidak hadir.');
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

  // Helper kompresi gambar dari native camera (file input) menjadi WebP ringan
  const compressImageFile = async (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 1280;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (b) => resolve(b || file),
            'image/webp',
            0.85
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  };

  // Handler saat foto selesai dijepret melalui native camera bawaan perangkat
  const handleNativeCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const capturedAt = new Date().toISOString();

    try {
      const compressedBlob = await compressImageFile(file);

      // Pastikan agenda sudah ada di DB atau buat draft terlebih dahulu jika belum ada
      const scheduleId = schedule?.id || existingAgenda?.header.schedule_id || null;
      let targetAgendaId = existingAgenda?.header.id;

      if (!targetAgendaId) {
        // Buat record header awal agar agendaId valid untuk storage path
        const initSave = await simpanAgenda({
          schedule_id: scheduleId,
          actual_teacher_name: activeTeacherName || teacherName,
          sekolah: 'SDIT AS-SYIFA',
          kelas,
          tanggal: targetDate,
          kbm: [
            {
              jam_ke: `Jam ${periodNumber}`,
              nama_guru: teacherName,
              mapel: subjectName,
              materi: materi.trim() || 'Draft Pembelajaran',
              tugas_pr: tugasPr.trim() || undefined,
              is_badal: isSubstitute,
            },
          ],
          absensi: absensiList,
          uraian_kejadian: uraianKejadian.trim() || undefined,
        });
        targetAgendaId = initSave.id;
      }

      const uploaded = await uploadAgendaEvidence({
        agendaId: targetAgendaId,
        file: compressedBlob,
        tanggal: targetDate,
        capturedAt,
        actualTeacherName: activeTeacherName || teacherName,
        actualTeacherId,
        academicYearId: schedule?.academic_year_id,
        oldStoragePath: existingEvidence?.storage_path,
      });

      setExistingEvidence(uploaded);
      showToast('success', 'Foto dokumentasi berhasil diambil dan disimpan.');
    } catch (err: any) {
      console.error('Evidence upload error:', err);
      showToast('error', 'Gagal mengunggah foto: ' + (err?.message || 'Periksa koneksi internet'));
    } finally {
      setIsUploadingPhoto(false);
      // Reset input agar bisa dipakai ulang jika dibutuhkan
      if (e.target) e.target.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi materi
    if (!materi.trim()) {
      showToast('error', 'Mohon isi Materi Pembelajaran.');
      return;
    }

    // Validasi foto dokumentasi WAJIB ADA (STAGE 4)
    if (!existingEvidence || !existingEvidence.storage_path) {
      showToast('error', 'Foto dokumentasi belum diambil. Ambil foto selfie guru terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduleId = schedule?.id || existingAgenda?.header.schedule_id || null;
      const agendaId = existingAgenda?.header.id || existingEvidence.agenda_id;

      await simpanAgenda({
        agendaId,
        schedule_id: scheduleId,
        actual_teacher_name: activeTeacherName || teacherName,
        sekolah: 'SDIT AS-SYIFA',
        kelas,
        tanggal: targetDate,
        kbm: [
          {
            jam_ke: `Jam ${periodNumber}`,
            nama_guru: teacherName,
            mapel: subjectName,
            materi: materi.trim(),
            tugas_pr: tugasPr.trim() || undefined,
            is_badal: isSubstitute,
          },
        ],
        absensi: absensiList,
        uraian_kejadian: uraianKejadian.trim() || undefined,
      });

      showToast(
        'success',
        existingAgenda
          ? `Perubahan agenda ${kelas} (${subjectName}) berhasil disimpan.`
          : `Agenda ${kelas} (${subjectName}) berhasil diselesaikan.`
      );

      onSuccessSave();
      onBack();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Gagal menyimpan agenda: ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const presentCount = Math.max(0, siswaKelas.length - absensiList.length);

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center justify-center shrink-0"
            title="Kembali ke Jadwal"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {existingAgenda ? 'Lihat / Edit Agenda Pembelajaran' : 'Isi Agenda Pembelajaran'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              SDIT AS-SYIFA &bull; {targetDate}
            </p>
          </div>
        </div>

        {/* Read-only Schedule Summary Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>{startTime} – {endTime} (Jam {periodNumber})</span>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* READ-ONLY SCHEDULE HEADER */}
        <div className={`p-4 rounded-2xl border ${isSubstitute ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
          {/* Badge badal */}
          {isSubstitute && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-100 border border-amber-300 rounded-xl">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">🔄 Mode Guru Pengganti (Badal)</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-3 bg-white border rounded-xl shadow-2xs ${isSubstitute ? 'border-amber-100' : 'border-emerald-100'}`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Kelas
              </span>
              <span className="text-sm font-bold text-slate-900">{kelas}</span>
            </div>
            <div className={`p-3 bg-white border rounded-xl shadow-2xs ${isSubstitute ? 'border-amber-100' : 'border-emerald-100'}`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Mata Pelajaran
              </span>
              <span className="text-sm font-bold text-slate-900">{subjectName}</span>
            </div>
            <div className={`p-3 bg-white border rounded-xl shadow-2xs ${isSubstitute ? 'border-amber-100' : 'border-emerald-100'}`}>
              {isSubstitute ? (
                <>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Guru Terjadwal
                  </span>
                  <span className="text-sm font-bold text-slate-500 line-through">{scheduledTeacherName}</span>
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mt-1">
                    Guru Pelaksana (Anda)
                  </span>
                  <span className="text-sm font-bold text-slate-900">{activeTeacherName}</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Guru Pengampu
                  </span>
                  <span className="text-sm font-bold text-slate-900">{scheduledTeacherName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* DESKTOP 2-COLUMN GRID / MOBILE 1-COLUMN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: KBM & CATATAN KEJADIAN */}
          <div className="lg:col-span-7 space-y-6">
            {/* SECTION I: KBM */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  I. Kegiatan Belajar Mengajar (KBM)
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Materi / Bahasan Pembelajaran <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={materi}
                  onChange={(e) => setMateri(e.target.value)}
                  placeholder="Tulis ringkasan materi, capaian pembelajaran, atau topik bahasan hari ini..."
                  className="w-full p-3.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-800 leading-relaxed bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tugas / PR <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={tugasPr}
                  onChange={(e) => setTugasPr(e.target.value)}
                  placeholder="Contoh: Latihan hal 42 nomor 1-5 / tugas kelompok..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-800 bg-white"
                />
              </div>
            </div>

            {/* SECTION III: CATATAN KEJADIAN */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <AlertCircle className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  III. Catatan Kejadian <span className="text-slate-400 font-normal">(Opsional)</span>
                </h3>
              </div>
              <textarea
                rows={3}
                value={uraianKejadian}
                onChange={(e) => setUraianKejadian(e.target.value)}
                placeholder="Catatan kendala kelas, kejadian khusus siswa, catatan evaluasi, dsb..."
                className="w-full p-3.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-800 leading-relaxed bg-white"
              />
            </div>
          </div>

          {/* RIGHT COLUMN: ABSENSI & BUKTI FOTO */}
          <div className="lg:col-span-5 space-y-6">
            {/* SECTION II: ABSENSI */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    II. Kehadiran Siswa
                  </h3>
                </div>

                {/* Summary Badges */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded-md border border-emerald-200">
                    {presentCount} Hadir
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

              {isLoadingSiswa ? (
                <div className="py-4 text-center text-xs text-slate-400">Memuat data siswa...</div>
              ) : absensiList.length === 0 ? (
                <div className="py-3 px-4 rounded-xl border border-emerald-200 bg-emerald-50/50 text-xs text-emerald-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Semua siswa hadir ({siswaKelas.length} siswa)</span>
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
                <div className="space-y-2.5">
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

                        <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0">
                          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-bold">
                            <button
                              type="button"
                              onClick={() => handleAbsensiChange(idx, 'status', 'S')}
                              className={`px-2.5 py-1 rounded-md transition ${
                                item.status === 'S'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              S
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAbsensiChange(idx, 'status', 'I')}
                              className={`px-2.5 py-1 rounded-md transition ${
                                item.status === 'I'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAbsensiChange(idx, 'status', 'A')}
                              className={`px-2.5 py-1 rounded-md transition ${
                                item.status === 'A'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              A
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

            {/* SECTION IV: DOKUMENTASI FOTO GURU */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    IV. Dokumentasi Foto Mengajar
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    Wajib
                  </span>
                </div>
                {existingEvidence?.storage_path ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Status: Tersimpan (Final)
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-medium">
                    Belum Ada Foto
                  </span>
                )}
              </div>

              {/* Status Foto & Tampilan */}
              {existingEvidence?.storage_path ? (
                // State FINAL: Read-only, guru tidak boleh retake / ganti / hapus
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center max-h-56 border border-slate-300">
                    <img
                      src={existingEvidence.signedUrl || ''}
                      alt="Dokumentasi Foto Guru"
                      className="w-full h-auto max-h-56 object-contain cursor-pointer"
                      onClick={() => setIsLightboxOpen(true)}
                    />
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="absolute bottom-2 right-2 px-2.5 py-1 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-medium rounded-md flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Perbesar</span>
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Foto dokumentasi sudah tersimpan.</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 block">Diambil:</span>
                        <span className="font-medium text-slate-700">
                          {existingEvidence.captured_at
                            ? new Date(existingEvidence.captured_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Diupload:</span>
                        <span className="font-medium text-slate-700">
                          {existingEvidence.uploaded_at
                            ? new Date(existingEvidence.uploaded_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // State BELUM ADA FOTO: Call to action buka kamera langsung
                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Belum ada foto dokumentasi</p>
                      <p className="text-[11px] text-slate-500">
                        Ambil foto selfie pengajar langsung melalui kamera perangkat.
                      </p>
                    </div>
                  </div>

                  {/* Hidden Native Camera Input with capture="user" */}
                  <input
                    ref={nativeCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handleNativeCameraChange}
                  />

                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50 shrink-0"
                  >
                    {isUploadingPhoto ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan Foto...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>Buka Kamera</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lightbox Modal */}
        <PhotoLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          imageUrl={existingEvidence?.signedUrl}
          uploadedAt={existingEvidence?.uploaded_at}
          capturedAt={existingEvidence?.captured_at}
          actualTeacherName={existingEvidence?.actual_teacher_name || activeTeacherName || teacherName}
          title={`Dokumentasi Foto - ${kelas} (${subjectName})`}
        />

        {/* Desktop Save Bar */}
        <div className="hidden md:flex p-4 bg-white border border-slate-200 rounded-2xl items-center justify-between shadow-xs">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
          >
            Batal / Kembali ke Jadwal
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{existingAgenda ? 'Simpan Perubahan' : 'Simpan Agenda'}</span>
              </>
            )}
          </button>
        </div>

        {/* Mobile Sticky Save Bar */}
        <div className="md:hidden fixed bottom-14 left-0 right-0 z-30 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-4 py-2.5 shadow-lg no-print">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Kembali
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{existingAgenda ? 'Simpan Edit' : 'Simpan Agenda'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
