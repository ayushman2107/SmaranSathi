import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User, 
  UserRole, 
  RegionalLanguage, 
  GameType, 
  Reminder, 
  Alert, 
  FamiliarPerson, 
  AIRecommendation, 
  GameSession,
  LevelFinishResult,
  UIUXSettings,
  UILayoutMode,
  UIThemePalette
} from './types';
import { Header } from './components/common/Header';
import { FloatingSOSButton } from './components/common/FloatingSOSButton';
import { THEME_CONFIGS } from './utils/themeConfig';
import { ElderlyHome } from './components/elderly/ElderlyHome';
import { FamiliarPeopleView } from './components/elderly/FamiliarPeopleView';
import { CaregiverDashboard } from './components/caregiver/CaregiverDashboard';
import { MemoryMatchGame } from './components/games/MemoryMatchGame';
import { SequenceRecallGame } from './components/games/SequenceRecallGame';
import { PictureRecognitionGame } from './components/games/PictureRecognitionGame';
import { SimplePuzzleGame } from './components/games/SimplePuzzleGame';
import { FaceMatchGame } from './components/games/FaceMatchGame';
import { SimpleCalculationGame } from './components/games/SimpleCalculationGame';
import { GameLevelSelectScreen } from './components/games/GameLevelSelectScreen';
import { LevelCompleteModal } from './components/games/LevelCompleteModal';
import { GameFeedbackModal } from './components/games/GameFeedbackModal';
import { LoginPage } from './components/auth/LoginPage';
import { FAMILIAR_PEOPLE_SEED } from './data/nerContent';
import { MemoryJournalModal } from './components/journal/MemoryJournalModal';
import { ReminderNotificationModal } from './components/reminders/ReminderNotificationModal';
import { ConnectCaregiverModal } from './components/elderly/ConnectCaregiverModal';
import { EditProfileModal } from './components/profile/EditProfileModal';
import { CaregiverSOSAlertModal } from './components/caregiver/CaregiverSOSAlertModal';
import { isReminderDue, getTriggerKey, calculateSnoozeTime } from './utils/reminderScheduler';
import { 
  isFollowupReminderDue, 
  shouldAlertCaregiverMissed, 
  createMissedMedicationAlert 
} from './utils/medicationScheduler';
import { recordLevelCompletion } from './utils/gameProgress';
import { autoDetectLocation } from './utils/locationDetector';
import { computeClientSideTrends } from './utils/cognitiveScoring';
import { 
  getAllUsersFromFirebase, 
  saveUserToFirebase,
  getRememberedUser, 
  saveRememberedUser, 
  clearRememberedUser, 
  getAllLocallySavedUsers,
  persistUserLocally,
  persistMultipleUsersLocally,
  getRemindersForUser, 
  saveReminderToFirebase, 
  toggleReminderInFirebase, 
  deleteReminderFromFirebase, 
  getFamilyForUser, 
  saveFamilyMemberToFirebase, 
  saveGameSessionToFirebase,
  getGameSessionsForUser,
  getLocallySavedGameSessions,
  persistGameSessionLocally,
  getAssignedElderlyIdsForCaregiver,
  linkElderlyToCaregiverInFirebase,
  saveAlertToFirebase,
  resolveAlertInFirebase,
  subscribeToCaregiverAlerts,
  subscribeToPatientGameSessions,
  logOutFirebaseUser
} from './lib/firebase';

export default function App() {
  const [users, setUsers] = useState<User[]>(() => {
    // Synchronously initialize with any locally saved profiles
    return getAllLocallySavedUsers();
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [assignedPatientIds, setAssignedPatientIds] = useState<Set<string>>(new Set());
  const [currentLanguage, setCurrentLanguage] = useState<RegionalLanguage>('as');
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [levelFinishResult, setLevelFinishResult] = useState<LevelFinishResult | null>(null);
  const [isLevelCompleteModalOpen, setIsLevelCompleteModalOpen] = useState<boolean>(false);
  const [isFamilyAlbumOpen, setIsFamilyAlbumOpen] = useState<boolean>(false);
  const [isJournalOpen, setIsJournalOpen] = useState<boolean>(false);
  const [isConnectCaregiverOpen, setIsConnectCaregiverOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [editingTargetUser, setEditingTargetUser] = useState<User | null>(null);
  const [activeCaregiverSOS, setActiveCaregiverSOS] = useState<Alert | null>(null);
  const notifiedSOSIdsRef = useRef<Set<string>>(new Set());

  // Dynamic UI/UX Layout & Themes State with persistent caching
  const [uiSettings, setUiSettings] = useState<UIUXSettings>(() => {
    try {
      const saved = localStorage.getItem('smaran_sathi_ui_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          layoutMode: 'compact',
          themePalette: 'default',
          textScale: parsed.textScale || 'normal',
          highContrast: !!parsed.highContrast,
          hapticAudio: parsed.hapticAudio !== false,
          reducedMotion: !!parsed.reducedMotion,
        };
      }
    } catch (e) {}
    return {
      layoutMode: 'compact',
      themePalette: 'default',
      textScale: 'normal',
      highContrast: false,
      hapticAudio: true,
      reducedMotion: false,
    };
  });

  // Sync users with Firebase Firestore and backend on mount, plus restore remembered session
  useEffect(() => {
    // 1. Immediately restore remembered user on this device for zero-friction launch
    const remembered = getRememberedUser();
    if (remembered) {
      setCurrentUser(remembered);
      if (remembered.language_pref) {
        setCurrentLanguage(remembered.language_pref);
      }
    }

    // 2. Load locally saved profiles instantly (zero delay)
    const localProfiles = getAllLocallySavedUsers();
    if (localProfiles && localProfiles.length > 0) {
      setUsers((prev) => {
        const map = new Map<string, User>();
        for (const u of prev) map.set(u.id, u);
        for (const u of localProfiles) map.set(u.id, { ...(map.get(u.id) || {}), ...u });
        return Array.from(map.values());
      });
    }

    // 3. Fetch all registered users from Firebase Firestore
    getAllUsersFromFirebase()
      .then((fbUsers) => {
        if (fbUsers && fbUsers.length > 0) {
          setUsers((prev) => {
            const map = new Map<string, User>();
            for (const u of prev) map.set(u.id, u);
            for (const u of fbUsers) map.set(u.id, { ...(map.get(u.id) || {}), ...u });
            const merged = Array.from(map.values());
            persistMultipleUsersLocally(merged);
            return merged;
          });
          if (remembered) {
            const freshUser = fbUsers.find((u) => u.id === remembered.id);
            if (freshUser) {
              setCurrentUser(freshUser);
              saveRememberedUser(freshUser);
            }
          }
        }
      })
      .catch(() => {});

    // 4. Fallback sync with backend API
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.users && data.users.length > 0) {
          setUsers((prev) => {
            const map = new Map<string, User>();
            for (const u of prev) map.set(u.id, u);
            for (const u of data.users) map.set(u.id, { ...(map.get(u.id) || {}), ...u });
            const merged = Array.from(map.values());
            persistMultipleUsersLocally(merged);
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Core Data
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [familiarPeople, setFamiliarPeople] = useState<FamiliarPerson[]>(FAMILIAR_PEOPLE_SEED);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [trendData, setTrendData] = useState<any>(null);

  // Time-Based Audible Reminder Alert System
  const [activeAlarmReminder, setActiveAlarmReminder] = useState<Reminder | null>(null);
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState<boolean>(false);
  const triggeredKeysRef = useRef<Set<string>>(new Set());

  // Continuous background checker to sound alarms when reminder times arrive
  useEffect(() => {
    if (!reminders || reminders.length === 0) return;

    const checkDueReminders = () => {
      const now = new Date();
      for (const rem of reminders) {
        if (!rem.completed) {
          // 1. Exact Scheduled Time Alarm
          if (isReminderDue(rem, now)) {
            const key = getTriggerKey(rem.id, now);
            if (!triggeredKeysRef.current.has(key)) {
              triggeredKeysRef.current.add(key);
              setActiveAlarmReminder(rem);
              setIsAlarmModalOpen(true);
              break;
            }
          }

          // 2. Follow-Up Reminder (15-30 minutes if not acknowledged)
          if (isFollowupReminderDue(rem, now)) {
            const followupKey = `followup-${rem.id}-${now.toDateString()}`;
            if (!triggeredKeysRef.current.has(followupKey)) {
              triggeredKeysRef.current.add(followupKey);
              setActiveAlarmReminder({
                ...rem,
                spoken_prompt: `Friendly follow-up reminder: Please remember to take ${rem.medication_name || rem.title}.`,
                instructions: `Gentle Follow-Up: Scheduled dose pending confirmation (${rem.time}).`
              });
              setIsAlarmModalOpen(true);
              break;
            }
          }

          // 3. Caregiver Alert if Missed (>30 minutes past scheduled time for caregiver-scheduled meds)
          if (shouldAlertCaregiverMissed(rem, now)) {
            const missedKey = `missed-alert-${rem.id}-${now.toDateString()}`;
            if (!triggeredKeysRef.current.has(missedKey)) {
              triggeredKeysRef.current.add(missedKey);
              
              const patientUser = (rem.user_id ? users.find((u) => u.id === rem.user_id) : null) || currentUser;
              const patientName = patientUser?.name || 'Patient';
              const patientId = patientUser?.id || rem.user_id || 'patient-id';
              const caregiverId = rem.caregiver_id || currentUser?.connected_caregiver_id || (currentUser?.role === 'caregiver' ? currentUser.id : undefined);

              const missedAlert = createMissedMedicationAlert(rem, patientName, patientId, caregiverId);
              
              setAlerts((prev) => [missedAlert, ...prev]);
              saveAlertToFirebase(missedAlert).catch(() => {});
              fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(missedAlert)
              }).catch(() => {});
            }
          }
        }
      }
    };

    checkDueReminders();
    const timer = setInterval(checkDueReminders, 4000);
    return () => clearInterval(timer);
  }, [reminders, users, currentUser]);

  // Feedback Modal State
  const [feedbackOpen, setFeedbackOpen] = useState<boolean>(false);
  const [lastStars, setLastStars] = useState<number>(3);
  const [lastGameType, setLastGameType] = useState<GameType>('memory_match');

  // Load patient data from Firebase and backend
  const loadPatientData = async (userId: string) => {
    try {
      // 1. Fetch AI recommendation
      const recRes = await fetch(`/api/ai/recommendation/${userId}`);
      if (recRes.ok) {
        const data = await recRes.json();
        setRecommendation(data);
      } else {
        setRecommendation({
          recommended_difficulty: 'easy',
          next_game_type: 'memory_match',
          engagement_score: 0,
          has_gaming_data: false,
          total_games_analyzed: 0,
          rationale: 'Awaiting initial game session: scores will be generated from actual patient gameplay.',
          observation_note: 'No gaming scores recorded yet. The patient is encouraged to play their first activity.',
          ethical_disclaimer: 'This is a cognitive engagement tool, not a medical diagnosis.',
          recent_trend: 'insufficient_data'
        });
      }

      // 2. Fetch User-Specific Reminders from Firebase Firestore
      const fbReminders = await getRemindersForUser(userId);
      if (fbReminders && fbReminders.length > 0) {
        setReminders(fbReminders);
      } else {
        const remRes = await fetch(`/api/reminders?userId=${userId}`);
        if (remRes.ok) {
          const data = await remRes.json();
          const rems = data.reminders || [];
          setReminders(rems);
          // Mirror to Firebase for future sessions
          for (const r of rems) {
            saveReminderToFirebase(r).catch(() => {});
          }
        }
      }

      // 3. Fetch Alerts
      const altRes = await fetch(`/api/alerts/${userId}`);
      if (altRes.ok) {
        const data = await altRes.json();
        setAlerts(data.alerts || []);
      }

      // 4. Fetch User-Specific Familiar People from Firebase Firestore
      const fbPeople = await getFamilyForUser(userId);
      if (fbPeople && fbPeople.length > 0) {
        setFamiliarPeople(fbPeople);
      } else {
        const famRes = await fetch(`/api/familiar-people/${userId}`);
        if (famRes.ok) {
          const data = await famRes.json();
          if (data.people && data.people.length > 0) {
            setFamiliarPeople(data.people);
            for (const p of data.people) {
              saveFamilyMemberToFirebase(p).catch(() => {});
            }
          } else {
            setFamiliarPeople(FAMILIAR_PEOPLE_SEED);
          }
        }
      }

      // 5. Fetch User-Specific Game Sessions & Sync to Backend
      const [fbSessions, localSessions] = await Promise.all([
        getGameSessionsForUser(userId),
        Promise.resolve(getLocallySavedGameSessions(userId))
      ]);
      const sessionMap = new Map<string, GameSession>();
      for (const s of [...fbSessions, ...localSessions]) {
        if (s && s.id) sessionMap.set(s.id, s);
      }
      const combinedSessions = Array.from(sessionMap.values());

      if (combinedSessions.length > 0) {
        // Sync with backend store so Express trends calculations include all Firestore/local sessions
        fetch('/api/game-sessions/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions: combinedSessions })
        }).catch(() => {});
      }

      // 6. Fetch Performance Trends
      const trendRes = await fetch(`/api/performance-trends/${userId}`);
      if (trendRes.ok) {
        const data = await trendRes.json();
        if (data && data.analysis && data.analysis.has_data) {
          setTrendData(data);
        } else if (combinedSessions.length > 0) {
          const clientTrends = computeClientSideTrends(combinedSessions);
          setTrendData(clientTrends);
        } else {
          setTrendData(data);
        }
      } else if (combinedSessions.length > 0) {
        const clientTrends = computeClientSideTrends(combinedSessions);
        setTrendData(clientTrends);
      }
    } catch (e) {
      console.warn('Backend/Firebase load error, using robust in-memory state', e);
    }
  };

  // On-demand AI recommendation refresh
  const handleRefreshRecommendation = async (patientId?: string) => {
    const targetId = patientId || (currentUser?.role === 'elderly' ? currentUser.id : currentPatientUser?.id);
    if (!targetId) return;
    try {
      const res = await fetch(`/api/ai/recommendation/${targetId}?refresh=true`);
      if (res.ok) {
        const data = await res.json();
        setRecommendation(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to refresh AI recommendation', err);
    }
  };

  // Synchronize assigned patients strictly for caregiver or self for elderly
  useEffect(() => {
    if (!currentUser) {
      setAssignedPatientIds(new Set());
      setSelectedPatientId(null);
      return;
    }

    if (currentUser.language_pref) {
      setCurrentLanguage(currentUser.language_pref);
    }

    if (currentUser.role === 'elderly') {
      // Elderly user views their own data
      setAssignedPatientIds(new Set());
      loadPatientData(currentUser.id);
    } else if (currentUser.role === 'caregiver') {
      // Caregiver views ONLY elderly patients who have assigned them
      const fetchAssigned = async () => {
        try {
          const fbIds = await getAssignedElderlyIdsForCaregiver(
            currentUser.id,
            currentUser.caregiver_code
          );

          const cgParam = currentUser.caregiver_code || currentUser.id;
          const res = await fetch(`/api/patients/${encodeURIComponent(cgParam)}`);
          let backendIds: string[] = [];
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.patients)) {
              backendIds = data.patients.map((p: User) => p.id);
            }
          }

          // Also check currently loaded users in state with matching connected_caregiver_id
          const cgCode = (currentUser.caregiver_code || '').trim().toUpperCase();
          const cgId = currentUser.id.trim().toUpperCase();
          const localAssigned = users
            .filter((u) => {
              if (u.role !== 'elderly') return false;
              const conn = (u.connected_caregiver_id || '').trim().toUpperCase();
              return conn && (conn === cgCode || conn === cgId);
            })
            .map((u) => u.id);

          const allAssigned = new Set([...fbIds, ...backendIds, ...localAssigned]);
          setAssignedPatientIds(allAssigned);

          if (allAssigned.size > 0) {
            setSelectedPatientId((prev) => {
              const target = (prev && allAssigned.has(prev)) ? prev : Array.from(allAssigned)[0];
              loadPatientData(target);
              return target;
            });
          } else {
            setSelectedPatientId(null);
            // Strict privacy: Clear other patients' sensitive data
            setReminders([]);
            setAlerts([]);
            setFamiliarPeople([]);
            setRecommendation(null);
            setTrendData(null);
          }
        } catch (err) {
          console.warn('Error fetching assigned patients:', err);
        }
      };

      fetchAssigned();
    }
  }, [currentUser?.id, currentUser?.role, currentUser?.caregiver_code, users.length]);

  // Real-time live synchronization for Caregiver: updates dashboard immediately as patient plays
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'caregiver') return;

    const patientIds = Array.from(assignedPatientIds) as string[];
    if (patientIds.length === 0) return;

    const unsubscribe = subscribeToPatientGameSessions(patientIds, (newSessions) => {
      if (newSessions && newSessions.length > 0) {
        for (const s of newSessions) {
          persistGameSessionLocally(s);
        }

        // Sync to backend and refresh active patient view
        fetch('/api/game-sessions/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions: newSessions })
        })
          .then(() => {
            if (selectedPatientId) {
              loadPatientData(selectedPatientId);
            }
          })
          .catch(() => {
            if (selectedPatientId) {
              const localSessions = getLocallySavedGameSessions(selectedPatientId);
              if (localSessions.length > 0) {
                const clientTrends = computeClientSideTrends(localSessions);
                setTrendData(clientTrends);
              }
            }
          });
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role, assignedPatientIds, selectedPatientId]);

  // Handle Login & Session Remembering
  const handleLogin = (user: User) => {
    saveRememberedUser(user);
    setCurrentUser(user);
    if (user.language_pref) {
      setCurrentLanguage(user.language_pref);
    }
    setActiveGame(null);
    setIsFamilyAlbumOpen(false);

    // Keep users state synced
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      return exists ? prev.map((u) => (u.id === user.id ? user : u)) : [user, ...prev];
    });

    if (user.role === 'elderly') {
      loadPatientData(user.id);
      if (!user.connected_caregiver_id) {
        setIsConnectCaregiverOpen(true);
      }
    }
  };

  // Direct patient linking handler from Caregiver dashboard
  const handleCaregiverConnectPatient = async (identifier: string): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser || currentUser.role !== 'caregiver') {
      return { success: false, message: 'Only caregivers can link patients.' };
    }

    const clean = identifier.trim().toLowerCase();
    const matched = users.find((u) => {
      if (u.role !== 'elderly') return false;
      if (u.id.toLowerCase() === clean) return true;
      if (u.name.toLowerCase().includes(clean)) return true;
      if (u.phone && u.phone.toLowerCase().includes(clean)) return true;
      return false;
    });

    if (!matched) {
      return { success: false, message: 'Patient not found. Check Patient ID, phone or name.' };
    }

    try {
      await linkElderlyToCaregiverInFirebase(matched.id, currentUser);
      fetch('/api/caregivers/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caregiver_id: currentUser.id,
          caregiver_code: currentUser.caregiver_code,
          elderly_id: matched.id
        })
      }).catch(() => {});

      const updatedPatient: User = {
        ...matched,
        connected_caregiver_id: currentUser.caregiver_code || currentUser.id,
        connected_caregiver_name: currentUser.name
      };
      persistUserLocally(updatedPatient);
      setUsers((prev) => prev.map((u) => (u.id === matched.id ? updatedPatient : u)));
      setAssignedPatientIds((prev) => new Set([...prev, matched.id]));
      setSelectedPatientId(matched.id);
      loadPatientData(matched.id);

      return { success: true, message: `Successfully connected to ${matched.name}!` };
    } catch (err) {
      console.warn('Failed to link patient:', err);
      return { success: false, message: 'Could not link patient. Please try again.' };
    }
  };

  // Handle Register New User (Fill Details or Randomize)
  const handleRegisterUser = (newUser: User) => {
    persistUserLocally(newUser);
    setUsers((prev) => [newUser, ...prev.filter((u) => u.id !== newUser.id)]);
    // Sync with backend store as well
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).catch(() => {});
  };

  // Handle Logout (Clears remembered session)
  const handleLogout = () => {
    logOutFirebaseUser().catch(() => {});
    clearRememberedUser();
    setCurrentUser(null);
    setSelectedPatientId(null);
    setActiveGame(null);
    setIsFamilyAlbumOpen(false);
    setIsConnectCaregiverOpen(false);
    setIsEditProfileOpen(false);
    setEditingTargetUser(null);
  };

  // Open Edit Profile Modal
  const handleOpenEditProfile = (targetUser?: User | null) => {
    const target = targetUser || currentUser;
    if (target) {
      setEditingTargetUser(target);
      setIsEditProfileOpen(true);
    }
  };

  // Save Updated Profile & Photo (Firestore & Session Persistence)
  const handleUpdateUser = async (updatedUser: User) => {
    // 1. Immediately update local permanent registry
    persistUserLocally(updatedUser);

    try {
      // 2. Persist directly to Firebase Firestore
      await saveUserToFirebase(updatedUser);

      // 3. If it's the current user, update session memory & UI language
      if (currentUser && currentUser.id === updatedUser.id) {
        saveRememberedUser(updatedUser);
        setCurrentUser(updatedUser);
        if (updatedUser.language_pref) {
          setCurrentLanguage(updatedUser.language_pref);
        }
      }

      // 4. Update in all users array
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));

      // 5. Sync with local backend
      fetch(`/api/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      }).catch(() => {
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser),
        }).catch(() => {});
      });
    } catch (error) {
      console.error('Failed to save updated profile in Firebase:', error);
      // Fallback local update
      if (currentUser && currentUser.id === updatedUser.id) {
        saveRememberedUser(updatedUser);
        setCurrentUser(updatedUser);
      }
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    }
  };

  // Handle Game Session Completion (Persisted in Firebase & Local Cache)
  const handleGameFinish = async (sessionData: Omit<GameSession, 'id' | 'completed_at'>) => {
    setLastStars(sessionData.stars);
    setLastGameType(sessionData.game_type);

    const fullSession: GameSession = {
      ...sessionData,
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      completed_at: new Date().toISOString(),
    };

    // 1. Immediately persist to local device cache and Firebase Firestore
    persistGameSessionLocally(fullSession);
    saveGameSessionToFirebase(fullSession).catch(() => {});

    // 2. Synchronously compute optimistic trends for instant real-time UI feedback
    const localAll = getLocallySavedGameSessions(sessionData.user_id);
    const sessionMap = new Map<string, GameSession>();
    for (const s of [fullSession, ...localAll]) {
      if (s && s.id) sessionMap.set(s.id, s);
    }
    const combined = Array.from(sessionMap.values());
    const optimisticTrends = computeClientSideTrends(combined);
    setTrendData(optimisticTrends);

    try {
      // 3. Post full session to Express backend
      const res = await fetch('/api/game-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullSession),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.recommendation) {
          setRecommendation(data.recommendation);
        }
        // Refresh patient data in background
        loadPatientData(sessionData.user_id);
      }
    } catch (err) {
      console.warn('Logging session offline fallback', err);
    }

    if (!selectedLevel) {
      setFeedbackOpen(true);
    }
  };

  // Handle Level Completion (Unlocks next level, records stars, best score, and syncs)
  const handleLevelFinish = async (result: LevelFinishResult) => {
    if (currentUser) {
      await recordLevelCompletion(currentUser.id, result);
    }
    setLevelFinishResult(result);
    setIsLevelCompleteModalOpen(true);
  };

  // Resolve Assigned Caregiver for currently logged-in elderly user
  const assignedCaregiverForElderly = useMemo(() => {
    if (!currentUser || currentUser.role !== 'elderly') return null;
    const connId = (currentUser.connected_caregiver_id || '').trim().toUpperCase();
    if (connId) {
      const found = users.find(
        (u) =>
          u.role === 'caregiver' &&
          (u.id.toUpperCase() === connId ||
            (u.caregiver_code && u.caregiver_code.toUpperCase() === connId))
      );
      if (found) return found;
    }
    if (currentUser.connected_caregiver_name) {
      const connName = currentUser.connected_caregiver_name.trim().toLowerCase();
      const found = users.find(
        (u) => u.role === 'caregiver' && u.name.trim().toLowerCase() === connName
      );
      if (found) return found;
    }
    return null;
  }, [currentUser, users]);

  const assignedCaregiverName =
    assignedCaregiverForElderly?.name ||
    currentUser?.connected_caregiver_name ||
    currentUser?.emergency_contact?.name ||
    '';

  const assignedCaregiverCode =
    assignedCaregiverForElderly?.caregiver_code ||
    currentUser?.connected_caregiver_id ||
    undefined;

  const isElderly = currentUser?.role === 'elderly';
  const assignedPatients = useMemo(() => {
    if (!currentUser || currentUser.role !== 'caregiver') return [];
    return users.filter((u) => {
      if (u.role !== 'elderly') return false;
      const cgCode = (currentUser.caregiver_code || '').trim().toUpperCase();
      const cgId = currentUser.id.trim().toUpperCase();
      const conn = (u.connected_caregiver_id || '').trim().toUpperCase();
      if (conn && (conn === cgCode || conn === cgId)) return true;
      if (assignedPatientIds.has(u.id)) return true;
      return false;
    });
  }, [currentUser, users, assignedPatientIds]);

  const currentPatientUser: User | null = useMemo(() => {
    if (!currentUser) return null;
    if (isElderly) return currentUser;
    return assignedPatients.find((u) => u.id === selectedPatientId) || assignedPatients[0] || null;
  }, [currentUser, isElderly, assignedPatients, selectedPatientId]);

  // Trigger SOS Alert (internal backend & state update)
  const handleTriggerSOS = async () => {
    if (!currentUser) return;
    const caregiverId = assignedCaregiverForElderly?.id || currentUser.connected_caregiver_id;
    const alertId = `alt-${Date.now()}`;

    // Automatically identify live location for emergency telemetry
    let alertLat = 26.1856;
    let alertLng = 91.7539;
    let locLabel = currentUser.location || 'Assam, North East India';

    try {
      const liveLoc = await autoDetectLocation();
      if (liveLoc) {
        if (liveLoc.coords) {
          alertLat = liveLoc.coords.latitude;
          alertLng = liveLoc.coords.longitude;
        }
        if (liveLoc.cityName && liveLoc.stateName) {
          locLabel = `${liveLoc.cityName}, ${liveLoc.stateName}`;
        }
      }
    } catch (locErr) {
      console.warn('Live location SOS detection fallback:', locErr);
    }

    const newAlert: Alert = {
      id: alertId,
      user_id: currentUser.id,
      patient_name: currentUser.name,
      caregiver_id: caregiverId,
      type: 'sos',
      severity: 'high',
      message: `🚨 Urgent: ${currentUser.name} pressed the SOS assistance button in ${locLabel}. Assigned caregiver (${assignedCaregiverName}) notified.`,
      triggered_at: new Date().toISOString(),
      resolved: false,
      lat: alertLat,
      lng: alertLng,
    };

    setAlerts((prev) => [newAlert, ...prev]);

    // Persist to Firestore for real-time caregiver delivery across tabs and devices
    saveAlertToFirebase(newAlert).catch((err) =>
      console.warn('Firestore SOS alert save warning:', err)
    );

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAlert),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.alert) {
          setAlerts((prev) => [data.alert, ...prev.filter((a) => a.id !== newAlert.id)]);
        }
      }
    } catch (err) {
      console.warn('SOS fallback', err);
    }
  };

  // Real-time listener for Caregiver when any assigned patient sends an SOS alert
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'caregiver') return;

    const caregiverId = currentUser.id;
    const patientIds = assignedPatients.map((p) => p.id);

    // 1. Subscribe to Firestore alerts in real-time
    const unsubscribe = subscribeToCaregiverAlerts(
      caregiverId,
      patientIds,
      (incomingAlerts) => {
        setAlerts(incomingAlerts);

        // Find unresolved SOS alert for this caregiver or their assigned patients
        const unresolvedSOS = incomingAlerts.filter(
          (a) =>
            a.type === 'sos' &&
            !a.resolved &&
            (a.caregiver_id === caregiverId ||
              (a.user_id && patientIds.includes(a.user_id)) ||
              patientIds.length === 0)
        );

        if (unresolvedSOS.length > 0) {
          const latestSOS = unresolvedSOS[0];
          if (!notifiedSOSIdsRef.current.has(latestSOS.id)) {
            notifiedSOSIdsRef.current.add(latestSOS.id);
            setActiveCaregiverSOS(latestSOS);
          }
        }
      }
    );

    // 2. High-frequency polling fallback (every 4 seconds)
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/alerts/caregiver/${caregiverId}`);
        if (res.ok) {
          const data = await res.json();
          const list: Alert[] = data.alerts || [];
          const unresolved = list.filter((a) => a.type === 'sos' && !a.resolved);
          if (unresolved.length > 0) {
            const latest = unresolved[0];
            if (!notifiedSOSIdsRef.current.has(latest.id)) {
              notifiedSOSIdsRef.current.add(latest.id);
              setActiveCaregiverSOS(latest);
              setAlerts((prev) => {
                const exists = prev.some((a) => a.id === latest.id);
                return exists ? prev : [latest, ...prev];
              });
            }
          }
        }
      } catch {}
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [currentUser, assignedPatients]);

  // Real-time listener for Game Sessions and Cognitive Telemetry for Caregiver & Patient dashboards
  useEffect(() => {
    if (!currentUser) return;

    // Which patient IDs to listen to
    const targetPatientIds = currentUser.role === 'elderly' 
      ? [currentUser.id] 
      : assignedPatients.map((p) => p.id);

    if (targetPatientIds.length === 0 && currentUser.role === 'caregiver') {
      return;
    }

    const unsubscribe = subscribeToPatientGameSessions(
      targetPatientIds,
      (incomingSessions) => {
        // Find which patient to refresh
        const activeTargetId = currentUser.role === 'elderly' 
          ? currentUser.id 
          : (selectedPatientId || targetPatientIds[0]);

        if (activeTargetId) {
          // Re-fetch patient trends and recommendations in real time
          fetch(`/api/performance-trends/${activeTargetId}`)
            .then((res) => res.json())
            .then((trend) => {
              if (trend) {
                setTrendData(trend);
              }
            })
            .catch(() => {});

          fetch(`/api/ai/recommendation/${activeTargetId}`)
            .then((res) => res.json())
            .then((rec) => {
              if (rec) {
                setRecommendation(rec);
              }
            })
            .catch(() => {});
        }
      }
    );

    // Periodic poll for real-time accuracy even across networks
    const trendPollInterval = setInterval(() => {
      const activeTargetId = currentUser.role === 'elderly' 
        ? currentUser.id 
        : (selectedPatientId || targetPatientIds[0]);
      if (activeTargetId) {
        fetch(`/api/performance-trends/${activeTargetId}`)
          .then((res) => res.json())
          .then((trend) => {
            if (trend) {
              setTrendData(trend);
            }
          })
          .catch(() => {});
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(trendPollInterval);
    };
  }, [currentUser?.id, currentUser?.role, selectedPatientId, assignedPatients.length]);

  /**
   * Dedicated triggerSOS function called on confirmation from FloatingSOSButton.
   * [USER PLACEHOLDER]: Implement custom emergency location dispatch or SMS/telephony backend hooks here.
   */
  const triggerSOS = async () => {
    console.log('🚨 triggerSOS() executed: Dispatching emergency notification...');

    // =========================================================================
    // [USER IMPLEMENTATION PLACEHOLDER]
    // Hook up external location APIs (e.g. navigator.geolocation) or emergency
    // contact SMS/telephony endpoints here:
    //
    // Example:
    // if ('geolocation' in navigator) {
    //   navigator.geolocation.getCurrentPosition(
    //     (pos) => console.log('Location coords:', pos.coords.latitude, pos.coords.longitude),
    //     (err) => console.warn('Geolocation warning:', err)
    //   );
    // }
    // =========================================================================

    // If a user profile is active, also trigger the application's internal alert system
    if (currentUser) {
      await handleTriggerSOS();
    }
  };

  // Toggle Reminder (Persisted to Firebase)
  const handleToggleReminder = async (reminderId: string) => {
    const target = reminders.find((r) => r.id === reminderId);
    if (!target) return;
    const newStatus = !target.completed;

    setReminders((prev) =>
      prev.map((r) => (r.id === reminderId ? { ...r, completed: newStatus } : r))
    );

    // Save status in Firebase
    toggleReminderInFirebase(reminderId, newStatus).catch(() => {});

    try {
      await fetch(`/api/reminders/${reminderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newStatus }),
      });
    } catch {}
  };

  // Trigger Immediate Alarm Sound & Visual Notification
  const handleTriggerManualAlarm = (reminder: Reminder) => {
    setActiveAlarmReminder(reminder);
    setIsAlarmModalOpen(true);
  };

  // Snooze Reminder from Alarm
  const handleSnoozeReminder = async (reminderId: string, minutes: number) => {
    const newTime = calculateSnoozeTime(minutes);
    setReminders((prev) =>
      prev.map((r) => (r.id === reminderId ? { ...r, time: newTime } : r))
    );
    try {
      await fetch(`/api/reminders/${reminderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: newTime }),
      });
    } catch {}
  };

  // Mark Completed from Alarm
  const handleCompleteFromAlarm = (reminderId: string) => {
    const target = reminders.find((r) => r.id === reminderId);
    if (target && !target.completed) {
      handleToggleReminder(reminderId);
    }
  };

  // Add Reminder (Caregiver - Persisted in Firebase)
  const handleAddReminder = async (newRem: Omit<Reminder, 'id' | 'created_at' | 'completed'>) => {
    const reminderWithId: Reminder = {
      ...newRem,
      id: `rem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      created_at: new Date().toISOString(),
      completed: false,
    };

    setReminders((prev) => [...prev, reminderWithId]);
    saveReminderToFirebase(reminderWithId).catch(() => {});

    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderWithId),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reminder) {
          setReminders((prev) => prev.map((r) => (r.id === reminderWithId.id ? data.reminder : r)));
          saveReminderToFirebase(data.reminder).catch(() => {});
        }
      }
    } catch {}
  };

  // Delete Reminder (Caregiver - Deleted from Firebase)
  const handleDeleteReminder = async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    deleteReminderFromFirebase(id).catch(() => {});
    try {
      await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    } catch {}
  };

  // Resolve Alert (Caregiver)
  const handleResolveAlert = async (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a))
    );
    if (activeCaregiverSOS?.id === id) {
      setActiveCaregiverSOS(null);
    }
    resolveAlertInFirebase(id).catch(() => {});
    try {
      await fetch(`/api/alerts/${id}/resolve`, { method: 'PUT' });
    } catch {}
  };

  // Add Familiar Person (Caregiver - Persisted in Firebase)
  const handleAddFamiliarPerson = async (person: Omit<FamiliarPerson, 'id'>) => {
    const personWithId: FamiliarPerson = {
      ...person,
      id: `fam-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setFamiliarPeople((prev) => [...prev, personWithId]);
    saveFamilyMemberToFirebase(personWithId).catch(() => {});

    try {
      const res = await fetch('/api/familiar-people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personWithId),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.person) {
          setFamiliarPeople((prev) => prev.map((p) => (p.id === personWithId.id ? data.person : p)));
          saveFamilyMemberToFirebase(data.person).catch(() => {});
        }
      }
    } catch {}
  };

  // Delete Familiar Person
  const handleDeleteFamiliarPerson = async (id: string) => {
    setFamiliarPeople((prev) => prev.filter((p) => p.id !== id));
    try {
      await fetch(`/api/familiar-people/${id}`, { method: 'DELETE' });
    } catch {}
  };

  // Play Next Game recommendation
  const handlePlayNext = (nextGameType: GameType) => {
    setFeedbackOpen(false);
    setActiveGame(nextGameType);
  };

  const handleReturnHome = () => {
    setFeedbackOpen(false);
    setActiveGame(null);
    setIsFamilyAlbumOpen(false);
  };

  // If no user is logged in, present the dedicated Login / Profile Creation Page
  if (!currentUser) {
    return (
      <LoginPage
        onLogin={handleLogin}
        users={users}
        onRegisterUser={handleRegisterUser}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${THEME_CONFIGS[uiSettings.themePalette]?.bgClass || 'bg-[#F8FAFC]'} ${uiSettings.highContrast ? 'contrast-125' : ''} text-[#1E293B] font-sans transition-colors duration-300`}>
      {/* Top Header with Brand, Center Emergency SOS Button, Regional Language Selector, and User Profile */}
      <Header
        currentUser={currentUser}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
        onEditProfile={() => handleOpenEditProfile(currentUser)}
        onLogout={handleLogout}
        onTriggerSOS={triggerSOS}
        themePalette={uiSettings.themePalette}
        layoutMode={uiSettings.layoutMode}
        patientName={currentPatientUser?.name || currentUser.name}
        contactName={assignedCaregiverName}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8">
        {isElderly ? (
          /* ELDERLY INTERFACE */
          activeGame ? (
            /* Active Game Flow: Either Level Selection Screen or Active Level Gameplay */
            selectedLevel === null ? (
              <GameLevelSelectScreen
                userId={currentUser.id}
                gameType={activeGame}
                language={currentLanguage}
                onSelectLevel={(lvl) => setSelectedLevel(lvl)}
                onBack={() => {
                  setActiveGame(null);
                  setSelectedLevel(null);
                }}
              />
            ) : activeGame === 'memory_match' ? (
              <MemoryMatchGame
                level={selectedLevel}
                difficulty={recommendation?.recommended_difficulty || 'easy'}
                language={currentLanguage}
                userId={currentUser.id}
                onFinish={handleGameFinish}
                onFinishLevel={handleLevelFinish}
                onExitToLevelSelect={() => setSelectedLevel(null)}
                onBack={() => setSelectedLevel(null)}
              />
            ) : activeGame === 'sequence_recall' ? (
              <SequenceRecallGame
                level={selectedLevel}
                difficulty={recommendation?.recommended_difficulty || 'easy'}
                language={currentLanguage}
                userId={currentUser.id}
                onFinish={handleGameFinish}
                onFinishLevel={handleLevelFinish}
                onExitToLevelSelect={() => setSelectedLevel(null)}
                onBack={() => setSelectedLevel(null)}
              />
            ) : activeGame === 'picture_recognition' ? (
              <PictureRecognitionGame
                level={selectedLevel}
                difficulty={recommendation?.recommended_difficulty || 'easy'}
                language={currentLanguage}
                userId={currentUser.id}
                onFinish={handleGameFinish}
                onFinishLevel={handleLevelFinish}
                onExitToLevelSelect={() => setSelectedLevel(null)}
                onBack={() => setSelectedLevel(null)}
              />
            ) : activeGame === 'simple_puzzle' ? (
              <SimplePuzzleGame
                level={selectedLevel}
                difficulty={recommendation?.recommended_difficulty || 'easy'}
                language={currentLanguage}
                userId={currentUser.id}
                onFinish={handleGameFinish}
                onFinishLevel={handleLevelFinish}
                onExitToLevelSelect={() => setSelectedLevel(null)}
                onBack={() => setSelectedLevel(null)}
              />
            ) : activeGame === 'simple_calculation' ? (
              <SimpleCalculationGame
                level={selectedLevel}
                difficulty={recommendation?.recommended_difficulty || 'easy'}
                language={currentLanguage}
                userId={currentUser.id}
                onFinish={handleGameFinish}
                onFinishLevel={handleLevelFinish}
                onExitToLevelSelect={() => setSelectedLevel(null)}
                onBack={() => setSelectedLevel(null)}
              />
            ) : (
              <FaceMatchGame
                level={selectedLevel}
                difficulty={recommendation?.recommended_difficulty || 'easy'}
                language={currentLanguage}
                userId={currentUser.id}
                familiarPeople={familiarPeople}
                onFinish={handleGameFinish}
                onFinishLevel={handleLevelFinish}
                onExitToLevelSelect={() => setSelectedLevel(null)}
                onBack={() => setSelectedLevel(null)}
              />
            )
          ) : isFamilyAlbumOpen ? (
            /* Family Album View */
            <FamiliarPeopleView
              people={familiarPeople}
              language={currentLanguage}
              onBack={() => setIsFamilyAlbumOpen(false)}
            />
          ) : (
            /* Elderly Home View */
            <ElderlyHome
              user={currentUser}
              language={currentLanguage}
              reminders={reminders}
              recommendation={recommendation}
              assignedCaregiverName={assignedCaregiverName}
              assignedCaregiverCode={assignedCaregiverCode}
              layoutMode={uiSettings.layoutMode}
              onSelectGame={(gt) => {
                setActiveGame(gt);
                setSelectedLevel(null);
              }}
              onOpenFamilyAlbum={() => setIsFamilyAlbumOpen(true)}
              onOpenJournal={() => setIsJournalOpen(true)}
              onOpenConnectCaregiver={() => setIsConnectCaregiverOpen(true)}
              onEditProfile={() => handleOpenEditProfile(currentUser)}
              onTriggerSOS={handleTriggerSOS}
              onToggleReminder={handleToggleReminder}
              onTriggerAlarm={handleTriggerManualAlarm}
              onRefreshRecommendation={handleRefreshRecommendation}
            />
          )
        ) : (
          /* CAREGIVER DASHBOARD - Strictly accessible to Caregivers */
          <CaregiverDashboard
            caregiverUser={currentUser}
            currentPatient={currentPatientUser}
            allPatients={assignedPatients}
            language={currentLanguage}
            onLanguageChange={setCurrentLanguage}
            onSwitchPatient={(patientId) => {
              setSelectedPatientId(patientId);
              loadPatientData(patientId);
            }}
            onEditProfile={(target) => handleOpenEditProfile(target)}
            onConnectPatient={handleCaregiverConnectPatient}
            reminders={reminders}
            alerts={alerts}
            familiarPeople={familiarPeople}
            recommendation={recommendation}
            onAddReminder={handleAddReminder}
            onDeleteReminder={handleDeleteReminder}
            onToggleReminder={handleToggleReminder}
            onResolveAlert={handleResolveAlert}
            onAddFamiliarPerson={handleAddFamiliarPerson}
            onDeleteFamiliarPerson={handleDeleteFamiliarPerson}
            onOpenJournal={() => setIsJournalOpen(true)}
            onTriggerAlarm={handleTriggerManualAlarm}
            trendData={trendData}
            onRefreshRecommendation={handleRefreshRecommendation}
          />
        )}
      </main>

      {/* Elderly Connect to Specific Caregiver ID Modal */}
      {currentUser && isElderly && (
        <ConnectCaregiverModal
          elderlyUser={currentUser}
          isOpen={isConnectCaregiverOpen}
          language={currentLanguage}
          onConnected={(updatedUser) => {
            setCurrentUser(updatedUser);
            setIsConnectCaregiverOpen(false);
            setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
            loadPatientData(updatedUser.id);
          }}
        />
      )}

      {/* Edit Profile & Photo Modal */}
      {editingTargetUser && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => {
            setIsEditProfileOpen(false);
            setEditingTargetUser(null);
          }}
          user={editingTargetUser}
          onSave={handleUpdateUser}
        />
      )}

      {/* Routine Reminder Alarm & Sound Notification Modal */}
      <ReminderNotificationModal
        reminder={activeAlarmReminder}
        isOpen={isAlarmModalOpen}
        onClose={() => {
          setIsAlarmModalOpen(false);
          setActiveAlarmReminder(null);
        }}
        onComplete={handleCompleteFromAlarm}
        onSnooze={handleSnoozeReminder}
        language={currentLanguage}
        patientName={currentPatientUser?.name}
      />

      {/* Memory Reminiscence Journal Modal */}
      {currentPatientUser && (
        <MemoryJournalModal
          isOpen={isJournalOpen}
          onClose={() => setIsJournalOpen(false)}
          userId={currentPatientUser.id}
          patientName={currentPatientUser.name}
        />
      )}

      {/* Level Completion / Level Result Modal */}
      {isLevelCompleteModalOpen && levelFinishResult && (
        <LevelCompleteModal
          result={levelFinishResult}
          language={currentLanguage}
          isOpen={isLevelCompleteModalOpen}
          onNextLevel={() => {
            setIsLevelCompleteModalOpen(false);
            const nextLvl = Math.min(10, levelFinishResult.level + 1);
            setSelectedLevel(nextLvl);
          }}
          onReplayLevel={() => {
            setIsLevelCompleteModalOpen(false);
            const curr = levelFinishResult.level;
            setSelectedLevel(null);
            setTimeout(() => setSelectedLevel(curr), 50);
          }}
          onExitToLevelSelect={() => {
            setIsLevelCompleteModalOpen(false);
            setSelectedLevel(null);
          }}
        />
      )}

      {/* Gentle Game Feedback Modal */}
      <GameFeedbackModal
        isOpen={feedbackOpen}
        gameType={lastGameType}
        stars={lastStars}
        language={currentLanguage}
        recommendation={recommendation}
        onPlayNext={handlePlayNext}
        onReturnHome={handleReturnHome}
      />

      {/* Real-time Emergency SOS Alert Modal for Assigned Caregiver */}
      {currentUser?.role === 'caregiver' && activeCaregiverSOS && (
        <CaregiverSOSAlertModal
          alert={activeCaregiverSOS}
          patient={users.find((u) => u.id === activeCaregiverSOS.user_id) || currentPatientUser}
          onResolve={handleResolveAlert}
          onDismiss={() => setActiveCaregiverSOS(null)}
          onViewPatient={(patientId) => {
            setSelectedPatientId(patientId);
            loadPatientData(patientId);
            setActiveCaregiverSOS(null);
          }}
        />
      )}

      {/* Floating Emergency SOS Button - Exclusively for Elderly Patient Companion View */}
      {currentUser?.role === 'elderly' && (
        <FloatingSOSButton
          onTriggerSOS={triggerSOS}
          patientName={currentUser.name}
          contactName={assignedCaregiverName}
        />
      )}
    </div>
  );
}
