import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DAFTAR_KELAS,
  type KelasOption,
  type AgendaKBM,
  type Siswa,
  type Guru,
  type FullAgenda,
} from '../types';
import {
  getDaftarSiswa,
  getDaftarGuru,
  simpanAgenda,
  checkGuruKelas,
} from '../services/agendaService';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Trash2,
  Save,
  Check,
  Loader2,
  AlertTriangle,
  RotateCcw,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(!!draft.current && !editData);

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

  // Load Guru list
  useEffect(() => {
    async function loadGuru() {
      try {
        const guruData = await getDaftarGuru();
        setDaftarGuru(guruData);
      } catch (err) {
        console.warn('Gagal memuat data guru:', err);
      }
    }
    loadGuru();
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

  const handleAddKbmRow = () => {
    const nextJam = kbmRows.length + 1;
    const defaultGuru = activeTeacherName || (daftarGuru.length > 0 ? daftarGuru[0].nama_guru : '');
    setKbmRows([
      ...kbmRows,
      {
        jam_ke: `${nextJam}`,
        nama_guru: defaultGuru,
        mapel: '',
        materi: '',
        tugas_pr: '',
        is_badal: isBadalChecked,
      },
    ]);
  };

  const handleInsertIstirahat = () => {
    setKbmRows([
      ...kbmRows,
      {
        jam_ke: 'Istirahat',
        nama_guru: '-',
        mapel: 'ISTIRAHAT',
        materi: 'Istirahat / Snack time',
        tugas_pr: '',
        is_badal: false,
      },
    ]);
  };

  const handleInsertIsoma = () => {
    setKbmRows([
      ...kbmRows,
      {
        jam_ke: 'Isoma',
        nama_guru: '-',
        mapel: 'ISOMA',
        materi: 'Istirahat, Sholat & Makan Siang',
        tugas_pr: '',
        is_badal: false,
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

    const invalidKbm = kbmRows.some(
      (r) => !r.jam_ke.trim() || !r.mapel.trim() || !r.materi.trim()
    );
    if (invalidKbm) {
      showToast('error', 'Mohon lengkapi Jam Ke, Mapel, dan Materi pada semua baris KBM.');
      return;
    }

    setIsSubmitting(true);
    try {
      await simpanAgenda({
        agendaId: editData?.header.id,
        sekolah: 'SDIT AS-SYIFA',
        kelas,
        tanggal,
        kbm: kbmRows.map((r) => ({
          ...r,
          nama_guru: r.nama_guru || activeTeacherName || '-',
          is_badal: Boolean(r.is_badal || isBadalChecked),
        })),
        absensi: absensiList,
        uraian_kejadian: uraianKejadian,
      });

      if (!editData) {
        clearDraft();
        setDraftSaved(false);
      }

      showToast(
        'success',
        editData
          ? `Koreksi agenda ${kelas} tanggal ${tanggal} berhasil disimpan.`
          : `Agenda ${kelas} tanggal ${tanggal} berhasil disimpan.`
      );

      const defaultGuru = activeTeacherName || (daftarGuru.length > 0 ? daftarGuru[0].nama_guru : '');
      setKbmRows([
        {
          jam_ke: '1-2',
          nama_guru: defaultGuru,
          mapel: '',
          materi: '',
          tugas_pr: '',
          is_badal: false,
        },
        {
          jam_ke: '3-4',
          nama_guru: defaultGuru,
          mapel: '',
          materi: '',
          tugas_pr: '',
          is_badal: false,
        },
      ]);
      setAbsensiList([]);
      setUraianKejadian('');
      setIsBadalChecked(false);

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
    <div className="max-w-4xl mx-auto">
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
              className="px-2.5 py-1 bg-white border border-amber-300 rounded font-semibold text-amber-800 hover:bg-amber-100 transition"
            >
              Batal Koreksi
            </button>
          )}
        </div>
      )}

      {/* Unified Single Sheet / Form Container */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden"
      >
        {/* Form Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {editData ? 'Koreksi Jurnal Agenda Kelas' : 'Jurnal & Agenda Kelas'}
              </h2>
              <p className="text-xs text-slate-500">
                SDIT AS-SYIFA &bull; Guru Aktif: <strong>{activeTeacherName || 'Guru'}</strong>
              </p>
            </div>
            {draftSaved && !editData && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Draft tersimpan otomatis</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tingkat Kelas
              </label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value as KelasOption)}
                className="w-full px-3 py-2 text-sm font-semibold rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
              >
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Pelaksanaan
              </label>
              <input
                type="date"
                max={todayStr}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Otomatis hari ini ({todayStr}). Dapat dipilih manual untuk agenda susulan lalu.
              </span>
            </div>
          </div>

          {/* Validasi Guru Kelas & Switch Guru Badal */}
          {!isValidatingGuru && !isGuruResmiKelas && activeTeacherName !== 'Administrator' && (
            <div className="mt-3.5 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Pemberitahuan Penugasan:</span> Anda tercatat bukan guru pengampu resmi untuk <strong>{kelas}</strong>.
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="badal-switch"
                  checked={isBadalChecked}
                  onChange={(e) => handleToggleBadal(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                />
                <label
                  htmlFor="badal-switch"
                  className="text-xs font-bold text-amber-900 cursor-pointer"
                >
                  Saya Mengajar Sebagai Guru Pengganti (Badal)
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 1: Kegiatan Belajar Mengajar (KBM) */}
        <div className={`p-4 sm:p-6 border-b border-slate-200 ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              I. Kegiatan Belajar Mengajar (KBM)
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInsertIstirahat}
                className="text-xs px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-medium transition"
              >
                + Istirahat
              </button>
              <button
                type="button"
                onClick={handleInsertIsoma}
                className="text-xs px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-medium transition"
              >
                + Isoma
              </button>
            </div>
          </div>

          {/* Desktop Table View */}
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
                {kbmRows.map((row, idx) => {
                  const isBreak = row.jam_ke === 'Istirahat' || row.jam_ke === 'Isoma';
                  return (
                    <tr key={idx} className={isBreak ? 'bg-slate-50' : 'bg-white'}>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="text"
                          required
                          value={row.jam_ke}
                          onChange={(e) => handleKbmChange(idx, 'jam_ke', e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        {isBreak ? (
                          <span className="text-xs text-slate-400 px-2">-</span>
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
                        <input
                          type="text"
                          required
                          placeholder="Mata Pelajaran"
                          value={row.mapel}
                          onChange={(e) => handleKbmChange(idx, 'mapel', e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded border border-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="text"
                          required
                          placeholder="Materi pokok pembelajaran"
                          value={row.materi}
                          onChange={(e) => handleKbmChange(idx, 'materi', e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="text"
                          placeholder="Tugas/PR"
                          value={row.tugas_pr || ''}
                          onChange={(e) => handleKbmChange(idx, 'tugas_pr', e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
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

          {/* Mobile Clean Form Rows */}
          <div className="md:hidden divide-y divide-slate-200 border border-slate-200 rounded-md">
            {kbmRows.map((row, idx) => {
              const isBreak = row.jam_ke === 'Istirahat' || row.jam_ke === 'Isoma';
              return (
                <div
                  key={idx}
                  className={`p-3 space-y-2 text-xs ${isBreak ? 'bg-slate-50' : 'bg-white'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 text-xs">Jam Ke:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={row.jam_ke}
                        onChange={(e) => handleKbmChange(idx, 'jam_ke', e.target.value)}
                        className="w-20 px-2 py-1 rounded border border-slate-300 font-bold focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveKbmRow(idx)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1"
                    >
                      Hapus
                    </button>
                  </div>

                  {!isBreak && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">
                          Guru Pengampu
                        </label>
                        {daftarGuru.length > 0 ? (
                          <select
                            value={row.nama_guru || activeTeacherName || ''}
                            onChange={(e) => handleKbmChange(idx, 'nama_guru', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs"
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
                            className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs"
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-0.5">
                            Mata Pelajaran
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Mapel"
                            value={row.mapel}
                            onChange={(e) => handleKbmChange(idx, 'mapel', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-0.5">
                            Tugas / PR
                          </label>
                          <input
                            type="text"
                            placeholder="Opsional"
                            value={row.tugas_pr || ''}
                            onChange={(e) => handleKbmChange(idx, 'tugas_pr', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">
                          Materi Pembelajaran
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Materi pokok..."
                          value={row.materi}
                          onChange={(e) => handleKbmChange(idx, 'materi', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddKbmRow}
            className="mt-3 w-full py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Baris Jam Pelajaran
          </button>
        </div>

        {/* Section 2: Absensi (Siswa Tidak Hadir) */}
        <div className={`p-4 sm:p-6 border-b border-slate-200 ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                II. Presensi (Siswa Tidak Hadir)
              </h3>
              <p className="text-[11px] text-slate-500">
                Secara default seluruh siswa dianggap HADIR. Hanya catat siswa yang berhalangan hadir.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddAbsensi}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-medium transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Siswa
            </button>
          </div>

          {absensiList.length === 0 ? (
            <div className="py-3 px-4 rounded border border-slate-200 bg-slate-50 text-xs text-slate-600">
              ✓ Seluruh siswa hadir lengkap (Nihil ketidakhadiran)
            </div>
          ) : (
            <div className="border border-slate-200 rounded divide-y divide-slate-200 text-xs">
              {absensiList.map((item, idx) => (
                <div key={idx} className="p-2 sm:p-2.5 flex items-center gap-2 bg-white">
                  <span className="text-slate-400 font-medium w-5 text-center">{idx + 1}.</span>
                  <div className="flex-1">
                    <select
                      value={item.siswa_id}
                      onChange={(e) => handleAbsensiChange(idx, 'siswa_id', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-500 font-medium"
                    >
                      {siswaKelas.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nama_siswa}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        handleAbsensiChange(idx, 'status', e.target.value as 'S' | 'I' | 'A')
                      }
                      className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-slate-500"
                    >
                      <option value="S">Sakit (S)</option>
                      <option value="I">Izin (I)</option>
                      <option value="A">Alpha (A)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAbsensi(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Catatan Kejadian Khusus */}
        <div className={`p-4 sm:p-6 border-b border-slate-200 ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            III. Catatan Kejadian Khusus (Opsional)
          </h3>
          <textarea
            rows={3}
            value={uraianKejadian}
            onChange={(e) => setUraianKejadian(e.target.value)}
            placeholder="Catatan kendala kelas, kejadian penting, siswa izin pulang awal, dsb..."
            className="w-full p-2.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500 text-slate-800"
          />
        </div>

        {/* Footer / Submit */}
        <div className="p-4 sm:p-6 bg-slate-50/60 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500">
            Periksa data sebelum menyimpan ke database.
          </span>
          <button
            type="submit"
            disabled={isSubmitting || isFormDisabled}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow-xs transition flex items-center gap-2 disabled:opacity-50"
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
    </div>
  );
};
