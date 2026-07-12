import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  MapPin,
  Save,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  Play,
  Calendar,
  Eye,
  User,
  Compass
} from 'lucide-react';
import { AttendanceRecord, SchoolConfig } from '../types';
import { fetchAttendanceRecords, saveSchoolConfig } from '../lib/googleApi';

interface AdminViewProps {
  accessToken: string;
  spreadsheetId: string;
  schoolConfig: SchoolConfig;
  onConfigUpdate: (newConfig: SchoolConfig) => void;
  demoBypass: boolean;
  onToggleDemoBypass: (bypass: boolean) => void;
}

export default function AdminView({
  accessToken,
  spreadsheetId,
  schoolConfig,
  onConfigUpdate,
  demoBypass,
  onToggleDemoBypass,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'rekap' | 'pengaturan'>('rekap');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'Semua' | 'Masuk' | 'Pulang'>('Semua');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Form states for Settings
  const [formConfig, setFormConfig] = useState<SchoolConfig>({ ...schoolConfig });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  // Sync state form configuration with external schoolConfig when it changes
  useEffect(() => {
    setFormConfig({ ...schoolConfig });
  }, [schoolConfig]);

  const loadAllRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAttendanceRecords(accessToken, spreadsheetId);
      // Sort newest first
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecords(data);
    } catch (err) {
      console.error('Error loading admin records:', err);
      setError('Gagal memuat rekap seluruh absensi dari Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'rekap') {
      loadAllRecords();
    }
  }, [activeTab, accessToken, spreadsheetId]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      await saveSchoolConfig(accessToken, spreadsheetId, formConfig);
      onConfigUpdate(formConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save school config:', err);
      alert('Gagal menyimpan pengaturan ke Google Sheets.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    setGeoLoading(true);
    if (!navigator.geolocation) {
      alert('Geolokasi tidak didukung browser Anda.');
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormConfig((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setGeoLoading(false);
      },
      (err) => {
        console.error(err);
        alert('Gagal mendeteksi lokasi GPS Anda saat ini.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Export records as CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;

    const headers = [
      'Timestamp',
      'Tanggal',
      'Nama',
      'Email',
      'Tipe Absen',
      'Jam Absen',
      'Jarak (meter)',
      'Status Lokasi',
      'Latitude',
      'Longitude',
      'Link Foto Selfie',
    ];

    const csvContent = [
      headers.join(','),
      ...records.map((r) =>
        [
          `"${r.timestamp}"`,
          `"${r.tanggal}"`,
          `"${r.nama}"`,
          `"${r.email}"`,
          `"${r.tipe}"`,
          `"${r.jam}"`,
          r.jarak.toFixed(1),
          `"${r.statusLokasi}"`,
          r.latitude,
          r.longitude,
          `"${r.fotoUrl}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Absensi_Sekolah_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering records
  const filteredRecords = records.filter((rec) => {
    const matchesType = filterType === 'Semua' || rec.tipe === filterType;
    const matchesSearch =
      rec.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.tanggal.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 font-sans" id="admin-section">
      {/* Google Sheets Link Indicator */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-800">
        <div className="space-y-1.5">
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse inline-block"></span>
            DASHBOARD ADMIN & GURU
          </h2>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Semua log absensi tersimpan otomatis dan aman di Google Sheets akun Google Anda. Anda dapat mengontrol koordinat geofence sekolah, batas jarak aman, dan memantau kehadiran siswa secara live.
          </p>
        </div>
        <a
          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-5 py-3 bg-white text-slate-900 hover:bg-slate-50 text-xs font-black rounded-2xl transition cursor-pointer shrink-0"
        >
          BUKA GOOGLE SHEETS
          <ExternalLink className="w-4 h-4 text-slate-500" />
        </a>
      </div>

      {/* Admin Mode Nav */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          onClick={() => setActiveTab('rekap')}
          className={`flex items-center gap-2 px-5 py-4 text-xs sm:text-sm font-extrabold transition border-b-2 cursor-pointer ${
            activeTab === 'rekap'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Rekap Absensi Siswa
        </button>
        <button
          onClick={() => setActiveTab('pengaturan')}
          className={`flex items-center gap-2 px-5 py-4 text-xs sm:text-sm font-extrabold transition border-b-2 cursor-pointer ${
            activeTab === 'pengaturan'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          Pengaturan Sekolah
        </button>
      </div>

      {/* REKAP TAB */}
      {activeTab === 'rekap' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table Control */}
            <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari berdasarkan nama, email, atau tanggal..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition font-medium"
                  />
                </div>

                {/* Filter */}
                <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200/50 self-start">
                  {(['Semua', 'Masuk', 'Pulang'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                        filterType === type ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5">
                <button
                  onClick={loadAllRecords}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-extrabold rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Segarkan
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={filteredRecords.length === 0}
                  className="flex items-center gap-1.5 px-4.5 py-2.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 text-xs font-extrabold rounded-xl border border-blue-200 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh CSV
                </button>
              </div>
            </div>

            {/* Attendance Table */}
            {loading ? (
              <div className="py-24 text-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-extrabold">Mengunduh data kehadiran seluruh siswa dari Google Sheets...</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3 animate-pulse" />
                <p className="text-xs text-rose-600 font-extrabold mb-3">{error}</p>
                <button
                  onClick={loadAllRecords}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer"
                >
                  Coba Segarkan Kembali
                </button>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-20 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20 text-slate-500" />
                <p className="text-sm font-extrabold text-slate-700">Tidak ada absensi yang ditemukan</p>
                <p className="text-xs mt-1">Pastikan filter atau pencarian Anda sesuai.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      <th className="py-4 px-6">Siswa</th>
                      <th className="py-4 px-6">Tipe & Jam</th>
                      <th className="py-4 px-6">Tanggal</th>
                      <th className="py-4 px-6">Status Lokasi & GPS</th>
                      <th className="py-4 px-6">Foto Selfie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                    {filteredRecords.map((rec, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40 transition">
                        {/* Student Identitas */}
                        <td className="py-4 px-6">
                          <div className="font-extrabold text-slate-800">{rec.nama}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{rec.email}</div>
                        </td>

                        {/* Absen Tipe & Jam */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                rec.tipe === 'Masuk'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : 'bg-sky-50 text-sky-700 border border-sky-100'
                              }`}
                            >
                              {rec.tipe}
                            </span>
                            <span className="font-extrabold text-slate-800">{rec.jam}</span>
                          </div>
                        </td>

                        {/* Tanggal */}
                        <td className="py-4 px-6 text-slate-600 font-bold">
                          {rec.tanggal}
                        </td>

                        {/* Lokasi & GPS */}
                        <td className="py-4 px-6 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                rec.statusLokasi === 'Dalam Radius'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {rec.statusLokasi}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">({rec.jarak.toFixed(1)}m)</span>
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">
                            Lat: {rec.latitude.toFixed(5)}, Lng: {rec.longitude.toFixed(5)}
                          </div>
                        </td>

                        {/* Selfie Preview */}
                        <td className="py-4 px-6">
                          {rec.fotoUrl ? (
                            <div className="relative w-11 h-11 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                              <img
                                src={rec.fotoUrl}
                                alt="Selfie"
                                className="w-full h-full object-cover transform scale-x-[-1]"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80';
                                }}
                              />
                              <button
                                onClick={() => setSelectedPhoto(rec.fotoUrl)}
                                className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No image</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIGURATION / SETTINGS TAB */}
      {activeTab === 'pengaturan' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Pengaturan Batasan Absensi</h3>
              <p className="text-xs text-slate-500">Sesuaikan lokasi dan batas jam absensi sekolah Anda. Perubahan langsung tersinkronisasi ke Google Sheets.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 font-medium">
              {/* School Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700">Nama Sekolah</label>
                <input
                  type="text"
                  required
                  value={formConfig.name}
                  onChange={(e) => setFormConfig((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* School Logo Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                  Logo Sekolah
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                  {formConfig.logoUrl ? (
                    <div className="relative w-16 h-16 bg-white rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
                      <img
                        src={formConfig.logoUrl}
                        alt="Logo Sekolah"
                        className="w-full h-full object-contain p-1"
                      />
                      <button
                        type="button"
                        onClick={() => setFormConfig(prev => ({ ...prev, logoUrl: '' }))}
                        className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black transition cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-slate-200 text-slate-400 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 border border-slate-300">
                      TANPA LOGO
                    </div>
                  )}

                   <div className="space-y-1.5 flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const img = new Image();
                            img.onload = () => {
                              // Target dimension: max 160 width or height for crisp look but very small file size
                              const maxDim = 160;
                              let width = img.width;
                              let height = img.height;
                              if (width > maxDim || height > maxDim) {
                                if (width > height) {
                                  height = Math.round((height * maxDim) / width);
                                  width = maxDim;
                                } else {
                                  width = Math.round((width * maxDim) / height);
                                  height = maxDim;
                                }
                              }
                              
                              const canvas = document.createElement('canvas');
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                ctx.drawImage(img, 0, 0, width, height);
                                // Compress to JPEG with 0.75 quality for super lightweight size (typically 3-8 KB)
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                                setFormConfig((prev) => ({ ...prev, logoUrl: dataUrl }));
                              }
                            };
                            if (typeof event.target?.result === 'string') {
                              img.src = event.target.result;
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[11px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 font-semibold leading-tight">Mendukung format gambar. Gambar akan dikompresi otomatis agar tersimpan optimal.</p>
                  </div>
                </div>
              </div>

              {/* Coordinates Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700">Latitude Sekolah</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formConfig.latitude}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, latitude: parseFloat(e.target.value) }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700">Longitude Sekolah</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formConfig.longitude}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, longitude: parseFloat(e.target.value) }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Get current coords button */}
              <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-100">
                <button
                  type="button"
                  disabled={geoLoading}
                  onClick={handleGetCurrentLocation}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition cursor-pointer shadow-md shadow-blue-100"
                >
                  <Compass className={`w-3.5 h-3.5 ${geoLoading ? 'animate-spin' : ''}`} />
                  Gunakan Koordinat GPS Saya Saat Ini
                </button>
                <p className="text-[10px] text-slate-400 mt-2 font-bold leading-relaxed">
                  Sangat direkomendasikan agar Anda lolos deteksi radius 100 meter jika melakukan uji coba di lokasi rumah/kantor sendiri.
                </p>
              </div>

              {/* Radius */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700">Radius Batasan Aman (meter)</label>
                <input
                  type="number"
                  required
                  min="10"
                  max="10000"
                  value={formConfig.radius}
                  onChange={(e) => setFormConfig((prev) => ({ ...prev, radius: parseInt(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Time Restrictions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700">Jam Mulai Absen Masuk</label>
                  <input
                    type="text"
                    required
                    placeholder="06:15"
                    value={formConfig.checkInStart}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, checkInStart: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                  />
                  <p className="text-[10px] text-slate-400 font-bold">Format 24 Jam (Contoh: 06:15)</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700">Jam Batas Akhir Absen Masuk</label>
                  <input
                    type="text"
                    required
                    placeholder="07:30"
                    value={formConfig.checkInEnd || ''}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, checkInEnd: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                  />
                  <p className="text-[10px] text-slate-400 font-bold">Format 24 Jam (Contoh: 07:30)</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700">Jam Mulai Absen Pulang</label>
                  <input
                    type="text"
                    required
                    placeholder="12:45"
                    value={formConfig.checkOutStart}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, checkOutStart: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                  />
                  <p className="text-[10px] text-slate-400 font-bold">Format 24 Jam (Contoh: 12:45)</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700">Jam Batas Akhir Absen Pulang</label>
                  <input
                    type="text"
                    required
                    placeholder="14:00"
                    value={formConfig.checkOutEnd || ''}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, checkOutEnd: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                  />
                  <p className="text-[10px] text-slate-400 font-bold">Format 24 Jam (Contoh: 14:00)</p>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="flex items-center gap-1.5 px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-md transition cursor-pointer"
                  id="btn-save-settings"
                >
                  <Save className="w-4 h-4" />
                  {saveLoading ? 'Menyimpan...' : 'SIMPAN PENGATURAN'}
                </button>
                {saveSuccess && (
                  <span className="flex items-center gap-1 text-emerald-600 text-xs font-extrabold animate-bounce">
                    <CheckCircle className="w-4 h-4" /> Pengaturan berhasil disimpan!
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Quick Sandbox / Demo Bypass Toggle */}
          <div className="bg-amber-50/50 border border-amber-200 p-6 rounded-3xl h-fit space-y-4">
            <div className="flex items-start gap-2.5">
              <Play className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-extrabold text-amber-900 text-sm">Mode Uji Coba (Demo Mode)</h4>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  Gunakan bypass waktu dan GPS untuk mempermudah penilaian dan simulasi fitur kapan saja secara fleksibel.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border border-amber-200 rounded-2xl flex items-center justify-between shadow-2xs">
              <span className="text-xs font-extrabold text-slate-700">Bypass Jam & GPS</span>
              <button
                onClick={() => onToggleDemoBypass(!demoBypass)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  demoBypass ? 'bg-amber-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    demoBypass ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="text-[10px] text-amber-800 space-y-1.5 leading-relaxed font-semibold">
              <p>• <span className="font-black text-amber-900">AKTIF:</span> Sesi absensi selalu terbuka penuh (baik Masuk/Pulang), dan lokasi siswa akan selalu divalidasi sukses ("Dalam Radius").</p>
              <p>• <span className="font-black text-amber-900">NONAKTIF:</span> Jam sekolah (Masuk mulai 06.15, Pulang mulai 12.45) dan koordinat batas 100m sekolah divalidasi ketat.</p>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-sm w-full bg-white rounded-3xl overflow-hidden p-4 shadow-2xl border border-slate-100">
            <img
              src={selectedPhoto}
              alt="Selfie Fullsize"
              className="w-full aspect-square object-cover rounded-2xl transform scale-x-[-1] border border-slate-100"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
              }}
            />
            <div className="mt-4 text-center">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-extrabold rounded-xl transition cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
