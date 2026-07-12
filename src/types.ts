export interface AttendanceRecord {
  timestamp: string;
  tanggal: string;
  nama: string;
  email: string;
  tipe: 'Masuk' | 'Pulang';
  jam: string;
  jarak: number; // in meters
  fotoUrl: string; // Google Drive shareable link
  statusLokasi: 'Dalam Radius' | 'Luar Radius';
  latitude: number;
  longitude: number;
}

export interface SchoolConfig {
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  checkInStart: string; // "06:15"
  checkInEnd: string; // "07:30"
  checkOutStart: string; // "12:45"
  checkOutEnd: string; // "14:00"
  logoUrl?: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isAdmin: boolean;
}
