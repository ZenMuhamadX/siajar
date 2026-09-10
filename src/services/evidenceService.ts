import { supabase } from '../lib/supabase';
import type { AgendaEvidence } from '../types';
import { compressEvidencePhoto } from '../utils/imageCompressor';

export const EVIDENCE_BUCKET = 'agenda-evidence';

// Cache signed URL agar tidak melakukan fetch berulang dalam 1 sesi
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

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
 * Upload bukti foto ke Supabase Storage dan simpan/update metadata di database.
 * Melakukan cleanup file lama jika ada penggantian foto.
 */
export async function uploadAgendaEvidence(params: {
  agendaId: string;
  file: File;
  tanggal: string; // YYYY-MM-DD
  oldStoragePath?: string;
}): Promise<AgendaEvidence> {
  const { agendaId, file, tanggal, oldStoragePath } = params;

  console.log(`[Evidence] Upload started for agenda ${agendaId}`);

  // 1. Client-side compression
  const compression = await compressEvidencePhoto(file);
  const fileToUpload = compression.file;
  const extension = fileToUpload.type === 'image/webp' ? 'webp' : 'jpg';

  // 2. Tentukan storage path: agenda-evidence/{tahun}/{bulan}/{tanggal}/{agenda_id}/evidence_{timestamp}.webp
  let year = '2026';
  let month = '01';
  let day = '01';

  if (tanggal && tanggal.includes('-')) {
    const parts = tanggal.split('-');
    if (parts.length === 3) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }
  }

  const timestamp = Date.now();
  const storagePath = `${year}/${month}/${day}/${agendaId}/evidence_${timestamp}.${extension}`;

  // 3. Upload ke Storage
  const { error: uploadErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, fileToUpload, {
      contentType: fileToUpload.type,
      upsert: true,
    });

  if (uploadErr) {
    console.error(`[Evidence] Upload failed for agenda ${agendaId}:`, uploadErr.message);
    throw new Error('Foto gagal diunggah. Periksa koneksi internet lalu coba lagi.');
  }

  console.log(`[Evidence] Upload success to storage: ${storagePath}`);

  // 4. Simpan metadata ke tabel agenda.agenda_evidence
  try {
    const { data: evidenceData, error: dbErr } = await supabase
      .from('agenda_evidence')
      .upsert(
        {
          agenda_id: agendaId,
          storage_path: storagePath,
          file_name: file.name,
          file_size: fileToUpload.size,
          mime_type: fileToUpload.type,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'agenda_id' }
      )
      .select()
      .single();

    if (dbErr) {
      console.error(`[Evidence] DB save failed for agenda ${agendaId}:`, dbErr.message);
      // Hapus file yang baru diupload agar tidak orphan
      await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
      throw new Error('Gagal menyimpan metadata bukti foto di database.');
    }

    // 5. Cleanup file lama jika ini adalah penggantian foto (replace)
    if (oldStoragePath && oldStoragePath !== storagePath) {
      try {
        await supabase.storage.from(EVIDENCE_BUCKET).remove([oldStoragePath]);
        signedUrlCache.delete(oldStoragePath);
        console.log(`[Evidence] Old file cleaned up: ${oldStoragePath}`);
      } catch (cleanErr: any) {
        console.warn(`[Evidence] Failed to cleanup old file ${oldStoragePath}:`, cleanErr.message);
      }
    }

    // Dapatkan signed URL untuk preview langsung
    const signedUrl = await getEvidenceSignedUrl(storagePath);

    return {
      id: evidenceData.id,
      agenda_id: evidenceData.agenda_id,
      storage_path: evidenceData.storage_path,
      file_name: evidenceData.file_name,
      file_size: evidenceData.file_size,
      mime_type: evidenceData.mime_type,
      uploaded_at: evidenceData.uploaded_at,
      created_at: evidenceData.created_at,
      signedUrl: signedUrl || undefined,
    };
  } catch (err: any) {
    console.error(`[Evidence] Error in save flow:`, err.message);
    throw err;
  }
}

/**
 * Hapus bukti foto (Storage & Database record).
 */
export async function deleteAgendaEvidence(agendaId: string, storagePath?: string): Promise<void> {
  console.log(`[Evidence] Delete started for agenda ${agendaId}`);

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
        signedUrlCache.delete(storagePath);
        console.log(`[Evidence] evidence delete success: ${storagePath}`);
      }
    } catch (err: any) {
      console.warn(`[Evidence] Storage delete exception:`, err?.message);
    }
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
      uploaded_at: data.uploaded_at,
      created_at: data.created_at,
      signedUrl: signedUrl || undefined,
    };
  } catch (e) {
    return null;
  }
}
