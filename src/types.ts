export type UserRole = 'elderly' | 'caregiver';

export type RegionalLanguage = 'en' | 'as' | 'kha' | 'mni' | 'hi';

export type DementiaStage = 'early' | 'mild' | 'moderate' | 'healthy_aging';

export interface User {
  id: string;
  patient_id?: string;
  name: string;
  role: UserRole;
  language_pref: RegionalLanguage;
  pin: string;
  phone?: string;
  caregiver_code?: string;
  connected_caregiver_id?: string;
  connected_caregiver_name?: string;
  age?: number;
  location?: string;
  diagnosis_note?: string;
  location_sharing?: boolean;
  avatar?: string;
  created_at: string;
  dementia_stage?: DementiaStage;
  care_goals?: string[];
  emergency_contact?: {
    name: string;
    phone: string;
    relation: string;
  };
  onboarded?: boolean;
  face_descriptor?: number[] | null;
  face_registered_at?: string | null;
  email?: string;
  updated_at?: string;
}

export interface CaregiverLink {
  id: string;
  caregiver_id: string;
  elderly_id: string;
  relation: string;
}

export type ReminderType = 
  | 'medication' 
  | 'hydration' 
  | 'activity' 
  | 'appointment' 
  | 'custom' 
  | 'meal' 
  | 'exercise' 
  | 'memory_game' 
  | 'chai_time' 
  | 'family_call'
  | string;

export type RecurrenceType = 'once' | 'daily' | 'weekdays' | 'weekly' | 'custom' | string;
export type ReminderPriority = 'low' | 'medium' | 'high' | 'gentle' | 'critical' | string;
export type MedicationStatus = 'upcoming' | 'due' | 'taken' | 'missed';

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  type: ReminderType;
  time?: string;
  time_str?: string;
  recurrence?: RecurrenceType;
  priority?: ReminderPriority;
  dosage?: string;
  instructions?: string;
  voice_prompt?: string;
  spoken_prompt?: string;
  audio_chime?: boolean | string;
  scheduled_date?: string;
  created_by?: string;
  completed: boolean;
  completed_at?: string | null;
  created_at: string;

  // Medication Management System (MMS) fields
  is_caregiver_scheduled?: boolean;
  caregiver_id?: string;
  caregiver_name?: string;
  medication_name?: string;
  frequency?: string;
  scheduled_times?: string[];
  status?: MedicationStatus;
  source?: 'caregiver' | 'patient' | 'system';
  acknowledged_at?: string | null;
  followup_sent?: boolean;
  missed_notified?: boolean;
}

export interface FamiliarPerson {
  id: string;
  user_id: string;
  name: string;
  relation: string;
  photo_url: string;
  notes?: string;
  phone?: string;
  voice_prompt?: string;
  favorite_memory?: string;
}

export interface Alert {
  id: string;
  user_id: string;
  patient_name?: string;
  caregiver_id?: string;
  type: string;
  message: string;
  severity?: 'low' | 'medium' | 'high' | string;
  resolved: boolean;
  resolved_at?: string | null;
  timestamp?: string;
  triggered_at?: string;
  lat?: number;
  lng?: number;
  created_at?: string;
}

export type GameType = 
  | 'memory_match' 
  | 'sequence_recall' 
  | 'picture_recognition' 
  | 'simple_puzzle' 
  | 'face_match'
  | 'simple_calculation';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface LevelScoreRecord {
  level: number;
  score: number;
  stars: number; // 1, 2, or 3
  timeSec: number;
  accuracy: number;
  attempts?: number;
  mistakes?: number;
  completedAt: string;
}

export interface GameLevelProgress {
  userId: string;
  gameId: GameType;
  unlockedLevel: number; // 1 to 10
  completedLevels: number[]; // Array of completed level numbers e.g. [1, 2]
  bestScorePerLevel: Record<number, LevelScoreRecord>;
  lastPlayedLevel?: number;
  updatedAt?: string;
}

export interface LevelFinishResult {
  won: boolean;
  level: number;
  gameType: GameType;
  score: number;
  stars: number; // 0 (if failed) or 1, 2, 3
  timeSec: number;
  accuracy: number;
  attempts: number;
  mistakes: number;
  completionRate: number;
  failReason?: string;
  winConditionMet?: string;
  nextLevelUnlocked?: boolean;
}

export interface GameSession {
  id: string;
  user_id: string;
  game_type: GameType;
  level_number?: number;
  accuracy: number; // 0 to 100 percentage
  response_time: number; // average response time in seconds
  attempts: number;
  mistakes: number;
  completion_rate: number; // 0 to 100
  difficulty_level: DifficultyLevel;
  stars: number; // 1, 2, or 3
  completed_at: string;
}

export interface CognitiveDomainScore {
  domain: string;
  game_type: GameType;
  game_title: string;
  accuracy: number;
  avg_response_time: number;
  sessions_count: number;
  mistakes_avg: number;
  status: 'strong' | 'steady' | 'needs_practice';
  analysis: string;
}

export interface PatientGamingAnalysis {
  has_data: boolean;
  total_games_played: number;
  gaming_score: number; // 0 to 100 derived directly from actual games
  score_breakdown: {
    accuracy_pts: number;      // max 50 pts
    speed_pts: number;         // max 25 pts
    focus_pts: number;         // max 15 pts
    completion_pts: number;    // max 10 pts
  };
  average_accuracy_pct: number;
  average_response_time_sec: number;
  total_mistakes: number;
  total_stars: number;
  domain_breakdown: CognitiveDomainScore[];
  trend_direction: 'improving' | 'stable' | 'attention_needed' | 'insufficient_data';
  trend_summary: string;
  speed_analysis: string;
  clinical_insight: string;
  recommended_game: {
    game_type: GameType;
    title: string;
    reason: string;
  };
  recent_sessions_summary: Array<{
    id: string;
    game_type: GameType;
    game_title: string;
    date: string;
    accuracy: number;
    response_time: number;
    mistakes: number;
    stars: number;
    difficulty_level: DifficultyLevel;
    note: string;
  }>;
}

export interface PerformanceTrend {
  user_id: string;
  period: string; // e.g., 'Week of Oct 12' or '2026-09-01'
  avg_accuracy: number;
  avg_response_time: number;
  engagement_score: number; // 0 to 100 rolling score
  games_count: number;
  baseline_accuracy: number;
  deviation_from_baseline_pct: number;
}

export interface TrendData {
  trends: Array<{
    session_num: number;
    date: string;
    accuracy: number;
    response_time: number;
    mistakes: number;
    game_type: GameType;
    difficulty: DifficultyLevel;
    baseline: number;
  }>;
  baseline_accuracy: number;
  recent_accuracy: number;
  deviation_from_baseline_pct: number;
  baseline_observation: string;
  game_breakdown: Record<string, number>;
  ethical_disclaimer: string;
  analysis?: PatientGamingAnalysis;
}

export interface AIRecommendation {
  recommended_difficulty: DifficultyLevel;
  next_game_type: GameType;
  recommended_game_title?: string;
  engagement_score: number;
  rationale: string;
  observation_note: string;
  ethical_disclaimer: string;
  recent_trend: 'improving' | 'stable' | 'attention_needed' | 'insufficient_data';
  has_gaming_data?: boolean;
  total_games_analyzed?: number;
  
  // AI Cognitive Intelligence Fields
  ai_powered?: boolean;
  clinical_reasoning?: string;
  cognitive_focus_domain?: string;
  patient_encouragement_message?: string;
  patient_voice_prompt?: string;
  caregiver_actionable_tip?: string;
  expected_therapeutic_benefit?: string;
  confidence_score?: number;
  adaptive_level_suggestion?: number;
  cognitive_domains_summary?: {
    memory?: string;
    attention?: string;
    speed?: string;
  };
}

export interface CulturalItem {
  id: string;
  name: Record<RegionalLanguage, string>;
  category: 'fruit' | 'animal' | 'festival' | 'craft' | 'monument' | 'attire' | 'tea' | 'lake';
  image_url: string;
  state_origin: string; // Assam, Meghalaya, Manipur, Nagaland, Arunachal Pradesh, Tripura, Mizoram, Sikkim
  state_native_name?: string;
  description: Record<RegionalLanguage, string>;
  clue?: Record<RegionalLanguage, string>;
  fun_fact?: Record<RegionalLanguage, string>;
  icon?: string;
  pronunciation_hint?: string;
}

// -------------------------------------------------------------
// Extended Healthcare & Journal Types
// -------------------------------------------------------------

export interface MemoryJournalEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  media_type: 'text' | 'audio' | 'photo' | 'video';
  media_url?: string;
  audio_duration?: string;
  location_tag?: string;
  emotion: 'joy' | 'peaceful' | 'nostalgic' | 'reflective';
  created_at: string;
}

export interface MedicationSchedule {
  id: string;
  user_id: string;
  med_name: string;
  dosage: string;
  timing: 'morning' | 'afternoon' | 'evening' | 'bedtime';
  time_str: string;
  purpose: string;
  taken_today: boolean;
  last_taken_at?: string;
}

export interface ConsultationDoctor {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
  location: string;
  available_days: string;
  consult_fee: string;
  avatar: string;
  rating: number;
}

export interface ConsultationAppointment {
  id: string;
  user_id: string;
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  hospital: string;
  date: string;
  time: string;
  status: 'confirmed' | 'completed' | 'scheduled';
  notes: string;
}

export interface ForumPost {
  id: string;
  author_name: string;
  author_role: string;
  location: string;
  title: string;
  content: string;
  tags: string[];
  likes: number;
  replies_count: number;
  created_at: string;
}

export interface DataLakeSummary {
  raw_records_count: number;
  cleansed_records_count: number;
  features_extracted: string[];
  model_accuracy: number;
  ethical_compliance_pct: number;
  anonymized: boolean;
  training_epochs: number;
  last_training_time: string;
}

// UI/UX Design System & Layout Archetypes
export type UILayoutMode = 'standard' | 'bento' | 'split' | 'zen' | 'compact' | 'heritage';
export type UIThemePalette = 'default' | 'terracotta' | 'pine' | 'sundown' | 'dzukou' | 'kanchenjunga' | 'monochrome';
export type UITextScale = 'normal' | 'large' | 'xlarge';

export interface UIUXSettings {
  layoutMode: UILayoutMode;
  themePalette: UIThemePalette;
  textScale: UITextScale;
  highContrast: boolean;
  hapticAudio: boolean;
  reducedMotion: boolean;
}

