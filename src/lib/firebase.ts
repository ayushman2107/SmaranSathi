import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  getDocFromServer,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  User, 
  UserRole, 
  Reminder, 
  MemoryJournalEntry, 
  FamiliarPerson, 
  GameSession,
  Alert
} from '../types';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore with specific database ID and auto-detecting transport
export const db = (() => {
  const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

  try {
    if (typeof window !== 'undefined') {
      return initializeFirestore(app, {
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true,
      }, dbId);
    }
    return getFirestore(app, dbId);
  } catch (e) {
    // If already initialized, retrieve existing Firestore instance
    return getFirestore(app, dbId);
  }
})();

/**
 * Validates Firestore connection health with offline-resilience
 */
export async function testConnection(): Promise<boolean> {
  try {
    const snap = await getDocFromServer(doc(db, 'test', 'connection'));
    return snap.exists();
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or network connectivity.");
    }
    return false;
  }
}

// Perform initial connection test on boot
testConnection().catch(() => {});

// Error handling helper for Firebase operations
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.warn(`Firestore [${operationType}] warning on ${path || 'unknown'}:`, errMsg);
}

// Collection References
const USERS_COLLECTION = 'users';
const REMINDERS_COLLECTION = 'reminders';
const JOURNALS_COLLECTION = 'journals';
const FAMILY_COLLECTION = 'family_members';
const SESSIONS_COLLECTION = 'game_sessions';
const LINKS_COLLECTION = 'caregiver_links';

// Local storage key for seamless device remembering
const REMEMBERED_USER_KEY = 'smritisaathi_remembered_user';

/**
 * Recursively strips any keys with `undefined` values from an object,
 * because Firestore throws errors on any `undefined` values.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && data !== null) {
    // Preserve Date or non-plain objects if any, but for plain objects strip undefined
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

// =========================================================================
// 1. User & Authentication Firestore Operations
// =========================================================================

export async function saveUserToFirebase(user: User): Promise<void> {
  // 1. Immediately persist to local device storage so data is never lost even offline
  persistUserLocally(user);

  try {
    const userRef = doc(db, USERS_COLLECTION, user.id);
    const payload = cleanForFirestore({
      ...user,
      updated_at: new Date().toISOString()
    });
    await setDoc(userRef, payload, { merge: true });
  } catch (error) {
    console.error('Error saving user to Firebase:', error);
    throw error;
  }
}

export async function updateUserFaceDescriptor(userId: string, descriptor: number[], newAvatar?: string): Promise<User | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existing = snap.data() as User;
      const updated: User = {
        ...existing,
        face_descriptor: descriptor,
        face_registered_at: new Date().toISOString(),
        ...(newAvatar ? { avatar: newAvatar } : {}),
        updated_at: new Date().toISOString(),
      } as any;
      await setDoc(userRef, cleanForFirestore(updated), { merge: true });
      persistUserLocally(updated);
      return updated;
    }
    return null;
  } catch (err) {
    console.warn('Error updating face descriptor in Firebase:', err);
    return null;
  }
}

export async function updateUserAvatar(userId: string, newAvatar: string): Promise<User | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existing = snap.data() as User;
      const updated: User = {
        ...existing,
        avatar: newAvatar,
        updated_at: new Date().toISOString(),
      } as any;
      await setDoc(userRef, cleanForFirestore(updated), { merge: true });
      persistUserLocally(updated);
      return updated;
    }
    return null;
  } catch (err) {
    console.warn('Error updating avatar in Firebase:', err);
    return null;
  }
}

export async function signInWithGoogle(intendedRole: UserRole = 'caregiver'): Promise<{ user: User; isNew: boolean } | null> {
  try {
    let firebaseUser: FirebaseUser | null = null;
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      firebaseUser = result.user;
    } catch (popupErr: any) {
      console.warn('Popup sign in failed or blocked, attempting fallback:', popupErr);
      if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
        throw new Error('Google Sign-in popup was blocked by browser. Please allow popups or use PIN login.');
      }
      throw popupErr;
    }

    if (!firebaseUser) return null;

    // Check if user document already exists in Firestore users collection
    const userDocRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const existingData = userDocSnap.data() as User;
      const updatedUser: User = {
        ...existingData,
        name: existingData.name || firebaseUser.displayName || 'Google User',
        avatar: existingData.avatar || firebaseUser.photoURL || undefined,
        updated_at: new Date().toISOString()
      };
      await setDoc(userDocRef, cleanForFirestore(updatedUser), { merge: true });
      persistUserLocally(updatedUser);
      return { user: updatedUser, isNew: false };
    }

    // If new user signing in with Google:
    const isCaregiver = intendedRole === 'caregiver';
    const newCaregiverCode = isCaregiver ? `CG-${Math.floor(1000 + Math.random() * 9000)}` : undefined;
    const newPatientId = !isCaregiver ? `PT-${Math.floor(1000 + Math.random() * 9000)}` : undefined;

    const newUser: User = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || (isCaregiver ? 'Caregiver' : 'Senior User'),
      role: intendedRole,
      language_pref: 'en',
      pin: '0000', // Default initial PIN for Google authenticated users
      phone: firebaseUser.phoneNumber || undefined,
      avatar: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      ...(newCaregiverCode ? { caregiver_code: newCaregiverCode } : {}),
      ...(newPatientId ? { patient_id: newPatientId } : {}),
      location: 'Guwahati, Assam, North East India',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await saveUserToFirebase(newUser);
    return { user: newUser, isNew: true };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function logOutFirebaseUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    console.warn('Firebase sign-out note:', e);
  }
}

export async function getUserFromFirebase(userId: string): Promise<User | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const u = snap.data() as User;
      persistUserLocally(u);
      return u;
    }
    return null;
  } catch (error) {
    console.warn('Error fetching user from Firebase:', error);
    return null;
  }
}

export async function getAllUsersFromFirebase(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    const list = snap.docs.map((d) => d.data() as User);
    if (list.length > 0) {
      persistMultipleUsersLocally(list);
    }
    return list;
  } catch (error) {
    console.warn('Error fetching all users from Firebase:', error);
    return [];
  }
}

export async function getCaregiversFromFirebase(): Promise<User[]> {
  try {
    const q = query(collection(db, USERS_COLLECTION), where('role', '==', 'caregiver'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as User);
  } catch (error) {
    console.warn('Error fetching caregivers from Firebase:', error);
    return [];
  }
}

/**
 * Normalizes phone numbers by stripping non-digit characters.
 * Handles Indian phone prefixes (+91, 91, 0) and standard 10-digit formats.
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Formats a 10-digit number into standard +91 XXXXX XXXXX display.
 */
export function formatPhoneNumberDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length === 10) {
    return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
  }
  return phone;
}

/**
 * Checks whether a phone number is already registered to an existing account.
 * Enforces strictly that only one user can register per phone number.
 * Checks Firestore users collection, local device cache, and returns the matching user if found.
 */
export async function findUserByPhoneNumber(
  rawPhone: string, 
  excludeUserId?: string
): Promise<User | null> {
  const cleanPhone = normalizePhoneNumber(rawPhone);
  if (!cleanPhone || cleanPhone.length < 10) return null;

  try {
    // 1. Check all users in Firestore
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const allUsers = usersSnap.docs.map((d) => d.data() as User);
    
    const matched = allUsers.find((u) => {
      if (!u.phone) return false;
      if (excludeUserId && u.id === excludeUserId) return false;
      return normalizePhoneNumber(u.phone) === cleanPhone;
    });

    if (matched) return matched;
  } catch (err) {
    console.warn('Error querying phone number in Firestore:', err);
  }

  // 2. Check locally saved users cache
  try {
    const localUsers = getAllLocallySavedUsers();
    const matchedLocal = localUsers.find((u) => {
      if (!u.phone) return false;
      if (excludeUserId && u.id === excludeUserId) return false;
      return normalizePhoneNumber(u.phone) === cleanPhone;
    });

    if (matchedLocal) return matchedLocal;
  } catch (err) {
    console.warn('Error querying local users for phone:', err);
  }

  return null;
}

export async function findUserByCredentials(
  role: UserRole,
  pin: string,
  identifier?: string
): Promise<User | null> {
  try {
    const cleanPin = pin.trim();
    const cleanId = identifier?.trim().toLowerCase();
    const cleanPhoneId = normalizePhoneNumber(identifier || '');

    const q = query(
      collection(db, USERS_COLLECTION),
      where('role', '==', role),
      where('pin', '==', cleanPin)
    );
    const snap = await getDocs(q);
    const matches = snap.docs.map((d) => d.data() as User);

    if (matches.length === 0) {
      return null;
    }

    if (!cleanId) {
      return matches[0];
    }

    // Match by name, phone (exact or normalized digits), caregiver code, patient ID, or user ID
    const specificMatch = matches.find((u) => {
      if (u.name.toLowerCase() === cleanId) return true;
      if (u.phone?.toLowerCase() === cleanId) return true;
      if (cleanPhoneId && cleanPhoneId.length >= 10 && u.phone && normalizePhoneNumber(u.phone) === cleanPhoneId) return true;
      if (u.caregiver_code?.toLowerCase() === cleanId) return true;
      if (u.patient_id?.toLowerCase() === cleanId) return true;
      if (u.id.toLowerCase() === cleanId) return true;
      return false;
    });

    return specificMatch || matches[0];
  } catch (error) {
    console.warn('Error verifying user in Firebase:', error);
    return null;
  }
}

export async function findCaregiverByCodeOrId(codeOrId: string): Promise<User | null> {
  try {
    const clean = codeOrId.trim().toUpperCase();
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    const allUsers = snap.docs.map((d) => d.data() as User);
    
    const matched = allUsers.find((u) => 
      u.role === 'caregiver' &&
      (u.caregiver_code?.toUpperCase() === clean ||
       u.id.toUpperCase() === clean ||
       u.name.toUpperCase().includes(clean))
    );

    return matched || null;
  } catch (error) {
    console.warn('Error searching caregiver in Firebase:', error);
    return null;
  }
}

export const searchCaregiverByCodeOrName = findCaregiverByCodeOrId;

export async function linkElderlyToCaregiverInFirebase(
  elderlyId: string, 
  caregiver: User
): Promise<User | null> {
  try {
    // 1. Update Elderly Document
    const elderlyRef = doc(db, USERS_COLLECTION, elderlyId);
    const elderlySnap = await getDoc(elderlyRef);
    if (!elderlySnap.exists()) return null;

    const elderlyData = elderlySnap.data() as User;
    const updatedElderly: User = {
      ...elderlyData,
      connected_caregiver_id: caregiver.caregiver_code || caregiver.id,
      connected_caregiver_name: caregiver.name
    };
    await setDoc(elderlyRef, cleanForFirestore(updatedElderly), { merge: true });

    // 2. Record in caregiver_links collection
    const linkId = `link-${caregiver.id}-${elderlyId}`;
    await setDoc(doc(db, LINKS_COLLECTION, linkId), cleanForFirestore({
      id: linkId,
      caregiver_id: caregiver.id,
      caregiver_code: caregiver.caregiver_code || caregiver.id,
      elderly_id: elderlyId,
      relation: 'Primary Care Link',
      created_at: new Date().toISOString()
    }));

    persistUserLocally(updatedElderly);
    return updatedElderly;
  } catch (error) {
    console.error('Error linking elderly to caregiver in Firebase:', error);
    return null;
  }
}

export async function unlinkElderlyFromCaregiverInFirebase(
  elderlyId: string
): Promise<User | null> {
  try {
    const elderlyRef = doc(db, USERS_COLLECTION, elderlyId);
    const elderlySnap = await getDoc(elderlyRef);
    if (!elderlySnap.exists()) return null;

    const elderlyData = elderlySnap.data() as User;
    const updatedElderly: User = {
      ...elderlyData,
      connected_caregiver_id: undefined,
      connected_caregiver_name: undefined,
    };
    await setDoc(elderlyRef, cleanForFirestore(updatedElderly), { merge: true });
    persistUserLocally(updatedElderly);
    return updatedElderly;
  } catch (error) {
    console.error('Error unlinking elderly from caregiver in Firebase:', error);
    return null;
  }
}

export async function getAssignedElderlyIdsForCaregiver(
  caregiverId: string,
  caregiverCode?: string
): Promise<string[]> {
  try {
    const patientIds = new Set<string>();
    const cleanId = caregiverId.trim().toUpperCase();
    const cleanCode = (caregiverCode || '').trim().toUpperCase();

    // 1. Fetch all elderly users in Firestore to cross-reference connected_caregiver_id
    const elderlyUsers: User[] = [];
    try {
      const usersSnap = await getDocs(
        query(collection(db, USERS_COLLECTION), where('role', '==', 'elderly'))
      );
      usersSnap.docs.forEach((docSnap) => {
        const u = docSnap.data() as User;
        elderlyUsers.push(u);
        const conn = (u.connected_caregiver_id || '').trim().toUpperCase();
        if (conn && (conn === cleanId || (cleanCode && conn === cleanCode))) {
          patientIds.add(u.id);
        }
      });
    } catch (e) {
      console.warn('Error querying users for assigned caregiver:', e);
    }

    // 2. Check caregiver_links collection ONLY for users who do not have a conflicting assignment
    try {
      const snap1 = await getDocs(collection(db, LINKS_COLLECTION));
      snap1.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const cid = (data.caregiver_id || '').toUpperCase();
        const ccode = (data.caregiver_code || '').toUpperCase();
        if ((cid && (cid === cleanId || cid === cleanCode)) || (ccode && (ccode === cleanCode || ccode === cleanId))) {
          if (data.elderly_id) {
            // Ensure elderly is not assigned to someone else
            const match = elderlyUsers.find(u => u.id === data.elderly_id);
            if (match && match.connected_caregiver_id) {
              const conn = match.connected_caregiver_id.trim().toUpperCase();
              if (conn !== cleanId && (!cleanCode || conn !== cleanCode)) {
                return; // Assigned to another caregiver, ignore stale link
              }
            }
            patientIds.add(data.elderly_id);
          }
        }
      });
    } catch (e) {
      console.warn('Error reading caregiver_links:', e);
    }

    return Array.from(patientIds);
  } catch (error) {
    console.warn('Error getting assigned elderly ids from Firebase:', error);
    return [];
  }
}

// =========================================================================
// 2. Reminders & Daily Routines (User-Specific)
// =========================================================================

export async function getRemindersForUser(userId: string): Promise<Reminder[]> {
  try {
    const q = query(
      collection(db, REMINDERS_COLLECTION),
      where('user_id', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Reminder);
  } catch (error) {
    console.warn('Error getting user reminders from Firebase:', error);
    return [];
  }
}

export async function saveReminderToFirebase(reminder: Reminder): Promise<void> {
  try {
    const ref = doc(db, REMINDERS_COLLECTION, reminder.id);
    await setDoc(ref, cleanForFirestore(reminder), { merge: true });
  } catch (error) {
    console.error('Error saving reminder to Firebase:', error);
  }
}

export async function toggleReminderInFirebase(reminderId: string, completed: boolean): Promise<void> {
  try {
    const ref = doc(db, REMINDERS_COLLECTION, reminderId);
    await updateDoc(ref, {
      completed,
      completed_at: completed ? new Date().toISOString() : null
    });
  } catch (error) {
    console.warn('Error toggling reminder in Firebase:', error);
  }
}

export async function deleteReminderFromFirebase(reminderId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, REMINDERS_COLLECTION, reminderId));
  } catch (error) {
    console.warn('Error deleting reminder from Firebase:', error);
  }
}

// =========================================================================
// 3. Memory Journals (Relationship-Specific to Assigned Patient-Caregiver Pair)
// =========================================================================

export const LOCAL_JOURNALS_KEY = 'smritisaathi_cached_memory_journals_v2';

export function persistJournalLocally(journal: MemoryJournalEntry): void {
  try {
    if (typeof window === 'undefined' || !journal || !journal.id) return;
    const existing = getLocallySavedJournals();
    const filtered = existing.filter((j) => j.id !== journal.id);
    const updated = [journal, ...filtered].slice(0, 150);
    localStorage.setItem(LOCAL_JOURNALS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not persist memory journal to local cache:', e);
  }
}

export function deleteJournalLocally(journalId: string): void {
  try {
    if (typeof window === 'undefined' || !journalId) return;
    const existing = getLocallySavedJournals();
    const filtered = existing.filter((j) => j.id !== journalId);
    localStorage.setItem(LOCAL_JOURNALS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Could not delete memory journal from local cache:', e);
  }
}

export function getLocallySavedJournals(filterId?: string): MemoryJournalEntry[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_JOURNALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MemoryJournalEntry[];
    if (!Array.isArray(parsed)) return [];
    if (!filterId) return parsed;
    const clean = filterId.trim().toLowerCase();
    return parsed.filter((j) => {
      if (!j) return false;
      const jRel = (j.relationship_id || '').toLowerCase();
      const jPat = (j.patient_id || j.user_id || '').toLowerCase();
      const jCg = (j.caregiver_id || '').toLowerCase();
      const jCreator = (j.created_by || '').toLowerCase();
      return (
        jRel === clean ||
        jPat === clean ||
        jCg === clean ||
        jCreator === clean ||
        (clean.length > 3 && jRel.includes(clean)) ||
        (clean.length > 3 && clean.includes(jPat))
      );
    });
  } catch (e) {
    console.warn('Could not read local memory journals:', e);
    return [];
  }
}

export async function getJournalsForRelationship(
  relationshipId: string
): Promise<MemoryJournalEntry[]> {
  const localList = getLocallySavedJournals(relationshipId);
  try {
    if (!relationshipId) return localList;
    const q = query(
      collection(db, JOURNALS_COLLECTION),
      where('relationship_id', '==', relationshipId)
    );
    const snap = await getDocs(q);
    const remoteList = snap.docs.map((d) => d.data() as MemoryJournalEntry);
    
    // Merge remote and local without duplicates
    const merged = new Map<string, MemoryJournalEntry>();
    remoteList.forEach((j) => {
      persistJournalLocally(j);
      merged.set(j.id, j);
    });
    localList.forEach((j) => {
      if (!merged.has(j.id)) merged.set(j.id, j);
    });

    return Array.from(merged.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (error) {
    console.warn('Error getting journals for relationship from Firebase:', error);
    return localList;
  }
}

export async function getJournalsForUser(userId: string): Promise<MemoryJournalEntry[]> {
  const localList = getLocallySavedJournals(userId);
  try {
    const q = query(
      collection(db, JOURNALS_COLLECTION),
      where('patient_id', '==', userId)
    );
    const snap = await getDocs(q);
    let remoteDocs = snap.docs;

    if (remoteDocs.length === 0) {
      // Fallback for legacy items without patient_id
      const legacyQ = query(
        collection(db, JOURNALS_COLLECTION),
        where('user_id', '==', userId)
      );
      const legacySnap = await getDocs(legacyQ);
      remoteDocs = legacySnap.docs;
    }

    const remoteList = remoteDocs.map((d) => d.data() as MemoryJournalEntry);
    const merged = new Map<string, MemoryJournalEntry>();
    remoteList.forEach((j) => {
      persistJournalLocally(j);
      merged.set(j.id, j);
    });
    localList.forEach((j) => {
      if (!merged.has(j.id)) merged.set(j.id, j);
    });

    return Array.from(merged.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (error) {
    console.warn('Error getting journals from Firebase:', error);
    return localList;
  }
}

export async function saveJournalToFirebase(journal: MemoryJournalEntry): Promise<void> {
  // Always persist locally first so nothing is lost even offline
  persistJournalLocally(journal);
  try {
    const ref = doc(db, JOURNALS_COLLECTION, journal.id);
    await setDoc(ref, cleanForFirestore(journal), { merge: true });
  } catch (error) {
    console.error('Error saving journal to Firebase:', error);
  }
}

export async function deleteJournalFromFirebase(journalId: string): Promise<void> {
  deleteJournalLocally(journalId);
  try {
    const ref = doc(db, JOURNALS_COLLECTION, journalId);
    await deleteDoc(ref);
  } catch (error) {
    console.error('Error deleting journal from Firebase:', error);
  }
}

// =========================================================================
// 4. Family Album Members (User-Specific)
// =========================================================================

export async function getFamilyForUser(userId: string): Promise<FamiliarPerson[]> {
  try {
    const q = query(
      collection(db, FAMILY_COLLECTION),
      where('user_id', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as FamiliarPerson);
  } catch (error) {
    console.warn('Error getting family members from Firebase:', error);
    return [];
  }
}

export async function saveFamilyMemberToFirebase(member: FamiliarPerson): Promise<void> {
  try {
    const ref = doc(db, FAMILY_COLLECTION, member.id);
    await setDoc(ref, cleanForFirestore(member), { merge: true });
  } catch (error) {
    console.error('Error saving family member to Firebase:', error);
  }
}

// =========================================================================
// 5. Game Sessions & Cognitive Tracking (User-Specific with Offline Cache)
// =========================================================================

export const LOCAL_SESSIONS_STORAGE_KEY = 'smritisaathi_cached_game_sessions_v1';

/**
 * Persists a game session to device local storage for immediate offline reliability.
 */
export function persistGameSessionLocally(session: GameSession): void {
  try {
    if (typeof window === 'undefined' || !session || !session.id) return;
    const existing = getLocallySavedGameSessions();
    const filtered = existing.filter((s) => s.id !== session.id);
    const updated = [session, ...filtered].slice(0, 100);
    localStorage.setItem(LOCAL_SESSIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not persist game session to local cache:', e);
  }
}

/**
 * Retrieves game sessions from local storage, optionally filtered by user.
 */
export function getLocallySavedGameSessions(userId?: string): GameSession[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GameSession[];
    if (!Array.isArray(parsed)) return [];
    
    if (!userId) return parsed;
    const cleanId = userId.trim().toLowerCase();
    const cleanStripped = cleanId.replace(/^user-/, '');

    // Check if user has associated patient_id or name in local profiles registry
    const localUsers = getAllLocallySavedUsers();
    const matchedUser = localUsers.find(
      (u) =>
        u.id.toLowerCase() === cleanId ||
        (u.patient_id && u.patient_id.toLowerCase() === cleanId) ||
        u.name.toLowerCase() === cleanId
    );

    const matchingIds = new Set<string>([cleanId, cleanStripped]);
    if (matchedUser) {
      if (matchedUser.id) {
        matchingIds.add(matchedUser.id.toLowerCase());
        matchingIds.add(matchedUser.id.toLowerCase().replace(/^user-/, ''));
      }
      if (matchedUser.patient_id) {
        matchingIds.add(matchedUser.patient_id.toLowerCase());
      }
    }

    return parsed.filter((s) => {
      if (!s || !s.user_id) return false;
      const sId = s.user_id.trim().toLowerCase();
      const sStripped = sId.replace(/^user-/, '');
      return matchingIds.has(sId) || matchingIds.has(sStripped);
    });
  } catch (e) {
    console.warn('Could not read local game sessions:', e);
    return [];
  }
}

export async function getGameSessionsForUser(userId: string): Promise<GameSession[]> {
  const localSessions = getLocallySavedGameSessions(userId);
  try {
    const cleanId = userId.trim().toLowerCase();
    const cleanStripped = cleanId.replace(/^user-/, '');

    // Check for associated patient_id or other aliases
    const localUsers = getAllLocallySavedUsers();
    const matchedUser = localUsers.find(
      (u) =>
        u.id.toLowerCase() === cleanId ||
        (u.patient_id && u.patient_id.toLowerCase() === cleanId) ||
        u.name.toLowerCase() === cleanId
    );

    const matchingIds = new Set<string>([userId, cleanId, cleanStripped]);
    if (matchedUser) {
      if (matchedUser.id) {
        matchingIds.add(matchedUser.id);
        matchingIds.add(matchedUser.id.toLowerCase());
        matchingIds.add(matchedUser.id.toLowerCase().replace(/^user-/, ''));
      }
      if (matchedUser.patient_id) {
        matchingIds.add(matchedUser.patient_id);
        matchingIds.add(matchedUser.patient_id.toLowerCase());
      }
    }

    const sessionsRef = collection(db, SESSIONS_COLLECTION);
    const snap = await getDocs(sessionsRef);
    const remoteSessions: GameSession[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() as GameSession;
      if (data && data.user_id) {
        const dId = data.user_id.trim();
        const dLower = dId.toLowerCase();
        const dStripped = dLower.replace(/^user-/, '');
        if (matchingIds.has(dId) || matchingIds.has(dLower) || matchingIds.has(dStripped)) {
          remoteSessions.push(data);
        }
      }
    });

    // Merge remote and local sessions by ID
    const mergedMap = new Map<string, GameSession>();
    for (const s of [...remoteSessions, ...localSessions]) {
      if (s && s.id) {
        mergedMap.set(s.id, s);
      }
    }

    const combined = Array.from(mergedMap.values());
    combined.sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );

    // Keep local cache synced with remote records
    combined.slice(0, 50).forEach((s) => persistGameSessionLocally(s));

    return combined;
  } catch (error) {
    console.warn('Error getting game sessions from Firebase, falling back to local:', error);
    return localSessions;
  }
}

export async function saveGameSessionToFirebase(session: GameSession): Promise<void> {
  // Always save locally first for instant offline recording
  persistGameSessionLocally(session);

  try {
    const ref = doc(db, SESSIONS_COLLECTION, session.id);
    await setDoc(ref, cleanForFirestore(session), { merge: true });
  } catch (error) {
    console.error('Error saving game session to Firebase:', error);
  }
}

/**
 * Real-time listener for game sessions of assigned patients.
 * Fires whenever a patient finishes a game and records new telemetry.
 */
export function subscribeToPatientGameSessions(
  patientIds: string[],
  onSessionsUpdate: (sessions: GameSession[]) => void
): () => void {
  try {
    const matchingIds = new Set<string>();
    for (const pid of patientIds) {
      if (pid) {
        const clean = pid.trim().toLowerCase();
        matchingIds.add(pid);
        matchingIds.add(clean);
        matchingIds.add(clean.replace(/^user-/, ''));
      }
    }

    // Also include patient_id from local registry
    const localUsers = getAllLocallySavedUsers();
    for (const u of localUsers) {
      const uId = u.id.toLowerCase();
      if (matchingIds.has(uId) || matchingIds.has(uId.replace(/^user-/, ''))) {
        if (u.patient_id) {
          matchingIds.add(u.patient_id);
          matchingIds.add(u.patient_id.toLowerCase());
        }
      }
    }

    const sessionsRef = collection(db, SESSIONS_COLLECTION);
    const unsubscribe = onSnapshot(
      sessionsRef,
      (snapshot) => {
        const items: GameSession[] = [];
        snapshot.forEach((docSnap) => {
          const session = docSnap.data() as GameSession;
          if (session && session.user_id) {
            const sId = session.user_id.trim();
            const sLower = sId.toLowerCase();
            const sStripped = sLower.replace(/^user-/, '');
            if (!patientIds.length || matchingIds.has(sId) || matchingIds.has(sLower) || matchingIds.has(sStripped)) {
              items.push(session);
              persistGameSessionLocally(session);
            }
          }
        });

        items.sort(
          (a, b) =>
            new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
        );
        onSessionsUpdate(items);
      },
      (error) => {
        console.warn('Game sessions real-time snapshot subscription warning:', error);
      }
    );

    return unsubscribe;
  } catch (e) {
    console.warn('Failed to subscribe to game sessions snapshot:', e);
    return () => {};
  }
}

export const ALL_PROFILES_LOCAL_REGISTRY_KEY = 'smritisaathi_saved_profiles_registry';

/**
 * Permanently stores a profile in the device's persistent profile registry.
 * This registry is NEVER cleared on logout, guaranteeing that all registered
 * profiles are preserved on this device across restarts and sessions.
 */
export function persistUserLocally(user: User): void {
  try {
    if (typeof window === 'undefined' || !user || !user.id) return;
    const existing = getAllLocallySavedUsers();
    const filtered = existing.filter((u) => u.id !== user.id);
    const updated = [user, ...filtered];
    localStorage.setItem(ALL_PROFILES_LOCAL_REGISTRY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not persist profile in local registry:', e);
  }
}

/**
 * Persists multiple profiles into the permanent local registry without duplicates.
 */
export function persistMultipleUsersLocally(users: User[]): void {
  try {
    if (typeof window === 'undefined' || !Array.isArray(users)) return;
    const existing = getAllLocallySavedUsers();
    const map = new Map<string, User>();
    for (const u of existing) {
      if (u && u.id) map.set(u.id, u);
    }
    for (const u of users) {
      if (u && u.id) map.set(u.id, { ...(map.get(u.id) || {}), ...u });
    }
    localStorage.setItem(ALL_PROFILES_LOCAL_REGISTRY_KEY, JSON.stringify(Array.from(map.values())));
  } catch (e) {
    console.warn('Could not persist multiple profiles in local registry:', e);
  }
}

/**
 * Retrieves all profiles ever saved on this device.
 */
export function getAllLocallySavedUsers(): User[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(ALL_PROFILES_LOCAL_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    let updated = false;
    parsed.forEach((u) => {
      if (u && u.role === 'elderly' && !u.patient_id) {
        u.patient_id = `PT-${Math.floor(1000 + Math.random() * 9000)}`;
        updated = true;
      }
    });
    if (updated) {
      localStorage.setItem(ALL_PROFILES_LOCAL_REGISTRY_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    console.warn('Could not retrieve local profiles registry:', e);
    return [];
  }
}

// =========================================================================
// 6. Seamless Remembering Session (User-Specific Auto-Login & Profile Recall)
// =========================================================================

export function saveRememberedUser(user: User): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(REMEMBERED_USER_KEY, JSON.stringify(user));
      // Also ensure it is permanently stored in the all-profiles registry
      persistUserLocally(user);
    }
  } catch (e) {
    console.warn('Could not cache session locally:', e);
  }
}

export function getRememberedUser(): User | null {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(REMEMBERED_USER_KEY);
      if (raw) {
        return JSON.parse(raw) as User;
      }
    }
  } catch (e) {
    console.warn('Could not read remembered user:', e);
  }
  return null;
}

export function clearRememberedUser(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(REMEMBERED_USER_KEY);
      localStorage.removeItem(ALL_PROFILES_LOCAL_REGISTRY_KEY);
    }
  } catch (e) {
    console.warn('Could not clear remembered user:', e);
  }
}

// =========================================================================
// 7. Emergency & Cognitive Alerts (SOS Alerts Real-Time Dispatch)
// =========================================================================

const ALERTS_COLLECTION = 'alerts';
const LOCAL_ALERTS_KEY = 'smritisaathi_cached_alerts';

function getLocalAlerts(): Alert[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAlerts(alerts: Alert[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_ALERTS_KEY, JSON.stringify(alerts));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function saveAlertToFirebase(alert: Alert): Promise<void> {
  try {
    // 1. Persist locally first for zero-latency UI updates
    const local = getLocalAlerts();
    const filtered = local.filter(a => a.id !== alert.id);
    saveLocalAlerts([alert, ...filtered]);

    // 2. Persist to Firestore
    const alertDocRef = doc(db, ALERTS_COLLECTION, alert.id);
    await setDoc(alertDocRef, {
      ...alert,
      triggered_at: alert.triggered_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.warn('Could not save alert to Firestore, fallback cached locally:', e);
  }
}

export async function getAlertsFromFirebase(userId?: string): Promise<Alert[]> {
  try {
    const alertsRef = collection(db, ALERTS_COLLECTION);
    const snap = await getDocs(alertsRef);
    if (!snap.empty) {
      const items: Alert[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data() as Alert;
        if (!userId || data.user_id === userId || (data.caregiver_id && data.caregiver_id === userId)) {
          items.push(data);
        }
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.triggered_at || b.created_at || '').getTime() - new Date(a.triggered_at || a.created_at || '').getTime());
      saveLocalAlerts(items);
      return items;
    }
  } catch (e) {
    console.warn('Firestore alerts fetch failed, using local cache:', e);
  }

  // Fallback to local cache
  const local = getLocalAlerts();
  if (userId) {
    return local.filter(a => a.user_id === userId || a.caregiver_id === userId);
  }
  return local;
}

export async function resolveAlertInFirebase(alertId: string): Promise<void> {
  try {
    // Update local cache
    const local = getLocalAlerts();
    const updated = local.map(a => a.id === alertId ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a);
    saveLocalAlerts(updated);

    // Update Firestore
    const alertDocRef = doc(db, ALERTS_COLLECTION, alertId);
    await updateDoc(alertDocRef, {
      resolved: true,
      resolved_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Could not resolve alert in Firestore:', e);
  }
}

/**
 * Real-time listener for alerts relevant to a caregiver.
 * Fires whenever any patient sends an SOS or whenever alert status changes.
 */
export function subscribeToCaregiverAlerts(
  caregiverId: string,
  assignedPatientIds: string[],
  onAlertsUpdate: (alerts: Alert[]) => void
): () => void {
  try {
    const alertsRef = collection(db, ALERTS_COLLECTION);
    const unsubscribe = onSnapshot(
      alertsRef,
      (snapshot) => {
        const items: Alert[] = [];
        snapshot.forEach((docSnap) => {
          const alert = docSnap.data() as Alert;
          // Match if this alert is for this caregiver or one of their assigned patients
          const isTargeted =
            alert.caregiver_id === caregiverId ||
            (alert.user_id && assignedPatientIds.includes(alert.user_id));

          if (isTargeted || assignedPatientIds.length === 0) {
            items.push(alert);
          }
        });

        items.sort(
          (a, b) =>
            new Date(b.triggered_at || b.created_at || '').getTime() -
            new Date(a.triggered_at || a.created_at || '').getTime()
        );
        onAlertsUpdate(items);
      },
      (error) => {
        console.warn('Alerts real-time snapshot subscription warning:', error);
      }
    );

    return unsubscribe;
  } catch (e) {
    console.warn('Failed to subscribe to alerts snapshot:', e);
    return () => {};
  }
}
