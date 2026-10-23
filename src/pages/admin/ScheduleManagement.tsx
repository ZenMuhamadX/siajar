import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  type AcademicYear,
  type ScheduleItem,
  type ScheduleDay,
  type ScheduleStatus,
  type PeriodTemplate,
  SCHEDULE_DAYS,
  DAY_TRANSLATION_MAP,
  type Guru,
  type MataPelajaran,
} from '../../types';
import { useClassLabels } from '../../contexts/ClassContext';
import {
  getAcademicYears,
  getSchedules,
  createSchedule,
  updateSchedule,
  setScheduleStatus,
  deleteSchedule,
  jadwalMencakupKelas,
  kelasDariJadwal,
} from '../../services/scheduleService';
import { getPeriodTemplates } from '../../services/periodTemplateService';
import { getDaftarGuru, getDaftarMapel } from '../../services/agendaService';
import { getHalaqohByKelas, getHalaqohUrutanMap } from '../../services/halaqohService';
import { findKelasId } from '../../services/classService';
import { buildClassRank } from '../../utils/classOrder';
import {
  compareSchedulesDefault,
  type ScheduleSortContext,
} from '../../utils/scheduleOrder';
import type { HalaqohTerdaftar } from '../../types';
import { PageHeader } from '../../components/admin/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { buildScheduleExportModel } from '../../services/export/scheduleExportModel';
import {
  downloadScheduleWorkbook,
  ScheduleExportError,
} from '../../services/export/scheduleExcelExport';
import { getSettingsSync } from '../../services/settings/settingsService';
import {
  Plus,
  CheckCircle2,
  Archive,
  Edit2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Clock,
  FileSpreadsheet,
  Loader2,
  Users,
} from 'lucide-react';
import {
  DataTable,
  StatusBadge,
  FilterBar,
  FormModal,
  formStyles,
  type Column,
} from '../../components/common';

interface ScheduleManagementProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onNavigateTab?: (tab: string) => void;
}

/** Label Indonesia untuk status (konsisten dengan StatusBadge). */
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktif',
  DRAFT: 'Draft',
  ARCHIVED: 'Diarsipkan',
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

/**
 * Urutan hari jadwal (konstanta, di luar komponen supaya referensinya stabil —
 * bila dibuat ulang tiap render, `useMemo` konteks sortir akan dihitung ulang
 * terus dan cache comparator-per-`ctx` jadi tak berguna).
 */
const DAY_ORDER: Record<string, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
};

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({
  showToast,
  onNavigateTab,
}) => {
  // Sumber kelas: master data, bukan konstanta hardcoded.
  const kelasLabels = useClassLabels();

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [teachers, setTeachers] = useState<Guru[]>([]);
  const [subjects, setSubjects] = useState<MataPelajaran[]>([]);
  const [periodTemplates, setPeriodTemplates] = useState<PeriodTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Nomor urut tiap halaqoh (Ummi) untuk menstabilkan urutan baris pada jam
   * yang sama. Hanya PENENTU SERI — bila gagal dimuat, sortir tetap jalan
   * memakai rantai sekunder yang lain.
   */
  const [halaqohUrutan, setHalaqohUrutan] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    getHalaqohUrutanMap()
      .then((m) => {
        if (alive) setHalaqohUrutan(m);
      })
      .catch(() => {
        /* urutan halaqoh hanya penentu seri; kegagalan tidak fatal */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Tampilan tunggal: satu tabel daftar (flat) + filter. Tidak ada mode
  //elompokan Per Hari / Per Guru / Per Kelas — semua itu cukup dijawab filter.
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  /**
   * Kelompok (halaqoh) milik kelas yang sedang dipilih di formulir, beserta
   * guru pilihan untuk MASING-MASING kelompok.
   *
   * Mapel Ummi diajarkan berkelompok: satu baris jadwal = satu kelompok = satu
   * guru. Karena itu guru tidak bisa menjadi satu pilihan tunggal di formulir —
   * ia dipilih per kelompok. Bentuk inilah yang menjaga prinsip "satu baris
   * jadwal = satu guru" tetap utuh meski jamnya sama.
   */
  const [halaqohKelas, setHalaqohKelas] = useState<HalaqohTerdaftar[]>([]);
  const [guruPerHalaqoh, setGuruPerHalaqoh] = useState<Record<string, string>>({});
  const [isLoadingHalaqoh, setIsLoadingHalaqoh] = useState(false);

  // Selected JP template for the form
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    day: 'MONDAY' as ScheduleDay,
    period_number: 1,
    start_time: '07:30',
    end_time: '08:05',
    kelas: '',
    subject_name: '',
    teacher_name: '',
    status: 'ACTIVE' as ScheduleStatus,
  });
  const [formConflictError, setFormConflictError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Kelas yang kelompoknya benar-benar sedang ditampilkan.
   *
   * Dihitung saat render — bukan disetel di dalam efek — supaya daftar kelompok
   * tidak pernah tampil untuk kelas yang salah selama satu frame, dan supaya
   * efek di bawah tidak perlu memanggil `setState` secara sinkron (yang memicu
   * render berantai). Efek hanya MENGAMBIL data; keputusan "apakah datanya
   * masih relevan" ada di sini dan di pemeriksaan `cancelled`.
   */
  const kelasHalaqohAktif = isEditModalOpen ? formData.kelas : '';

  // Dialog hapus (menggantikan confirm() bawaan browser)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Export Excel (Stage 5.2)
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Export jadwal ke .xlsx.
   *
   * Sumber data = state `schedules`, yang sudah di-scope ke `selectedAYId`
   * oleh `getSchedules({ academicYearId })`. Sengaja TIDAK memakai
   * `filteredSchedules`: filter hari/kelas/guru/status di layar tidak
   * mempersempit file, supaya jadwal mingguan yang dihasilkan utuh dan
   * siap dicetak. Tidak ada query baru, tidak ada perubahan business logic.
   */
  const handleExportExcel = async () => {
    if (isExporting) return;

    if (!selectedAYId) {
      showToast('error', 'Pilih tahun ajaran terlebih dahulu.');
      return;
    }
    const academicYearName = academicYears.find((y) => y.id === selectedAYId)?.name;
    if (!academicYearName) {
      showToast('error', 'Tahun ajaran tidak ditemukan. Muat ulang halaman lalu coba lagi.');
      return;
    }
    if (schedules.length === 0) {
      showToast('error', 'Belum ada jadwal untuk tahun ajaran ini.');
      return;
    }

    setIsExporting(true);
    try {
      // Pengaturan dibaca saat klik (sinkron dari cache provider) supaya
      // perubahan di halaman Pengaturan langsung berlaku tanpa perlu reload,
      // tanpa membuat halaman Jadwal ikut re-render.
      const settings = getSettingsSync();
      const model = buildScheduleExportModel({
        schedules,
        academicYearName,
        schoolName: settings.schoolName,
        teachers,
        // Warna latar sel diambil dari master mapel (kolom `warna`).
        subjects,
        // Kolom kelas pada sheet mingguan, urut tingkat lalu rombel.
        classOptions: kelasLabels,
        showTeacherName: settings.excel.showTeacherName,
        includeDraft: settings.excel.includeDraft,
      });
      const fileName = await downloadScheduleWorkbook(model, settings.excel);
      showToast(
        'success',
        `${fileName} berhasil diunduh (${model.exportedCount} slot, ${model.academicYearName}).`,
      );
    } catch (err) {
      showToast(
        'error',
        err instanceof ScheduleExportError ? err.message : 'Gagal mengekspor jadwal.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Load masters & initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ayList, gList, mList] = await Promise.all([
        getAcademicYears(),
        getDaftarGuru(),
        getDaftarMapel(),
      ]);

      setAcademicYears(ayList);
      setTeachers(gList);
      setSubjects(mList);

      // Default to active academic year
      let currentAYId = selectedAYId;
      if (!currentAYId || !ayList.some((y) => y.id === currentAYId)) {
        const activeAY = ayList.find((y) => y.status === 'ACTIVE') || ayList[0];
        if (activeAY) {
          currentAYId = activeAY.id;
          setSelectedAYId(currentAYId);
        }
      }

      if (currentAYId) {
        const [schList, ptList] = await Promise.all([
          getSchedules({ academicYearId: currentAYId }),
          getPeriodTemplates(currentAYId, true),
        ]);
        setSchedules(schList);
        setPeriodTemplates(ptList);
      } else {
        setSchedules([]);
        setPeriodTemplates([]);
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Gagal memuat data jadwal: ' + (err?.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Salinan `schedules` terbaru untuk dibaca di dalam efek tanpa menjadikannya
   * dependensi.
   *
   * Efek pemuatan kelompok perlu tahu guru apa yang sudah tersimpan, tetapi
   * kalau `schedules` masuk daftar dependensi, setiap penyimpanan jadwal akan
   * memicu efek itu lagi — dan menimpa pilihan guru yang baru saja dibuat
   * pengguna. Ref membuat nilainya selalu segar sekaligus tidak memicu efek.
   */
  const schedulesRef = useRef(schedules);
  schedulesRef.current = schedules;

  /**
   * Muat kelompok kelas + guru yang sudah tersimpan, setiap kali kelas di
   * formulir berganti.
   *
   * Dijalankan untuk SEMUA mapel (bukan hanya yang berkelompok) karena nilai
   * yang dipilih di sini juga dipakai saat mengubah mapel dari biasa menjadi
   * berkelompok. Menunda pemuatan sampai mapel dipilih akan membuat daftar
   * kelompok berkedip kosong tepat saat pengguna butuh melihatnya.
   *
   * Edit: guru tiap kelompok diisi dari baris jadwal yang sudah ada (baris lain
   * dengan JP/hari sama yang menunjuk kelompok itu), supaya membuka formulir
   * tidak menghapus penugasan yang sudah benar.
   *
   * Seluruh `setState` terjadi SETELAH `await`, bukan di badan efek. Itulah yang
   * membuat efek ini tidak memicu render berantai: React hanya menerima
   * pembaruan saat data dari server benar-benar tiba.
   */
  useEffect(() => {
    // Kelas efektif: kosong berarti modal tertutup, sehingga daftar kelompok
    // tidak perlu ditampilkan sama sekali.
    if (!kelasHalaqohAktif) return;

    let cancelled = false;

    (async () => {
      try {
        const kelasId = await findKelasId(kelasHalaqohAktif);
        // Halaqoh kini milik tahun ajaran dan punya kelas sumber; yang relevan
        // untuk kelas ini adalah halaqoh yang kelas sumbernya memuatnya.
        const list =
          kelasId && selectedAYId ? await getHalaqohByKelas(kelasId, selectedAYId) : [];
        if (cancelled) return;

        // Prefill guru dari jadwal yang sudah ada pada slot yang sama.
        const guru: Record<string, string> = {};
        for (const h of list) {
          const sama = schedulesRef.current.find(
            (s) =>
              s.halaqoh_id === h.id &&
              // Baris halaqoh tidak punya `kelas` tunggal — pencocokan kelasnya
              // memakai daftar kelas sumber, kalau tidak guru tidak pernah
              // ter-prefill saat jadwalnya dibuka ulang.
              jadwalMencakupKelas(s, kelasHalaqohAktif) &&
              s.day === formData.day &&
              s.period_number === Number(formData.period_number),
          );
          if (sama) guru[h.id] = sama.teacher_name;
        }

        // Kelas sudah berganti lagi saat permintaan ini berjalan → hasilnya
        // sudah basi dan tidak boleh menimpa daftar kelompok yang baru.
        if (cancelled) return;

        setHalaqohKelas(list);
        setGuruPerHalaqoh(guru);
        setIsLoadingHalaqoh(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setHalaqohKelas([]);
          setIsLoadingHalaqoh(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kelasHalaqohAktif, formData.kelas, formData.day, formData.period_number, selectedAYId]);

  const handleAYChange = async (ayId: string) => {
    setSelectedAYId(ayId);
    setIsLoading(true);
    try {
      const [schList, ptList] = await Promise.all([
        getSchedules({ academicYearId: ayId }),
        getPeriodTemplates(ayId, true),
      ]);
      setSchedules(schList);
      setPeriodTemplates(ptList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    if (!selectedAYId) {
      showToast('error', 'Pilih atau buat Tahun Ajaran di menu Pengaturan > Tahun Ajaran.');
      return;
    }
    setEditingItem(null);
    setFormConflictError('');
    setGuruPerHalaqoh({});
    setHalaqohKelas([]);
    setIsLoadingHalaqoh(true);
    // Pre-select first active JP if available
    const firstPT = periodTemplates[0] ?? null;
    setSelectedTemplateId(firstPT?.id ?? '');
    setFormData({
      day: 'MONDAY',
      period_number: firstPT?.period_number ?? 1,
      start_time: firstPT?.start_time.slice(0, 5) ?? '07:30',
      end_time: firstPT?.end_time.slice(0, 5) ?? '08:05',
      kelas: kelasLabels[0] ?? '',
      subject_name: '',
      teacher_name: '',
      status: 'ACTIVE',
    });
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormConflictError('');
    setGuruPerHalaqoh({});
    setHalaqohKelas([]);
    setIsLoadingHalaqoh(true);
    // Try to match existing period_number to a template
    const matchedPT = periodTemplates.find((pt) => pt.period_number === item.period_number) ?? null;
    setSelectedTemplateId(matchedPT?.id ?? '');
    setFormData({
      day: item.day,
      period_number: item.period_number,
      start_time: item.start_time.slice(0, 5),
      end_time: item.end_time.slice(0, 5),
      // Baris halaqoh tidak punya `kelas` tunggal; kelas pertama dari kelas
      // sumbernya dipakai sebagai konteks formulir, karena dari kelas itulah
      // daftar kelompoknya dimuat kembali.
      kelas: kelasDariJadwal(item)[0] ?? item.kelas,
      subject_name: item.subject_name,
      teacher_name: item.teacher_name,
      status: item.status,
    });
    setIsEditModalOpen(true);
  };

  /**
   * Apakah mapel yang dipilih di formulir diajarkan berkelompok (halaqoh).
   *
   * Dihitung dari MASTER MAPEL (`is_halaqoh`), bukan dari teks nama mapel.
   * Sekolah bisa memutuskan sendiri mapel mana yang berkelompok tanpa aplikasi
   * menebak-nebak dari kata "Ummi" di namanya.
   */
  const selectedSubject = subjects.find((m) => m.nama_mapel === formData.subject_name);
  const isMapelHalaqoh = Boolean(selectedSubject?.is_halaqoh);

  // Save Schedule
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormConflictError('');

    if (!formData.subject_name) {
      setFormConflictError('Pilih Mata Pelajaran terlebih dahulu.');
      return;
    }
    if (isMapelHalaqoh) {
      if (halaqohKelas.length === 0) {
        setFormConflictError(
          'Kelas ini belum punya kelompok (halaqoh). Bagi siswanya dulu di menu Halaqoh.',
        );
        return;
      }
      if (halaqohKelas.some((h) => !guruPerHalaqoh[h.id])) {
        setFormConflictError(
          'Setiap kelompok harus punya guru. Lengkapi dulu guru untuk semua kelompok.',
        );
        return;
      }
    } else if (!formData.teacher_name) {
      setFormConflictError('Pilih Guru terlebih dahulu.');
      return;
    }
    if (periodTemplates.length > 0 && !selectedTemplateId) {
      setFormConflictError('Pilih Jam Pelajaran (JP) terlebih dahulu.');
      return;
    }
    if (formData.start_time >= formData.end_time) {
      setFormConflictError('Jam mulai harus lebih awal dari jam selesai.');
      return;
    }

    // RLS relies on schedule.teacher_id / subject_id, not the name text.
    // Resolve the master row so the ID is always stored.
    const subject = subjects.find((m) => m.nama_mapel === formData.subject_name);

    if (!subject) {
      setFormConflictError(
        'Mata pelajaran tidak ditemukan di master data. Muat ulang halaman lalu coba lagi.'
      );
      return;
    }

    /** Baris dasar bersama untuk semua jalur simpan. */
    const base = {
      academic_year_id: selectedAYId,
      day: formData.day,
      period_number: Number(formData.period_number),
      start_time: formData.start_time,
      end_time: formData.end_time,
      kelas: formData.kelas,
      subject_name: formData.subject_name,
      subject_id: subject.id,
      status: formData.status,
      ...(selectedTemplateId ? { period_template_id: selectedTemplateId } : {}),
    };

    setIsSaving(true);
    try {
      if (isMapelHalaqoh) {
        // Satu baris jadwal per kelompok — inilah bentuk B. Dua kelompok pada
        // jam yang sama menjadi DUA baris, masing-masing dengan guru sendiri,
        // sehingga "satu baris jadwal = satu guru" tetap benar.
        const targets = halaqohKelas.map((h) => ({
          halaqohId: h.id,
          halaqohNama: h.nama,
          guruNama: guruPerHalaqoh[h.id],
          guru: teachers.find((t) => t.nama_guru === guruPerHalaqoh[h.id]),
        }));

        const missingTeacher = targets.find((t) => !t.guru);
        if (missingTeacher) {
          setFormConflictError(
            `Guru "${missingTeacher.guruNama}" tidak ada di master data. Muat ulang halaman lalu coba lagi.`,
          );
          setIsSaving(false);
          return;
        }

        // Bandingkan dengan baris yang sudah ada pada slot ini untuk kelas ini.
        // Pencocokan kelas WAJIB memakai daftar kelas sumber: baris halaqoh tidak
        // punya `kelas` tunggal, jadi perbandingan label langsung selalu gagal —
        // akibatnya setiap penyimpanan membuat baris BARU alih-alih memperbarui
        // yang lama, dan jadwal halaqoh menumpuk ganda.
        const existingRows = schedules.filter(
          (s) =>
            jadwalMencakupKelas(s, formData.kelas) &&
            s.day === formData.day &&
            s.period_number === Number(formData.period_number) &&
            // Hanya baris berkelompok yang boleh tersentuh dari sini.
            Boolean(s.halaqoh_id),
        );

        // Baris yang bukan bagian dari formulir ini (mapel lain, jam lain) tidak
        // pernah ikut terhapus.
        const milikMapelIni = existingRows.filter(
          (s) => s.subject_name === formData.subject_name,
        );

        for (const t of targets) {
          const sudahAda = milikMapelIni.find((s) => s.halaqoh_id === t.halaqohId);
          if (sudahAda) {
            await updateSchedule(sudahAda.id, {
              ...base,
              teacher_name: t.guru!.nama_guru,
              teacher_id: t.guru!.id,
              halaqoh_id: t.halaqohId,
            });
          } else {
            await createSchedule({
              ...base,
              teacher_name: t.guru!.nama_guru,
              teacher_id: t.guru!.id,
              halaqoh_id: t.halaqohId,
              activity_type: 'KBM',
            });
          }
        }

        // Kelompok yang dilepas dari formulir (mis. kelompok dihapus setelah
        // jadwal dibuat) ikut dibuang, tapi HANYA baris mapel ini pada slot ini.
        const idDipakai = new Set(targets.map((t) => t.halaqohId));
        for (const s of milikMapelIni) {
          if (s.halaqoh_id && !idDipakai.has(s.halaqoh_id)) {
            await deleteSchedule(s.id);
          }
        }

        // Saat mengedit, baris asal mungkin berpindah kelas/hari/JP. Pencarian
        // `milikMapelIni` di atas memakai nilai BARU, sehingga baris lama tidak
        // akan pernah ditemukan dan akan tertinggal sebagai jadwal hantu di
        // slot yang sudah ditinggalkan. Karena itu baris asal dibuang terpisah
        // bila tidak lagi ikut dalam himpunan baris tujuan.
        if (editingItem?.halaqoh_id) {
          const masihDipakai = targets.some((t) => t.halaqohId === editingItem.halaqoh_id) &&
            jadwalMencakupKelas(editingItem, formData.kelas) &&
            editingItem.day === formData.day &&
            editingItem.period_number === Number(formData.period_number);
          const barisLamaMasihAda = milikMapelIni.some((s) => s.id === editingItem.id);
          if (!masihDipakai && !barisLamaMasihAda) {
            await deleteSchedule(editingItem.id);
          }
        }

        showToast(
          'success',
          editingItem
            ? `Jadwal berkelompok diperbarui (${targets.length} kelompok).`
            : `Jadwal berkelompok dibuat (${targets.length} kelompok, ${formData.kelas}).`,
        );
      } else {
        const selectedTeacher = teachers.find((t) => t.nama_guru === formData.teacher_name);
        if (!selectedTeacher) {
          setFormConflictError(
            'Guru tidak ditemukan di master data. Muat ulang halaman lalu coba lagi.',
          );
          setIsSaving(false);
          return;
        }

        if (editingItem) {
          await updateSchedule(editingItem.id, {
            ...base,
            teacher_name: formData.teacher_name,
            teacher_id: selectedTeacher.id,
          });
          showToast('success', 'Jadwal berhasil diperbarui.');
        } else {
          await createSchedule({
            ...base,
            teacher_name: formData.teacher_name,
            teacher_id: selectedTeacher.id,
            activity_type: 'KBM',
          });
          showToast('success', 'Jadwal baru berhasil dibuat.');
        }
      }

      setIsEditModalOpen(false);
      const updated = await getSchedules({ academicYearId: selectedAYId });
      setSchedules(updated);
    } catch (err: any) {
      setFormConflictError(err?.message || 'Gagal menyimpan jadwal.');
    } finally {
      setIsSaving(false);
    }
  };

  // Status toggle
  const handleToggleStatus = async (item: ScheduleItem) => {
    const nextStatus: ScheduleStatus =
      item.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    try {
      await setScheduleStatus(item.id, nextStatus);
      showToast('success', `Status jadwal diubah menjadi ${statusLabel(nextStatus)}.`);
      const updated = await getSchedules({ academicYearId: selectedAYId });
      setSchedules(updated);
    } catch (err: any) {
      showToast('error', 'Gagal mengubah status: ' + (err?.message || ''));
    }
  };

  // Delete (buka dialog konfirmasi)
  const handleDelete = (item: ScheduleItem) => {
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSchedule(deleteTarget.id);
      showToast('info', 'Jadwal dihapus.');
      setDeleteTarget(null);
      const updated = await getSchedules({ academicYearId: selectedAYId });
      setSchedules(updated);
    } catch (err: any) {
      showToast('error', 'Gagal menghapus jadwal: ' + (err?.message || ''));
    } finally {
      setIsDeleting(false);
    }
  };

  // // Seed reference
  // const handleSeedReference = async () => {
  //   if (
  //     confirm(
  //       'Generate jadwal referensi otomatis 2026/2027 untuk seluruh kelas? Jadwal yang sudah ada tidak akan diduplikasi.'
  //     )
  //   ) {
  //     try {
  //       setIsLoading(true);
  //       const res = await seedAcademicYearAndReferenceSchedule(
  //         teachers.map((t) => t.nama_guru),
  //         selectedAYId
  //       );
  //       showToast(
  //         'success',
  //         `Sukses mengenerate ${res.createdCount} slot jadwal referensi 2026/2027!`
  //       );
  //       await loadData();
  //     } catch (err: any) {
  //       showToast('error', 'Gagal generate referensi: ' + (err?.message || ''));
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   }
  // };

  /**
   * Konteks sortir jadwal. Rank kelas dibangun dari master (tingkat → rombel)
   * dan `labelsOf` memakai `kelasDariJadwal` — keduanya yang membuat baris
   * halaqah (berkelas kosong) menempel di kelas sumbernya, bukan meloncat ke
   * atas 1A. Di-`useMemo` supaya referensinya stabil dan aman dipakai sebagai
   * kunci cache di `compareSchedulesDefault`.
   */
  const sortCtx: ScheduleSortContext = useMemo(
    () => ({
      dayOrder: DAY_ORDER,
      kelasRank: buildClassRank(kelasLabels),
      halaqohUrutan,
      labelsOf: kelasDariJadwal,
    }),
    [kelasLabels, halaqohUrutan],
  );

  const isFiltered =
    filterDay !== 'ALL' ||
    filterTeacher !== 'ALL' ||
    filterClass !== 'ALL' ||
    filterStatus !== 'ALL' ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setFilterDay('ALL');
    setFilterTeacher('ALL');
    setFilterClass('ALL');
    setFilterStatus('ALL');
    setSearchQuery('');
  };

  const filteredSchedules = schedules
    .filter((s) => {
      if (filterDay !== 'ALL' && s.day !== filterDay) return false;
      if (filterTeacher !== 'ALL' && s.teacher_name !== filterTeacher) return false;
      if (filterClass !== 'ALL' && !jadwalMencakupKelas(s, filterClass)) return false;
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSubj = s.subject_name.toLowerCase().includes(q);
        const matchTeach = s.teacher_name.toLowerCase().includes(q);
        // Pencarian kelas memakai daftar kelasnya, supaya baris halaqoh lintas
        // kelas ikut ketemu saat dicari lewat salah satu kelas sumbernya.
        const matchClass = kelasDariJadwal(s).some((label) =>
          label.toLowerCase().includes(q),
        );
        if (!matchSubj && !matchTeach && !matchClass) return false;
      }
      return true;
    })
    .sort((a, b) => compareSchedulesDefault(a, b, sortCtx));

  // KPI mengikuti filter yang sedang aktif, supaya angka == baris yang terlihat
  const kpiSource = isFiltered ? filteredSchedules : schedules;
  const activeCount = kpiSource.filter((s) => s.status === 'ACTIVE').length;
  const draftOrArchiveCount = kpiSource.length - activeCount;
  const uniqueTeachersCount = new Set(kpiSource.map((s) => s.teacher_name)).size;

  // ── Cell renderers: satu sumber untuk SEMUA mode tampilan ──
  const cellDay = (item: ScheduleItem) => (
    <span className="font-semibold text-slate-800">{DAY_TRANSLATION_MAP[item.day]}</span>
  );
  const cellTime = (item: ScheduleItem) => (
    <span className="font-mono text-xs text-slate-600 whitespace-nowrap">
      {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}
    </span>
  );
  const cellPeriod = (item: ScheduleItem) => (
    <span className="font-bold text-slate-700">{item.period_number}</span>
  );
  const cellClass = (item: ScheduleItem) => {
    // Baris halaqoh lintas kelas tidak punya satu `kelas` — selnya akan kosong
    // dan baris tampak anonim. Labelnya digabung dari kelas sumbernya.
    const labels = kelasDariJadwal(item);
    const teks = labels.length > 0 ? labels.join(', ') : '—';
    return (
      <span className="block truncate font-bold text-slate-900" title={teks}>
        {teks}
      </span>
    );
  };
  /* Nama kelompok sengaja SEBARIS dengan nama mapel, bukan ditumpuk di
   * bawahnya. Versi bertumpuk membuat sel jadi dua baris, dan karena tinggi
   * baris tabel ditentukan isi, setiap baris halaqoh tampil ~20px lebih tinggi
   * daripada baris biasa — daftar jadi bergerigi. Dengan sebaris, tinggi semua
   * baris tetap sama tanpa perlu memaksa tinggi px (yang berisiko memotong
   * teks saat browser di-zoom).
   *
   * `min-w-0` + `truncate` wajib berpasangan dengan `table-fixed`: tanpa itu
   * nama kelompok yang panjang akan melebarkan kolom, bukan terpotong.
   *
   * Saat ada chip, nama mapel diberi `shrink-0` + `max-w-[55%]`. Tanpa itu
   * flex membagi penyusutan menurut lebar konten, sehingga "Ummi" (34px) ikut
   * menyusut jadi "Umm…" hanya karena nama kelompoknya panjang. Dengan cara
   * ini yang terpotong selalu chip-nya, dan nama mapel tetap utuh. */
  const cellSubject = (item: ScheduleItem) => {
    const adaChip = Boolean(item.halaqoh || item.halaqoh_id);
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={`min-w-0 truncate font-semibold text-slate-900 ${
            adaChip ? 'max-w-[55%] shrink-0' : ''
          }`}
          title={item.subject_name}
        >
          {item.subject_name}
        </span>
        {/* Baris berkelompok tanpa nama kelompok berarti data lama dari sebelum
            Fase 2 — ditandai supaya kelihatan dan bisa diperbaiki. */}
        {item.halaqoh ? (
          <span
            className="inline-flex min-w-0 shrink items-center gap-1 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700"
            title={item.halaqoh}
          >
            <Users className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{item.halaqoh}</span>
          </span>
        ) : item.halaqoh_id ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            <Users className="w-2.5 h-2.5 shrink-0" />
            Kelompok
          </span>
        ) : null}
      </div>
    );
  };
  const cellTeacher = (item: ScheduleItem) => (
    <span className="block truncate text-slate-700" title={item.teacher_name}>
      {item.teacher_name}
    </span>
  );
  const cellStatus = (item: ScheduleItem) => <StatusBadge status={item.status} />;
  const cellActions = (item: ScheduleItem) => {
    const isActive = item.status === 'ACTIVE';
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => handleToggleStatus(item)}
          className={`p-1.5 rounded-md transition ${
            isActive
              ? 'text-slate-600 hover:text-amber-600 hover:bg-amber-50'
              : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
          }`}
          title={isActive ? 'Arsipkan Jadwal' : 'Aktifkan Jadwal'}
        >
          {isActive ? <Archive className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        </button>
        <button
          aria-label="Edit Jadwal"
          type="button"
          onClick={() => handleOpenEdit(item)}
          className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-md transition"
          title="Edit Jadwal"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
         <button
           aria-label="Hapus Jadwal"
          type="button"
          onClick={() => handleDelete(item)}
          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
          title="Hapus Jadwal"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
       </div>
    );
  };

  /* Lebar kolom: begitu tabel memakai `table-fixed` (lihat `tableClassName`
   * di bawah), semua kolom WAJIB punya `width` — kolom tanpa width akan dibagi
   * rata sisa ruang dan hasilnya bisa lebih sempit dari isinya. Kolom yang
   * isinya dinamis (mapel, guru) memakai persen supaya ikut menyesuaikan lebar
   * layar; sisanya px karena isinya berukuran tetap (jam, angka, badge, ikon).
   *
   * Angka px di sini sudah memperhitungkan padding sel `px-4` (32px): kolom
   * Aksi butuh 3 tombol x 26px + 2 gap x 4px = 86px isi, jadi 120px. */
  const COL_DAY: Column<ScheduleItem> = {
    key: 'day',
    header: 'Hari',
    align: 'left',
    width: '110px',
    accessor: cellDay,
  };
  const COL_TIME: Column<ScheduleItem> = {
    key: 'time',
    header: 'Waktu',
    align: 'left',
    width: '130px',
    accessor: cellTime,
  };
  const COL_PERIOD: Column<ScheduleItem> = {
    key: 'period_number',
    header: 'JP',
    align: 'center',
    width: '60px',
    accessor: cellPeriod,
  };
  const COL_CLASS: Column<ScheduleItem> = {
    key: 'kelas',
    header: 'Kelas',
    align: 'center',
    width: '96px',
    accessor: cellClass,
  };
  const COL_SUBJECT: Column<ScheduleItem> = {
    key: 'subject_name',
    header: 'Mata Pelajaran',
    align: 'left',
    width: '26%',
    accessor: cellSubject,
  };
  const COL_TEACHER: Column<ScheduleItem> = {
    key: 'teacher_name',
    header: 'Guru Pengampu',
    align: 'left',
    width: '18%',
    accessor: cellTeacher,
  };
  const COL_STATUS: Column<ScheduleItem> = {
    key: 'status',
    header: 'Status',
    align: 'center',
    width: '110px',
    accessor: cellStatus,
  };
  const COL_ACTIONS: Column<ScheduleItem> = {
    key: 'actions',
    header: 'Aksi',
    align: 'right',
    width: '120px',
    accessor: cellActions,
  };

  const listColumns: Column<ScheduleItem>[] = [
    COL_DAY,
    COL_TIME,
    COL_PERIOD,
    COL_CLASS,
    COL_SUBJECT,
    COL_TEACHER,
    COL_STATUS,
    COL_ACTIONS,
  ];

  const sharedTableProps = {
    isLoading,
    isFiltered,
    onResetFilter: handleResetFilters,
    emptyTitle: isFiltered
      ? 'Tidak ada jadwal yang sesuai filter'
      : 'Belum ada jadwal pelajaran',
    emptyDescription: isFiltered
      ? 'Coba ubah kata kunci atau filter, lalu reset bila perlu.'
      : 'Klik "Tambah Jadwal" untuk membuat slot jadwal mengajar.',
  };

  return (
    <div className="space-y-5">
      {/* Consistent Page Header */}
      <PageHeader
        title="Jadwal Pembelajaran"
        description="Kelola jadwal pelajaran mingguan, penugasan guru, dan slot jam pelajaran."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal</span>
            </button>
          </div>
        }
      />

      {/* Summary KPI Cards (mengikuti filter yang sedang aktif) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Total Slot Jadwal</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{kpiSource.length}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {isFiltered ? `dari ${schedules.length} total` : 'seluruh tahun ajaran aktif'}
          </p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Jadwal Aktif</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Draft / Diarsipkan</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-600 mt-1">{draftOrArchiveCount}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Guru Terjadwal</p>
          <p className="text-xl sm:text-2xl font-bold text-primary-700 mt-1">{uniqueTeachersCount}</p>
        </div>
      </div>

      {/* Modern Compact Toolbar & Filters */}
      <div className="space-y-3">
        {/* Standardized FilterBar */}
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari mapel, guru, kelas..."
          isFiltered={isFiltered}
          onResetFilters={handleResetFilters}
          filters={
            <>
              {/* Tahun ajaran = cakupan data (bukan filter baris), tetap di baris filter */}
              <select
                value={selectedAYId}
                onChange={(e) => handleAYChange(e.target.value)}
                title="Tahun ajaran"
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-bold"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    TA {ay.name}
                    {ay.status === 'ACTIVE' ? ' (Aktif)' : ''}
                  </option>
                ))}
              </select>

              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs"
              >
                <option value="ALL">Semua Hari</option>
                {SCHEDULE_DAYS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>

              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs"
              >
                <option value="ALL">Semua Kelas</option>
                {kelasLabels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs max-w-[140px] truncate"
              >
                <option value="ALL">Semua Guru</option>
                {teachers.map((g) => (
                  <option key={g.id} value={g.nama_guru}>
                    {g.nama_guru}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Diarsipkan</option>
              </select>
            </>
          }
          actions={
            <div className="flex items-center gap-1.5">
              <button
                aria-label="Unduh jadwal pelajaran (.xlsx) untuk tahun ajaran terpilih"
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting}
                className={`${formStyles.ghostBtn} disabled:opacity-60 disabled:cursor-not-allowed`}
                title="Unduh jadwal pelajaran (.xlsx) untuk tahun ajaran terpilih"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                )}
                {isExporting ? 'Exporting...' : 'Export Excel'}
              </button>

               <button
                 aria-label="Refresh Data"
                type="button"
                onClick={() => loadData()}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                title="Refresh Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
             </div>
          }
        />
      </div>

      {/* Tampilan tunggal: satu tabel daftar (flat) + paginasi.
          formerly ada mode Per Hari / Per Guru / Per Kelas — sekarang cukup
          dijawab oleh filter hari/kelas/guru/status di FilterBar di atas.

          `table-fixed` = lebar kolom diambil dari `width` tiap kolom dan TIDAK
          lagi terpengaruh panjang isi. Pada layout `auto` bawaan browser,
          `width` hanya saran: nama kelompok/guru yang panjang melebarkan
          kolomnya sendiri sehingga kolom lain bergeser. Konsekuensinya semua
          isi sel dinamis harus `truncate` — lihat `cellSubject`/`cellTeacher`.
          `min-w` menjaga kolom ber-px tidak ikut terjepit di layar sempit;
          tabel lalu digeser ke samping lewat ScrollArea, bukan dipadatkan. */}
      <DataTable
        columns={listColumns}
        data={filteredSchedules}
        keyExtractor={(item) => item.id}
        {...sharedTableProps}
        tableClassName="table-fixed min-w-[1000px]"
        headerRightContent={
          <span className="text-xs font-semibold text-slate-500">
            {filteredSchedules.length}
            {isFiltered ? ` dari ${schedules.length}` : ''} slot jadwal
          </span>
        }
        enablePagination
        defaultPageSize={25}
      />


      {/* Create / Edit Schedule Modal — FormModal supaya aman saat form lebih
          tinggi dari layar (dulu kepala modal terpotong dan scroll-nya jatuh ke
          tabel jadwal di belakang). */}
      <FormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editingItem ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Baru'}
        subtitle={
          editingItem
            ? 'Perbarui informasi slot jadwal pelajaran'
            : 'Isi semua field untuk menambah slot jadwal'
        }
        onSubmit={handleSaveSchedule}
        busy={isSaving}
        size="lg"
        footer={(formId) => (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as ScheduleStatus })
                }
                className={`${formStyles.select} w-auto py-1`}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Aktif</option>
                <option value="ARCHIVED">Arsip</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className={formStyles.ghostBtn}
              >
                Batal
              </button>
              <button type="submit" form={formId} disabled={isSaving} className={formStyles.primaryBtn}>
                {isSaving ? 'Menyimpan...' : editingItem ? 'Perbarui' : 'Simpan Jadwal'}
              </button>
            </div>
          </>
        )}
      >
        {formConflictError && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p>{formConflictError}</p>
          </div>
        )}

        <div className="p-5 space-y-5">

                {/* ── Section 1: Waktu & Jadwal ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={formStyles.sectionTitle}>
                      Waktu &amp; Jadwal
                    </span>
                    <div className="flex-1 h-px bg-primary-100" />
                  </div>

                  {/* Hari + JP Selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={formStyles.label}>
                        Hari
                      </label>
                      <select
                        value={formData.day}
                        onChange={(e) =>
                          setFormData({ ...formData, day: e.target.value as ScheduleDay })
                        }
                        className={formStyles.select}
                      >
                        {SCHEDULE_DAYS.map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={formStyles.label}>
                        Jam Pelajaran (JP)
                      </label>
                      {periodTemplates.length === 0 ? (
                        <div className="px-2.5 py-2 text-xs bg-amber-50 border border-amber-200 rounded-lg text-amber-700 space-y-2">
                          <p>Belum ada JP. Konfigurasi dulu di menu Slot Waktu (JP).</p>
                          <button
                            type="button"
                            onClick={() => onNavigateTab?.('slot_waktu')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md transition"
                          >
                            <Clock className="w-3 h-3" />
                            <span>Buka Slot Waktu (JP)</span>
                          </button>
                        </div>
                      ) : (
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => {
                            const pt = periodTemplates.find((t) => t.id === e.target.value);
                            setSelectedTemplateId(e.target.value);
                            if (pt) {
                              setFormData((f) => ({
                                ...f,
                                period_number: pt.period_number,
                                start_time: pt.start_time.slice(0, 5),
                                end_time: pt.end_time.slice(0, 5),
                              }));
                            }
                          }}
                          className={formStyles.select}
                        >
                          <option value="">-- Pilih JP --</option>
                          {periodTemplates.map((pt) => (
                            <option key={pt.id} value={pt.id}>
                              {pt.label} · {pt.start_time.slice(0, 5)}–{pt.end_time.slice(0, 5)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Time preview read-only */}
                  {selectedTemplateId && formData.start_time && formData.end_time && (
                    <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 text-xs text-primary-700">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Waktu:{' '}
                        <strong>
                          {formData.start_time} – {formData.end_time}
                        </strong>
                        <span className="text-primary-500 ml-2">(dari Master JP)</span>
                      </span>
                    </div>
                  )}
                </div>


                {/* ── Section 2: Kelas & Mata Pelajaran ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={formStyles.sectionTitle}>
                      Kelas &amp; Mata Pelajaran
                    </span>
                    <div className="flex-1 h-px bg-primary-100" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={formStyles.label}>
                        Kelas
                      </label>
                      <select
                        value={formData.kelas}
                        onChange={(e) => {
                          setIsLoadingHalaqoh(true);
                          setFormData({ ...formData, kelas: e.target.value });
                        }}
                        className={formStyles.select}
                      >
                        {kelasLabels.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={formStyles.label}>
                        Mata Pelajaran
                      </label>
                      <select
                        value={formData.subject_name}
                        onChange={(e) =>
                          setFormData({ ...formData, subject_name: e.target.value })
                        }
                        className={formStyles.select}
                      >
                        <option value="">-- Pilih Mapel --</option>
                        {subjects.map((m) => (
                          <option key={m.id} value={m.nama_mapel}>
                            {m.nama_mapel}
                            {m.is_halaqoh ? ' (berkelompok)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Guru Pengampu ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={formStyles.sectionTitle}>
                      {isMapelHalaqoh ? 'Guru per Kelompok' : 'Guru Pengampu'}
                    </span>
                    <div className="flex-1 h-px bg-primary-100" />
                  </div>

                  {isMapelHalaqoh ? (
                    <>
                      <div className="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-700">
                        <Users className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>{formData.subject_name}</strong> diajarkan berkelompok.
                          Pilih guru untuk setiap kelompok — satu kelompok menjadi satu
                          baris jadwal pada jam yang sama.
                        </span>
                      </div>

                      {isLoadingHalaqoh ? (
                        <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Memuat kelompok kelas {formData.kelas}...</span>
                        </div>
                      ) : halaqohKelas.length === 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-2">
                          <p>
                            Kelas <strong>{formData.kelas}</strong> belum punya kelompok
                            (halaqoh). Bagi siswanya dulu sebelum menyusun jadwal.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditModalOpen(false);
                              onNavigateTab?.('halaqoh');
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md transition"
                          >
                            <Users className="w-3 h-3" />
                            <span>Buka menu Halaqoh</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {halaqohKelas.map((h) => (
                            <div
                              key={h.id}
                              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            >
                              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                                {h.nama}
                              </span>
                              <select
                                value={guruPerHalaqoh[h.id] ?? ''}
                                onChange={(e) =>
                                  setGuruPerHalaqoh((prev) => ({
                                    ...prev,
                                    [h.id]: e.target.value,
                                  }))
                                }
                                aria-label={`Guru untuk ${h.nama}`}
                                className={`${formStyles.select} w-auto max-w-[220px] py-1`}
                              >
                                <option value="">-- Pilih Guru --</option>
                                {teachers.map((g) => (
                                  <option key={g.id} value={g.nama_guru}>
                                    {g.nama_guru}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <select
                      value={formData.teacher_name}
                      onChange={(e) =>
                        setFormData({ ...formData, teacher_name: e.target.value })
                      }
                      className={formStyles.select}
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map((g) => (
                        <option key={g.id} value={g.nama_guru}>
                          {g.nama_guru}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

              </div>
      </FormModal>

      {/* Dialog konfirmasi hapus jadwal */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Hapus jadwal ini?"
        message={
          deleteTarget
            ? `Jadwal ${deleteTarget.kelas} — ${deleteTarget.subject_name} (${deleteTarget.teacher_name}) akan dihapus permanen.`
            : ''
        }
        confirmText="Hapus"
      />
    </div>
  );
};
