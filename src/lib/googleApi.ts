import { AttendanceRecord, SchoolConfig } from '../types';

const SPREADSHEET_NAME = 'Absensi Sekolah';

// Simple in-memory cache for the spreadsheet ID
let cachedSpreadsheetId: string | null = null;

// Helper to convert base64 to Blob
function base64ToBlob(base64: string, mime: string) {
  const parts = base64.split(',');
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
}

/**
 * Searches for an existing "Absensi Sekolah" spreadsheet in the user's Drive.
 * If not found, creates one and initializes the sheets with headers and default configuration.
 */
export async function findOrCreateSpreadsheet(accessToken: string): Promise<string> {
  if (accessToken === 'demo-access-token') {
    return 'demo-spreadsheet-id';
  }

  if (cachedSpreadsheetId) {
    return cachedSpreadsheetId;
  }

  // Check LocalStorage first for speed
  const savedId = localStorage.getItem('absensi_spreadsheet_id');
  if (savedId) {
    cachedSpreadsheetId = savedId;
    return savedId;
  }

  try {
    // 1. Search for existing spreadsheet in Drive
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(SPREADSHEET_NAME)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      throw new Error(`Failed to search Drive: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const existingId = searchData.files[0].id;
      localStorage.setItem('absensi_spreadsheet_id', existingId);
      cachedSpreadsheetId = existingId;
      return existingId;
    }

    // 2. Spreadsheet not found, create a new one
    console.log('Spreadsheet not found, creating a new one...');
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const createBody = {
      properties: {
        title: SPREADSHEET_NAME,
      },
      sheets: [
        {
          properties: {
            title: 'Kehadiran',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: 'Pengaturan',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    };

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create spreadsheet: ${createRes.statusText}`);
    }

    const sheetData = await createRes.json();
    const newId = sheetData.spreadsheetId;

    // 3. Initialize headers for "Kehadiran" sheet
    await appendSpreadsheetRow(accessToken, newId, 'Kehadiran!A1', [
      [
        'Timestamp',
        'Tanggal',
        'Nama',
        'Email',
        'Tipe',
        'Jam',
        'Jarak (meter)',
        'Status Lokasi',
        'Latitude',
        'Longitude',
        'Foto Selfie URL',
      ],
    ]);

    // 4. Initialize "Pengaturan" sheet headers and default config
    await appendSpreadsheetRow(accessToken, newId, 'Pengaturan!A1', [
      ['Key', 'Value', 'Keterangan'],
      ['school_name', 'SD Harapan Bangsa', 'Nama Sekolah'],
      ['school_lat', '-6.200000', 'Latitude Sekolah'],
      ['school_lng', '106.816666', 'Longitude Sekolah'],
      ['school_radius', '100', 'Radius Toleransi (meter)'],
      ['check_in_start', '06:15', 'Jam Mulai Absen Masuk'],
      ['check_out_start', '12:45', 'Jam Mulai Absen Pulang'],
    ]);

    localStorage.setItem('absensi_spreadsheet_id', newId);
    cachedSpreadsheetId = newId;
    return newId;
  } catch (error) {
    console.error('Error in findOrCreateSpreadsheet:', error);
    throw error;
  }
}

/**
 * Appends a row of data to a spreadsheet.
 */
export async function appendSpreadsheetRow(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<any> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson.error?.message || JSON.stringify(errJson);
    } catch (e) {
      detail = res.statusText;
    }
    throw new Error(`Failed to append spreadsheet data: ${detail}`);
  }

  return res.json();
}

/**
 * Gets values from a spreadsheet range.
 */
export async function getSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<any[][] | null> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get spreadsheet values: ${res.statusText}`);
  }

  const data = await res.json();
  return data.values || null;
}

/**
 * Updates values in a specific spreadsheet range.
 */
export async function updateSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<any> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson.error?.message || JSON.stringify(errJson);
    } catch (e) {
      detail = res.statusText;
    }
    throw new Error(`Failed to update spreadsheet data: ${detail}`);
  }

  return res.json();
}

/**
 * Uploads a selfie photo to Google Drive and makes it viewable to anyone.
 * Returns the shareable web view link.
 */
export async function uploadSelfieToDrive(
  accessToken: string,
  base64DataUrl: string,
  filename: string
): Promise<string> {
  if (accessToken === 'demo-access-token') {
    return base64DataUrl;
  }
  try {
    // 1. Create a folder named "Absensi Sekolah - Foto Selfie" or find it
    const folderSearchUrl = `https://www.googleapis.com/drive/v3/files?q=name='Absensi Sekolah - Foto Selfie' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const folderSearchRes = await fetch(folderSearchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let folderId = '';
    if (folderSearchRes.ok) {
      const searchData = await folderSearchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id;
      }
    }

    // Create folder if not found
    if (!folderId) {
      console.log('Creating folder for selfies...');
      const folderCreateRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Absensi Sekolah - Foto Selfie',
          mimeType: 'application/vnd.google-apps.folder',
        }),
      });

      if (folderCreateRes.ok) {
        const folderData = await folderCreateRes.json();
        folderId = folderData.id;
      }
    }

    // 2. Prepare multipart upload for the file
    const metadata = {
      name: filename,
      mimeType: 'image/jpeg',
      parents: folderId ? [folderId] : [],
    };

    const blob = base64ToBlob(base64DataUrl, 'image/jpeg');
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error(`Failed to upload file to Drive: ${uploadRes.statusText}`);
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.id;

    // 3. Make the file publicly viewable (anyone with link can view)
    try {
      const permissionUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
      await fetch(permissionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });
    } catch (permError) {
      console.warn('Could not set public permissions, file remains private but link is created:', permError);
    }

    // Construct direct viewable URL or use the webViewLink
    // The direct embedding-safe link is: https://drive.google.com/uc?export=view&id={fileId}
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  } catch (error) {
    console.error('Error in uploadSelfieToDrive:', error);
    throw error;
  }
}

/**
 * Fetches all attendance records from the spreadsheet.
 */
export async function fetchAttendanceRecords(
  accessToken: string,
  spreadsheetId: string
): Promise<AttendanceRecord[]> {
  if (accessToken === 'demo-access-token' || spreadsheetId === 'demo-spreadsheet-id') {
    const existing = localStorage.getItem('demo_attendance_records');
    if (!existing) {
      const mockSeeds: AttendanceRecord[] = [
        {
          timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
          tanggal: 'Sabtu, 11 Juli 2026',
          nama: 'Siswa Demo (Simulasi)',
          email: 'demo.siswa@sekolah.id',
          tipe: 'Masuk',
          jam: '06:28',
          jarak: 42.5,
          statusLokasi: 'Dalam Radius',
          latitude: -6.200150,
          longitude: 106.816550,
          fotoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
        },
        {
          timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
          tanggal: 'Sabtu, 11 Juli 2026',
          nama: 'Siswa Demo (Simulasi)',
          email: 'demo.siswa@sekolah.id',
          tipe: 'Pulang',
          jam: '12:55',
          jarak: 58.1,
          statusLokasi: 'Dalam Radius',
          latitude: -6.199850,
          longitude: 106.816750,
          fotoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
        }
      ];
      localStorage.setItem('demo_attendance_records', JSON.stringify(mockSeeds));
      return mockSeeds;
    }
    return JSON.parse(existing);
  }
  try {
    const values = await getSpreadsheetValues(accessToken, spreadsheetId, 'Kehadiran!A2:K');
    if (!values) return [];

    return values.map((row) => ({
      timestamp: row[0] || '',
      tanggal: row[1] || '',
      nama: row[2] || '',
      email: row[3] || '',
      tipe: (row[4] || 'Masuk') as 'Masuk' | 'Pulang',
      jam: row[5] || '',
      jarak: parseFloat(row[6]) || 0,
      statusLokasi: (row[7] || 'Luar Radius') as 'Dalam Radius' | 'Luar Radius',
      latitude: parseFloat(row[8]) || 0,
      longitude: parseFloat(row[9]) || 0,
      fotoUrl: row[10] || '',
    }));
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    return [];
  }
}

/**
 * Save an attendance record to the spreadsheet.
 */
export async function saveAttendanceRecord(
  accessToken: string,
  spreadsheetId: string,
  record: AttendanceRecord
): Promise<void> {
  if (accessToken === 'demo-access-token' || spreadsheetId === 'demo-spreadsheet-id') {
    const existing = localStorage.getItem('demo_attendance_records');
    const records = existing ? JSON.parse(existing) : [];
    records.push(record);
    localStorage.setItem('demo_attendance_records', JSON.stringify(records));
    return;
  }
  const row = [
    record.timestamp,
    record.tanggal,
    record.nama,
    record.email,
    record.tipe,
    record.jam,
    record.jarak,
    record.statusLokasi,
    record.latitude,
    record.longitude,
    record.fotoUrl,
  ];

  await appendSpreadsheetRow(accessToken, spreadsheetId, 'Kehadiran!A:A', [row]);
}

/**
 * Fetches configuration from the spreadsheet.
 */
export async function fetchSchoolConfig(
  accessToken: string,
  spreadsheetId: string
): Promise<SchoolConfig> {
  if (accessToken === 'demo-access-token' || spreadsheetId === 'demo-spreadsheet-id') {
    const saved = localStorage.getItem('demo_school_config');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      name: 'SD Harapan Bangsa (Demo)',
      latitude: -6.200000,
      longitude: 106.816666,
      radius: 100,
      checkInStart: '06:15',
      checkInEnd: '07:30',
      checkOutStart: '12:45',
      checkOutEnd: '14:00',
      logoUrl: '',
    };
  }
  try {
    const values = await getSpreadsheetValues(accessToken, spreadsheetId, 'Pengaturan!A2:C');
    if (!values) {
      throw new Error('Config rows empty');
    }

    const config: Partial<SchoolConfig> = {};
    values.forEach((row) => {
      const key = row[0];
      const val = row[1];
      if (key === 'school_name') config.name = val;
      if (key === 'school_lat') config.latitude = parseFloat(val);
      if (key === 'school_lng') config.longitude = parseFloat(val);
      if (key === 'school_radius') config.radius = parseFloat(val);
      if (key === 'check_in_start') config.checkInStart = val;
      if (key === 'check_in_end') config.checkInEnd = val;
      if (key === 'check_out_start') config.checkOutStart = val;
      if (key === 'check_out_end') config.checkOutEnd = val;
      if (key === 'school_logo') config.logoUrl = val;
    });

    return {
      name: config.name || 'SD Harapan Bangsa',
      latitude: config.latitude !== undefined ? config.latitude : -6.200000,
      longitude: config.longitude !== undefined ? config.longitude : 106.816666,
      radius: config.radius !== undefined ? config.radius : 100,
      checkInStart: config.checkInStart || '06:15',
      checkInEnd: config.checkInEnd || '07:30',
      checkOutStart: config.checkOutStart || '12:45',
      checkOutEnd: config.checkOutEnd || '14:00',
      logoUrl: config.logoUrl || '',
    };
  } catch (error) {
    console.error('Error fetching school config, using default:', error);
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
  }
}

/**
 * Saves configuration back to the spreadsheet.
 */
export async function saveSchoolConfig(
  accessToken: string,
  spreadsheetId: string,
  config: SchoolConfig
): Promise<void> {
  if (accessToken === 'demo-access-token' || spreadsheetId === 'demo-spreadsheet-id') {
    localStorage.setItem('demo_school_config', JSON.stringify(config));
    return;
  }

  // 1. Fetch existing settings from "Pengaturan" sheet to merge safely
  let existing: any[][] | null = null;
  try {
    existing = await getSpreadsheetValues(accessToken, spreadsheetId, 'Pengaturan!A1:C50');
  } catch (err) {
    console.warn('Error fetching existing config sheet, we will attempt direct write:', err);
  }

  const newConfigRows = [
    ['school_name', config.name, 'Nama Sekolah'],
    ['school_lat', config.latitude.toString(), 'Latitude Sekolah'],
    ['school_lng', config.longitude.toString(), 'Longitude Sekolah'],
    ['school_radius', config.radius.toString(), 'Radius Toleransi (meter)'],
    ['check_in_start', config.checkInStart, 'Jam Mulai Absen Masuk'],
    ['check_in_end', config.checkInEnd, 'Jam Batas Akhir Absen Masuk'],
    ['check_out_start', config.checkOutStart, 'Jam Mulai Absen Pulang'],
    ['check_out_end', config.checkOutEnd, 'Jam Batas Akhir Absen Pulang'],
    ['school_logo', config.logoUrl || '', 'Logo Sekolah (Base64 atau URL)'],
  ];

  if (!existing || existing.length === 0) {
    // If the sheet is empty, write header + all rows
    const initValues = [
      ['Key', 'Value', 'Keterangan'],
      ...newConfigRows
    ];
    await updateSpreadsheetValues(accessToken, spreadsheetId, `Pengaturan!A1:C${initValues.length}`, initValues);
    return;
  }

  const updatedRows = [...existing];
  
  // Ensure we have a valid header row at 0
  if (updatedRows.length === 0 || updatedRows[0][0]?.toLowerCase() !== 'key') {
    updatedRows[0] = ['Key', 'Value', 'Keterangan'];
  }

  newConfigRows.forEach(([key, val, desc]) => {
    const idx = updatedRows.findIndex(row => row && row[0] === key);
    if (idx !== -1) {
      // Key exists, update value and keep description or update it
      updatedRows[idx] = [key, val, desc];
    } else {
      // Key is missing (e.g. older spreadsheets missing school_logo), append it
      updatedRows.push([key, val, desc]);
    }
  });

  const range = `Pengaturan!A1:C${updatedRows.length}`;
  await updateSpreadsheetValues(accessToken, spreadsheetId, range, updatedRows);
}
