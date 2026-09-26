import React, { useState, useEffect, useRef } from 'react';
import type { TimelineSlot } from '../../services/scheduleDetectionService';
import type { Siswa, AgendaEvidence, FullAgenda, Substitution } from '../../types';
import { getDaftarSiswa, simpanAgenda } from '../../services/agendaService';
import { uploadAgendaEvidence, getEvidenceDisplayUrl } from '../../services/evidenceService';
import { PhotoLightboxModal } from '../PhotoLightboxModal';
import { useSchoolName } from '../../contexts/SettingsContext';
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
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

/**
 * `status` boleh kosong: guru harus memilih sendiri.
 * Sebelumnya baris baru otomatis terisi 'S' (Sakit) sehingga status yang
 * tersimpan sering tidak sesuai kenyataan hanya karena guru lupa mengubahnya.
 */
interface AbsensiInputItem {
  siswa_id: string;
  status: 'S' | 'I' | 'A' | '';
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

interface DraftPayload {
  materi: string;
  tugasPr: string;
  absensiList: AbsensiInputItem[];
  uraianKejadian: string;
  savedAt: number;
}

const DRAFT_PREFIX = 'siajar.draft.agenda.';

/**
 * Penanda materi untuk agenda yang baru terbentuk karena guru memotret foto,
 * tetapi belum disimpan.
 *
 * Kenapa perlu: unggahan foto butuh `agendaId` untuk menyusun path berkas,
 * sehingga memotret lebih dulu membuat baris agenda di basis data. Akibatnya
 * `computeSlotStatus` langsung menandai slot itu COMPLETED — padahal guru baru
 * memotret dan belum menyelesaikan isian.
 *
 * Nilai ini ditulis dan dibaca oleh kode yang sama, dan dipakai untuk
 * membedakan "agenda setengah jadi" dari "agenda yang benar-benar tersimpan".
 * Tanpa itu, agenda setengah jadi akan terkunci dan tidak bisa dilanjutkan.
 */
const DRAFT_MATERI_PLACEHOLDER = 'Draft Pembelajaran';

const readDraft = (key: string): DraftPayload | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeDraft = (key: string, payload: DraftPayload) => {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* mode privat / kuota penuh — draf dilewati, bukan kegagalan */
  }
};

const removeDraft = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* diabaikan */
  }
};

const formatDateTimeIndo = (iso?: string) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
};

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
  // Nama sekolah dari Pengaturan; ikut tersimpan di agenda_header.sekolah.
  const schoolName = useSchoolName();
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
  const [existingEvidence, setExistingEvidence] = useState<AgendaEvidence | null>(
    () => existingAgenda?.evidence ?? null
  );
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  // Draf lokal. Isian hanya hidup di memori, dan guru wajib membuka aplikasi
  // kamera di tengah pengisian — di Android, berpindah ke kamera bisa membuat
  // tab dibuang sehingga seluruh tulisan hilang. Draf ditulis ke localStorage
  // dan dipulihkan saat form dibuka kembali.
  //
  // Kunci identitas agenda dipakai juga sebagai dependensi efek inisialisasi.
  // Ini penting: `InputAgenda` menjalankan timer 30 detik yang menghitung ulang
  // status slot lewat `recomputeTimelineSlotStatuses`, dan fungsi itu membuat
  // objek slot BARU setiap kali (via `slots.map(item => ({...item}))`). Bila
  // efek inisialisasi bergantung pada objek `slot`, ia akan berjalan ulang tiap
  // 30 detik — mengembalikan isian ke nilai basis data dan menghapus pratinjau
  // foto yang baru saja diambil. Bergantung pada identitas (string) membuatnya
  // hanya berjalan saat agenda benar-benar berganti.
  const agendaIdentity = `${
    slot?.schedule.id ?? directEditData?.header.schedule_id ?? 'nosched'
  }|${targetDate}`;
  const draftKey = `${DRAFT_PREFIX}${agendaIdentity}`;
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);

  /**
   * Kunci baca-saja untuk agenda yang sudah tersimpan.
   *
   * Diputuskan SEKALI per agenda, tepat saat form dibuka untuk agenda itu — dan
   * sengaja TIDAK dihitung ulang secara reaktif. Alasannya: memotret foto
   * membuat baris agenda di basis data (unggahan butuh `agendaId` untuk path
   * berkas), dan `computeSlotStatus` langsung menandainya COMPLETED. Kalau kunci
   * dihitung dari status terkini, form akan mengunci diri sendiri begitu guru
   * selesai memotret — padahal isiannya belum selesai.
   *
   * Agenda yang baru terbentuk karena foto tetapi belum disimpan dikenali dari
   * materi penandanya, sehingga masih bisa dilanjutkan.
   */
  const [lockedAgenda, setLockedAgenda] = useState<string | null>(null);

  useEffect(() => {
    const savedMateri = existingAgenda?.kbm?.[0]?.materi;
    const isUnfinishedDraft = savedMateri === DRAFT_MATERI_PLACEHOLDER;
    setLockedAgenda(existingAgenda && !isUnfinishedDraft ? agendaIdentity : null);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaIdentity]);

  const isLocked = lockedAgenda === agendaIdentity;

  // Rujukan bagian, dipakai untuk mengarahkan guru ke isian yang kurang.
  const photoSectionRef = useRef<HTMLDivElement>(null);
  const materiSectionRef = useRef<HTMLDivElement>(null);
  const absensiSectionRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState<'foto' | 'materi' | 'absensi' | null>(null);

  const focusStep = (step: 'foto' | 'materi' | 'absensi') => {
    const target =
      step === 'foto'
        ? photoSectionRef
        : step === 'materi'
        ? materiSectionRef
        : absensiSectionRef;
    target.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlighted(step);
    window.setTimeout(() => setHighlighted(null), 2600);
    if (step === 'materi') document.getElementById('agenda-materi')?.focus();
  };

  // Initialize data when form opens or slot changes, lalu pulihkan draf bila ada.
  useEffect(() => {
    const base: Omit<DraftPayload, 'savedAt'> = existingAgenda
      ? {
          materi: existingAgenda.kbm?.[0]?.materi || '',
          tugasPr: existingAgenda.kbm?.[0]?.tugas_pr || '',
          absensiList: (existingAgenda.absensi || []).map((a) => ({
            siswa_id: a.siswa_id,
            status: a.status,
          })),
          uraianKejadian: existingAgenda.kejadian?.[0]?.uraian_kejadian || '',
        }
      : { materi: '', tugasPr: '', absensiList: [], uraianKejadian: '' };

    const draft = readDraft(draftKey);
    const draftHasContent =
      !!draft &&
      (draft.materi.trim() !== '' ||
        draft.tugasPr.trim() !== '' ||
        draft.uraianKejadian.trim() !== '' ||
        draft.absensiList.length > 0);

    // Draf hanya dipakai bila memang berbeda dari isi yang sudah tersimpan,
    // supaya tidak menimpa data lama dengan sisa ketikan yang sudah usang.
    const sameAsBase =
      !!draft &&
      draft.materi === base.materi &&
      draft.tugasPr === base.tugasPr &&
      draft.uraianKejadian === base.uraianKejadian &&
      JSON.stringify(draft.absensiList) === JSON.stringify(base.absensiList);

    if (draft && draftHasContent && !sameAsBase) {
      setMateri(draft.materi);
      setTugasPr(draft.tugasPr);
      setAbsensiList(draft.absensiList);
      setUraianKejadian(draft.uraianKejadian);
      setDraftRestoredAt(draft.savedAt);
    } else {
      setMateri(base.materi);
      setTugasPr(base.tugasPr);
      setAbsensiList(base.absensiList);
      setUraianKejadian(base.uraianKejadian);
      setDraftRestoredAt(null);
    }

    setDraftReady(true);
    // `existingEvidence` sengaja TIDAK di-reset di sini — pengelolaannya
    // dipisah ke efek di bawah supaya pratinjau foto tidak ikut terhapus.
    //
    // Dependensi sengaja berupa identitas (string), bukan objek `slot`: timer
    // 30 detik di InputAgenda membuat objek slot baru terus, sehingga memakai
    // objek akan mengulang efek ini dan mengosongkan isian.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaIdentity]);

  /**
   * Sinkronisasi foto dengan agenda yang sedang dibuka.
   *
   * Dipicu HANYA oleh dua hal: agenda benar-benar berganti (`agendaIdentity`),
   * atau foto di basis data berubah (`incomingEvidencePath`). Perhitungan ulang
   * status slot tiap 30 detik tidak mengubah keduanya, sehingga tidak lagi
   * menghapus pratinjau.
   *
   * Dua gejala yang diperbaiki:
   *
   *  - Sebelum disimpan: foto yang baru dijepret hidup di state lokal
   *    (`setExistingEvidence(uploaded)`) sementara agenda di basis data belum
   *    ada. Dulu efek inisialisasi berjalan ulang tiap 30 detik dan
   *    menimpanya dengan `null`.
   *  - Sesudah disimpan: data agenda dari basis data TIDAK memuat `signedUrl`
   *    (lihat `mapAgendaRow`). Dulu efek inisialisasi mengembalikan state ke
   *    objek itu, dan efek pemuat URL tidak ikut berjalan karena
   *    `storage_path`-nya tidak berubah — pratinjau mati sampai halaman dimuat
   *    ulang.
   */
  const incomingEvidencePath = existingAgenda?.evidence?.storage_path ?? null;

  useEffect(() => {
    setExistingEvidence(existingAgenda?.evidence ?? null);
    // Dipicu oleh identitas agenda dan path foto; `existingAgenda` dibaca
    // sebagai nilai terbaru pada saat itu.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaIdentity, incomingEvidencePath]);

  // Simpan draf tertunda. Menunggu `draftReady` penting: tanpa itu, efek ini
  // menulis keadaan kosong awal dan menghapus draf sebelum sempat dibaca.
  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const hasContent =
        materi.trim() !== '' ||
        tugasPr.trim() !== '' ||
        uraianKejadian.trim() !== '' ||
        absensiList.length > 0;
      if (!hasContent) {
        removeDraft(draftKey);
        return;
      }
      writeDraft(draftKey, {
        materi,
        tugasPr,
        absensiList,
        uraianKejadian,
        savedAt: Date.now(),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [materi, tugasPr, absensiList, uraianKejadian, draftReady, draftKey]);

  const discardDraft = () => {
    removeDraft(draftKey);
    setDraftRestoredAt(null);
    const base = existingAgenda
      ? {
          materi: existingAgenda.kbm?.[0]?.materi || '',
          tugasPr: existingAgenda.kbm?.[0]?.tugas_pr || '',
          absensiList: (existingAgenda.absensi || []).map((a) => ({
            siswa_id: a.siswa_id,
            status: a.status as AbsensiInputItem['status'],
          })),
          uraianKejadian: existingAgenda.kejadian?.[0]?.uraian_kejadian || '',
        }
      : { materi: '', tugasPr: '', absensiList: [], uraianKejadian: '' };
    setMateri(base.materi);
    setTugasPr(base.tugasPr);
    setAbsensiList(base.absensiList);
    setUraianKejadian(base.uraianKejadian);
    showToast('info', 'Draf dibuang. Isian kembali ke versi tersimpan.');
  };

  // Load Siswa list for this class
  useEffect(() => {
    let isMounted = true;
    async function loadSiswa() {
      if (!kelas) return;
      setIsLoadingSiswa(true);
      try {
        const list = await getDaftarSiswa(kelas);
        if (isMounted) setSiswaKelas(list);
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

  /**
   * Muat URL tampil untuk foto yang sedang ditampilkan.
   *
   * Memakai `getEvidenceDisplayUrl` (object URL dari blob yang diunduh sekali),
   * bukan signed URL langsung. Alasannya: signed URL punya masa berlaku, dan
   * form ini bisa dibiarkan terbuka lama — sebelumnya pratinjau bisa mati
   * sendiri saat token kedaluwarsa. Isi berkas bukti bersifat tetap, jadi
   * menyimpannya di memori aman.
   *
   * `signedUrl` ikut jadi dependensi supaya URL diambil ulang setiap kali
   * state kembali ke objek tanpa URL (mis. setelah pindah agenda).
   */
  useEffect(() => {
    const path = existingEvidence?.storage_path;
    if (!path || existingEvidence?.signedUrl) return;

    let isMounted = true;
    getEvidenceDisplayUrl(path).then((url) => {
      if (!isMounted || !url) return;
      // Pastikan jawaban yang terlambat tidak menempel ke foto yang berbeda.
      setExistingEvidence((prev) =>
        prev && prev.storage_path === path ? { ...prev, signedUrl: url } : prev
      );
    });
    return () => {
      isMounted = false;
    };
  }, [existingEvidence?.storage_path, existingEvidence?.signedUrl]);

  // ------------------------------------------------------------------ //
  // Kehadiran                                                           //
  // ------------------------------------------------------------------ //

  const handleAddAbsensi = () => {
    if (siswaKelas.length === 0) {
      showToast('error', `Belum ada data siswa di ${kelas}.`);
      return;
    }
    if (absensiList.length >= siswaKelas.length) {
      showToast('info', 'Semua siswa sudah masuk dalam daftar tidak hadir.');
      return;
    }
    // Sengaja TIDAK menebak siswa maupun status: sebelumnya baris baru langsung
    // terisi siswa pertama yang belum terdaftar + status "Sakit", sehingga
    // hampir selalu perlu dua koreksi sebelum datanya benar.
    setAbsensiList([...absensiList, { siswa_id: '', status: '' }]);
  };

  const handleRemoveAbsensi = (index: number) => {
    setAbsensiList(absensiList.filter((_, i) => i !== index));
  };

  const handleAbsensiChange = (index: number, field: keyof AbsensiInputItem, value: string) => {
    const updated = [...absensiList];
    updated[index] = { ...updated[index], [field]: value };
    setAbsensiList(updated);
  };

  /** Siswa yang belum dipakai baris lain — mencegah satu siswa dicatat dua kali. */
  const availableStudents = (currentId: string) =>
    siswaKelas.filter(
      (s) => s.id === currentId || !absensiList.some((a) => a.siswa_id === s.id)
    );

  const absentCount = absensiList.filter((a) => a.siswa_id && a.status).length;
  const presentCount = Math.max(0, siswaKelas.length - absentCount);
  const isAbsensiComplete = absensiList.every((a) => a.siswa_id && a.status);

  /**
   * Baris absensi yang sudah lengkap — satu-satunya bentuk yang dikirim ke
   * server. Predikat tipe dipakai supaya `status: ''` (belum dipilih) benar-benar
   * tersingkir, bukan sekadar tersaring saat runtime.
   */
  const completeAbsensi = absensiList.filter(
    (a): a is { siswa_id: string; status: 'S' | 'I' | 'A' } => Boolean(a.siswa_id && a.status)
  );

  // ------------------------------------------------------------------ //
  // Foto                                                                //
  // ------------------------------------------------------------------ //

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
          canvas.toBlob((b) => resolve(b || file), 'image/webp', 0.85);
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
        const initSave = await simpanAgenda({
          schedule_id: scheduleId,
          actual_teacher_name: activeTeacherName || teacherName,
          sekolah: schoolName,
          kelas,
          tanggal: targetDate,
          kbm: [
            {
              jam_ke: `Jam ${periodNumber}`,
              nama_guru: teacherName,
              mapel: subjectName,
              // Penanda agenda setengah jadi — dibaca kembali oleh `isLocked`
              // agar agenda ini tidak terkunci sebelum guru menekan Simpan.
              materi: materi.trim() || DRAFT_MATERI_PLACEHOLDER,
              tugas_pr: tugasPr.trim() || undefined,
              is_badal: isSubstitute,
            },
          ],
          absensi: completeAbsensi,
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
      showToast('success', 'Foto dokumentasi berhasil disimpan.');
    } catch (err: any) {
      console.error('Evidence upload error:', err);
      showToast('error', 'Gagal mengunggah foto: ' + (err?.message || 'Periksa koneksi internet'));
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // ------------------------------------------------------------------ //
  // Kirim                                                               //
  // ------------------------------------------------------------------ //

  const isPhotoReady = Boolean(existingEvidence?.storage_path);
  const isMateriReady = Boolean(materi.trim());

  /**
   * Satu-satunya jalur validasi.
   *
   * Form sengaja memakai `noValidate` dan atribut `required` sudah dilepas:
   * sebelumnya browser mencegat lebih dulu dengan balon bawaannya, sehingga
   * pesan + arahkan-fokus buatan aplikasi tidak pernah berjalan. Sekarang
   * semua kekurangan ditangani dengan cara yang sama.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      showToast('info', 'Agenda yang sudah tersimpan tidak dapat diubah.');
      return;
    }

    if (!isMateriReady) {
      showToast('error', 'Materi pembelajaran belum diisi.');
      focusStep('materi');
      return;
    }

    if (!isPhotoReady) {
      showToast('info', 'Ambil foto dokumentasi dulu sebelum menyimpan agenda.');
      focusStep('foto');
      return;
    }

    if (!isAbsensiComplete) {
      showToast('error', 'Lengkapi dulu nama dan status siswa yang tidak hadir.');
      focusStep('absensi');
      return;
    }

    const evidence = existingEvidence;
    if (!evidence?.storage_path) return;

    setIsSubmitting(true);
    try {
      const scheduleId = schedule?.id || existingAgenda?.header.schedule_id || null;
      const agendaId = existingAgenda?.header.id || evidence.agenda_id;

      await simpanAgenda({
        agendaId,
        schedule_id: scheduleId,
        actual_teacher_name: activeTeacherName || teacherName,
        sekolah: schoolName,
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
        absensi: completeAbsensi,
        uraian_kejadian: uraianKejadian.trim() || undefined,
      });

      removeDraft(draftKey);

      showToast(
        'success',
        existingAgenda
          ? `Perubahan agenda ${kelas} (${subjectName}) berhasil disimpan.`
          : `Agenda ${kelas} (${subjectName}) berhasil diselesaikan.`
      );

      // Navigasi setelah simpan diurus pemanggil (`onSuccessSave`), supaya bisa
      // langsung membuka slot terlewat berikutnya. `onBack()` TIDAK dipanggil di
      // sini — dulu keduanya berjalan berurutan dan saling menimpa.
      //
      // `isSubmitting` sengaja TIDAK dikembalikan ke false saat berhasil:
      // pemanggil butuh waktu sesaat untuk memuat timeline dan berpindah slot,
      // dan selama itu tombol harus tetap mati agar tidak terkirim dua kali.
      onSuccessSave();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Gagal menyimpan agenda: ' + (err?.message || ''));
      setIsSubmitting(false);
    }
  };

  const isStepDone = {
    foto: isPhotoReady,
    materi: isMateriReady,
    kehadiran: isAbsensiComplete,
    catatan: Boolean(uraianKejadian.trim()),
  };

  return (
    /* Tidak ada lagi elemen tetap di halaman ini: bilah simpan ikut menggulir
       di ujung formulir. Ruang bawah hanya perlu melewati navigasi bawah HP
       (76px), dan `<main>` di TeacherShell sudah menyumbang `pb-24` (96px) —
       jadi tidak perlu tambahan padding di sini. */
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Kembali ke daftar jadwal"
            onClick={onBack}
            className="p-2.5 min-w-11 min-h-11 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shrink-0"
            title="Kembali ke Jadwal"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {isLocked ? 'Lihat Agenda' : 'Isi Agenda Mengajar'}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {schoolName} &bull; {targetDate}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold self-start sm:self-auto">
          <Clock className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            {startTime}–{endTime} · Jam ke-{periodNumber}
          </span>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* READ-ONLY SCHEDULE HEADER */}
        <div
          className={`p-4 rounded-2xl border ${
            isSubstitute ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          {isSubstitute && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-100 border border-amber-300 rounded-xl">
              <RefreshCw className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Mode Guru Pengganti (Badal)
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              className={`p-3 bg-white border rounded-xl shadow-2xs ${
                isSubstitute ? 'border-amber-100' : 'border-emerald-100'
              }`}
            >
              <span className="text-2xs font-bold text-slate-600 uppercase tracking-wider block">
                Kelas
              </span>
              <span className="text-base font-bold text-slate-900">{kelas}</span>
            </div>
            <div
              className={`p-3 bg-white border rounded-xl shadow-2xs ${
                isSubstitute ? 'border-amber-100' : 'border-emerald-100'
              }`}
            >
              <span className="text-2xs font-bold text-slate-600 uppercase tracking-wider block">
                Mata Pelajaran
              </span>
              <span className="text-base font-bold text-slate-900">{subjectName}</span>
            </div>
            <div
              className={`p-3 bg-white border rounded-xl shadow-2xs ${
                isSubstitute ? 'border-amber-100' : 'border-emerald-100'
              }`}
            >
              {isSubstitute ? (
                <>
                  <span className="text-2xs font-bold text-slate-600 uppercase tracking-wider block">
                    Guru Terjadwal
                  </span>
                  <span className="text-base font-semibold text-slate-500 line-through">
                    {scheduledTeacherName}
                  </span>
                  <span className="text-2xs font-bold text-amber-700 uppercase tracking-wider block mt-1.5">
                    Guru Pelaksana (Anda)
                  </span>
                  <span className="text-base font-bold text-slate-900">{activeTeacherName}</span>
                </>
              ) : (
                <>
                  <span className="text-2xs font-bold text-slate-600 uppercase tracking-wider block">
                    Guru Pengampu
                  </span>
                  <span className="text-base font-bold text-slate-900">{scheduledTeacherName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pemberitahuan draf yang dipulihkan — tidak muncul saat agenda terkunci */}
        {!isLocked && draftRestoredAt && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <RotateCcw className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-blue-900 leading-relaxed">
                <strong>Isian sebelumnya dipulihkan</strong> (tersimpan otomatis{' '}
                {new Date(draftRestoredAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                ). Periksa kembali sebelum menyimpan.
              </p>
            </div>
            <button
              type="button"
              onClick={discardDraft}
              className="shrink-0 px-3 py-2 min-h-10 text-xs font-bold text-blue-800 bg-white border border-blue-300 rounded-lg hover:bg-blue-100 transition"
            >
              Buang draf
            </button>
          </div>
        )}

        {/* ============ LANGKAH 1 — FOTO (duluan, karena diambil di kelas) ============ */}
        <FormStep
          step={1}
          title="Foto Dokumentasi Mengajar"
          hint="Ambil selfie Anda di ruang kelas. Ini bukti kehadiran mengajar dan wajib ada sebelum menyimpan."
          icon={<Camera className="w-4 h-4" aria-hidden="true" />}
          done={isStepDone.foto}
          required
          highlighted={highlighted === 'foto'}
          sectionRef={photoSectionRef}
        >
          {existingEvidence?.storage_path ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center max-h-72 border border-slate-300">
                <img
                  src={existingEvidence.signedUrl || ''}
                  alt={`Dokumentasi foto ${kelas}`}
                  className="w-full h-auto max-h-72 object-contain"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="text-xs text-emerald-900">
                    <p className="font-bold">Foto sudah tersimpan</p>
                    <p className="text-emerald-800 mt-0.5">
                      Diambil {formatDateTimeIndo(existingEvidence.captured_at)} · tidak dapat
                      diganti
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="px-3 py-2 min-h-10 bg-white border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg hover:bg-emerald-100 transition flex items-center gap-1.5 shrink-0"
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>Perbesar</span>
                </button>
              </div>
            </div>
          ) : isLocked ? (
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/70 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                <Camera className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500">Tidak ada foto dokumentasi</p>
                <p className="text-xs text-slate-500 mt-0.5 max-w-sm">
                  Agenda ini tersimpan tanpa foto.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/70 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <Camera className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Belum ada foto</p>
                <p className="text-xs text-slate-600 mt-0.5 max-w-sm">
                  Kamera depan akan terbuka. Pastikan wajah Anda terlihat dan ruang kelas jadi
                  latar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="w-full sm:w-auto px-5 py-3 min-h-12 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50"
              >
                {isUploadingPhoto ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span>Menyimpan foto…</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" aria-hidden="true" />
                    <span>Buka Kamera</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Input kamera dipakai bersama tombol "Buka Kamera" dan "Ganti Foto" */}
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleNativeCameraChange}
          />
        </FormStep>

        {/* ============ LANGKAH 2 — MATERI ============ */}
        <FormStep
          step={2}
          title="Materi Pembelajaran"
          hint="Ringkas apa yang diajarkan hari ini. Isian ini ikut tercetak di rekap."
          icon={<BookOpen className="w-4 h-4" aria-hidden="true" />}
          done={isStepDone.materi}
          required
          highlighted={highlighted === 'materi'}
          sectionRef={materiSectionRef}
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="agenda-materi"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Materi / Bahasan <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="agenda-materi"
                rows={5}
                aria-required="true"
                readOnly={isLocked}
                value={materi}
                onChange={(e) => setMateri(e.target.value)}
                placeholder="Contoh: Penjumlahan pecahan berpenyebut sama — latihan halaman 42."
                className={`w-full p-3.5 text-base rounded-xl border leading-relaxed ${
                  isLocked
                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                    : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600'
                }`}
              />
              <p className="text-xs text-slate-600 mt-1.5">
                Satu sampai dua kalimat sudah cukup.
              </p>
            </div>

            <div>
              <label
                htmlFor="agenda-tugas-pr"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Tugas / PR <span className="text-slate-600 font-normal">(opsional)</span>
              </label>
              <input
                id="agenda-tugas-pr"
                type="text"
                readOnly={isLocked}
                value={tugasPr}
                onChange={(e) => setTugasPr(e.target.value)}
                placeholder="Contoh: Latihan halaman 42 nomor 1–5"
                className={`w-full px-3.5 py-3 text-base rounded-xl border ${
                  isLocked
                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                    : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600'
                }`}
              />
            </div>
          </div>
        </FormStep>

        {/* ============ LANGKAH 3 — KEHADIRAN ============ */}
        <FormStep
          step={3}
          title="Kehadiran Siswa"
          hint="Semua siswa dianggap hadir. Catat hanya yang tidak masuk."
          icon={<UserCheck className="w-4 h-4" aria-hidden="true" />}
          done={isStepDone.kehadiran && absensiList.length > 0}
          highlighted={highlighted === 'absensi'}
          sectionRef={absensiSectionRef}
        >
          {isLoadingSiswa ? (
            <div className="py-4 text-center text-xs text-slate-600" role="status" aria-live="polite">
              Memuat data siswa…
            </div>
          ) : siswaKelas.length === 0 ? (
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Belum ada data siswa untuk kelas {kelas}. Hubungi administrator bila daftar siswa
                seharusnya sudah ada.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Ringkasan kehadiran */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-200">
                  {presentCount} hadir
                </span>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-semibold rounded-lg border border-blue-200">
                  {absensiList.filter((a) => a.status === 'S').length} sakit
                </span>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-semibold rounded-lg border border-amber-200">
                  {absensiList.filter((a) => a.status === 'I').length} izin
                </span>
                <span className="px-2.5 py-1 bg-rose-50 text-rose-800 font-semibold rounded-lg border border-rose-200">
                  {absensiList.filter((a) => a.status === 'A').length} alpa
                </span>
              </div>

              {absensiList.length === 0 ? (
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-semibold text-emerald-900">
                      Semua {siswaKelas.length} siswa hadir
                    </span>
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={handleAddAbsensi}
                      className="shrink-0 px-3 py-2 min-h-10 text-xs font-bold text-emerald-900 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 transition"
                    >
                      + Catat yang tidak hadir
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {absensiList.map((item, idx) => (
                      <div key={idx} className="p-3 space-y-2.5 bg-white">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 font-bold text-xs w-5 text-center shrink-0">
                            {idx + 1}.
                          </span>
                          <label className="sr-only" htmlFor={`absen-siswa-${idx}`}>
                            Nama siswa tidak hadir baris {idx + 1}
                          </label>
                          <select
                            id={`absen-siswa-${idx}`}
                            value={item.siswa_id}
                            disabled={isLocked}
                            onChange={(e) => handleAbsensiChange(idx, 'siswa_id', e.target.value)}
                            className={`flex-1 min-h-10 px-3 py-2 text-base rounded-lg ${
                              isLocked
                                ? 'bg-slate-50 text-slate-600 border-slate-200'
                                : 'bg-white text-slate-900 border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600'
                            }`}
                          >
                            <option value="">Pilih siswa…</option>
                            {availableStudents(item.siswa_id).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nama_siswa}
                              </option>
                            ))}
                          </select>
                          {!isLocked && (
                            <button
                              type="button"
                              aria-label={`Hapus baris ${idx + 1}`}
                              onClick={() => handleRemoveAbsensi(idx)}
                              className="p-2 min-w-10 min-h-10 inline-flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {/* Status: tidak ada pilihan yang terisi lebih dulu */}
                        <div
                          role="group"
                          aria-label={`Status kehadiran baris ${idx + 1}`}
                          className="flex items-center gap-1.5 pl-7"
                        >
                          <span className="text-xs text-slate-600 font-medium mr-1">Status:</span>
                          {(
                            [
                              ['S', 'Sakit', 'bg-blue-600'],
                              ['I', 'Izin', 'bg-amber-500'],
                              ['A', 'Alpa', 'bg-rose-600'],
                            ] as const
                          ).map(([value, label, activeBg]) => (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={item.status === value}
                              disabled={isLocked}
                              onClick={() => handleAbsensiChange(idx, 'status', value)}
                              className={`px-3 py-2 min-h-10 rounded-lg text-xs font-bold border transition ${
                                item.status === value
                                  ? `${activeBg} text-white border-transparent shadow-xs`
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                              } ${isLocked ? 'cursor-default opacity-80' : ''}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!isAbsensiComplete && (
                    <p className="text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      Setiap baris perlu nama siswa dan status sebelum bisa disimpan.
                    </p>
                  )}

                  {!isLocked && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={handleAddAbsensi}
                        className="flex-1 py-2.5 min-h-10 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        <span>Tambah siswa tidak hadir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAbsensiList([])}
                        className="py-2.5 min-h-10 px-4 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center justify-center gap-1.5 transition"
                      >
                        <UserCheck className="w-4 h-4" aria-hidden="true" />
                        <span>Semua hadir</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </FormStep>

        {/* ============ LANGKAH 4 — CATATAN (opsional) ============ */}
        <FormStep
          step={4}
          title="Catatan Kejadian"
          hint="Kendala kelas, kejadian khusus siswa, atau catatan evaluasi."
          icon={<AlertCircle className="w-4 h-4" aria-hidden="true" />}
          done={isStepDone.catatan}
          optional
        >
          <label className="sr-only" htmlFor="agenda-kejadian">
            Catatan kejadian
          </label>
          <textarea
            id="agenda-kejadian"
            rows={3}
            readOnly={isLocked}
            value={uraianKejadian}
            onChange={(e) => setUraianKejadian(e.target.value)}
            placeholder="Contoh: dua siswa rebut di pertengahan jam, materi dilanjutkan setelah ditegur."
            className={`w-full p-3.5 text-base rounded-xl border leading-relaxed ${
              isLocked
                ? 'border-slate-200 bg-slate-50 text-slate-600'
                : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600'
            }`}
          />
        </FormStep>

        {/* Lightbox Modal */}
        <PhotoLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          imageUrl={existingEvidence?.signedUrl}
          uploadedAt={existingEvidence?.uploaded_at}
          capturedAt={existingEvidence?.captured_at}
          actualTeacherName={
            existingEvidence?.actual_teacher_name || activeTeacherName || teacherName
          }
          title={`Dokumentasi Foto - ${kelas} (${subjectName})`}
        />

        {/* Konfirmasi ganti foto dihapus: foto yang sudah tersimpan bersifat
            tetap dan tidak bisa diganti, sama seperti agendanya. */}

        {/* Bilah simpan — satu saja, ikut menggulir bersama form di paling bawah.
            Untuk agenda yang sudah tersimpan, tidak ada yang bisa disimpan lagi,
            jadi yang tersisa hanya jalan kembali. */}
        {isLocked ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs no-print">
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto py-3 min-h-12 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
            >
              Kembali ke Jadwal
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 no-print">
            <SaveChecklist
              materi={isMateriReady}
              foto={isPhotoReady}
              absensi={isAbsensiComplete}
              onFix={focusStep}
            />

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="py-3 min-h-11 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Kembali ke Jadwal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-3 min-h-12 px-6 bg-primary-700 hover:bg-primary-800 text-white text-sm font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 sm:ml-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Menyimpan…</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" aria-hidden="true" />
                    <span>Simpan Agenda</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Bagian berlangkah                                                          */
/* -------------------------------------------------------------------------- */

interface FormStepProps {
  step: number;
  title: string;
  hint: string;
  icon: React.ReactNode;
  done: boolean;
  required?: boolean;
  optional?: boolean;
  highlighted?: boolean;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

/**
 * Satu langkah pengisian.
 *
 * Latar belakangnya: sebelumnya form ini memakai dua kolom di layar lebar dan
 * satu kolom di HP, dengan judul bernomor Romawi I–IV. Karena kolom menumpuk
 * di HP, urutan yang benar-benar terlihat adalah I → III → II → IV — nomornya
 * justru menyesatkan. Sekarang satu kolom di semua ukuran layar, dan nomor
 * yang ditampilkan adalah urutan sebenarnya.
 *
 * Ukuran teks juga dinaikkan berjenjang: judul langkah 16px, label isian 14px,
 * isi isian 16px. Sebelumnya semuanya 14px sehingga hierarki tidak terlihat.
 */
const FormStep: React.FC<FormStepProps> = ({
  step,
  title,
  hint,
  icon,
  done,
  required = false,
  optional = false,
  highlighted = false,
  sectionRef,
  children,
}) => (
  <section
    ref={sectionRef}
    aria-labelledby={`step-${step}-title`}
    className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all duration-300 ${
      highlighted ? 'border-rose-400 ring-4 ring-rose-200' : 'border-slate-200'
    }`}
  >
    <header className="flex items-start gap-3 pb-3 mb-4 border-b border-slate-100">
      <span
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
          done
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-100 text-slate-600 border border-slate-200'
        }`}
        aria-hidden="true"
      >
        {done ? <CheckCircle2 className="w-4 h-4" /> : step}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id={`step-${step}-title`}
            className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5"
          >
            <span className="text-slate-500" aria-hidden="true">
              {icon}
            </span>
            {title}
          </h2>
          {required && (
            <span className="text-2xs font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
              Wajib
            </span>
          )}
          {optional && (
            <span className="text-2xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
              Opsional
            </span>
          )}
          {done && (
            <span className="sr-only">Langkah ini sudah lengkap</span>
          )}
        </div>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{hint}</p>
      </div>
    </header>

    {children}
  </section>
);

/* -------------------------------------------------------------------------- */
/* Daftar periksa syarat simpan                                               */
/* -------------------------------------------------------------------------- */

/**
 * Syarat simpan ditampilkan SEBELUM guru menekan Simpan.
 *
 * Sebelumnya foto dokumentasi bersifat wajib tetapi tidak pernah disebutkan di
 * dekat tombolnya — guru mengisi semuanya, menekan Simpan, lalu ditolak lewat
 * notifikasi di sudut layar. Yang belum lengkap kini terlihat sekilas dan
 * dapat ditekan untuk langsung menuju bagiannya.
 */
const SaveChecklist: React.FC<{
  materi: boolean;
  foto: boolean;
  absensi: boolean;
  onFix: (step: 'foto' | 'materi' | 'absensi') => void;
}> = ({ materi, foto, absensi, onFix }) => {
  const items = [
    { key: 'materi' as const, label: 'Materi', ok: materi, hint: 'belum diisi' },
    { key: 'foto' as const, label: 'Foto', ok: foto, hint: 'belum ada' },
    { key: 'absensi' as const, label: 'Kehadiran', ok: absensi, hint: 'belum lengkap' },
  ];

  return (
    <ul className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="Kelengkapan sebelum menyimpan">
      {items.map((item) =>
        item.ok ? (
          <li key={item.key}>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border font-semibold bg-emerald-50 text-emerald-800 border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              {item.label}
              <span className="sr-only">: sudah lengkap</span>
            </span>
          </li>
        ) : (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onFix(item.key)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border font-semibold bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 transition"
            >
              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
              {item.label}
              <span className="sr-only">: {item.hint}, tekan untuk menuju bagiannya</span>
            </button>
          </li>
        )
      )}
    </ul>
  );
};
