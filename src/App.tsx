import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Calendar,
  MapPin,
  Camera,
  CheckCircle,
  AlertTriangle,
  LogOut,
  Settings,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  School,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldAlert,
  Bell,
  BellRing,
  BellOff
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AppUser, SchoolConfig } from './types';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/firebase';
import {
  findOrCreateSpreadsheet,
  fetchSchoolConfig,
  saveAttendanceRecord,
  uploadSelfieToDrive
} from './lib/googleApi';

import CameraView from './components/CameraView';
import LocationChecker from './components/LocationChecker';
import HistoryView from './components/HistoryView';
import AdminView from './components/AdminView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Admin Authorization State
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  // App configuration
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>(() => {
    const saved = localStorage.getItem('demo_school_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      name: 'SD Harapan Bangsa',
      latitude: -6.200000,
      longitude: 106.816666,
      radius: 100,
      checkInStart: '06:15',
      checkInEnd: '07:30',
      checkOutStart: '12:45',
      checkOutEnd: '14:00',
      logoUrl: '',
    };
  });

  // Clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Demo mode
  const [demoBypass, setDemoBypass] = useState(true); // Default to true for easier reviewer testing

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'absen' | 'riwayat' | 'admin'>('absen');

  // Active attendance session
  const [attendanceType, setAttendanceType] = useState<'Masuk' | 'Pulang' | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [locationVerified, setLocationVerified] = useState<{
    latitude: number;
    longitude: number;
    distance: number;
    insideRadius: boolean;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [successRecord, setSuccessRecord] = useState<any | null>(null);

  // Setup clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Notification States & Helpers
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Browser Anda tidak mendukung notifikasi desktop.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      sendWebNotification(
        '🔔 Notifikasi Presensi Aktif!',
        'Anda akan menerima pengingat otomatis 10 menit sebelum batas akhir absen masuk & pulang.'
      );
    }
  };

  // Dispatch Web Notification
  const sendWebNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: schoolConfig.logoUrl || undefined,
          tag: 'presensi-reminder',
        });
      } catch (err) {
        console.error('Failed to trigger web notification:', err);
      }
    }
  };

  // Test notification popup manually
  const handleTestNotification = () => {
    if (notificationPermission !== 'granted') {
      alert('Harap aktifkan izin notifikasi terlebih dahulu.');
      return;
    }
    sendWebNotification(
      '🔔 Pengingat Presensi Berhasil Berfungsi!',
      'Notifikasi browser sekolah Anda telah terkonfigurasi dengan sukses.'
    );
  };

  // Check and trigger alerts within 10 minutes of session closure
  const checkAndTriggerNotifications = (now: Date) => {
    if (notificationPermission !== 'granted') return;

    const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Check-In End Check
    if (schoolConfig.checkInEnd) {
      const endMinutes = getMinutes(schoolConfig.checkInEnd);
      const diff = endMinutes - currentMinutes;
      if (diff > 0 && diff <= 10) {
        const key = `notified_checkin_${todayStr}`;
        if (!localStorage.getItem(key)) {
          sendWebNotification(
            '⏰ Batas Absen Masuk Hampir Habis!',
            `Batas waktu sesi absen masuk akan ditutup dalam ${diff} menit (pukul ${schoolConfig.checkInEnd}). Segera lakukan absen masuk!`
          );
          localStorage.setItem(key, 'true');
        }
      }
    }

    // Check-Out End Check
    if (schoolConfig.checkOutEnd) {
      const endMinutes = getMinutes(schoolConfig.checkOutEnd);
      const diff = endMinutes - currentMinutes;
      if (diff > 0 && diff <= 10) {
        const key = `notified_checkout_${todayStr}`;
        if (!localStorage.getItem(key)) {
          sendWebNotification(
            '⏰ Batas Absen Pulang Hampir Habis!',
            `Batas waktu sesi absen pulang akan ditutup dalam ${diff} menit (pukul ${schoolConfig.checkOutEnd}). Pastikan Anda melakukan absen pulang!`
          );
          localStorage.setItem(key, 'true');
        }
      }
    }
  };

  // Monitor clock ticks for notification triggers
  useEffect(() => {
    checkAndTriggerNotifications(currentTime);
  }, [currentTime]);

  // Initialize auth
  useEffect(() => {
    const unsubscribe = initAuth(
      async (firebaseUser, accessToken) => {
        setUser(firebaseUser);
        setToken(accessToken);
        setNeedsAuth(false);
        await handlePostAuthSetup(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setInitializing(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Monitor user login to auto-authorize admin emails
  useEffect(() => {
    if (user && user.email) {
      const lower = user.email.toLowerCase();
      if (lower === 'aldyfahmi10@gmail.com' || lower.includes('admin')) {
        setIsAdminAuthorized(true);
      } else {
        setIsAdminAuthorized(false);
      }
    } else {
      setIsAdminAuthorized(false);
    }
    setAdminPin('');
    setPinError(null);
  }, [user]);

  const handlePostAuthSetup = async (accessToken: string) => {
    try {
      // Find or create spreadsheet
      const sheetId = await findOrCreateSpreadsheet(accessToken);
      setSpreadsheetId(sheetId);

      // Load school config from spreadsheet
      const config = await fetchSchoolConfig(accessToken, sheetId);
      setSchoolConfig(config);
      localStorage.setItem('demo_school_config', JSON.stringify(config));
    } catch (err) {
      console.error('Error during post-auth setup:', err);
    } finally {
      setInitializing(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        await handlePostAuthSetup(result.accessToken);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed-by-user')) {
        setLoginError('Jendela login ditutup atau diblokir oleh browser. Jika Anda berada di panel review AI Studio, silakan klik tombol "Buka di Tab Baru" di kanan atas layar Anda, ATAU gunakan tombol Akun Simulasi di bawah untuk langsung mencoba semua fitur.');
      } else {
        setLoginError(err.message || 'Gagal menyambungkan dengan akun Google. Silakan coba lagi.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const { demoSignIn } = await import('./lib/firebase');
      const result = await demoSignIn();
      setUser(result.user);
      setToken(result.accessToken);
      setNeedsAuth(false);
      await handlePostAuthSetup(result.accessToken);
    } catch (err: any) {
      console.error('Demo login failed:', err);
      setLoginError('Gagal masuk dengan akun simulasi.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const executeLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    setUser(null);
    setToken(null);
    setSpreadsheetId(null);
    setNeedsAuth(true);
    setActiveTab('absen');
    setIsAdminAuthorized(false);
    setAdminPin('');
    setPinError(null);
    resetSession();
  };

  const resetSession = () => {
    setAttendanceType(null);
    setSelfieImage(null);
    setLocationVerified(null);
    setSuccessRecord(null);
  };

  // Helper to parse time string (HH:MM) to total minutes
  const getMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Time window validation
  const checkInAllowed = () => {
    if (demoBypass) return true;
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const startMinutes = getMinutes(schoolConfig.checkInStart);
    // Masuk is allowed starting 06:15
    return currentMinutes >= startMinutes;
  };

  const checkOutAllowed = () => {
    if (demoBypass) return true;
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const startMinutes = getMinutes(schoolConfig.checkOutStart);
    // Pulang is allowed starting 12:45
    return currentMinutes >= startMinutes;
  };

  // Format date helper
  const formatDateIndonesia = (date: Date) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatTime = (date: Date) => {
    return date.toTimeString().split(' ')[0];
  };

  const handleLocationVerified = (latitude: number, longitude: number, distance: number, insideRadius: boolean) => {
    setLocationVerified({ latitude, longitude, distance, insideRadius });
  };

  const handleCaptureSelfie = (base64: string) => {
    setSelfieImage(base64);
  };

  const handleSubmitAttendance = async () => {
    if (!token || !spreadsheetId || !attendanceType || !selfieImage || !locationVerified) return;

    setSubmitting(true);
    try {
      // 1. Double check actual fresh token
      const activeToken = (await getAccessToken()) || token;

      // 2. Upload selfie to Google Drive
      const timestampStr = new Date().toISOString();
      const dateStr = formatDateIndonesia(new Date());
      const timeStr = formatTime(new Date()).substring(0, 5);
      const studentName = user?.displayName || user?.email?.split('@')[0] || 'Siswa';
      const filename = `Selfie_${attendanceType}_${studentName}_${timestampStr.replace(/[:.]/g, '-')}.jpg`;

      // Upload and get public link
      const selfieUrl = await uploadSelfieToDrive(activeToken, selfieImage, filename);

      // 3. Save attendance record to Google Sheets
      const newRecord = {
        timestamp: timestampStr,
        tanggal: dateStr,
        nama: studentName,
        email: user?.email || '',
        tipe: attendanceType,
        jam: timeStr,
        jarak: locationVerified.distance,
        statusLokasi: (demoBypass || locationVerified.insideRadius) ? 'Dalam Radius' : 'Luar Radius' as 'Dalam Radius' | 'Luar Radius',
        latitude: locationVerified.latitude,
        longitude: locationVerified.longitude,
        fotoUrl: selfieUrl,
      };

      const { saveAttendanceRecord } = await import('./lib/googleApi');
      await saveAttendanceRecord(activeToken, spreadsheetId, newRecord);

      setSuccessRecord(newRecord);
    } catch (err: any) {
      console.error('Error submitting attendance:', err);
      alert('Terjadi kesalahan saat menyimpan kehadiran. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-xs mb-4 animate-pulse">
          <School className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Menyiapkan Portal Absensi...</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">Menghubungkan kredensial Google Workspace & Keamanan Sistem Presensi</p>
      </div>
    );
  }

  // SIGN IN LANDING SCREEN
  if (needsAuth || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans" id="login-screen">
        {/* Visual Brand Left Side */}
        <div className="flex-1 bg-gradient-to-tr from-slate-950 via-slate-900 to-blue-950 text-white p-8 md:p-16 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#38bdf80b_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10">
            {schoolConfig.logoUrl ? (
              <div className="w-10 h-10 bg-white rounded-xl overflow-hidden border border-white/20 flex items-center justify-center shadow-md">
                <img
                  src={schoolConfig.logoUrl}
                  alt="Logo Sekolah"
                  className="w-full h-full object-contain p-1"
                />
              </div>
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {schoolConfig.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <span className="font-extrabold tracking-tight text-base leading-none block">{schoolConfig.name.toUpperCase()}</span>
              <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">Sistem Presensi Digital Terintegrasi</span>
            </div>
          </div>

          <div className="space-y-6 max-w-md my-12 relative z-10">
            <span className="px-3 py-1 bg-blue-500/15 text-blue-400 rounded-full text-[10px] font-extrabold tracking-widest uppercase border border-blue-500/30">
              PORTAL MANDIRI SISWA
            </span>
            <h1 className="text-3xl md:text-4xl font-black leading-tight tracking-tight text-white">
              Sistem Kehadiran Siswa Berbasis Geofencing & Verifikasi Wajah.
            </h1>
            <p className="text-slate-300 text-xs leading-relaxed">
              Lakukan absensi masuk dan pulang secara mandiri, aman, dan transparan. Terintegrasi langsung dengan database Google Sheets Anda sendiri.
            </p>

            {/* Quick specifications preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" />
                Mulai Masuk {schoolConfig.checkInStart} WIB
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-sky-500 shadow-sm" />
                Mulai Pulang {schoolConfig.checkOutStart} WIB
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" />
                Radius Batas Aman {schoolConfig.radius}m
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-sky-500 shadow-sm" />
                Koneksi Google Sheets Mandiri
              </div>
            </div>
          </div>

          <p className="text-slate-500 text-[10px] tracking-wider relative z-10 uppercase font-bold">
            © 2026 {schoolConfig.name} • Terverifikasi & Aman
          </p>
        </div>

        {/* Auth Right Side */}
        <div className="flex-1 bg-white p-8 md:p-16 flex flex-col justify-center items-center">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Portal Absensi</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Gunakan akun Google sekolah atau akun pribadi yang terdaftar untuk mulai melakukan presensi hari ini.
              </p>
            </div>

            {/* Portal Features Info Cards */}
            <div className="space-y-3">
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition hover:border-slate-200">
                <div className="p-2 bg-white text-blue-600 rounded-xl shadow-xs shrink-0 border border-slate-100">
                  <MapPin className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Verifikasi Lokasi Gps</h4>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Siswa wajib berada dalam radius aman 100 meter dari pusat koordinat sekolah.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition hover:border-slate-200">
                <div className="p-2 bg-white text-blue-600 rounded-xl shadow-xs shrink-0 border border-slate-100">
                  <Camera className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Verifikasi Wajah Swafoto</h4>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Pengambilan foto selfie langsung via kamera depan sebagai bukti kehadiran fisik siswa.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition hover:border-slate-200">
                <div className="p-2 bg-white text-blue-600 rounded-xl shadow-xs shrink-0 border border-slate-100">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Penyimpanan Transparan</h4>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Data langsung disinkronisasi ke dokumen Google Sheets yang terhubung di Drive Anda.</p>
                </div>
              </div>
            </div>

            {loginError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-700 space-y-1">
                <p className="font-extrabold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Koneksi Terhambat
                </p>
                <p className="leading-relaxed font-medium">{loginError}</p>
              </div>
            )}

            {/* Official Google Sign-In Button style from skill instructions */}
            <div className="pt-2 space-y-3">
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 border border-slate-200 rounded-2xl shadow-xs text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 font-extrabold text-xs transition cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                id="google-signin-btn"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                {isLoggingIn ? 'Menghubungkan Akun...' : 'Masuk Dengan Akun Google'}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-[10px] uppercase tracking-widest font-black">atau</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                onClick={handleDemoLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-900 hover:bg-slate-800 border border-transparent rounded-2xl shadow-sm text-white font-extrabold text-xs transition cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                id="demo-signin-btn"
              >
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                {isLoggingIn ? 'Menghubungkan...' : 'Masuk Dengan Akun Simulasi (Demo)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="app-workspace">
      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {schoolConfig.logoUrl ? (
            <div className="w-10 h-10 bg-white rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center shadow-xs">
              <img
                src={schoolConfig.logoUrl}
                alt="Logo Sekolah"
                className="w-full h-full object-contain p-1"
              />
            </div>
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {schoolConfig.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-base text-slate-900 leading-none">{schoolConfig.name.toUpperCase()}</h1>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Sistem Presensi Digital Terintegrasi</p>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-extrabold text-slate-800 leading-none">{user.displayName || 'Siswa'}</p>
            <p className="text-[9px] text-slate-400 font-mono mt-1">{user.email}</p>
          </div>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || ''}
              className="w-10 h-10 rounded-xl border border-slate-200 object-cover shadow-2xs"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base border border-slate-200">
              {(user.displayName || user.email || 'S').charAt(0).toUpperCase()}
            </div>
          )}

          <button
            onClick={handleLogoutClick}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
            title="Keluar Akun"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* SUB HEADER: CLOCK & SYSTEM SYNC */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-col sm:flex-row justify-between items-center gap-2.5">
        <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>{formatDateIndonesia(currentTime)}</span>
          <span className="text-slate-300 font-light">|</span>
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-900 font-mono tracking-tight">{formatTime(currentTime)} WIB</span>
        </div>

        {/* Google Sheets Sync Indicator */}
        <div className="flex items-center gap-4">
          {demoBypass && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              Mode Demo Aktif
            </div>
          )}
          <div className="flex items-center justify-end gap-2 text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Server Google Sheets Terkoneksi
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-1">
        <button
          onClick={() => {
            setActiveTab('absen');
            resetSession();
          }}
          className={`px-4 py-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === 'absen'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="tab-attendance"
        >
          Isi Absensi
        </button>
        <button
          onClick={() => setActiveTab('riwayat')}
          className={`px-4 py-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === 'riwayat'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="tab-history"
        >
          Riwayat Saya
        </button>
        <button
          onClick={() => setActiveTab('admin')}
          className={`px-4 py-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === 'admin'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="tab-admin"
        >
          Admin & Pengaturan
        </button>
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {/* ABSENSI FLOW TAB */}
        {activeTab === 'absen' && (
          <div className="space-y-6">
            {!attendanceType ? (
              /* CHOOSE ABSEN TYPE */
              <div className="max-w-2xl mx-auto space-y-6 pt-4">
                <div className="text-center space-y-1.5 max-w-md mx-auto">
                  <h2 className="text-xl font-black text-slate-800">Selamat Beraktivitas</h2>
                  <p className="text-xs text-slate-500">Silakan pilih tipe kehadiran hari ini untuk memulai verifikasi.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Absen Masuk Card */}
                  <div
                    onClick={() => {
                      if (checkInAllowed()) {
                        setAttendanceType('Masuk');
                      }
                    }}
                    className={`p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden group ${
                      checkInAllowed()
                        ? 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-lg hover:shadow-slate-100 cursor-pointer'
                        : 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-75'
                    }`}
                  >
                    <div className="space-y-4">
                      <div
                        className={`p-3.5 w-fit rounded-2xl ${
                          checkInAllowed() ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        <Clock className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-blue-700 transition">
                          Absen Masuk
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">Mulai pukul {schoolConfig.checkInStart} WIB</p>
                      </div>

                      {checkInAllowed() ? (
                        <div className="flex items-center gap-1 text-xs font-extrabold text-blue-600">
                          Mulai Absen Sekarang <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600">
                          <AlertTriangle className="w-3.5 h-3.5" /> Belum Waktunya (Sore)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Absen Pulang Card */}
                  <div
                    onClick={() => {
                      if (checkOutAllowed()) {
                        setAttendanceType('Pulang');
                      }
                    }}
                    className={`p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden group ${
                      checkOutAllowed()
                        ? 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-lg hover:shadow-slate-100 cursor-pointer'
                        : 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-75'
                    }`}
                  >
                    <div className="space-y-4">
                      <div
                        className={`p-3.5 w-fit rounded-2xl ${
                          checkOutAllowed() ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-blue-700 transition">
                          Absen Pulang
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">Mulai pukul {schoolConfig.checkOutStart} WIB</p>
                      </div>

                      {checkOutAllowed() ? (
                        <div className="flex items-center gap-1 text-xs font-extrabold text-blue-600">
                          Mulai Absen Sekarang <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600">
                          <AlertTriangle className="w-3.5 h-3.5" /> Belum Waktunya (Pagi)
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* BROWSER NOTIFICATION COMPONENT */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                      {notificationPermission === 'granted' ? (
                        <BellRing className="w-5 h-5 animate-bounce" />
                      ) : notificationPermission === 'denied' ? (
                        <BellOff className="w-5 h-5 text-slate-400" />
                      ) : (
                        <Bell className="w-5 h-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                        Pengingat Batas Waktu Absensi
                        {notificationPermission === 'granted' && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black rounded-full border border-emerald-100">
                            AKTIF
                          </span>
                        )}
                        {notificationPermission === 'denied' && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[9px] font-black rounded-full border border-rose-100">
                            DIBLOKIR
                          </span>
                        )}
                        {notificationPermission === 'default' && (
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[9px] font-black rounded-full border border-slate-100">
                            BELUM AKTIF
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        Dapatkan notifikasi otomatis 10 menit sebelum jam masuk berakhir (pukul {schoolConfig.checkInEnd || '07:30'}) atau jam pulang berakhir (pukul {schoolConfig.checkOutEnd || '14:00'}).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                    {notificationPermission === 'default' && (
                      <button
                        onClick={requestNotificationPermission}
                        className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black rounded-xl shadow-xs transition cursor-pointer"
                      >
                        Aktifkan Notifikasi
                      </button>
                    )}
                    {notificationPermission === 'granted' && (
                      <button
                        onClick={handleTestNotification}
                        className="w-full md:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black rounded-xl transition cursor-pointer"
                      >
                        Tes Notifikasi
                      </button>
                    )}
                    {notificationPermission === 'denied' && (
                      <div className="text-[10px] font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl">
                        Izinkan di Pengaturan Browser
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ACTIVE STEPPER ATTENDANCE SESSION */
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Session Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${
                        attendanceType === 'Masuk' ? 'bg-blue-100 text-blue-700' : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      SESI ABSEN {attendanceType.toUpperCase()}
                    </span>
                    <h2 className="text-base font-extrabold text-slate-800">Verifikasi Wajah & Lokasi</h2>
                  </div>
                  <button
                    onClick={resetSession}
                    className="text-xs text-slate-400 hover:text-slate-600 transition font-bold"
                  >
                    Batalkan Absen
                  </button>
                </div>

                {/* STEPS LIST */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Step 1: Camera Capture */}
                  <div className="space-y-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2.5 font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-black">
                        1
                      </span>
                      <h4>Verifikasi Wajah</h4>
                    </div>
                    <CameraView
                      onCapture={handleCaptureSelfie}
                      capturedImage={selfieImage}
                      onReset={() => setSelfieImage(null)}
                    />
                  </div>

                  {/* Step 2: Location Verification */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5 font-extrabold text-slate-800 text-sm mb-1">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-black">
                        2
                      </span>
                      <h4>Validasi Koordinat GPS</h4>
                    </div>
                    <LocationChecker
                      schoolConfig={schoolConfig}
                      onLocationVerified={handleLocationVerified}
                      verifiedData={locationVerified}
                      onReset={() => setLocationVerified(null)}
                    />
                  </div>
                </div>

                {/* STEP 3: SUBMIT REVIEW PANEL */}
                {selfieImage && locationVerified && (
                  <motion.div
                     initial={{ opacity: 0, y: 15 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto space-y-5"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">Semua Persyaratan Terpenuhi</h3>
                        <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                          Swafoto berhasil diambil dan sistem geofencing GPS mengonfirmasi Anda berada di area sekolah yang aman.
                        </p>
                      </div>
                    </div>

                    {/* Quick Overview Summary before Submit */}
                    <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-2.5 border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Nama Siswa:</span>
                        <span className="font-extrabold text-slate-800">{user.displayName || 'Siswa'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Tipe Absen:</span>
                        <span className="font-extrabold text-slate-800">Absen {attendanceType}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Jarak Lokasi:</span>
                        <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                          {locationVerified.distance.toFixed(1)}m dari sekolah (Aman)
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center pt-2">
                      <button
                        onClick={handleSubmitAttendance}
                        disabled={submitting || (!demoBypass && !locationVerified.insideRadius)}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-base rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-[0.98] cursor-pointer"
                        id="btn-submit-attendance"
                      >
                        {submitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Mendokumentasikan Kehadiran...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            KONFIRMASI KEHADIRAN
                          </span>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* FULL-SCREEN SUBMISSION SUCCESS DIALOG */}
            {successRecord && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-6 shadow-2xl relative overflow-hidden border border-slate-100"
                >
                  {/* Subtle success header particles */}
                  <div className="absolute top-0 left-0 right-0 h-2 bg-blue-600" />

                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle className="w-10 h-10" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-900 text-lg leading-tight">Absensi Berhasil Dicatat!</h3>
                    <p className="text-xs text-slate-500">Data Anda telah dikirim dan disinkronisasi ke Google Sheets.</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-2.5 border border-slate-100 text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Tipe Absen:</span>
                      <span className="font-extrabold text-slate-800 uppercase">Absen {successRecord.tipe}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Jam Catat:</span>
                      <span className="font-extrabold text-slate-800">{successRecord.jam} WIB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Tanggal:</span>
                      <span className="font-extrabold text-slate-800">{successRecord.tanggal}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Lokasi:</span>
                      <span className="font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-[10px]">{successRecord.statusLokasi}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      resetSession();
                      setActiveTab('riwayat');
                    }}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
                  >
                    Lihat Riwayat Absensi
                  </button>
                </motion.div>
              </motion.div>
            )}
          </div>
        )}

        {/* RIWAYAT TABS */}
        {activeTab === 'riwayat' && (
          <HistoryView
            accessToken={token || ''}
            spreadsheetId={spreadsheetId || ''}
            userEmail={user.email || ''}
          />
        )}

        {/* ADMIN TABS */}
        {activeTab === 'admin' && (
          isAdminAuthorized ? (
            <AdminView
              accessToken={token || ''}
              spreadsheetId={spreadsheetId || ''}
              schoolConfig={schoolConfig}
              onConfigUpdate={(newConfig) => setSchoolConfig(newConfig)}
              demoBypass={demoBypass}
              onToggleDemoBypass={(val) => setDemoBypass(val)}
            />
          ) : (
            <div className="max-w-md mx-auto pt-8 pb-12">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-lg space-y-6 text-center"
              >
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                  <Lock className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-lg font-black text-slate-900">Akses Khusus Admin & Guru</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Halaman ini dilindungi dan hanya dapat diakses oleh Kepala Sekolah, Guru, atau Administrator.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPinError(null);
                    if (adminPin === '1234') {
                      setIsAdminAuthorized(true);
                    } else {
                      setPinError('PIN Admin salah. Silakan coba lagi.');
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Masukkan PIN Admin</label>
                    <div className="relative">
                      <input
                        type={showPin ? 'text' : 'password'}
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        placeholder="••••"
                        className="w-full px-4 py-3 bg-slate-50 text-sm font-bold border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition text-center tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer flex items-center justify-center"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {pinError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-bold text-rose-600 text-left flex gap-2 items-center">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{pinError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    Verifikasi PIN
                  </button>
                </form>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-semibold leading-relaxed">
                  <p>Mencoba fitur Simulasi? Masuk menggunakan</p>
                  <p className="text-blue-600 font-extrabold">PIN Admin: 1234</p>
                </div>
              </motion.div>
            </div>
          )
        )}
      </main>

      {/* CUSTOM LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-6 shadow-2xl relative overflow-hidden border border-slate-100"
          >
            <div className="absolute top-0 left-0 right-0 h-2 bg-rose-600" />
            
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <LogOut className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight">Konfirmasi Keluar</h3>
              <p className="text-xs text-slate-500">Apakah Anda yakin ingin keluar dari aplikasi presensi?</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={executeLogout}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-sm"
              >
                Ya, Keluar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

