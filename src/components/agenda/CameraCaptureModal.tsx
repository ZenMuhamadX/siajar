import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, Check, X, AlertTriangle, SwitchCamera, Loader2 } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (blob: Blob, capturedAt: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [capturedTimestamp, setCapturedTimestamp] = useState<string | null>(null);

  // Helper untuk menghentikan media stream secara menyeluruh
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Memulai streaming kamera
  const startCamera = useCallback(
    async (mode: 'user' | 'environment') => {
      stopStream();
      setIsLoadingCamera(true);
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Browser tidak mendukung akses kamera perangkat.');
        setIsLoadingCamera(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // auto-play policy exception handling
          }
        }
        setIsLoadingCamera(false);
        console.log('[CameraLog] camera_opened');
      } catch (err: any) {
        console.error('[CameraLog] camera error:', err);
        setIsLoadingCamera(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError(
            'Kamera tidak dapat digunakan. Izinkan akses kamera pada browser/perangkat untuk mengambil dokumentasi.'
          );
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError('Kamera perangkat tidak ditemukan atau tidak tersedia.');
        } else {
          setCameraError('Gagal membuka kamera perangkat: ' + (err.message || 'Error tidak diketahui'));
        }
      }
    },
    [stopStream]
  );

  // Inisialisasi saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setCapturedPreviewUrl(null);
      setCapturedTimestamp(null);
      startCamera(facingMode);
    } else {
      stopStream();
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
      setCapturedBlob(null);
      setCapturedPreviewUrl(null);
      setCapturedTimestamp(null);
    }

    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, facingMode, stopStream]);

  // Capture tombol Ambil Foto
  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Gagal memproses snapshot kamera.');
      return;
    }

    // Jika kamera depan, mirror canvas horizontal agar sesuai preview selfie
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const nowIso = new Date().toISOString();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Gagal menghasilkan foto.');
          return;
        }

        const previewUrl = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedPreviewUrl(previewUrl);
        setCapturedTimestamp(nowIso);

        // Hentikan streaming kamera saat dalam mode review snapshot
        stopStream();
        console.log('[CameraLog] photo_captured at', nowIso);
      },
      'image/jpeg',
      0.9
    );
  };

  // Tombol Ambil Ulang (Retake)
  const handleRetake = () => {
    console.log('[CameraLog] photo_retake');
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    setCapturedBlob(null);
    setCapturedPreviewUrl(null);
    setCapturedTimestamp(null);
    startCamera(facingMode);
  };

  // Switch kamera depan/belakang
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Konfirmasi Gunakan Foto
  const handleConfirmUse = () => {
    if (capturedBlob && capturedTimestamp) {
      onPhotoCaptured(capturedBlob, capturedTimestamp);
      handleClose();
    }
  };

  const handleClose = () => {
    stopStream();
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    onClose();
  };

  // Modal ini memakai mode `bare` karena tampilannya memang layar penuh (tanpa
  // kartu). `ModalShell` tetap memberi `role="dialog"`, ESC, dan perangkap
  // fokus yang sebelumnya tidak ada di sini.
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      bare
      closeOnBackdrop={false}
      ariaLabel="Kamera dokumentasi mengajar"
      backdropClassName="bg-black"
      cardClassName="relative flex flex-col justify-between select-none overflow-hidden"
    >
      {/* Top Floating Bar: Close & Switch Camera */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
        <button
          type="button"
          onClick={handleClose}
          className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md transition"
          aria-label="Tutup kamera"
          title="Tutup Kamera"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {!capturedBlob && (
          <button
            type="button"
            onClick={handleToggleFacingMode}
            disabled={isLoadingCamera || Boolean(cameraError)}
            className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md transition disabled:opacity-30"
            aria-label="Putar kamera depan/belakang"
            title="Putar Kamera"
          >
            <SwitchCamera className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Pure Viewfinder: Fullscreen Video / Preview */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
        {capturedPreviewUrl ? (
          <img
            src={capturedPreviewUrl}
            alt="Pratinjau foto yang baru diambil"
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                facingMode === 'user' ? '-scale-x-100' : ''
              }`}
            />

            {isLoadingCamera && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white text-xs"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" aria-hidden="true" />
                <span>Membuka kamera...</span>
              </div>
            )}

            {cameraError && (
              <div
                className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center gap-3 text-white"
                role="alert"
              >
                <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                </div>
                <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="mt-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Coba Lagi</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Floating Bar: Pure Shutter / Action Buttons */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-6 pb-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center">
        {capturedBlob ? (
          <div className="flex items-center gap-6 w-full max-w-xs justify-around">
            <button
              type="button"
              onClick={handleRetake}
              className="flex flex-col items-center gap-1 text-white hover:text-slate-300 active:scale-95 transition"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center backdrop-blur-md">
                <RefreshCw className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <span className="text-[13px] font-medium">Ulang</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmUse}
              className="flex flex-col items-center gap-1 text-emerald-400 hover:text-emerald-300 active:scale-95 transition"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Check className="w-7 h-7 text-white" aria-hidden="true" />
              </div>
              <span className="text-[13px] font-bold text-white">Gunakan</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleCapture}
              disabled={isLoadingCamera || Boolean(cameraError)}
              aria-label="Ambil foto"
              title="Ambil Foto"
              className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center p-1 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition shadow-2xl"
            >
              <div className="w-full h-full rounded-full bg-white active:bg-slate-200 transition" />
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
