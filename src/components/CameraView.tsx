import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Upload, AlertCircle, CheckCircle } from 'lucide-react';

interface CameraViewProps {
  onCapture: (base64Image: string) => void;
  capturedImage: string | null;
  onReset: () => void;
}

export default function CameraView({ onCapture, capturedImage, onReset }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Start the front camera
  const startCamera = async () => {
    setError(null);
    setLoading(true);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // front camera
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError(
        'Gagal mengakses kamera depan. Pastikan izin kamera telah diberikan. Anda juga dapat menggunakan opsi Unggah Foto di bawah.'
      );
      setIsCameraActive(false);
    } finally {
      setLoading(false);
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (!capturedImage) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [capturedImage]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to base64 Data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onCapture(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onCapture(reader.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate a mock selfie for testing purposes
  const generateMockSelfie = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 400;
        canvas.height = 400;
        
        // Background
        const grad = ctx.createRadialGradient(200, 200, 50, 200, 200, 200);
        grad.addColorStop(0, '#fef08a'); // light yellow
        grad.addColorStop(1, '#ca8a04'); // dark yellow school vibe
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 400, 400);

        // Face
        ctx.beginPath();
        ctx.arc(200, 200, 100, 0, Math.PI * 2);
        ctx.fillStyle = '#fde047';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#ca8a04';
        ctx.stroke();

        // Eyes
        ctx.beginPath();
        ctx.arc(160, 180, 10, 0, Math.PI * 2);
        ctx.arc(240, 180, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();

        // Smile
        ctx.beginPath();
        ctx.arc(200, 210, 50, 0, Math.PI);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Text
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'center';
        ctx.fillText('SELFIE DEMO', 200, 340);

        const dataUrl = canvas.toDataURL('image/jpeg');
        onCapture(dataUrl);
        stopCamera();
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto" id="camera-section font-sans">
      <div className="relative w-full aspect-[4/3] bg-slate-900 rounded-3xl overflow-hidden border-4 border-white shadow-xl ring-1 ring-slate-200">
        {!capturedImage ? (
          <>
            {/* Live Camera Feed */}
            {isCameraActive && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            )}

            {/* Custom Overlay and Tags from Sleek Interface Theme */}
            {isCameraActive && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
                  <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-black animate-pulse">REC</span>
                  <span className="bg-slate-900/60 backdrop-blur-md text-slate-200 text-[9px] px-2 py-0.5 rounded font-bold">FRONT_CAM_01</span>
                </div>

                {/* Circular Face Guide with dashed blue borders */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 border-2 border-dashed border-blue-400/70 rounded-full flex items-center justify-center">
                    <div className="w-44 h-44 border border-white/30 rounded-full flex items-center justify-center">
                      <span className="bg-blue-600/80 text-white text-[9px] font-extrabold px-2 py-1 rounded-full backdrop-blur-xs uppercase tracking-wider shadow-sm">
                        Posisikan Wajah
                      </span>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                  <span className="text-white/80 text-[10px] font-bold">Posisikan wajah di dalam lingkaran</span>
                </div>
              </>
            )}

            {/* Loading / Error States */}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white p-4">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                <p className="text-xs font-bold text-slate-300">Menghubungkan kamera...</p>
              </div>
            )}

            {error && !isCameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
                <AlertCircle className="w-12 h-12 text-amber-500 mb-3 animate-pulse" />
                <p className="text-xs font-semibold text-slate-300 mb-4 leading-relaxed">{error}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-slate-800 text-white text-xs font-extrabold rounded-xl hover:bg-slate-700 transition"
                  >
                    Coba Lagi
                  </button>
                  <button
                    onClick={generateMockSelfie}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-extrabold rounded-xl hover:bg-blue-500 transition"
                  >
                    Gunakan Foto Demo
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Captured Image Preview */
          <div className="relative w-full h-full">
            <img
              src={capturedImage}
              alt="Selfie"
              className="w-full h-full object-cover transform scale-x-[-1]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-4 right-4 bg-emerald-500 text-white p-2 rounded-full shadow-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <span className="bg-slate-950/80 text-slate-200 text-xs px-3 py-1.5 rounded-full font-bold backdrop-blur-xs shadow-md">
                Verifikasi Wajah Berhasil
              </span>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Control Buttons */}
      <div className="mt-4 flex flex-wrap gap-3 justify-center w-full">
        {!capturedImage ? (
          <>
            {isCameraActive && (
              <button
                onClick={capturePhoto}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-100 transition transform active:scale-95 cursor-pointer"
                id="btn-capture"
              >
                <Camera className="w-4 h-4" />
                AMBIL FOTO SEKARANG
              </button>
            )}

            <div className="flex gap-2">
              <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs cursor-pointer transition">
                <Upload className="w-4 h-4 text-slate-500" />
                Unggah Berkas Foto
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {!isCameraActive && !loading && (
                <button
                  onClick={generateMockSelfie}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 transition cursor-pointer"
                >
                  Gunakan Foto Demo
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
            id="btn-retake"
          >
            <RefreshCw className="w-4 h-4" />
            Ambil Ulang Foto
          </button>
        )}
      </div>
    </div>
  );
}
