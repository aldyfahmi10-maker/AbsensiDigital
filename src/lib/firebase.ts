import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Sheets and Drive scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Save token in sessionStorage to persist across refreshes, but in-memory works too.
// The workspace guidelines say:
// "You MUST implement in-memory caching for the access token. Do NOT store the access token in localStorage or sessionStorage. Use onAuthStateChanged to clear the cached token when the user signs out."
// Okay! We must strictly follow the in-memory caching and clean-up in onAuthStateChanged rule!
// Wait! Let's make sure we handle cachedAccessToken correctly.

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If we have a user but no access token (e.g. after a page refresh), 
        // we might need to prompt sign-in or let the user click sign-in.
        // Wait, to be safe, if we don't have a token, we tell the app we need auth.
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const demoSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  const mockUser = {
    uid: 'demo-user-123',
    email: 'demo.siswa@sekolah.id',
    displayName: 'Siswa Demo (Simulasi)',
    photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    emailVerified: true,
  } as unknown as User;

  cachedAccessToken = 'demo-access-token';
  return { user: mockUser, accessToken: 'demo-access-token' };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
