import { useState, useEffect } from 'react';
import { MapPin, Navigation, CheckCircle, AlertTriangle, RefreshCw, Compass } from 'lucide-react';
import { SchoolConfig } from '../types';

interface LocationCheckerProps {
  schoolConfig: SchoolConfig;
  onLocationVerified: (latitude: number, longitude: number, distance: number, insideRadius: boolean) => void;
  verifiedData: {
    latitude: number;
    longitude: number;
    distance: number;
    insideRadius: boolean;
  } | null;
  onReset: () => void;
}

// Haversine formula to calculate distance in meters
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // returns distance in meters
}

export default function LocationChecker({
  schoolConfig,
  onLocationVerified,
  verifiedData,
  onReset,
}: LocationCheckerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const checkLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolokasi tidak didukung oleh browser Anda.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentCoords({ latitude, longitude });

        const distance = calculateDistance(latitude, longitude, schoolConfig.latitude, schoolConfig.longitude);
        const insideRadius = distance <= schoolConfig.radius;

        onLocationVerified(latitude, longitude, distance, insideRadius);
        setLoading(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        let errorMsg = 'Gagal mendeteksi lokasi.';
        if (err.code === 1) {
          errorMsg = 'Izin lokasi ditolak. Silakan berikan izin akses GPS pada browser Anda.';
        } else if (err.code === 2) {
          errorMsg = 'Posisi lokasi tidak tersedia.';
        } else if (err.code === 3) {
          errorMsg = 'Waktu permintaan lokasi habis (timeout).';
        }
        setError(errorMsg);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Automatically check location once on load
  useEffect(() => {
    if (!verifiedData) {
      checkLocation();
    }
  }, [verifiedData, schoolConfig]);

  // Simulate a mock location that matches the school's position exactly (for quick testing/demo)
  const simulateSchoolLocation = () => {
    const lat = schoolConfig.latitude;
    const lng = schoolConfig.longitude;
    setCurrentCoords({ latitude: lat, longitude: lng });
    onLocationVerified(lat, lng, 0, true);
    setError(null);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 rounded-3xl border border-slate-200 shadow-sm font-sans" id="location-checker-section">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          Verifikasi Lokasi GPS
        </h3>
        {!verifiedData && !loading && (
          <button
            onClick={checkLocation}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition cursor-pointer"
            title="Refresh lokasi"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Target School Information */}
      <div className="bg-slate-50 rounded-2xl p-4 text-xs mb-4 border border-slate-100">
        <div className="flex items-start gap-2.5">
          <Compass className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-slate-700">Target Sekolah: {schoolConfig.name}</p>
            <p className="text-slate-500">
              Koordinat: {schoolConfig.latitude.toFixed(6)}, {schoolConfig.longitude.toFixed(6)}
            </p>
            <p className="text-blue-600 font-extrabold text-[10px] uppercase tracking-wider">
              Radius Maksimum: {schoolConfig.radius} Meter
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-6 flex flex-col items-center justify-center text-center">
          <div className="relative flex items-center justify-center w-12 h-12 mb-3">
            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75"></span>
            <Navigation className="relative w-6 h-6 text-blue-600 animate-pulse" />
          </div>
          <p className="text-xs font-bold text-slate-600">Mencari satelit GPS terdekat...</p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Pastikan izin akses lokasi browser aktif</p>
        </div>
      )}

      {error && !loading && !verifiedData && (
        <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 text-amber-800 text-xs mb-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1 w-full">
              <p className="font-extrabold text-amber-900">Izin / Sinyal GPS Terhambat</p>
              <p className="text-amber-700 font-medium leading-relaxed">{error}</p>
              <div className="pt-2.5 flex flex-wrap gap-2">
                <button
                  onClick={checkLocation}
                  className="px-3.5 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition cursor-pointer"
                >
                  Coba Lagi
                </button>
                <button
                  onClick={simulateSchoolLocation}
                  className="px-3.5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  Simulasi GPS Sekolah
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verified Location Output */}
      {verifiedData && !loading && (
        <div className="space-y-4">
          <div
            className={`p-4 rounded-2xl border flex gap-3 ${
              verifiedData.insideRadius
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50/50 border-rose-200 text-rose-800'
            }`}
          >
            {verifiedData.insideRadius ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <p className="font-extrabold text-sm leading-tight">
                {verifiedData.insideRadius ? 'Lokasi Terverifikasi (Aman)' : 'Di Luar Batas Sekolah'}
              </p>
              <p className="opacity-90 font-medium">
                Jarak Anda ke Sekolah:{' '}
                <span className="font-extrabold">
                  {verifiedData.distance < 1000
                    ? `${verifiedData.distance.toFixed(1)} meter`
                    : `${(verifiedData.distance / 1000).toFixed(2)} km`}
                </span>
              </p>
              <p className="opacity-75 font-medium">
                Koordinat Anda: {verifiedData.latitude.toFixed(6)}, {verifiedData.longitude.toFixed(6)}
              </p>
              {!verifiedData.insideRadius && (
                <div className="pt-2 text-[11px] font-bold text-rose-700 space-y-1">
                  <p>⚠️ Anda wajib berada dalam radius {schoolConfig.radius} meter dari sekolah untuk absensi valid.</p>
                  <p className="opacity-90 font-normal italic leading-relaxed mt-1">
                    Demo: Gunakan tombol simulasi di bawah untuk memposisikan GPS Anda langsung di sekolah.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-center text-xs">
            <button
              onClick={onReset}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-200 transition cursor-pointer"
            >
              Ulangi Cek Lokasi
            </button>
            {!verifiedData.insideRadius && (
              <button
                onClick={simulateSchoolLocation}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                Simulasi GPS Sekolah
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
