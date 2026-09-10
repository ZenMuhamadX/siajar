/**
 * Utility untuk kompresi dan resize foto client-side.
 * Target:
 * - Ukuran file: ~500 KB - 1.5 MB
 * - Format: image/webp (fallback jpeg jika webp tidak didukung)
 * - Dimensi max: 1600px (agar teks papan tulis / aktivitas tetap tajam dan jelas)
 */

export interface CompressionResult {
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export async function compressEvidencePhoto(
  file: File,
  maxDimension = 1600,
  targetQuality = 0.8
): Promise<CompressionResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Format file tidak didukung. Harap pilih gambar.');
  }

  // Cek batas raw file awal: 15MB
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Foto terlalu besar (maksimal 15 MB). Silakan pilih foto lain.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memproses gambar.'));
      img.onload = () => {
        try {
          let { width, height } = img;

          // Resize proporsional jika lebih besar dari maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            throw new Error('Gagal menginisialisasi canvas untuk kompresi gambar.');
          }

          // Render gambar ke canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Cek dukungan WebP
          const mimeType = 'image/webp';
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                // Fallback ke JPEG jika WebP gagal
                canvas.toBlob(
                  (jpegBlob) => {
                    if (!jpegBlob) {
                      reject(new Error('Gagal mengompresi foto.'));
                      return;
                    }
                    finalizeResult(jpegBlob, 'evidence.jpg', 'image/jpeg', width, height);
                  },
                  'image/jpeg',
                  targetQuality
                );
                return;
              }
              finalizeResult(blob, 'evidence.webp', 'image/webp', width, height);
            },
            mimeType,
            targetQuality
          );

          function finalizeResult(
            blob: Blob,
            fileName: string,
            outputMime: string,
            finalW: number,
            finalH: number
          ) {
            const compressedFile = new File([blob], fileName, {
              type: outputMime,
              lastModified: Date.now(),
            });

            const previewUrl = URL.createObjectURL(compressedFile);

            resolve({
              file: compressedFile,
              previewUrl,
              originalSize: file.size,
              compressedSize: compressedFile.size,
              width: finalW,
              height: finalH,
            });
          }
        } catch (err: any) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
