import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer, 
  getDocs, 
  deleteDoc, 
  collection, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
/* CRITICAL: Explicitly specify firestoreDatabaseId for custom provisioned databases */
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const googleAuthProvider = new GoogleAuthProvider();
export const appleAuthProvider = new OAuthProvider('apple.com');

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client offline, check connection.");
      return false;
    }
    // Expected if 'test/connection' doc does not exist, connection is verified
    return true;
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    if (result.user) {
      await saveUserProfile(result.user);
    }
    return result.user;
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    console.warn('Google sign-in status:', error?.message || error);
    return null;
  }
}

export async function signInWithApple(): Promise<User | null> {
  try {
    const appleProvider = new OAuthProvider('apple.com');
    appleProvider.addScope('email');
    appleProvider.addScope('name');
    const result = await signInWithPopup(auth, appleProvider);
    if (result.user) {
      await saveUserProfile(result.user);
    }
    return result.user;
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    console.warn('Apple sign-in status:', error?.message || error);
    return null;
  }
}

export function signInAsDemoReviewer(): { uid: string; email: string; displayName: string } {
  const demoUser = {
    uid: 'demo_reviewer_earthi',
    email: 'test-reviewer@earthi.ltd',
    displayName: 'App Store Reviewer (Earthi)',
  };
  localStorage.setItem('iza_demo_reviewer_session', JSON.stringify(demoUser));
  return demoUser;
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

export async function saveUserProfile(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'Sovereign Owner',
      photoURL: user.photoURL || '',
      updatedAt: new Date().toISOString(),
      createdAt: user.metadata.creationTime || new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export async function syncMemoryToFirestore(userId: string, memory: {
  id: string;
  content: string;
  summary?: string;
  kind: string;
  source?: string;
  salience?: number;
  pinned?: boolean;
  isArchived?: boolean;
  capturedAt: string;
}): Promise<void> {
  const path = `users/${userId}/memories/${memory.id}`;
  try {
    const ref = doc(db, 'users', userId, 'memories', memory.id);
    await setDoc(ref, {
      id: memory.id,
      userId,
      content: memory.content.substring(0, 10000),
      summary: (memory.summary || '').substring(0, 1000),
      kind: memory.kind || 'note',
      source: memory.source || 'vault',
      salience: memory.salience || 1.0,
      pinned: !!memory.pinned,
      isArchived: !!memory.isArchived,
      capturedAt: memory.capturedAt
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchUserMemoriesFromFirestore(userId: string): Promise<any[]> {
  const path = `users/${userId}/memories`;
  try {
    const coll = collection(db, 'users', userId, 'memories');
    const q = query(coll, orderBy('capturedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function deleteMemoryFromFirestore(userId: string, memoryId: string): Promise<void> {
  const path = `users/${userId}/memories/${memoryId}`;
  try {
    const ref = doc(db, 'users', userId, 'memories', memoryId);
    await deleteDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncBiometricsToFirestore(userId: string, telemetry: {
  hr: number;
  stress?: number;
  orr?: number;
  teg?: number;
  teng?: number;
}): Promise<void> {
  const id = `bio-${Date.now()}`;
  const path = `users/${userId}/biometrics/${id}`;
  try {
    const ref = doc(db, 'users', userId, 'biometrics', id);
    await setDoc(ref, {
      id,
      userId,
      hr: telemetry.hr,
      stress: telemetry.stress || 0,
      orr: telemetry.orr || 0,
      teg: telemetry.teg || 0,
      teng: telemetry.teng || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
