import { supabase } from '../lib/supabase';
import type { AgendaEvidence } from '../types';
import { compressEvidencePhoto } from '../utils/imageCompressor';

export const EVIDENCE_BUCKET = 'agenda-evidence';

// Cache signed URL agar tidak melakukan fetch berulang dalam 1 sesi
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Cache URL tampil berbasis blob (object URL).
 *
 * Kenapa perlu: signed URL punya masa berlaku (default 1 jam). Selama form
 * dibiarkan terbuka, URL itu bisa kedaluwarsa dan gambar yang sudah tampil
 * tiba-tiba gagal dimuat ulang. Karena berkas bukti foto bersifat tetap
 * (isinya hanya berubah bila guru sengaja mengambil ulang, dan saat itu cache
 * memang dibuang), menyimpan isinya di memori aman dan menghilangkan
 * ketergantungan pada masa berlaku token.
 *
 * `fetch` ke Storage bisa ditolak CORS pada instalasi self-hosted. Karena itu
 * kegagalan apa pun jatuh kembali ke signed URL — perilakunya sama seperti
 * sebelumnya, tidak lebih buruk.
 */
const blobUrlCache = new Map<string, string>();

/** Batas jumlah foto yang disimpan di memori (foto ±200 KB setelah kompresi). */
const BLOB_CACHE_LIMIT = 30;

export function invalidateEvidenceDisplayUrl(storagePath?: string | null): void {
  if (!storagePath) return;
  const url = blobUrlCache.get(storagePath);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrlCache.delete(storagePath);
  }
  signedUrlCache.delete(storagePath);
}

/**
 * Ambil banyak signed URL sekaligus (K-09).
 *
 * Menggantikan pola N+1 lama (`Promise.all` berisi satu `createSignedUrl` per
 * berkas) yang membuat ratusan permintaan ke Storage ketika satu halaman
 * memuat banyak foto. Supabase mendukung `createSignedUrls` (jamak) sehingga
 * satu permintaan menangani seluruh daftar.
 *
 * Hanya path yang belum ada di cache yang diminta, dan hasilnya diisi ke cache
 * yang sama dengan `getEvidenceSignedUrl`.
 *
 * Mengembalikan `Map<storagePath, signedUrl>`; path yang gagal tidak muncul.
 */
export async function getEvidenceSignedUrls(
  storagePaths: string[],
  expiresInSeconds = 3600
): Promise<Map<string, string>> {
  const now = Date.now();
  const result = new Map<string, string>();
  const missing: string[] = [];

  for (const path of new Set(storagePaths.filter(Boolean))) {
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > now + 60 * 1000) {
      result.set(path, cached.url);
    } else {
      missing.push(path);
    }
  }

  if (missing.length === 0) return result;

  try {
    const { data, error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrls(missing, expiresInSeconds);

    if (error || !data) {
      console.warn('Gagal membuat signed URL batch untuk evidence:', error?.message);
      return result;
    }

    for (const item of data) {
      // `path` pada respons adalah path asli yang diminta.
      const path = (item as { path?: string }).path;
      const url = (item as { signedUrl?: string; signedURL?: string }).signedUrl
        ?? (item as { signedURL?: string }).signedURL;
      if (path && url) {
        result.set(path, url);
        signedUrlCache.set(path, { url, expiresAt: now + expiresInSeconds * 1000 });
      }
    }
  } catch (err: any) {
    console.warn('Gagal memproses signed URL batch evidence:', err?.message || err);
  }

  return result;
}

/**
 * Mengambil signed URL untuk file foto di Supabase Storage.
 * Masa aktif default 3600 detik (1 jam).
 */
export async function getEvidenceSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!storagePath) return null;

  const now = Date.now();
  const cached = signedUrlCache.get(storagePath);
  if (cached && cached.expiresAt > now + 60 * 1000) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      console.warn('Gagal membuat signed URL untuk evidence:', error.message);
      return null;
    }

    if (data?.signedUrl) {
      signedUrlCache.set(storagePath, {
        url: data.signedUrl,
        expiresAt: now + expiresInSeconds * 1000,
      });
      return data.signedUrl;
    }

    return null;
  } catch (err: any) {
    console.warn('Gagal memproses signed URL evidence:', err?.message || err);
    return null;
  }
}

/**
 * URL untuk MENAMPILKAN foto: object URL dari blob yang sudah diunduh sekali.
 *
 * Aman dipakai sebagai `src` gambar maupun sebagai sumber lightbox, dan
 * hasilnya tetap berlaku selama halaman tidak dimuat ulang.
 */
export async function getEvidenceDisplayUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;

  const cached = blobUrlCache.get(storagePath);
  if (cached) return cached;

  const signed = await getEvidenceSignedUrl(storagePath);
  if (!signed) return null;

  try {
    const res = await fetch(signed);
    // `opaque` berarti CORS tidak mengizinkan isinya dibaca — pakai signed URL.
    if (!res.ok || res.type === 'opaque') return signed;

    const blob = await res.blob();
    if (blob.size === 0) return signed;

    const objectUrl = URL.createObjectURL(blob);

    // Buang entri tertua bila melewati batas, supaya memori tidak menumpuk
    // di perangkat kelas bawah.
    if (blobUrlCache.size >= BLOB_CACHE_LIMIT) {
      const oldest = blobUrlCache.keys().next().value;
      if (oldest) invalidateEvidenceDisplayUrl(oldest);
    }

    blobUrlCache.set(storagePath, objectUrl);
    return objectUrl;
  } catch {
    return signed;
  }
}

/**
 * Upload bukti foto langsung ke Supabase Storage dan simpan metadata di database.
 * Menerima file (File/Blob) hasil capture kamera, capturedAt, dan actualTeacher info.
 */
export async function uploadAgendaEvidence(params: {
  agendaId: string;
  file: File | Blob;
  tanggal: string; // YYYY-MM-DD
  capturedAt?: string;
  actualTeacherName?: string;
  actualTeacherId?: string | null;
  academicYearId?: string;
  oldStoragePath?: string;
}): Promise<AgendaEvidence> {
  const {
    agendaId,
    file,
    tanggal,
    capturedAt = new Date().toISOString(),
    actualTeacherName,
    actualTeacherId,
    academicYearId,
    oldStoragePath,
  } = params;

  console.log(`[Evidence] photo_upload_started for agenda ${agendaId}`);

  // 1. Konversi ke File object jika masih Blob mentah
  const fileObj =
    file instanceof File
      ? file
      : new File([file], `evidence_${Date.now()}.jpg`, { type: 'image/jpeg' });

  // 2. Client-side compression
  const compression = await compressEvidencePhoto(fileObj);
  const fileToUpload = compression.file;
  const extension = fileToUpload.type === 'image/webp' ? 'webp' : 'jpg';

  // 3. Tentukan storage path terstruktur:
  // Format: {academic_year_id atau tahun}/{agenda_date}/{agenda_id}.webp
  const folderPrefix = academicYearId ? academicYearId : (tanggal ? tanggal.split('-')[0] : '2026');
  const dateFolder = tanggal || 'undated';
  const storagePath = `${folderPrefix}/${dateFolder}/${agendaId}.${extension}`;

  // 4. Upload ke Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, fileToUpload, {
      contentType: fileToUpload.type,
      upsert: true,
    });

  if (uploadErr) {
    console.error(`[Evidence] photo_upload_failed for agenda ${agendaId}:`, uploadErr.message);
    throw new Error('Foto dokumentasi gagal diunggah ke storage. Periksa koneksi internet lalu coba lagi.');
  }

  console.log(`[Evidence] photo_upload_success to storage: ${storagePath}`);

  // 5. Simpan metadata ke tabel agenda.agenda_evidence
  try {
    const uploadedAt = new Date().toISOString();
    const payload: Record<string, any> = {
      agenda_id: agendaId,
      storage_path: storagePath,
      file_name: `${agendaId}.${extension}`,
      file_size: fileToUpload.size,
      mime_type: fileToUpload.type,
      captured_at: capturedAt,
      uploaded_at: uploadedAt,
    };

    if (actualTeacherName) payload.actual_teacher_name = actualTeacherName;
    if (actualTeacherId) payload.actual_teacher_id = actualTeacherId;

    const { data: evidenceData, error: dbErr } = await supabase
      .from('agenda_evidence')
      .upsert(payload, { onConflict: 'agenda_id' })
      .select()
      .single();

    if (dbErr) {
      console.error(`[Evidence] DB save failed for agenda ${agendaId}:`, dbErr.message);
      // Orphan cleanup: hapus file yang baru saja diupload jika insert metadata database gagal
      await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
      throw new Error('Gagal menyimpan metadata bukti foto di database.');
    }

    // 6. Cleanup file lama jika path berbeda
    if (oldStoragePath && oldStoragePath !== storagePath) {
      try {
        await supabase.storage.from(EVIDENCE_BUCKET).remove([oldStoragePath]);
        invalidateEvidenceDisplayUrl(oldStoragePath);
        console.log(`[Evidence] Old file cleaned up: ${oldStoragePath}`);
      } catch (cleanErr: any) {
        console.warn(`[Evidence] Failed to cleanup old file ${oldStoragePath}:`, cleanErr.message);
      }
    }

    // Ambil signed URL untuk preview langsung.
    // Cache dibuang lebih dulu: path diturunkan dari `agendaId`, sehingga
    // pengambilan ulang menimpa berkas yang sama — tanpa ini, pratinjau akan
    // menampilkan URL lama yang isinya sudah tergantikan.
    invalidateEvidenceDisplayUrl(storagePath);
    const signedUrl = await getEvidenceSignedUrl(storagePath);

    return {
      id: evidenceData.id,
      agenda_id: evidenceData.agenda_id,
      storage_path: evidenceData.storage_path,
      file_name: evidenceData.file_name,
      file_size: evidenceData.file_size,
      mime_type: evidenceData.mime_type,
      captured_at: evidenceData.captured_at,
      uploaded_at: evidenceData.uploaded_at,
      actual_teacher_name: evidenceData.actual_teacher_name,
      actual_teacher_id: evidenceData.actual_teacher_id,
      created_at: evidenceData.created_at,
      signedUrl: signedUrl || undefined,
    };
  } catch (err: any) {
    console.error(`[Evidence] photo_upload_failed during DB metadata step:`, err.message);
    throw err;
  }
}

/**
 * Hapus bukti foto (Storage & Database record).
 * Digunakan oleh admin untuk mereset dokumentasi agenda.
 */
export async function deleteAgendaEvidence(
  agendaId: string,
  storagePath?: string,
  isAdminAction = false
): Promise<void> {
  console.log(`[Evidence] Delete started for agenda ${agendaId}. AdminAction: ${isAdminAction}`);

  // 1. Hapus dari database terlebih dahulu
  const { error: dbErr } = await supabase
    .from('agenda_evidence')
    .delete()
    .eq('agenda_id', agendaId);

  if (dbErr) {
    console.error(`[Evidence] DB delete failed:`, dbErr.message);
    throw new Error('Gagal menghapus data bukti foto dari database.');
  }

  // 2. Hapus file dari Storage jika path tersedia
  if (storagePath) {
    try {
      const { error: storageErr } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .remove([storagePath]);

      if (storageErr) {
        console.warn(`[Evidence] Storage delete warning:`, storageErr.message);
      } else {
        invalidateEvidenceDisplayUrl(storagePath);
        console.log(`[Evidence] evidence delete success: ${storagePath}`);
      }
    } catch (err: any) {
      console.warn(`[Evidence] Storage delete exception:`, err?.message);
    }
  }

  if (isAdminAction) {
    console.log(`[Evidence] photo_deleted_by_admin for agenda ${agendaId}`);
  }
}

/**
 * Mengambil metadata evidence untuk satu agenda.
 */
export async function getAgendaEvidence(agendaId: string): Promise<AgendaEvidence | null> {
  try {
    const { data, error } = await supabase
      .from('agenda_evidence')
      .select('*')
      .eq('agenda_id', agendaId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const signedUrl = await getEvidenceSignedUrl(data.storage_path);

    return {
      id: data.id,
      agenda_id: data.agenda_id,
      storage_path: data.storage_path,
      file_name: data.file_name,
      file_size: data.file_size,
      mime_type: data.mime_type,
      captured_at: data.captured_at,
      uploaded_at: data.uploaded_at,
      actual_teacher_name: data.actual_teacher_name,
      actual_teacher_id: data.actual_teacher_id,
      created_at: data.created_at,
      signedUrl: signedUrl || undefined,
    };
  } catch (e) {
    return null;
  }
}
