import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Search, RefreshCw, ChevronRight, User, Eye } from 'lucide-react';
import { AttendanceRecord } from '../types';
import { fetchAttendanceRecords } from '../lib/googleApi';

interface HistoryViewProps {
  accessToken: string;
  spreadsheetId: string;
  userEmail: string;
}

export default function HistoryView({ accessToken, spreadsheetId, userEmail }: HistoryViewProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'Semua' | 'Masuk' | 'Pulang'>('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAttendanceRecords(accessToken, spreadsheetId);
      // Filter for current user's records only
      const userRecords = data.filter((record) => record.email.toLowerCase() === userEmail.toLowerCase());
      // Sort newest first
      userRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecords(userRecords);
    } catch (err: any) {
      console.error('Error loading history:', err);
      setError('Gagal memuat data riwayat absensi dari Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [accessToken, spreadsheetId, userEmail]);

  // Filtered records
  const filteredRecords = records.filter((rec) => {
    const matchesType = filterType === 'Semua' || rec.tipe === filterType;
    const matchesSearch =
      rec.tanggal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.jam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.statusLokasi.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const totalMasuk = records.filter((r) => r.tipe === 'Masuk').length;
  const totalPulang = records.filter((r) => r.tipe === 'Pulang').length;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" id="history-section">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-3xl flex items-center gap-3.5">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-100">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Absen Masuk</p>
            <p className="text-2xl font-black text-slate-800 leading-tight mt-0.5">{totalMasuk} <span className="text-xs font-bold text-slate-500">kali</span></p>
          </div>
        </div>

        <div className="bg-sky-50/50 border border-sky-100 p-5 rounded-3xl flex items-center gap-3.5">
          <div className="p-3 bg-sky-600 text-white rounded-2xl shadow-md shadow-sky-100">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Absen Pulang</p>
            <p className="text-2xl font-black text-slate-800 leading-tight mt-0.5">{totalPulang} <span className="text-xs font-bold text-slate-500">kali</span></p>
          </div>
        </div>

        <div className="bg-slate-50/80 border border-slate-200 p-5 rounded-3xl col-span-2 md:col-span-1 flex items-center gap-3.5">
          <div className="p-3 bg-slate-800 text-white rounded-2xl shadow-sm">
            <User className="w-5 h-5" />
          </div>
          <div className="truncate">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Akun Saya</p>
            <p className="text-sm font-black text-slate-800 mt-0.5 truncate" title={userEmail}>
              {userEmail.split('@')[0]}
            </p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Header and Controls */}
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Riwayat Kehadiran Pribadi</h3>
              <p className="text-xs text-slate-500">Data tersinkronisasi langsung dengan Google Sheets</p>
            </div>
            <button
              onClick={loadHistory}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-extrabold rounded-xl border border-slate-200 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Segarkan Data
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari berdasarkan tanggal (Contoh: 12 Juli)..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition font-medium"
              />
            </div>

            {/* Type Filters */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200/50 self-start">
              {(['Semua', 'Masuk', 'Pulang'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    filterType === type ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Records List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <p className="text-xs font-extrabold text-slate-500">Menghubungkan ke database Google Sheets...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-xs text-rose-600 font-extrabold mb-3">{error}</p>
            <button
              onClick={loadHistory}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-md transition cursor-pointer"
            >
              Coba Segarkan Lagi
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20 text-slate-500" />
            <p className="text-sm font-extrabold text-slate-700">Belum ada riwayat absensi</p>
            <p className="text-xs mt-1">Lakukan absen masuk atau pulang pada halaman depan.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRecords.map((rec, idx) => (
              <div key={idx} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                <div className="flex gap-4">
                  {/* Selfie Thumbnail */}
                  <div className="relative w-14 h-14 bg-slate-100 rounded-2xl overflow-hidden shrink-0 border border-slate-200">
                    {rec.fotoUrl ? (
                      <img
                        src={rec.fotoUrl}
                        alt="Selfie thumbnail"
                        className="w-full h-full object-cover transform scale-x-[-1]"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    {rec.fotoUrl && (
                      <button
                        onClick={() => setSelectedPhoto(rec.fotoUrl)}
                        className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition duration-200 cursor-pointer"
                        title="Perbesar Foto"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          rec.tipe === 'Masuk'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
                            : 'bg-sky-50 text-sky-700 border border-sky-200/50'
                        }`}
                      >
                        {rec.tipe}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">{rec.jam}</span>
                    </div>

                    <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      {rec.tanggal}
                    </p>

                    <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      Jarak: {rec.jarak.toFixed(1)}m
                      <span
                        className={`inline-block w-2 h-2 rounded-full ml-1 ${
                          rec.statusLokasi === 'Dalam Radius' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                        }`}
                        title={rec.statusLokasi}
                      />
                    </p>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end gap-2.5 border-t sm:border-0 pt-3 sm:pt-0 border-slate-100">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      rec.statusLokasi === 'Dalam Radius'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {rec.statusLokasi}
                  </span>
                  <a
                    href={rec.fotoUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-blue-600 font-extrabold flex items-center gap-1 transition"
                  >
                    Berkas Google Drive
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
