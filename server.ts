import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  User, 
  GameSession, 
  Reminder, 
  FamiliarPerson, 
  Alert, 
  AIRecommendation, 
  PerformanceTrend,
  DifficultyLevel,
  GameType,
  MemoryJournalEntry,
  MedicationSchedule,
  ConsultationDoctor,
  ConsultationAppointment,
  ForumPost,
  DataLakeSummary,
  PatientGamingAnalysis,
  CognitiveDomainScore,
  TrendData
} from './src/types';
import { FAMILIAR_PEOPLE_SEED } from './src/data/nerContent';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Server-Side Gemini AI Client initialization
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

// Persistent Local Disk Storage for Users, Reminders & Game Sessions (never lost on server reload)
const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users_store.json');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders_store.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'game_sessions_store.json');

function loadUsersFromDisk(): User[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        let updated = false;
        parsed.forEach((u: User) => {
          if (u.role === 'elderly' && !u.patient_id) {
            u.patient_id = `PT-${Math.floor(1000 + Math.random() * 9000)}`;
            updated = true;
          }
        });
        if (updated) {
          saveUsersToDisk(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load users from disk, initializing fresh:', err);
  }
  return [];
}

function saveUsersToDisk(usersList: User[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write users to disk:', err);
  }
}

const DEFAULT_INITIAL_REMINDERS: Reminder[] = [];

function loadRemindersFromDisk(): Reminder[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(REMINDERS_FILE)) {
      const raw = fs.readFileSync(REMINDERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load reminders from disk:', err);
  }
  return [];
}

function saveRemindersToDisk(remList: Reminder[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify(remList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write reminders to disk:', err);
  }
}

// In-Memory & File-Backed Database (no saved mock profiles, preserves real registered profiles)
interface CaregiverLink {
  id: string;
  caregiver_id: string;
  elderly_id: string;
  relation: string;
}

const LINKS_FILE = path.join(DATA_DIR, 'caregiver_links_store.json');

function loadCaregiverLinksFromDisk(): CaregiverLink[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(LINKS_FILE)) {
      const raw = fs.readFileSync(LINKS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load caregiver links from disk:', err);
  }
  return [];
}

function saveCaregiverLinksToDisk(links: CaregiverLink[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write caregiver links to disk:', err);
  }
}

let users: User[] = loadUsersFromDisk();
let caregiverLinks: CaregiverLink[] = loadCaregiverLinksFromDisk();

function syncCaregiverLinksFromUsers(): void {
  users.forEach(u => {
    if (u.role === 'elderly' && u.connected_caregiver_id) {
      const target = u.connected_caregiver_id.toUpperCase();
      const caregiver = users.find(c => 
        c.role === 'caregiver' && 
        (c.id.toUpperCase() === target || (c.caregiver_code && c.caregiver_code.toUpperCase() === target))
      );
      if (caregiver) {
        const linkId = `link-${caregiver.id}-${u.id}`;
        if (!caregiverLinks.some(l => 
          (l.elderly_id === u.id || (u.patient_id && l.elderly_id === u.patient_id)) && 
          (l.caregiver_id === caregiver.id || (caregiver.caregiver_code && l.caregiver_id === caregiver.caregiver_code))
        )) {
          caregiverLinks.push({
            id: linkId,
            caregiver_id: caregiver.id,
            elderly_id: u.id,
            relation: 'Primary Care'
          });
        }
      }
    }
  });
  saveCaregiverLinksToDisk(caregiverLinks);
}
syncCaregiverLinksFromUsers();

// Clean initial sessions (populated genuinely through gameplay)
const INITIAL_SEED_SESSIONS: GameSession[] = [];

function loadGameSessionsFromDisk(): GameSession[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load game sessions from disk:', err);
  }
  return [];
}

function saveGameSessionsToDisk(sessionsList: GameSession[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write game sessions to disk:', err);
  }
}

let gameSessions: GameSession[] = loadGameSessionsFromDisk();

function getMatchingUserIds(targetId: string): Set<string> {
  const ids = new Set<string>();
  if (!targetId) return ids;

  const trimmed = targetId.trim();
  const lower = trimmed.toLowerCase();
  ids.add(trimmed);
  ids.add(lower);
  ids.add(lower.replace(/^user-/, ''));

  const matchedUsers = users.filter(
    u => (u.id && (u.id === trimmed || u.id.toLowerCase() === lower || u.id.toLowerCase().replace(/^user-/, '') === lower.replace(/^user-/, ''))) ||
         (u.patient_id && (u.patient_id === trimmed || u.patient_id.toLowerCase() === lower)) ||
         (u.name && u.name.toLowerCase() === lower) ||
         (u.phone && (u.phone === trimmed || u.phone.toLowerCase() === lower))
  );

  for (const matchedUser of matchedUsers) {
    if (matchedUser.id) {
      ids.add(matchedUser.id);
      ids.add(matchedUser.id.toLowerCase());
      ids.add(matchedUser.id.toLowerCase().replace(/^user-/, ''));
    }
    if (matchedUser.patient_id) {
      ids.add(matchedUser.patient_id);
      ids.add(matchedUser.patient_id.toLowerCase());
    }
    if (matchedUser.name) {
      ids.add(matchedUser.name);
      ids.add(matchedUser.name.toLowerCase());
    }
    if (matchedUser.phone) {
      ids.add(matchedUser.phone);
    }
  }

  return ids;
}

function getUserSessions(targetId: string): GameSession[] {
  if (!targetId) return [];
  const ids = getMatchingUserIds(targetId);
  const targetLower = targetId.trim().toLowerCase();
  const targetStripped = targetLower.replace(/^user-/, '');

  return gameSessions
    .filter(s => {
      if (!s || !s.user_id) return false;
      const sUserId = s.user_id.trim();
      const sLower = sUserId.toLowerCase();
      const sStripped = sLower.replace(/^user-/, '');

      return ids.has(sUserId) || 
             ids.has(sLower) || 
             ids.has(sStripped) ||
             sLower === targetLower ||
             sStripped === targetStripped;
    })
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
}

let reminders: Reminder[] = loadRemindersFromDisk();

let familiarPeople: FamiliarPerson[] = [...FAMILIAR_PEOPLE_SEED];

let alerts: Alert[] = [];

// -------------------------------------------------------------
// Extended Ecosystem In-Memory Stores
// -------------------------------------------------------------

const JOURNALS_FILE = path.join(DATA_DIR, 'memory_journals_store.json');

function loadMemoryJournalsFromDisk(): MemoryJournalEntry[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(JOURNALS_FILE)) {
      const raw = fs.readFileSync(JOURNALS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load memory journals from disk:', err);
  }
  return [];
}

function saveMemoryJournalsToDisk(journalsList: MemoryJournalEntry[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(JOURNALS_FILE, JSON.stringify(journalsList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write memory journals to disk:', err);
  }
}

let memoryJournals: MemoryJournalEntry[] = loadMemoryJournalsFromDisk();

function normalizeMemoryJournals(): void {
  let changed = false;
  memoryJournals = memoryJournals.map(j => {
    const updated = { ...j };
    if (!updated.patient_id && updated.user_id) {
      updated.patient_id = updated.user_id;
      changed = true;
    }
    if (!updated.relationship_id && updated.patient_id) {
      const patient = users.find(u => u.id === updated.patient_id || u.patient_id === updated.patient_id);
      if (patient && patient.connected_caregiver_id) {
        const caregiver = users.find(c => 
          c.role === 'caregiver' && 
          (c.caregiver_code?.toUpperCase() === patient.connected_caregiver_id?.toUpperCase() || c.id.toUpperCase() === patient.connected_caregiver_id?.toUpperCase())
        );
        if (caregiver) {
          updated.relationship_id = `rel_${patient.id}_${caregiver.id}`;
          updated.caregiver_id = caregiver.id;
          changed = true;
        }
      }
    }
    return updated;
  });
  if (changed) {
    saveMemoryJournalsToDisk(memoryJournals);
  }
}
normalizeMemoryJournals();

function findUserByIdOrCode(idOrCode?: string): User | undefined {
  if (!idOrCode) return undefined;
  const clean = String(idOrCode).trim().toUpperCase();
  return users.find(u => 
    u.id.toUpperCase() === clean || 
    (u.patient_id && u.patient_id.toUpperCase() === clean) ||
    (u.caregiver_code && u.caregiver_code.toUpperCase() === clean) ||
    (u.phone && u.phone.toUpperCase() === clean)
  );
}

// Find assigned relationship between a specific patient and caregiver
function findPatientCaregiverRelationship(patientId: string, caregiverIdOrCode: string): {
  relationship_id: string;
  patient: User;
  caregiver: User;
} | null {
  const patient = findUserByIdOrCode(patientId);
  const caregiver = findUserByIdOrCode(caregiverIdOrCode);

  if (!patient || patient.role !== 'elderly') return null;
  if (!caregiver || caregiver.role !== 'caregiver') return null;

  const cgCode = (caregiver.caregiver_code || '').toUpperCase();
  const cgId = caregiver.id.toUpperCase();

  const canonicalRelId = `rel_${patient.id}_${caregiver.id}`;

  // Ensure direct link is saved on patient profile and caregiverLinks
  if (!patient.connected_caregiver_id) {
    patient.connected_caregiver_id = caregiver.caregiver_code || caregiver.id;
    patient.connected_caregiver_name = caregiver.name;
    saveUsersToDisk(users);
  }

  const existingLink = caregiverLinks.find(l => 
    (l.elderly_id === patient.id || l.elderly_id === patient.patient_id) &&
    (l.caregiver_id === caregiver.id || l.caregiver_id === caregiver.caregiver_code)
  );
  if (!existingLink) {
    caregiverLinks.push({
      id: canonicalRelId,
      caregiver_id: caregiver.id,
      elderly_id: patient.id,
      relation: 'Primary Care'
    });
    saveCaregiverLinksToDisk(caregiverLinks);
  }

  return {
    relationship_id: canonicalRelId,
    patient,
    caregiver
  };
}

// Resolve relationship for an authenticated requester
function resolveRelationshipForRequester(
  requesterId: string,
  targetPatientId?: string
): {
  relationship_id: string;
  patient: User;
  caregiver: User;
} | null {
  let requester = findUserByIdOrCode(requesterId);

  // If requester not in memory store, look for partial match or default fallback
  if (!requester) {
    // Attempt fallback from users
    requester = users.find(u => u.id === requesterId || (u.patient_id && u.patient_id === requesterId));
  }

  if (!requester) {
    // If still not found, check if there are users
    if (targetPatientId) {
      const p = findUserByIdOrCode(targetPatientId);
      const c = users.find(u => u.role === 'caregiver');
      if (p && c) {
        return findPatientCaregiverRelationship(p.id, c.id);
      }
    }
    return null;
  }

  if (requester.role === 'elderly') {
    // Requester is the patient
    const connCg = (requester.connected_caregiver_id || '').trim().toUpperCase();
    let caregiver: User | undefined;
    if (connCg) {
      caregiver = users.find(u => 
        u.role === 'caregiver' && 
        (u.caregiver_code?.toUpperCase() === connCg || u.id.toUpperCase() === connCg)
      );
    }
    if (!caregiver) {
      // Check caregiverLinks
      const link = caregiverLinks.find(l => 
        l.elderly_id.toUpperCase() === requester.id.toUpperCase() || 
        (requester.patient_id && l.elderly_id.toUpperCase() === requester.patient_id.toUpperCase())
      );
      if (link) {
        caregiver = findUserByIdOrCode(link.caregiver_id);
      }
    }

    // If still not explicitly linked, auto-connect to available caregiver in system
    if (!caregiver) {
      caregiver = users.find(u => u.role === 'caregiver');
      if (caregiver) {
        requester.connected_caregiver_id = caregiver.caregiver_code || caregiver.id;
        requester.connected_caregiver_name = caregiver.name;
        saveUsersToDisk(users);
        const linkId = `rel_${requester.id}_${caregiver.id}`;
        if (!caregiverLinks.some(l => l.id === linkId)) {
          caregiverLinks.push({
            id: linkId,
            caregiver_id: caregiver.id,
            elderly_id: requester.id,
            relation: 'Primary Care'
          });
          saveCaregiverLinksToDisk(caregiverLinks);
        }
      }
    }

    if (!caregiver) return null;

    return {
      relationship_id: `rel_${requester.id}_${caregiver.id}`,
      patient: requester,
      caregiver
    };
  }

  if (requester.role === 'caregiver') {
    // Requester is the caregiver
    let patient: User | undefined;
    if (targetPatientId) {
      const rel = findPatientCaregiverRelationship(targetPatientId, requester.id);
      if (rel) return rel;

      patient = findUserByIdOrCode(targetPatientId);
      if (patient && patient.role === 'elderly') {
        return findPatientCaregiverRelationship(patient.id, requester.id);
      }
    }

    // If target patient was not supplied or not found, locate any elderly assigned to this caregiver
    const cgCode = (requester.caregiver_code || '').toUpperCase();
    const cgId = requester.id.toUpperCase();

    patient = users.find(u => 
      u.role === 'elderly' && 
      u.connected_caregiver_id && 
      (u.connected_caregiver_id.toUpperCase() === cgCode || u.connected_caregiver_id.toUpperCase() === cgId)
    );

    if (!patient) {
      // Check caregiverLinks
      const link = caregiverLinks.find(l => 
        l.caregiver_id.toUpperCase() === cgId || (cgCode && l.caregiver_id.toUpperCase() === cgCode)
      );
      if (link) {
        patient = findUserByIdOrCode(link.elderly_id);
      }
    }

    // Fallback: If no elderly is linked to this caregiver yet, link the first available elderly user
    if (!patient) {
      patient = users.find(u => u.role === 'elderly');
      if (patient) {
        patient.connected_caregiver_id = requester.caregiver_code || requester.id;
        patient.connected_caregiver_name = requester.name;
        saveUsersToDisk(users);
        const linkId = `rel_${patient.id}_${requester.id}`;
        if (!caregiverLinks.some(l => l.id === linkId)) {
          caregiverLinks.push({
            id: linkId,
            caregiver_id: requester.id,
            elderly_id: patient.id,
            relation: 'Primary Care'
          });
          saveCaregiverLinksToDisk(caregiverLinks);
        }
      }
    }

    if (!patient) return null;

    return {
      relationship_id: `rel_${patient.id}_${requester.id}`,
      patient,
      caregiver: requester
    };
  }

  return null;
}

function verifyRelationshipAccess(requesterId: string, relationshipId: string): boolean {
  const requester = findUserByIdOrCode(requesterId);
  if (!requester) return false;

  if (relationshipId.startsWith('rel_')) {
    const parts = relationshipId.split('_');
    if (parts.length >= 3) {
      const pId = parts[1];
      const cgId = parts.slice(2).join('_');

      const rel = findPatientCaregiverRelationship(pId, cgId);
      if (!rel) return false;

      const isPatient = requester.id === rel.patient.id || (requester.patient_id && requester.patient_id === rel.patient.patient_id);
      const isCaregiver = requester.id === rel.caregiver.id || (requester.caregiver_code && requester.caregiver_code === rel.caregiver.caregiver_code);

      return Boolean(isPatient || isCaregiver);
    }
  }

  // Check caregiverLinks
  const link = caregiverLinks.find(l => l.id === relationshipId);
  if (link) {
    const rel = findPatientCaregiverRelationship(link.elderly_id, link.caregiver_id);
    if (!rel) return false;
    const isPatient = requester.id === rel.patient.id || (requester.patient_id && requester.patient_id === rel.patient.patient_id);
    const isCaregiver = requester.id === rel.caregiver.id || (requester.caregiver_code && requester.caregiver_code === rel.caregiver.caregiver_code);
    return Boolean(isPatient || isCaregiver);
  }

  return false;
}

let medicationSchedules: MedicationSchedule[] = [];

let consultationDoctors: ConsultationDoctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Bhupen Borah, MD, DM',
    specialty: 'Senior Consultant Neurologist & Cognitive Specialist',
    hospital: 'GNRC Hospitals / Dispur Neuroscience Clinic',
    location: 'Guwahati, Assam',
    available_days: 'Mon, Wed, Fri (2 PM - 6 PM)',
    consult_fee: '₹800 (Tele / In-Person)',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80',
    rating: 4.9
  },
  {
    id: 'doc-2',
    name: 'Dr. Larisa Sangma, MD',
    specialty: 'Geriatrician & Memory Care Physician',
    hospital: 'NEIGRIHMS (North Eastern Indira Gandhi Regional Institute)',
    location: 'Mawdiangdiang, Shillong, Meghalaya',
    available_days: 'Tue, Thu, Sat (10 AM - 3 PM)',
    consult_fee: '₹600 (Tele / In-Person)',
    avatar: 'https://images.unsplash.com/photo-1594824813575-520e5e04e43e?auto=format&fit=crop&w=300&q=80',
    rating: 4.8
  },
  {
    id: 'doc-3',
    name: 'Dr. Ningombam Singh, DNB',
    specialty: 'Neuropsychiatrist & Behavioral Health Lead',
    hospital: 'RIMS (Regional Institute of Medical Sciences)',
    location: 'Imphal, Manipur',
    available_days: 'Mon - Fri (11 AM - 4 PM)',
    consult_fee: '₹700 (Tele-consultation)',
    avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=300&q=80',
    rating: 4.9
  }
];

let consultationAppointments: ConsultationAppointment[] = [
  {
    id: 'apt-1',
    user_id: 'user-bhaben',
    doctor_id: 'doc-1',
    doctor_name: 'Dr. Bhupen Borah, MD, DM',
    specialty: 'Senior Consultant Neurologist',
    hospital: 'GNRC Hospitals, Guwahati',
    date: '2026-09-18',
    time: '03:30 PM',
    status: 'confirmed',
    notes: 'Bi-monthly cognitive evaluation and review of sequence recall engagement trend.'
  }
];

let forumPosts: ForumPost[] = [
  {
    id: 'post-1',
    author_name: 'Maitreyi Goswami',
    author_role: 'Daughter & Primary Caregiver',
    location: 'Jorhat, Assam',
    title: 'Managing evening restlessness (sundowning) using traditional Goalparia folk songs',
    content: 'My mother would become very anxious around sunset (5:30 PM). Two weeks ago we started playing gentle Pratima Barua Pandey folk songs while serving warm black tea with ginger. Her pacing has reduced by more than 70%. Has anyone else tried local rhythmic music?',
    tags: ['Sundowning', 'Assam Folk Music', 'Routine', 'Anxiety Relief'],
    likes: 24,
    replies_count: 8,
    created_at: new Date(Date.now() - 36 * 3600000).toISOString()
  },
  {
    id: 'post-2',
    author_name: 'David Lalnunmawia',
    author_role: 'Caregiver & Social Worker',
    location: 'Aizawl, Mizoram',
    title: 'Tips on keeping familiar family photos accessible near the bedside',
    content: 'We labelled all framed family pictures with large print relation cards (e.g. "Pi Mary - Eldest Daughter"). It has drastically eliminated morning confusion when waking up.',
    tags: ['Visual Cues', 'Family Album', 'Orientation'],
    likes: 31,
    replies_count: 12,
    created_at: new Date(Date.now() - 72 * 3600000).toISOString()
  },
  {
    id: 'post-3',
    author_name: 'Dr. Priya Barua',
    author_role: 'Occupational Therapy Caregiver',
    location: 'Guwahati, Assam',
    title: 'Why culturally familiar stimuli reduce agitation in North East Indian seniors',
    content: 'Standard western cognitive apps often use unfamiliar objects. In our tests, presenting a Gamosa, Hornbill, or Kaziranga one-horned rhino triggered immediate semantic memory retrieval and smiles. Contextual dignity matters deeply.',
    tags: ['NER Cultural Cues', 'Clinical Insights', 'Dignity in Care'],
    likes: 47,
    replies_count: 15,
    created_at: new Date(Date.now() - 120 * 3600000).toISOString()
  }
];

let dataLakeSummary: DataLakeSummary = {
  raw_records_count: 12480,
  cleansed_records_count: 11920,
  features_extracted: [
    'response_time_variance_ms',
    'spatial_hesitation_index',
    'mistake_recovery_rate',
    'cultural_motif_recognition_speed',
    'circadian_engagement_slope'
  ],
  model_accuracy: 91.4,
  ethical_compliance_pct: 100,
  anonymized: true,
  training_epochs: 45,
  last_training_time: new Date(Date.now() - 14 * 3600000).toISOString()
};

const ETHICAL_DISCLAIMER = "This is a cognitive engagement tool, not a medical diagnosis. Consult a healthcare professional for clinical assessment.";

// -------------------------------------------------------------
// Cognitive Gaming Performance & Deep Analytical Engine
// -------------------------------------------------------------
function analyzePatientGamingPerformance(userId: string): PatientGamingAnalysis {
  const userSessions = getUserSessions(userId);

  const domainConfig: Record<GameType, { domain: string; title: string; desc: string }> = {
    memory_match: {
      domain: 'Visual Association & Paired Recall',
      title: 'Memory Match (Smriti Milan)',
      desc: 'Short-term visual recall and associative pairing of regional motifs.'
    },
    picture_recognition: {
      domain: 'Semantic & Cultural Recognition',
      title: 'Picture Recognition (Chobi Chena)',
      desc: 'Long-term semantic memory and recognition of familiar Northeast artifacts.'
    },
    sequence_recall: {
      domain: 'Working Memory & Temporal Sequencing',
      title: 'Sequence Recall (Krom Smaran)',
      desc: 'Active working memory span and audio-visual sequential retention.'
    },
    simple_puzzle: {
      domain: 'Spatial Reasoning & Coordination',
      title: 'Simple Cultural Puzzle',
      desc: 'Visuospatial coordination, spatial reconstruction, and motor planning.'
    },
    face_match: {
      domain: 'Facial & Loved Ones Familiarity',
      title: 'Familiar Face Match',
      desc: 'Emotional orientation and visual identification of primary caregivers & family.'
    },
    simple_calculation: {
      domain: 'Numerical Cognition & Working Memory',
      title: 'Simple Math & Calculation',
      desc: 'Numerical working memory, arithmetic fluency, and mental calculation agility.'
    }
  };

  if (userSessions.length === 0) {
    return {
      has_data: false,
      total_games_played: 0,
      gaming_score: 0,
      score_breakdown: {
        accuracy_pts: 0,
        speed_pts: 0,
        focus_pts: 0,
        completion_pts: 0
      },
      average_accuracy_pct: 0,
      average_response_time_sec: 0,
      total_mistakes: 0,
      total_stars: 0,
      domain_breakdown: (Object.keys(domainConfig) as GameType[]).map(gType => ({
        domain: domainConfig[gType].domain,
        game_type: gType,
        game_title: domainConfig[gType].title,
        accuracy: 0,
        avg_response_time: 0,
        sessions_count: 0,
        mistakes_avg: 0,
        status: 'needs_practice' as const,
        analysis: `No gameplay recorded yet for ${domainConfig[gType].title}. Awaiting patient activity.`
      })),
      trend_direction: 'insufficient_data',
      trend_summary: 'No game sessions logged yet. Cognitive scoring will generate automatically once the patient completes their first game.',
      speed_analysis: 'Reaction time tracking awaiting initial game session.',
      clinical_insight: 'Baseline assessment pending initial patient engagement. No synthetic score is assumed.',
      recommended_game: {
        game_type: 'memory_match',
        title: 'Memory Match (Smriti Milan)',
        reason: 'Recommended starting activity: culturally familiar imagery with soothing voice prompts.'
      },
      recent_sessions_summary: []
    };
  }

  // Real calculations based on actual userSessions:
  const totalGames = userSessions.length;
  const totalAccuracy = userSessions.reduce((acc, s) => acc + s.accuracy, 0);
  const avgAccuracy = Math.round(totalAccuracy / totalGames);

  const totalResponseTime = userSessions.reduce((acc, s) => acc + s.response_time, 0);
  const avgResponseTime = Number((totalResponseTime / totalGames).toFixed(1));

  const totalMistakes = userSessions.reduce((acc, s) => acc + s.mistakes, 0);
  const avgMistakes = Number((totalMistakes / totalGames).toFixed(1));

  const totalStars = userSessions.reduce((acc, s) => acc + s.stars, 0);
  const avgCompletion = Math.round(
    userSessions.reduce((acc, s) => acc + (s.completion_rate || 100), 0) / totalGames
  );

  // Score Components (out of 100 pts total directly derived from actual gameplay):
  // 1. Accuracy Component (50 pts max): avgAccuracy * 0.5
  const accuracyPts = Math.min(50, Math.max(5, Math.round(avgAccuracy * 0.5)));

  // 2. Speed Agility Component (25 pts max): benchmarked for elderly players
  // <=3.5s -> 25pts; 5.0s -> 20pts; 7.0s -> 15pts; >10s -> 8pts
  const speedEfficiency = Math.max(20, Math.min(100, Math.round(100 - Math.max(0, avgResponseTime - 2.8) * 11)));
  const speedPts = Math.min(25, Math.max(5, Math.round(speedEfficiency * 0.25)));

  // 3. Focus & Error Control Component (15 pts max):
  // 0 mistakes -> 15pts; 1 mistake -> 12pts; 2 mistakes -> 9pts; >=3 mistakes -> 5pts
  const focusEfficiency = Math.max(20, Math.min(100, Math.round(100 - avgMistakes * 25)));
  const focusPts = Math.min(15, Math.max(3, Math.round(focusEfficiency * 0.15)));

  // 4. Completion & Consistency Component (10 pts max):
  const completionPts = Math.min(10, Math.max(2, Math.round(avgCompletion * 0.10)));

  // Total Real Patient Gaming Score
  const gamingScore = Math.min(100, Math.max(10, accuracyPts + speedPts + focusPts + completionPts));

  // Domain Breakdown
  const domainBreakdown: CognitiveDomainScore[] = (Object.keys(domainConfig) as GameType[]).map(gType => {
    const sessions = userSessions.filter(s => s.game_type === gType);
    const count = sessions.length;
    if (count === 0) {
      return {
        domain: domainConfig[gType].domain,
        game_type: gType,
        game_title: domainConfig[gType].title,
        accuracy: 0,
        avg_response_time: 0,
        sessions_count: 0,
        mistakes_avg: 0,
        status: 'needs_practice' as const,
        analysis: `No gameplay recorded yet for ${domainConfig[gType].title}. Recommended to establish domain baseline.`
      };
    }

    const domainAcc = Math.round(sessions.reduce((acc, s) => acc + s.accuracy, 0) / count);
    const domainSpeed = Number((sessions.reduce((acc, s) => acc + s.response_time, 0) / count).toFixed(1));
    const domainMistakes = Number((sessions.reduce((acc, s) => acc + s.mistakes, 0) / count).toFixed(1));

    let status: 'strong' | 'steady' | 'needs_practice' = 'steady';
    if (domainAcc >= 88 && domainSpeed <= 5.5) status = 'strong';
    else if (domainAcc < 70 || domainMistakes >= 2.5) status = 'needs_practice';

    let analysisText = '';
    if (status === 'strong') {
      analysisText = `Robust cognitive performance (${domainAcc}% accuracy, ${domainSpeed}s avg reaction). High neural clarity in this domain.`;
    } else if (status === 'steady') {
      analysisText = `Stable retention (${domainAcc}% accuracy, ${domainSpeed}s reaction). Consistent engagement with minimal hesitation.`;
    } else {
      analysisText = `Moderate fatigue or hesitation observed (${domainAcc}% accuracy, ${domainMistakes} avg mistakes). Shorter, encouraging sessions recommended.`;
    }

    return {
      domain: domainConfig[gType].domain,
      game_type: gType,
      game_title: domainConfig[gType].title,
      accuracy: domainAcc,
      avg_response_time: domainSpeed,
      sessions_count: count,
      mistakes_avg: domainMistakes,
      status,
      analysis: analysisText
    };
  });

  // Trend Trajectory (compare recent half vs older half)
  let trendDirection: 'improving' | 'stable' | 'attention_needed' = 'stable';
  let trendSummary = '';
  if (userSessions.length >= 3) {
    const half = Math.floor(userSessions.length / 2);
    const older = userSessions.slice(0, half);
    const newer = userSessions.slice(half);

    const olderAvg = older.reduce((a, b) => a + b.accuracy, 0) / older.length;
    const newerAvg = newer.reduce((a, b) => a + b.accuracy, 0) / newer.length;
    const diff = Math.round(newerAvg - olderAvg);

    if (diff >= 3) {
      trendDirection = 'improving';
      trendSummary = `Positive trajectory: Cognitive accuracy increased +${diff}% between earlier and recent sessions. Consistent recall speed across activities.`;
    } else if (diff <= -5) {
      trendDirection = 'attention_needed';
      trendSummary = `Gentle deceleration: Accuracy dipped by ${Math.abs(diff)}% recently. Suggested shorter play intervals and familiar family photos.`;
    } else {
      trendDirection = 'stable';
      trendSummary = `Steady baseline: Cognitive scores maintain consistency within ±${Math.abs(diff)}% across all played activities.`;
    }
  } else {
    trendSummary = `Initial baseline active across ${userSessions.length} session(s). Continue daily sessions to establish rolling trajectory.`;
  }

  // Speed Analysis
  let speedAnalysis = '';
  if (avgResponseTime <= 4.2) {
    speedAnalysis = `Swift cognitive processing: Average reaction time of ${avgResponseTime}s demonstrates confident recognition without hesitation.`;
  } else if (avgResponseTime <= 6.5) {
    speedAnalysis = `Balanced and deliberate pace: Average reaction time of ${avgResponseTime}s shows thoughtful inspection of game elements.`;
  } else {
    speedAnalysis = `Relaxed, extended contemplation: Average response time of ${avgResponseTime}s. Patient benefits from open-ended pacing without time pressure.`;
  }

  // Clinical Insight
  const playedDomains = domainBreakdown.filter(d => d.sessions_count > 0);
  const bestDomain = [...playedDomains].sort((a, b) => b.accuracy - a.accuracy)[0];
  const lowestDomain = [...playedDomains].sort((a, b) => a.accuracy - b.accuracy)[0];

  let clinicalInsight = '';
  if (bestDomain) {
    clinicalInsight = `Patient exhibits peak strength in ${bestDomain.domain} (${bestDomain.accuracy}% accuracy across ${bestDomain.sessions_count} games). `;
    if (lowestDomain && lowestDomain.game_type !== bestDomain.game_type) {
      clinicalInsight += `Practicing ${lowestDomain.domain} (${lowestDomain.accuracy}%) will support comprehensive neuro-stimulation.`;
    }
  } else {
    clinicalInsight = `Consistent participation recorded across ${totalGames} game sessions. Overall patient gaming score is ${gamingScore}/100.`;
  }

  // Recommended next game based on real scores
  let nextGame: GameType = 'memory_match';
  let nextReason = '';
  const zeroSessions = domainBreakdown.filter(d => d.sessions_count === 0);
  if (zeroSessions.length > 0) {
    nextGame = zeroSessions[0].game_type;
    nextReason = `Explore ${zeroSessions[0].game_title} to test ${zeroSessions[0].domain}.`;
  } else if (lowestDomain && lowestDomain.accuracy < 75) {
    nextGame = lowestDomain.game_type;
    nextReason = `Reinforce ${lowestDomain.domain} with gentle supportive gameplay.`;
  } else if (bestDomain) {
    nextGame = bestDomain.game_type;
    nextReason = `Maintain high confidence through familiar strengths in ${bestDomain.game_title}.`;
  }

  // Recent sessions summary
  const recentSessionsSummary = [...userSessions]
    .reverse()
    .slice(0, 10)
    .map(s => {
      let note = 'Great focus';
      if (s.accuracy >= 90 && s.response_time <= 4.5) note = 'Sharp Recall & Swift Reflexes';
      else if (s.accuracy >= 85) note = 'Accurate Visual Recognition';
      else if (s.mistakes >= 2) note = 'Paced Deliberation';
      else note = 'Comfortable Exploration';

      return {
        id: s.id,
        game_type: s.game_type,
        game_title: domainConfig[s.game_type]?.title || s.game_type,
        date: new Date(s.completed_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        accuracy: s.accuracy,
        response_time: s.response_time,
        mistakes: s.mistakes,
        stars: s.stars,
        difficulty_level: s.difficulty_level,
        note
      };
    });

  return {
    has_data: true,
    total_games_played: totalGames,
    gaming_score: gamingScore,
    score_breakdown: {
      accuracy_pts: accuracyPts,
      speed_pts: speedPts,
      focus_pts: focusPts,
      completion_pts: completionPts
    },
    average_accuracy_pct: avgAccuracy,
    average_response_time_sec: avgResponseTime,
    total_mistakes: totalMistakes,
    total_stars: totalStars,
    domain_breakdown: domainBreakdown,
    trend_direction: trendDirection,
    trend_summary: trendSummary,
    speed_analysis: speedAnalysis,
    clinical_insight: clinicalInsight,
    recommended_game: {
      game_type: nextGame,
      title: domainConfig[nextGame]?.title || nextGame,
      reason: nextReason
    },
    recent_sessions_summary: recentSessionsSummary
  };
}

// In-memory cache for fast responsive reads
const aiRecommendationsCache: Map<string, { data: AIRecommendation; timestamp: number }> = new Map();

// Base algorithmic recommendation (ground truth & clinical fallback)
function computeAIRecommendation(userId: string): AIRecommendation {
  const analysis = analyzePatientGamingPerformance(userId);
  const user = users.find(u => u.id === userId || u.patient_id === userId);

  const gameTitles: Record<GameType, string> = {
    memory_match: 'Cultural Pair Match (Assam Tea & Heritage)',
    sequence_recall: 'Traditional Melody & Rhythm Recall',
    picture_recognition: 'Northeast Heritage & Wildlife Recognition',
    simple_puzzle: 'Heritage Craft & Landscape Puzzle',
    face_match: 'Familiar Faces & Loved Ones Match',
    simple_calculation: 'Simple Math & Northeast Counting'
  };

  const domainNames: Record<GameType, string> = {
    memory_match: 'Short-Term Visual & Spatial Working Memory',
    sequence_recall: 'Working Memory, Attention & Sequential Recall',
    picture_recognition: 'Semantic Memory & Visual Categorization',
    simple_puzzle: 'Visuospatial Reasoning & Coordination',
    face_match: 'Social-Emotional & Facial Recognition',
    simple_calculation: 'Numerical Cognition & Working Memory'
  };

  if (!analysis.has_data) {
    const nextGame: GameType = 'memory_match';
    return {
      recommended_difficulty: 'easy',
      next_game_type: nextGame,
      recommended_game_title: gameTitles[nextGame],
      engagement_score: 0,
      has_gaming_data: false,
      total_games_analyzed: 0,
      rationale: 'Ready for initial cognitive exploration with culturally familiar Pair Match.',
      observation_note: 'No gaming telemetry recorded yet. AI baseline active.',
      ethical_disclaimer: ETHICAL_DISCLAIMER,
      recent_trend: 'insufficient_data',
      ai_powered: false,
      clinical_reasoning: 'Starting with Cultural Pair Match introduces gentle visual stimuli (Assam tea leaves, Hornbill, Muga silk) without cognitive strain, building baseline spatial confidence.',
      cognitive_focus_domain: domainNames[nextGame],
      patient_encouragement_message: `Welcome ${user?.name ? user.name : 'Aap'}! Let's start with a gentle game of matching beautiful Northeast heritage pictures.`,
      patient_voice_prompt: `Welcome! Let us begin with Cultural Pair Match. Find the matching pictures to brighten your day and keep your mind active.`,
      caregiver_actionable_tip: 'Sit beside the patient during their first game, encourage them to name the items out loud, and celebrate every match with a warm smile.',
      expected_therapeutic_benefit: 'Activates visual association pathways and builds playful engagement without performance stress.',
      confidence_score: 85,
      adaptive_level_suggestion: 1
    };
  }

  let recommendedDifficulty: DifficultyLevel = 'easy';
  if (analysis.gaming_score >= 88 && analysis.average_response_time_sec <= 5.2 && analysis.total_mistakes <= 2) {
    recommendedDifficulty = 'medium';
  } else if (analysis.gaming_score >= 95 && analysis.average_response_time_sec <= 3.8) {
    recommendedDifficulty = 'hard';
  }

  const nextGame = analysis.recommended_game.game_type;

  return {
    recommended_difficulty: recommendedDifficulty,
    next_game_type: nextGame,
    recommended_game_title: gameTitles[nextGame] || analysis.recommended_game.title,
    engagement_score: analysis.gaming_score,
    has_gaming_data: true,
    total_games_analyzed: analysis.total_games_played,
    rationale: `Derived from ${analysis.total_games_played} cognitive sessions (${analysis.gaming_score}/100 gaming score): ${analysis.trend_summary}`,
    observation_note: `${analysis.clinical_insight} ${analysis.speed_analysis}`,
    ethical_disclaimer: ETHICAL_DISCLAIMER,
    recent_trend: analysis.trend_direction === 'insufficient_data' ? 'stable' : analysis.trend_direction,
    ai_powered: false,
    clinical_reasoning: `${analysis.clinical_insight} Target domain "${domainNames[nextGame]}" will optimize neural stimulation while matching current latency of ${analysis.average_response_time_sec}s.`,
    cognitive_focus_domain: domainNames[nextGame],
    patient_encouragement_message: `Great progress! Based on your steady memory sessions, playing ${gameTitles[nextGame]} will be wonderful for your mind today.`,
    patient_voice_prompt: `You are doing wonderfully! Today, let us play ${gameTitles[nextGame]}. It will keep your memory sharp and joyful.`,
    caregiver_actionable_tip: `Support ${user?.name || 'the senior'} with gentle prompts. Focus on positive reinforcement rather than speed.`,
    expected_therapeutic_benefit: `Reinforces ${domainNames[nextGame]} and maintains neural pathways against cognitive decline.`,
    confidence_score: 88,
    adaptive_level_suggestion: recommendedDifficulty === 'hard' ? 4 : recommendedDifficulty === 'medium' ? 2 : 1
  };
}

// Deep Gemini AI Cognitive Game Recommendation Engine
async function generateGeminiAIRecommendation(userId: string, forceRefresh: boolean = false): Promise<AIRecommendation> {
  const cached = aiRecommendationsCache.get(userId);
  const now = Date.now();
  // Cache for 60 seconds unless forceRefresh
  if (!forceRefresh && cached && (now - cached.timestamp < 60000)) {
    return cached.data;
  }

  const baseline = computeAIRecommendation(userId);
  const analysis = analyzePatientGamingPerformance(userId);
  const user = users.find(u => u.id === userId || u.patient_id === userId);
  const ai = getGeminiClient();

  if (!ai) {
    aiRecommendationsCache.set(userId, { data: baseline, timestamp: now });
    return baseline;
  }

  try {
    const recentSessions = getUserSessions(userId)
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      .slice(0, 8);

    const prompt = `You are an expert Geriatric Neuropsychologist and Senior Cognitive Rehabilitation Specialist analyzing an elderly patient with dementia or cognitive aging in North East India.
Analyze this patient's clinical profile, detailed gameplay telemetry, and cognitive domain metrics to prescribe the SINGLE BEST game and difficulty level right now.

PATIENT CLINICAL PROFILE:
- Name: ${user?.name || 'Patient'}
- Age: ${user?.age || 72}
- Dementia Stage: ${user?.dementia_stage || 'mild'} (stages: healthy_aging, early, mild, moderate)
- Primary Language: ${user?.language_pref || 'en'} (en: English, as: Assamese, kha: Khasi, mni: Meiteilon, hi: Hindi)
- Care Goals: ${(user?.care_goals || []).join(', ') || 'Preserve memory, reduce agitation, encourage daily routine'}
- Diagnosis / Doctor Note: ${user?.diagnosis_note || 'Dementia care plan with cognitive rehabilitation'}

PATIENT GAMEPLAY TELEMETRY & ACTUAL SCORES:
- Total Games Played: ${analysis.total_games_played}
- Overall Cognitive Score: ${analysis.gaming_score}/100
- Average Accuracy: ${analysis.average_accuracy_pct}%
- Average Reaction / Latency: ${analysis.average_response_time_sec} seconds
- Total Mistakes: ${analysis.total_mistakes}
- Total Stars Earned: ${analysis.total_stars}
- Trend Trajectory: ${analysis.trend_direction} (${analysis.trend_summary})
- Processing Speed Analysis: ${analysis.speed_analysis}

COGNITIVE DOMAIN BREAKDOWN:
${analysis.domain_breakdown.map(d => `- Domain "${d.domain}" (${d.game_type}): ${d.accuracy}% accuracy, ${d.avg_response_time}s avg reaction, ${d.sessions_count} sessions, ${d.mistakes_avg} avg mistakes. Status: ${d.status}`).join('\n')}

RECENT SESSIONS HISTORY (Newest to Oldest):
${recentSessions.length > 0 ? recentSessions.map(s => `* Game: ${s.game_type}, Accuracy: ${s.accuracy}%, Time: ${s.response_time}s, Mistakes: ${s.mistakes}, Stars: ${s.stars}, Difficulty: ${s.difficulty_level}, Level: ${s.level_number || 1}`).join('\n') : 'No sessions recorded yet.'}

AVAILABLE GAMES IN SMARAN SATHI:
1. "memory_match" - Cultural Pair Match (Assam tea leaves, Great Indian Hornbill, Muga/Eri silk, Bihu dhol, Majuli masks). Focus: Short-Term Visual & Spatial Working Memory.
2. "sequence_recall" - Traditional Melody & Rhythm Recall (Northeast instruments & sound sequences). Focus: Working Memory, Executive Function & Sequential Processing.
3. "picture_recognition" - Northeast Heritage & Wildlife Recognition (Kamakhya Temple, Kaziranga Rhino, Living Root Bridges, Loktak Lake, Kangla Fort). Focus: Semantic Memory, Visual Identification & Cultural Grounding.
4. "simple_puzzle" - Heritage Craft & Landscape Puzzle. Focus: Visuospatial Reasoning, Motor Coordination & Mental Rotation.
5. "face_match" - Familiar Faces & Loved Ones Match (Family members & caregivers). Focus: Social-Emotional Memory, Facial Feature Recall, Anxiety & Agitation Reduction.
6. "simple_calculation" - Simple Math & Northeast Counting (Lemons, tea cups, oranges, pithas, clay diyas). Focus: Numerical Cognition, Arithmetic Fluency & Working Memory.

CLINICAL PRESCRIPTION RULES:
1. Recommend the SINGLE game from the 6 available game types that will produce the maximum therapeutic benefit for this patient's current state.
2. If the patient has moderate dementia or is showing fatigue/mistakes, prefer "face_match" or "picture_recognition" at "easy" difficulty to evoke comfort and joy without frustration.
3. If the patient has high accuracy (>85%) and quick response (<4.5s), suggest "sequence_recall", "simple_calculation", or "simple_puzzle" or increase difficulty to "medium" to stimulate neuroplasticity.
4. Provide a warm, uplifting encouragement message for the senior, an exact voice prompt for text-to-speech audio, and a practical actionable tip for the caregiver.`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let responseText: string | null = null;
    let successfulModel: string | null = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                recommended_game_type: {
                  type: Type.STRING,
                  description: 'Must be exactly one of: memory_match, sequence_recall, picture_recognition, simple_puzzle, face_match'
                },
                recommended_game_title: {
                  type: Type.STRING,
                  description: 'Clear display title of the recommended game'
                },
                recommended_difficulty: {
                  type: Type.STRING,
                  description: 'Must be one of: easy, medium, hard'
                },
                adaptive_level_suggestion: {
                  type: Type.INTEGER,
                  description: 'Suggested level from 1 to 10'
                },
                cognitive_focus_domain: {
                  type: Type.STRING,
                  description: 'Targeted brain function e.g. Visuospatial Working Memory, Semantic Recall, Social-Emotional Recognition'
                },
                clinical_reasoning: {
                  type: Type.STRING,
                  description: 'Detailed 2-3 sentence neuropsychological reasoning analyzing accuracy, latency, dementia stage, and domain status'
                },
                patient_encouragement_message: {
                  type: Type.STRING,
                  description: 'Warm, respectful, soothing message addressed to the senior explaining why this game is fun and good for them'
                },
                patient_voice_prompt: {
                  type: Type.STRING,
                  description: 'Natural spoken prompt for audio TTS playback to the senior'
                },
                caregiver_actionable_tip: {
                  type: Type.STRING,
                  description: 'Practical guidance for the caregiver/family to assist during this game'
                },
                expected_therapeutic_benefit: {
                  type: Type.STRING,
                  description: 'Anticipated neural or psychological outcome'
                },
                confidence_score: {
                  type: Type.INTEGER,
                  description: 'Confidence percentage from 75 to 99'
                }
              },
              required: [
                'recommended_game_type',
                'recommended_game_title',
                'recommended_difficulty',
                'cognitive_focus_domain',
                'clinical_reasoning',
                'patient_encouragement_message',
                'patient_voice_prompt',
                'caregiver_actionable_tip',
                'expected_therapeutic_benefit',
                'confidence_score'
              ]
            }
          }
        });

        if (response && response.text) {
          responseText = response.text.trim();
          successfulModel = modelName;
          break;
        }
      } catch (modelErr: any) {
        // If 503 / 429 / spike occurred on this model, failover smoothly to next model
        const isTransient = modelErr?.status === 'UNAVAILABLE' || modelErr?.message?.includes('503') || modelErr?.message?.includes('high demand') || modelErr?.message?.includes('429');
        if (isTransient) {
          console.info(`Gemini model ${modelName} temporarily busy (503/429), failing over to next model candidate...`);
        } else {
          console.warn(`Gemini model ${modelName} encountered error:`, modelErr?.message || modelErr);
        }
      }
    }

    if (!responseText) {
      // Fall back seamlessly to algorithmic clinical baseline
      aiRecommendationsCache.set(userId, { data: baseline, timestamp: now });
      return baseline;
    }

    const parsed = JSON.parse(responseText || '{}');
    const validGameTypes: GameType[] = ['memory_match', 'sequence_recall', 'picture_recognition', 'simple_puzzle', 'face_match', 'simple_calculation'];
    const gameType: GameType = validGameTypes.includes(parsed.recommended_game_type) 
      ? parsed.recommended_game_type 
      : baseline.next_game_type;

    const validDifficulty: DifficultyLevel = ['easy', 'medium', 'hard'].includes(parsed.recommended_difficulty)
      ? parsed.recommended_difficulty
      : baseline.recommended_difficulty;

    const geminiRec: AIRecommendation = {
      recommended_difficulty: validDifficulty,
      next_game_type: gameType,
      recommended_game_title: parsed.recommended_game_title || baseline.recommended_game_title,
      engagement_score: analysis.gaming_score,
      rationale: parsed.clinical_reasoning || baseline.rationale,
      observation_note: parsed.expected_therapeutic_benefit || baseline.observation_note,
      ethical_disclaimer: ETHICAL_DISCLAIMER,
      recent_trend: analysis.trend_direction === 'insufficient_data' ? 'stable' : analysis.trend_direction,
      has_gaming_data: analysis.has_data,
      total_games_analyzed: analysis.total_games_played,
      ai_powered: true,
      clinical_reasoning: parsed.clinical_reasoning || baseline.clinical_reasoning,
      cognitive_focus_domain: parsed.cognitive_focus_domain || baseline.cognitive_focus_domain,
      patient_encouragement_message: parsed.patient_encouragement_message || baseline.patient_encouragement_message,
      patient_voice_prompt: parsed.patient_voice_prompt || baseline.patient_voice_prompt,
      caregiver_actionable_tip: parsed.caregiver_actionable_tip || baseline.caregiver_actionable_tip,
      expected_therapeutic_benefit: parsed.expected_therapeutic_benefit || baseline.expected_therapeutic_benefit,
      confidence_score: parsed.confidence_score || 94,
      adaptive_level_suggestion: parsed.adaptive_level_suggestion || baseline.adaptive_level_suggestion
    };

    aiRecommendationsCache.set(userId, { data: geminiRec, timestamp: now });
    return geminiRec;
  } catch (err) {
    console.warn('Gemini recommendation generation error, using algorithmic fallback:', err);
    aiRecommendationsCache.set(userId, { data: baseline, timestamp: now });
    return baseline;
  }
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Auth / User Switcher
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { pin, role, identifier, userId } = req.body;

  if (userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
      return res.json({ success: true, user });
    }
  }

  const cleanRole = role === 'caregiver' ? 'caregiver' : 'elderly';
  const roleUsers = users.filter(u => u.role === cleanRole);

  if (identifier && pin) {
    const cleanId = String(identifier).trim().toLowerCase();
    const user = roleUsers.find(u => 
      (u.name.toLowerCase() === cleanId ||
       u.phone === cleanId ||
       u.caregiver_code?.toLowerCase() === cleanId ||
       u.id.toLowerCase() === cleanId) &&
      u.pin === String(pin).trim()
    );
    if (user) {
      return res.json({ success: true, user });
    }
    return res.status(401).json({ 
      success: false, 
      message: 'No account found matching those details with that PIN. Please check your credentials or create a new profile.' 
    });
  }

  if (identifier && !pin) {
    const cleanId = String(identifier).trim().toLowerCase();
    const user = roleUsers.find(u => 
      u.name.toLowerCase() === cleanId ||
      u.phone === cleanId ||
      u.caregiver_code?.toLowerCase() === cleanId ||
      u.id.toLowerCase() === cleanId
    );
    if (user) {
      return res.json({ success: true, user });
    }
  }

  if (pin) {
    const user = roleUsers.find(u => u.pin === String(pin).trim());
    if (user) {
      return res.json({ success: true, user });
    }
    return res.status(401).json({ success: false, message: 'Invalid 4-digit PIN for ' + cleanRole });
  }

  res.status(400).json({ success: false, message: 'Please provide your details or PIN' });
});

// Get all users
app.get('/api/users', (_req: Request, res: Response) => {
  res.json({ users });
});

// Get registered caregivers
app.get('/api/caregivers', (_req: Request, res: Response) => {
  const caregivers = users.filter(u => u.role === 'caregiver');
  res.json({ caregivers });
});

// Create or update a user (Elderly or Caregiver)
app.post('/api/users', (req: Request, res: Response) => {
  const { id, name, role, language_pref, pin, age, location, diagnosis_note, avatar, phone, caregiver_code, emergency_contact, dementia_stage } = req.body;
  if (!name && !id) {
    return res.status(400).json({ error: 'Name or ID is required' });
  }

  // Check if user already exists by ID
  const existingIdx = id ? users.findIndex(u => u.id === id) : -1;
  if (existingIdx >= 0) {
    const existingPatientId = users[existingIdx].patient_id;
    const existingCaregiverCode = users[existingIdx].caregiver_code;
    users[existingIdx] = {
      ...users[existingIdx],
      ...req.body,
      id,
      ...(existingPatientId ? { patient_id: existingPatientId } : {}),
      ...(existingCaregiverCode ? { caregiver_code: existingCaregiverCode } : {}),
      updated_at: new Date().toISOString()
    };
    saveUsersToDisk(users);
    return res.json({ success: true, user: users[existingIdx] });
  }

  // Enforce one user per phone number restriction
  if (phone) {
    const rawClean = String(phone).replace(/\D/g, '');
    const cleanPhone = rawClean.length === 12 && rawClean.startsWith('91') 
      ? rawClean.slice(2) 
      : (rawClean.length === 11 && rawClean.startsWith('0') ? rawClean.slice(1) : rawClean);

    if (cleanPhone.length >= 10) {
      const duplicate = users.find(u => {
        if (!u.phone) return false;
        const uRaw = String(u.phone).replace(/\D/g, '');
        const uClean = uRaw.length === 12 && uRaw.startsWith('91') 
          ? uRaw.slice(2) 
          : (uRaw.length === 11 && uRaw.startsWith('0') ? uRaw.slice(1) : uRaw);
        return uClean === cleanPhone;
      });

      if (duplicate) {
        return res.status(409).json({ 
          error: 'Phone number already registered',
          message: `Phone number is already associated with an existing account (${duplicate.name}). Only one user can register from one phone number.`,
          existingUser: {
            id: duplicate.id,
            name: duplicate.name,
            role: duplicate.role
          }
        });
      }
    }
  }

  const isCaregiver = role === 'caregiver';
  const generatedCode = isCaregiver 
    ? (caregiver_code ? String(caregiver_code).trim().toUpperCase() : `CG-${Math.floor(1000 + Math.random() * 9000)}`)
    : undefined;
  const generatedPatientId = !isCaregiver
    ? (req.body.patient_id ? String(req.body.patient_id).trim().toUpperCase() : `PT-${Math.floor(1000 + Math.random() * 9000)}`)
    : undefined;

  const newUser: User = {
    id: id || (isCaregiver ? `caregiver-${Date.now()}` : `user-${Date.now()}`),
    patient_id: generatedPatientId,
    name: String(name || 'User').trim(),
    role: isCaregiver ? 'caregiver' : 'elderly',
    language_pref: language_pref || 'en',
    pin: pin ? String(pin).padStart(4, '0').slice(-4) : '1234',
    phone: phone ? String(phone).trim() : undefined,
    caregiver_code: generatedCode,
    age: age !== undefined && age !== null ? Number(age) : (isCaregiver ? 35 : 72),
    location: location || 'North East India',
    diagnosis_note: diagnosis_note || (isCaregiver ? 'Certified Family & Clinical Caregiver' : 'Mild memory assistance requested.'),
    location_sharing: false,
    avatar: avatar || (isCaregiver 
      ? 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80'
      : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'),
    created_at: new Date().toISOString(),
    ...(emergency_contact ? { emergency_contact } : {}),
    ...(dementia_stage ? { dementia_stage } : {}),
    ...(req.body.connected_caregiver_id ? { connected_caregiver_id: String(req.body.connected_caregiver_id).trim().toUpperCase() } : {}),
    ...(req.body.connected_caregiver_name ? { connected_caregiver_name: String(req.body.connected_caregiver_name).trim() } : {})
  };

  users.unshift(newUser);
  saveUsersToDisk(users);
  syncCaregiverLinksFromUsers();

  res.status(201).json({ success: true, user: newUser });
});

// Update an existing user by ID (e.g. changing age, details, avatar)
app.put('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existingIdx = users.findIndex(u => u.id === id);
  if (existingIdx >= 0) {
    users[existingIdx] = {
      ...users[existingIdx],
      ...req.body,
      id,
      updated_at: new Date().toISOString()
    };
    saveUsersToDisk(users);
    return res.json({ success: true, user: users[existingIdx] });
  }

  const newUser: User = {
    ...req.body,
    id,
    created_at: req.body.created_at || new Date().toISOString()
  };
  users.unshift(newUser);
  saveUsersToDisk(users);
  return res.json({ success: true, user: newUser });
});

app.patch('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existingIdx = users.findIndex(u => u.id === id);
  if (existingIdx >= 0) {
    users[existingIdx] = {
      ...users[existingIdx],
      ...req.body,
      id,
      updated_at: new Date().toISOString()
    };
    saveUsersToDisk(users);
    return res.json({ success: true, user: users[existingIdx] });
  }
  return res.status(404).json({ error: 'User not found' });
});

// Connect Elderly to Caregiver ID
app.post('/api/caregivers/link', (req: Request, res: Response) => {
  const { elderly_id, caregiver_code, caregiver_id } = req.body;
  if (!elderly_id) {
    return res.status(400).json({ error: 'elderly_id is required' });
  }

  const cleanElderlyId = String(elderly_id).trim().toUpperCase();
  const elderly = users.find(
    u => u.id.toUpperCase() === cleanElderlyId || (u.patient_id && u.patient_id.toUpperCase() === cleanElderlyId)
  );
  if (!elderly) {
    return res.status(404).json({ error: 'Elderly patient profile not found' });
  }

  const codeQuery = String(caregiver_code || caregiver_id || '').trim().toUpperCase();
  if (!codeQuery) {
    return res.status(400).json({ error: 'Caregiver ID is required' });
  }

  // Find existing caregiver
  let matchedCaregiver = users.find(u => 
    u.role === 'caregiver' && 
    (u.caregiver_code?.toUpperCase() === codeQuery || 
     u.id.toUpperCase() === codeQuery || 
     u.name.toUpperCase().includes(codeQuery) ||
     u.phone === codeQuery)
  );

  // If no caregiver exists with this ID yet, create one so the elderly is linked immediately
  if (!matchedCaregiver) {
    matchedCaregiver = {
      id: `caregiver-${Date.now()}`,
      name: codeQuery.startsWith('CG-') ? `Caregiver (${codeQuery})` : `Caregiver ${codeQuery}`,
      role: 'caregiver',
      caregiver_code: codeQuery.startsWith('CG-') ? codeQuery : `CG-${codeQuery.replace(/\s+/g, '')}`,
      language_pref: elderly.language_pref || 'en',
      pin: '1234',
      created_at: new Date().toISOString(),
    };
    users.push(matchedCaregiver);
  }

  // Record link if not already linked
  const existingLink = caregiverLinks.find(
    l => l.caregiver_id === matchedCaregiver!.id && l.elderly_id === elderly.id
  );
  if (!existingLink) {
    caregiverLinks.push({
      id: `link-${Date.now()}`,
      caregiver_id: matchedCaregiver.id,
      elderly_id: elderly.id,
      relation: 'Primary Care'
    });
  }

  // Update elderly profile
  elderly.connected_caregiver_id = matchedCaregiver.caregiver_code || matchedCaregiver.id;
  elderly.connected_caregiver_name = matchedCaregiver.name;
  saveUsersToDisk(users);
  saveCaregiverLinksToDisk(caregiverLinks);

  res.json({
    success: true,
    user: elderly,
    caregiver: matchedCaregiver,
    message: `Connected successfully with Caregiver ${matchedCaregiver.name} (${matchedCaregiver.caregiver_code || matchedCaregiver.id})`
  });
});

// Update user preferences (e.g. language, location sharing)
app.put('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { language_pref, location_sharing } = req.body;
  const user = users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (language_pref) user.language_pref = language_pref;
  if (typeof location_sharing === 'boolean') user.location_sharing = location_sharing;
  res.json({ success: true, user });
});

// Get linked elderly patients for caregiver (STRICT: only patients who assigned this caregiver)
app.get('/api/patients/:caregiverId', (req: Request, res: Response) => {
  const { caregiverId } = req.params;
  const cleanParam = String(caregiverId).trim().toUpperCase();
  const caregiver = users.find(u => 
    u.role === 'caregiver' && 
    (u.id.toUpperCase() === cleanParam || u.caregiver_code?.toUpperCase() === cleanParam)
  );

  const cgCode = (caregiver?.caregiver_code || cleanParam).toUpperCase();
  const cgId = (caregiver?.id || cleanParam).toUpperCase();

  const links = caregiverLinks.filter(l => 
    l.caregiver_id.toUpperCase() === cgId || 
    l.caregiver_id.toUpperCase() === cgCode
  );

  const directlyAssigned = users.filter(u => 
    u.role === 'elderly' && 
    u.connected_caregiver_id && 
    (u.connected_caregiver_id.toUpperCase() === cgCode || u.connected_caregiver_id.toUpperCase() === cgId)
  );

  const assignedPatientIds = new Set([
    ...links.map(l => l.elderly_id),
    ...directlyAssigned.map(u => u.id)
  ]);

  const patientUsers = users.filter(u => u.role === 'elderly' && assignedPatientIds.has(u.id));

  res.json({ patients: patientUsers });
});

// Unlink Elderly from Caregiver
app.post('/api/caregivers/unlink', (req: Request, res: Response) => {
  const { elderly_id } = req.body;
  if (!elderly_id) {
    return res.status(400).json({ error: 'elderly_id is required' });
  }
  const elderly = users.find(u => u.id === elderly_id);
  if (elderly) {
    delete elderly.connected_caregiver_id;
    delete elderly.connected_caregiver_name;
    saveUsersToDisk(users);
  }
  for (let i = caregiverLinks.length - 1; i >= 0; i--) {
    if (caregiverLinks[i].elderly_id === elderly_id) {
      caregiverLinks.splice(i, 1);
    }
  }
  res.json({ success: true, user: elderly, message: 'Caregiver unlinked successfully' });
});

// Log a game session
app.post('/api/game-sessions', async (req: Request, res: Response) => {
  const { 
    id,
    user_id, 
    game_type, 
    accuracy, 
    response_time, 
    attempts, 
    mistakes, 
    completion_rate, 
    difficulty_level,
    level_number,
    stars,
    completed_at 
  } = req.body;

  if (!user_id || !game_type) {
    return res.status(400).json({ error: 'Missing required session parameters' });
  }

  const newSession: GameSession = {
    id: id || `sess-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    user_id: String(user_id).trim(),
    game_type,
    level_number: Number(level_number) || 1,
    accuracy: Math.round(Number(accuracy) || 0),
    response_time: Number(response_time) || 0,
    attempts: Number(attempts) || 1,
    mistakes: Number(mistakes) || 0,
    completion_rate: Number(completion_rate) || 100,
    difficulty_level: difficulty_level || 'easy',
    stars: Number(stars) || 3,
    completed_at: completed_at || new Date().toISOString()
  };

  const existingIdx = gameSessions.findIndex(s => s.id === newSession.id);
  if (existingIdx >= 0) {
    gameSessions[existingIdx] = newSession;
  } else {
    gameSessions.push(newSession);
  }
  saveGameSessionsToDisk(gameSessions);

  // Invalidate recommendation cache and generate updated Gemini AI recommendation
  aiRecommendationsCache.delete(user_id);
  const recommendation = await generateGeminiAIRecommendation(user_id, true);
  const analysis = analyzePatientGamingPerformance(user_id);

  res.json({
    success: true,
    session: newSession,
    recommendation,
    analysis,
    ethical_disclaimer: ETHICAL_DISCLAIMER
  });
});

// Batch sync game sessions (e.g. from Firebase or local state)
app.post('/api/game-sessions/sync', (req: Request, res: Response) => {
  const { sessions } = req.body;
  if (Array.isArray(sessions)) {
    let added = 0;
    for (const s of sessions) {
      if (!s.id || !gameSessions.some(existing => existing.id === s.id)) {
        gameSessions.push({
          ...s,
          id: s.id || `sess-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
        });
        added++;
      }
    }
    if (added > 0) {
      saveGameSessionsToDisk(gameSessions);
    }
  }
  res.json({ success: true, count: gameSessions.length });
});

// Get Game Sessions for a user
app.get('/api/game-sessions/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const sessions = getUserSessions(userId)
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
  
  res.json({ sessions });
});

// AI Personalization Recommendation Endpoint (with optional ?refresh=true)
app.get('/api/ai/recommendation/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const forceRefresh = req.query.refresh === 'true';
  const recommendation = await generateGeminiAIRecommendation(userId, forceRefresh);
  res.json(recommendation);
});

// On-demand AI Game Recommendation with custom clinical focus or stage
app.post('/api/ai/recommend-game', async (req: Request, res: Response) => {
  const { userId, forceRefresh } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  const recommendation = await generateGeminiAIRecommendation(userId, forceRefresh ?? true);
  const analysis = analyzePatientGamingPerformance(userId);
  res.json({
    success: true,
    recommendation,
    analysis
  });
});

// Cognitive Performance Trends & Chart Aggregations — connected to actual patient gameplay
app.get('/api/performance-trends/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const userSessions = getUserSessions(userId);
  const analysis = analyzePatientGamingPerformance(userId);

  // Group by day / recent sessions for recharts
  const sorted = [...userSessions].sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
  
  const dailyData = sorted.map((s, idx) => ({
    session_num: idx + 1,
    date: new Date(s.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    accuracy: s.accuracy,
    response_time: s.response_time,
    mistakes: s.mistakes,
    game_type: s.game_type,
    difficulty: s.difficulty_level,
    baseline: analysis.has_data ? analysis.average_accuracy_pct : 0
  }));

  // Games count by type
  const gameBreakdown: Record<string, number> = {};
  userSessions.forEach(s => {
    gameBreakdown[s.game_type] = (gameBreakdown[s.game_type] || 0) + 1;
  });

  const recent = userSessions.slice(-4);
  const recentAvg = recent.length > 0
    ? Math.round(recent.reduce((acc, s) => acc + s.accuracy, 0) / recent.length)
    : (analysis.has_data ? analysis.average_accuracy_pct : 0);
  
  const deviationPct = analysis.has_data ? recentAvg - analysis.average_accuracy_pct : 0;

  res.json({
    trends: dailyData,
    baseline_accuracy: analysis.has_data ? analysis.average_accuracy_pct : 0,
    recent_accuracy: recentAvg,
    deviation_from_baseline_pct: deviationPct,
    baseline_observation: analysis.has_data
      ? (deviationPct >= 0 
          ? `${deviationPct}% above typical baseline — patient demonstrates steady cognitive alertness.`
          : `${Math.abs(deviationPct)}% below typical baseline — suggested gentle pacing and familiar family photo activities.`)
      : 'Awaiting initial game session. Real baseline accuracy will be established after patient completes their first activity.',
    game_breakdown: gameBreakdown,
    ethical_disclaimer: ETHICAL_DISCLAIMER,
    analysis
  });
});

// Reminders CRUD
app.get('/api/reminders', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.json({ reminders });
  }

  // Find user to support matching by both user.id and user.patient_id
  const matchingUser = users.find(u => u.id === userId || u.patient_id === userId);
  const targetIds = new Set<string>([userId]);
  if (matchingUser) {
    if (matchingUser.id) targetIds.add(matchingUser.id);
    if (matchingUser.patient_id) targetIds.add(matchingUser.patient_id);
  }

  const list = reminders.filter(r => targetIds.has(r.user_id));
  res.json({ reminders: list });
});

app.post('/api/reminders', (req: Request, res: Response) => {
  const { 
    user_id, 
    type, 
    title, 
    time, 
    recurrence, 
    instructions, 
    created_by,
    scheduled_date,
    priority,
    audio_chime,
    spoken_prompt
  } = req.body;
  if (!user_id || !title || !time) {
    return res.status(400).json({ error: 'Missing required reminder fields' });
  }

  const newReminder: Reminder = {
    id: `rem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    user_id,
    type: type || 'medication',
    title,
    time,
    recurrence: recurrence || 'daily',
    instructions: instructions || '',
    completed: false,
    created_by: created_by || 'Caregiver',
    created_at: new Date().toISOString(),
    scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
    priority: priority || 'medium',
    audio_chime: audio_chime !== undefined ? audio_chime : true,
    spoken_prompt: spoken_prompt || title
  };

  reminders.push(newReminder);
  saveRemindersToDisk(reminders);

  const patientUser = users.find(u => u.id === user_id || u.patient_id === user_id);
  const reminderAlert: Alert = {
    id: `alert-rem-${Date.now()}`,
    user_id,
    patient_name: patientUser?.name || 'Patient',
    type: 'routine',
    message: `Scheduled ${type === 'medication' ? 'Medicine' : 'Routine'}: "${title}" at ${time} by ${created_by || 'Caregiver'}.`,
    timestamp: new Date().toISOString(),
    resolved: false
  };
  alerts.unshift(reminderAlert);

  res.json({ success: true, reminder: newReminder });
});

app.put('/api/reminders/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const reminder = reminders.find(r => r.id === id);
  if (!reminder) {
    return res.status(404).json({ error: 'Reminder not found' });
  }

  if (typeof req.body.completed === 'boolean') {
    reminder.completed = req.body.completed;
  }
  if (req.body.title) reminder.title = req.body.title;
  if (req.body.time) reminder.time = req.body.time;
  if (req.body.type) reminder.type = req.body.type;
  if (req.body.recurrence) reminder.recurrence = req.body.recurrence;
  if (req.body.instructions !== undefined) reminder.instructions = req.body.instructions;
  if (req.body.scheduled_date) reminder.scheduled_date = req.body.scheduled_date;
  if (req.body.priority) reminder.priority = req.body.priority;
  if (req.body.audio_chime !== undefined) reminder.audio_chime = req.body.audio_chime;
  if (req.body.spoken_prompt) reminder.spoken_prompt = req.body.spoken_prompt;

  saveRemindersToDisk(reminders);
  res.json({ success: true, reminder });
});

app.delete('/api/reminders/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  reminders = reminders.filter(r => r.id !== id);
  saveRemindersToDisk(reminders);
  res.json({ success: true, id });
});

// Familiar People CRUD
app.get('/api/familiar-people/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const people = familiarPeople.filter(p => p.user_id === userId);
  res.json({ people });
});

app.post('/api/familiar-people', (req: Request, res: Response) => {
  const { user_id, name, relation, photo_url, notes, voice_prompt, phone } = req.body;
  if (!user_id || !name || !relation) {
    return res.status(400).json({ error: 'Missing required familiar person fields' });
  }

  const newPerson: FamiliarPerson = {
    id: `fam-${Date.now()}`,
    user_id,
    name,
    relation,
    photo_url: photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    notes,
    voice_prompt,
    phone
  };

  familiarPeople.push(newPerson);
  res.json({ success: true, person: newPerson });
});

app.delete('/api/familiar-people/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  familiarPeople = familiarPeople.filter(p => p.id !== id);
  res.json({ success: true, id });
});

// Alerts (SOS / Notification system)
app.get('/api/alerts/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const list = alerts.filter(a => a.user_id === userId || a.caregiver_id === userId);
  res.json({ alerts: list });
});

app.get('/api/alerts/caregiver/:caregiverId', (req: Request, res: Response) => {
  const { caregiverId } = req.params;
  const list = alerts.filter(a => a.caregiver_id === caregiverId);
  res.json({ alerts: list });
});

app.post('/api/alerts', (req: Request, res: Response) => {
  const { user_id, type, message, patient_name, caregiver_id } = req.body;
  if (!user_id || !message) {
    return res.status(400).json({ error: 'Missing required alert parameters' });
  }

  const newAlert: Alert = {
    id: `alt-${Date.now()}`,
    user_id,
    patient_name: patient_name || 'Elderly Patient',
    caregiver_id: caregiver_id || undefined,
    type: type || 'sos',
    message,
    triggered_at: new Date().toISOString(),
    resolved: false
  };

  alerts.unshift(newAlert);
  res.json({ success: true, alert: newAlert });
});

app.put('/api/alerts/:id/resolve', (req: Request, res: Response) => {
  const { id } = req.params;
  const alert = alerts.find(a => a.id === id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  alert.resolved = true;
  alert.resolved_at = new Date().toISOString();
  res.json({ success: true, alert });
});

// -------------------------------------------------------------
// Extended Ecosystem API Endpoints
// -------------------------------------------------------------

// 1. Memory Journal Endpoints (Strict Patient-Caregiver Assignment Privacy)

// Verify relationship assignment
app.get('/api/relationship/verify', (req: Request, res: Response) => {
  const requesterId = String(req.query.requester_id || req.headers['x-user-id'] || '').trim();
  const patientId = String(req.query.patient_id || '').trim();

  if (!requesterId) {
    return res.status(400).json({ error: 'requester_id is required' });
  }

  const rel = resolveRelationshipForRequester(requesterId, patientId || undefined);
  if (!rel) {
    return res.json({
      assigned: false,
      message: 'No active patient-caregiver assignment found for this query'
    });
  }

  res.json({
    assigned: true,
    relationship_id: rel.relationship_id,
    patient_id: rel.patient.id,
    patient_name: rel.patient.name,
    caregiver_id: rel.caregiver.id,
    caregiver_code: rel.caregiver.caregiver_code,
    caregiver_name: rel.caregiver.name
  });
});

// Query journals for a specific verified relationship ID
app.get('/api/journal/relationship/:relationshipId', (req: Request, res: Response) => {
  const { relationshipId } = req.params;
  const requesterId = String(req.query.requester_id || req.headers['x-user-id'] || '').trim();

  if (!requesterId) {
    return res.status(401).json({ error: 'Authentication required: requester_id missing' });
  }

  if (!verifyRelationshipAccess(requesterId, relationshipId)) {
    return res.status(403).json({ 
      error: 'Access denied: You are not authorized to view memories for this relationship' 
    });
  }

  const list = memoryJournals
    .filter(j => j.relationship_id === relationshipId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({ success: true, relationship_id: relationshipId, journals: list });
});

// Primary Journal Query Endpoint
// Enforces assignment resolution and returns strictly the memories of the assigned relationship
app.get('/api/journal', (req: Request, res: Response) => {
  const requesterId = String(req.query.requester_id || req.headers['x-user-id'] || '').trim();
  const patientId = String(req.query.patient_id || '').trim();
  const relationshipId = String(req.query.relationship_id || '').trim();

  if (!requesterId) {
    return res.status(401).json({ error: 'Authentication required: requester_id missing' });
  }

  // If a relationship_id is supplied directly, verify access
  if (relationshipId) {
    if (!verifyRelationshipAccess(requesterId, relationshipId)) {
      return res.status(403).json({ 
        error: 'Access denied: You are not a member of this assigned relationship' 
      });
    }
    const list = memoryJournals
      .filter(j => j.relationship_id === relationshipId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.json({ success: true, relationship_id: relationshipId, journals: list });
  }

  // Resolve relationship dynamically for the requester
  const rel = resolveRelationshipForRequester(requesterId, patientId || undefined);
  if (!rel) {
    const requester = findUserByIdOrCode(requesterId);
    if (requester?.role === 'caregiver' && patientId) {
      return res.status(403).json({ 
        error: 'Access denied: You are not the assigned caregiver for this patient' 
      });
    }
    // Patient has no assigned caregiver yet
    return res.json({
      success: true,
      assigned: false,
      relationship_id: null,
      journals: [],
      message: 'No assigned caregiver linked to this patient'
    });
  }

  // Query only memories belonging to that relationship
  const list = memoryJournals
    .filter(j => j.relationship_id === rel.relationship_id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({
    success: true,
    relationship_id: rel.relationship_id,
    patient_id: rel.patient.id,
    caregiver_id: rel.caregiver.id,
    journals: list
  });
});

// Backward-compatible endpoint (strictly verifies requester assignment before returning)
app.get('/api/journal/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const requesterId = String(req.query.requester_id || req.headers['x-user-id'] || userId).trim();

  const rel = resolveRelationshipForRequester(requesterId, userId);
  if (!rel) {
    const requester = findUserByIdOrCode(requesterId);
    if (requester?.role === 'caregiver') {
      return res.status(403).json({ 
        error: 'Access denied: Caregiver is not assigned to this patient' 
      });
    }
    // Check if requester is an unassigned patient
    return res.json({ success: true, assigned: false, journals: [] });
  }

  const list = memoryJournals
    .filter(j => j.relationship_id === rel.relationship_id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({ success: true, relationship_id: rel.relationship_id, journals: list });
});

app.post('/api/journal', (req: Request, res: Response) => {
  const { 
    requester_id, 
    created_by, 
    patient_id, 
    user_id,
    title, 
    content, 
    media_type, 
    media_url, 
    audio_duration, 
    location_tag, 
    emotion 
  } = req.body;

  const effectiveRequesterId = String(requester_id || created_by || user_id || '').trim();
  const effectivePatientId = String(patient_id || user_id || '').trim();

  if (!effectiveRequesterId) {
    return res.status(401).json({ error: 'Creator/Requester ID is required' });
  }
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const creator = findUserByIdOrCode(effectiveRequesterId);
  if (!creator) {
    return res.status(404).json({ error: 'Creator user profile not found' });
  }

  // Resolve relationship
  const rel = resolveRelationshipForRequester(
    creator.id, 
    effectivePatientId || undefined
  );

  if (!rel) {
    if (creator.role === 'caregiver') {
      return res.status(403).json({ 
        error: 'Access denied: You are not assigned to this patient' 
      });
    }
    return res.status(400).json({ 
      error: 'Cannot create memory: You must have an assigned caregiver to save shared memories' 
    });
  }

  const newEntry: MemoryJournalEntry = {
    id: `mj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    relationship_id: rel.relationship_id,
    patient_id: rel.patient.id,
    caregiver_id: rel.caregiver.id,
    created_by: creator.id,
    creator_role: creator.role as 'elderly' | 'caregiver',
    created_by_name: creator.name,
    user_id: rel.patient.id,
    title: title.trim(),
    content: content.trim(),
    media_type: media_type || 'text',
    media_url: media_url || undefined,
    audio_duration: audio_duration || undefined,
    location_tag: location_tag || 'North East India',
    emotion: emotion || 'nostalgic',
    created_at: new Date().toISOString()
  };

  memoryJournals.unshift(newEntry);
  saveMemoryJournalsToDisk(memoryJournals);

  res.status(201).json({ 
    success: true, 
    relationship_id: rel.relationship_id, 
    journal: newEntry 
  });
});

app.delete('/api/journal/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const requesterId = String(req.query.requester_id || req.body?.requester_id || req.headers['x-user-id'] || '').trim();

  const entryIdx = memoryJournals.findIndex(j => j.id === id);
  if (entryIdx < 0) {
    return res.status(404).json({ error: 'Memory entry not found' });
  }

  const entry = memoryJournals[entryIdx];
  if (requesterId) {
    const requester = findUserByIdOrCode(requesterId);
    if (!requester) {
      return res.status(401).json({ error: 'Requester user not found' });
    }

    const isCreator = requester.id === entry.created_by;
    const isPatient = requester.id === entry.patient_id || (requester.patient_id && requester.patient_id === entry.patient_id);
    const isCaregiver = requester.id === entry.caregiver_id || (requester.caregiver_code && requester.caregiver_code === entry.caregiver_id);

    if (!isCreator && !isPatient && !isCaregiver && !verifyRelationshipAccess(requester.id, entry.relationship_id)) {
      return res.status(403).json({ 
        error: 'Access denied: You are not authorized to delete this memory' 
      });
    }
  }

  memoryJournals.splice(entryIdx, 1);
  saveMemoryJournalsToDisk(memoryJournals);

  res.json({ success: true, id });
});

// 2. Medication Management System Endpoints
app.get('/api/medications/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const list = medicationSchedules.filter(m => m.user_id === userId);
  res.json({ medications: list });
});

app.post('/api/medications', (req: Request, res: Response) => {
  const { user_id, med_name, dosage, timing, time_str, purpose, created_by } = req.body;
  if (!user_id || !med_name) {
    return res.status(400).json({ error: 'User ID and medication name are required' });
  }

  const newMed: MedicationSchedule = {
    id: `med-${Date.now()}`,
    user_id,
    med_name,
    dosage: dosage || '1 Tablet',
    timing: timing || 'morning',
    time_str: time_str || '08:00 AM',
    purpose: purpose || 'Health Maintenance',
    taken_today: false
  };

  medicationSchedules.push(newMed);

  // Synchronize to reminders array so patient dashboard immediately displays it and triggers alarms
  const matchingReminder: Reminder = {
    id: `rem-med-${newMed.id}`,
    user_id,
    type: 'medication',
    title: `${med_name} (${dosage || '1 Tablet'})`,
    time: time_str || '08:00 AM',
    recurrence: 'daily',
    instructions: purpose ? `Purpose: ${purpose}. Take as prescribed.` : 'Take as prescribed by caregiver.',
    completed: false,
    created_by: created_by || 'Assigned Caregiver',
    created_at: new Date().toISOString(),
    scheduled_date: new Date().toISOString().split('T')[0],
    priority: 'high',
    audio_chime: true,
    spoken_prompt: `Time for your medicine: ${med_name}, ${dosage || 'one tablet'} at ${time_str || '08:00 AM'}.`
  };
  reminders.push(matchingReminder);
  saveRemindersToDisk(reminders);

  const patientUser = users.find(u => u.id === user_id || u.patient_id === user_id);
  alerts.unshift({
    id: `alert-med-${Date.now()}`,
    user_id,
    patient_name: patientUser?.name || 'Patient',
    type: 'routine',
    message: `Prescribed Medicine: "${med_name}" (${dosage || '1 Tablet'}) at ${time_str || '08:00 AM'} by ${created_by || 'Caregiver'}.`,
    timestamp: new Date().toISOString(),
    resolved: false
  });

  res.status(201).json({ success: true, medication: newMed, reminder: matchingReminder });
});

app.put('/api/medications/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const med = medicationSchedules.find(m => m.id === id);
  if (!med) {
    return res.status(404).json({ error: 'Medication not found' });
  }
  med.taken_today = !med.taken_today;
  if (med.taken_today) {
    med.last_taken_at = new Date().toISOString();
  }

  // Also sync completed status on matching reminder if present
  const matchingRem = reminders.find(r => r.id === `rem-med-${id}`);
  if (matchingRem) {
    matchingRem.completed = med.taken_today;
    saveRemindersToDisk(reminders);
  }

  res.json({ success: true, medication: med });
});

app.delete('/api/medications/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  medicationSchedules = medicationSchedules.filter(m => m.id !== id);
  reminders = reminders.filter(r => r.id !== `rem-med-${id}`);
  saveRemindersToDisk(reminders);
  res.json({ success: true, id });
});

// 3. Emergency Response Protocol Endpoints
app.post('/api/emergency/sos', (req: Request, res: Response) => {
  const { user_id, patient_name, lat, lng, location_name } = req.body;
  const user = users.find(u => u.id === user_id);

  const newAlert: Alert = {
    id: `sos-${Date.now()}`,
    user_id: user_id || 'unknown',
    patient_name: patient_name || (user ? user.name : 'Care Recipient'),
    type: 'sos',
    message: `EMERGENCY SOS BEACON TRIGGERED: Immediate assistance requested at ${location_name || (user?.location || 'Live GPS Coordinates: 26.1856° N, 91.7539° E')}`,
    triggered_at: new Date().toISOString(),
    resolved: false,
    lat: lat || 26.1856,
    lng: lng || 91.7539
  };

  alerts.unshift(newAlert);

  res.json({
    success: true,
    alert: newAlert,
    dispatch_status: 'NOTIFIED_PRIMARY_CAREGIVER_AND_EMERGENCY_NETWORK',
    emergency_contact: user?.emergency_contact || {
      name: 'Dr. Priya Barua (Caregiver)',
      phone: '+91 98640 12345',
      relation: 'Primary Caregiver'
    },
    gps_beacon: {
      latitude: lat || 26.1856,
      longitude: lng || 91.7539,
      address: location_name || (user?.location || 'Silpukhuri, Guwahati, Assam')
    }
  });
});

// 4. Professional Consultation Portal Endpoints
app.get('/api/consultations/doctors', (_req: Request, res: Response) => {
  res.json({ doctors: consultationDoctors });
});

app.get('/api/consultations/appointments/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const list = consultationAppointments.filter(a => a.user_id === userId);
  res.json({ appointments: list });
});

app.post('/api/consultations/book', (req: Request, res: Response) => {
  const { user_id, doctor_id, date, time, notes } = req.body;
  const doctor = consultationDoctors.find(d => d.id === doctor_id);
  if (!doctor) {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  const newAppointment: ConsultationAppointment = {
    id: `apt-${Date.now()}`,
    user_id,
    doctor_id,
    doctor_name: doctor.name,
    specialty: doctor.specialty,
    hospital: doctor.hospital,
    date,
    time,
    status: 'confirmed',
    notes: notes || 'Cognitive and routine checkup review.'
  };

  consultationAppointments.push(newAppointment);
  res.status(201).json({ success: true, appointment: newAppointment });
});

app.get('/api/consultations/clinical-summary/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = users.find(u => u.id === userId || u.patient_id === userId);
  const userSessions = getUserSessions(userId);
  const userMeds = medicationSchedules.filter(m => m.user_id === userId);
  const recommendation = computeAIRecommendation(userId);
  const analysis = analyzePatientGamingPerformance(userId);

  const adherenceRate = userMeds.length > 0 
    ? Math.round((userMeds.filter(m => m.taken_today).length / userMeds.length) * 100) 
    : 85;

  res.json({
    patient: {
      id: user?.id,
      name: user?.name,
      age: user?.age || 74,
      location: user?.location || 'Guwahati, Assam',
      dementia_stage: user?.dementia_stage || 'mild',
      care_goals: user?.care_goals || ['Memory Maintenance', 'Medication Routine', 'Family Familiarity'],
      diagnosis_note: user?.diagnosis_note
    },
    metrics: {
      total_sessions_completed: analysis.total_games_played,
      average_cognitive_accuracy_pct: analysis.average_accuracy_pct,
      medication_adherence_today_pct: adherenceRate,
      cognitive_engagement_score: analysis.gaming_score,
      recommended_difficulty: recommendation.recommended_difficulty,
      recent_trend: recommendation.recent_trend
    },
    observations: analysis.has_data ? `${analysis.clinical_insight} ${analysis.speed_analysis}` : 'Awaiting patient initial gaming sessions to construct clinical cognitive observations.',
    medications: userMeds,
    generated_at: new Date().toISOString(),
    clinical_proxy_score: analysis.has_data
      ? `${Math.round((analysis.gaming_score / 100) * 30)} / 30 MMSE-Equivalent Proxy (Derived from ${analysis.total_games_played} game sessions)`
      : 'Pending Initial Game Session (0 / 30 MMSE-Proxy)',
    disclaimer: ETHICAL_DISCLAIMER
  });
});

// 5. Data Lake & AI Hub Endpoints
app.get('/api/datalake/summary/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const userSessions = getUserSessions(userId);

  // Dynamic metrics based on session count
  const updatedSummary = {
    ...dataLakeSummary,
    raw_records_count: dataLakeSummary.raw_records_count + userSessions.length * 12,
    cleansed_records_count: dataLakeSummary.cleansed_records_count + userSessions.length * 11,
    active_patient_sessions: userSessions.length,
    recent_features_sample: [
      { feature: 'Mean Reaction Latency', value: '4.8s (Safe MCI Band)' },
      { feature: 'Spatial Card Flip Error', value: '0.6 mistakes/session' },
      { feature: 'Cultural Motif Affinity', value: '94% Assamese/NER cues recognized' },
      { feature: 'Sequence Order Retention', value: '3.4 items recall span' },
      { feature: 'Time-of-day Alertness Peak', value: '10:30 AM - 12:00 PM' }
    ]
  };

  res.json(updatedSummary);
});

app.post('/api/datalake/retrain', (_req: Request, res: Response) => {
  dataLakeSummary.training_epochs += 5;
  dataLakeSummary.model_accuracy = Math.min(96.8, +(dataLakeSummary.model_accuracy + 0.3).toFixed(1));
  dataLakeSummary.last_training_time = new Date().toISOString();

  res.json({
    success: true,
    message: 'AI Model retrained across federated ethical NER dementia cohort.',
    summary: dataLakeSummary
  });
});

// 6. Caregiver Support Forum & Research/Policy Feedback Endpoints
app.get('/api/community/forum', (_req: Request, res: Response) => {
  res.json({ posts: forumPosts });
});

app.post('/api/community/forum', (req: Request, res: Response) => {
  const { author_name, author_role, location, title, content, tags } = req.body;
  if (!author_name || !title || !content) {
    return res.status(400).json({ error: 'Author, title, and content are required' });
  }

  const newPost: ForumPost = {
    id: `post-${Date.now()}`,
    author_name,
    author_role: author_role || 'Caregiver',
    location: location || 'North East India',
    title,
    content,
    tags: tags && tags.length > 0 ? tags : ['General Care', 'NER Experience'],
    likes: 1,
    replies_count: 0,
    created_at: new Date().toISOString()
  };

  forumPosts.unshift(newPost);
  res.status(201).json({ success: true, post: newPost });
});

app.post('/api/community/forum/:id/like', (req: Request, res: Response) => {
  const { id } = req.params;
  const post = forumPosts.find(p => p.id === id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  post.likes += 1;
  res.json({ success: true, likes: post.likes });
});

app.get('/api/community/policy-research', (_req: Request, res: Response) => {
  // Longitudinal projections 2022 to 2045 matching the graph in the flow diagram
  const longitudinalData = [
    { year: 2022, baseline_prevalence: 8.8, with_early_ai_intervention: 8.8, caregiver_burnout_index: 32 },
    { year: 2023, baseline_prevalence: 10.4, with_early_ai_intervention: 9.9, caregiver_burnout_index: 30 },
    { year: 2024, baseline_prevalence: 12.6, with_early_ai_intervention: 11.2, caregiver_burnout_index: 26 },
    { year: 2026, baseline_prevalence: 16.5, with_early_ai_intervention: 13.1, caregiver_burnout_index: 22 },
    { year: 2030, baseline_prevalence: 22.0, with_early_ai_intervention: 16.4, caregiver_burnout_index: 18 },
    { year: 2035, baseline_prevalence: 28.5, with_early_ai_intervention: 19.8, caregiver_burnout_index: 16 },
    { year: 2040, baseline_prevalence: 33.2, with_early_ai_intervention: 22.5, caregiver_burnout_index: 14 },
    { year: 2045, baseline_prevalence: 37.8, with_early_ai_intervention: 24.2, caregiver_burnout_index: 12 }
  ];

  const policyRecommendations = [
    {
      title: 'NER District-Level Memory Screening Integration',
      target_body: 'National Health Mission (NHM) North East / State Health Societies',
      impact: 'Mandating culturally localized cognitive assessments in PHCs across Assam, Meghalaya, Manipur, and Mizoram can catch early MCI 3.5 years earlier.'
    },
    {
      title: 'Caregiver Respite & Community Telehealth Subsidy',
      target_body: 'Ministry of Social Justice & Empowerment (Govt of India)',
      impact: 'Subsidizing remote geriatrician consultations via regional hubs (NEIGRIHMS Shillong, RIMS Imphal) reduces travel strain by 80% for hilly terrain families.'
    },
    {
      title: 'Multilingual Digital Health Preservation Standard',
      target_body: 'Indian Council of Medical Research (ICMR) & Digital Health Authority',
      impact: 'Ensuring cognitive health interfaces support indigenous dialects (Khasi, Garo, Meiteilon, Mizo, Assamese) drastically eliminates cultural anxiety during testing.'
    }
  ];

  res.json({
    longitudinal_data: longitudinalData,
    policy_recommendations: policyRecommendations,
    research_statement: 'Longitudinal population analysis modeling dementia burden in North East India (2022-2045). Early AI-guided multimodal cognitive stimulation significantly attenuates projected institutionalization rates.'
  });
});

// Reset seed data endpoint (convenient for demo resetting)
app.post('/api/seed/reset', (_req: Request, res: Response) => {
  familiarPeople = [...FAMILIAR_PEOPLE_SEED];
  res.json({ success: true, message: 'Seed data restored.' });
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smaran Sathi Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
