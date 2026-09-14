import React, { useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar 
} from 'recharts';
import { 
  Activity, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Brain, 
  Users, 
  Bell, 
  Sparkles, 
  Info,
  Calendar,
  Layers,
  Stethoscope,
  Pill,
  BookOpen,
  Camera,
  Edit3,
  ShieldAlert,
  ShieldCheck,
  Link as LinkIcon,
  Gamepad2,
  Award,
  Zap,
  Target,
  TrendingUp,
  BarChart2,
  Check,
  Palette,
  Globe,
  Download
} from 'lucide-react';
import { 
  User, 
  Reminder, 
  Alert, 
  FamiliarPerson, 
  AIRecommendation, 
  DifficultyLevel, 
  ReminderType, 
  RecurrenceType, 
  TrendData, 
  PatientGamingAnalysis, 
  CognitiveDomainScore, 
  GameSession,
  RegionalLanguage
} from '../../types';
import { IntegratedCareView } from '../care/IntegratedCareView';
import { ConsultationPortalView } from '../consultation/ConsultationPortalView';
import { ScheduleRemindersManager } from './ScheduleRemindersManager';
import { soundEffects } from '../../utils/speechAndAudio';
import { downloadPhoto } from '../../utils/downloadPhoto';
import { CAREGIVER_TRANSLATIONS } from '../../data/caregiverTranslations';
import { LANGUAGE_LABELS } from '../../data/nerContent';

interface CaregiverDashboardProps {
  caregiverUser?: User;
  currentPatient?: User | null;
  allPatients: User[];
  onSwitchPatient: (patientId: string) => void;
  onEditProfile?: (targetUser: User) => void;
  onConnectPatient?: (patientIdentifier: string) => Promise<{ success: boolean; message?: string }>;
  reminders: Reminder[];
  alerts: Alert[];
  familiarPeople: FamiliarPerson[];
  recommendation: AIRecommendation | null;
  onAddReminder: (newReminder: Omit<Reminder, 'id' | 'created_at' | 'completed'>) => void;
  onDeleteReminder: (id: string) => void;
  onToggleReminder: (id: string) => void;
  onResolveAlert: (id: string) => void;
  onAddFamiliarPerson: (person: Omit<FamiliarPerson, 'id'>) => void;
  onDeleteFamiliarPerson: (id: string) => void;
  onOpenJournal?: () => void;
  onTriggerAlarm?: (reminder: Reminder) => void;
  trendData: TrendData | null;
  language?: RegionalLanguage;
  onLanguageChange?: (lang: RegionalLanguage) => void;
  onRefreshRecommendation?: () => Promise<any>;
}

export const CaregiverDashboard: React.FC<CaregiverDashboardProps> = ({
  caregiverUser,
  currentPatient,
  allPatients,
  onSwitchPatient,
  onEditProfile,
  onConnectPatient,
  reminders,
  alerts,
  familiarPeople,
  recommendation,
  onAddReminder,
  onDeleteReminder,
  onToggleReminder,
  onResolveAlert,
  onAddFamiliarPerson,
  onDeleteFamiliarPerson,
  onOpenJournal,
  onTriggerAlarm,
  trendData,
  language,
  onLanguageChange,
  onRefreshRecommendation,
}) => {
  const currentLang: RegionalLanguage = language || caregiverUser?.language_pref || 'en';
  const t = CAREGIVER_TRANSLATIONS[currentLang] || CAREGIVER_TRANSLATIONS.en;
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'trends' | 'care' | 'consultation' | 'reminders' | 'alerts' | 'people'>('trends');
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [isRefreshingAI, setIsRefreshingAI] = useState(false);

  const handleRefreshAI = async () => {
    if (!onRefreshRecommendation || isRefreshingAI) return;
    setIsRefreshingAI(true);
    soundEffects.playGentleTap();
    try {
      await onRefreshRecommendation();
      soundEffects.playSuccessChime();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshingAI(false);
    }
  };

  // Connect Patient direct linking state
  const [patientLinkInput, setPatientLinkInput] = useState('');
  const [isLinkingPatient, setIsLinkingPatient] = useState(false);
  const [linkStatusMessage, setLinkStatusMessage] = useState('');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const handleDirectConnectPatient = async () => {
    if (!patientLinkInput.trim() || !onConnectPatient) return;
    setIsLinkingPatient(true);
    setLinkStatusMessage('');
    try {
      const res = await onConnectPatient(patientLinkInput.trim());
      if (res.success) {
        setLinkStatusMessage(res.message || 'Patient successfully assigned and connected!');
        soundEffects.playSuccessChime();
        setPatientLinkInput('');
        setTimeout(() => {
          setIsConnectModalOpen(false);
          setLinkStatusMessage('');
        }, 1500);
      } else {
        setLinkStatusMessage(res.message || 'Could not find patient with that ID or details.');
        soundEffects.playGentleTap();
      }
    } catch (err) {
      setLinkStatusMessage('Failed to connect patient. Please try again.');
    } finally {
      setIsLinkingPatient(false);
    }
  };

  // New Reminder form state
  const [remTitle, setRemTitle] = useState('');
  const [remType, setRemType] = useState<ReminderType>('medication');
  const [remTime, setRemTime] = useState('09:00 AM');
  const [remRecurrence, setRemRecurrence] = useState<RecurrenceType>('daily');
  const [remInstructions, setRemInstructions] = useState('');

  // New Familiar Person form state
  const [personName, setPersonName] = useState('');
  const [personRelation, setPersonRelation] = useState('');
  const [personPhoto, setPersonPhoto] = useState('');
  const [personNotes, setPersonNotes] = useState('');
  const [personPhone, setPersonPhone] = useState('');

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient || !remTitle.trim()) return;

    onAddReminder({
      user_id: currentPatient.id,
      title: remTitle,
      type: remType,
      time: remTime,
      recurrence: remRecurrence,
      instructions: remInstructions,
      created_by: 'Caregiver Priya',
    });

    setRemTitle('');
    setRemInstructions('');
    setShowAddReminderModal(false);
  };

  const handleCreatePerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient || !personName.trim() || !personRelation.trim()) return;

    onAddFamiliarPerson({
      user_id: currentPatient.id,
      name: personName,
      relation: personRelation,
      photo_url: personPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      notes: personNotes,
      phone: personPhone,
    });

    setPersonName('');
    setPersonRelation('');
    setPersonPhoto('');
    setPersonNotes('');
    setPersonPhone('');
    setShowAddPersonModal(false);
  };

  const analysis: PatientGamingAnalysis | undefined = trendData?.analysis;
  const hasGamingData = Boolean(analysis?.has_data && (analysis?.total_games_played || 0) > 0);

  const chartData = trendData?.trends || [];
  const barData = Object.entries(trendData?.game_breakdown || {}).map(([game, count]) => ({
    game: game.replace('_', ' ').toUpperCase(),
    count,
  }));

  const activeAlerts = alerts.filter((a) => !a.resolved);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Caregiver ID & Connection Code Bar with Theme Gradient */}
      {caregiverUser && (
        <div 
          style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
          className="text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-[#47D6B6]"
        >
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-white/90 border-2 border-[#47D6B6] flex items-center justify-center font-black text-[#2794EB] text-base shrink-0 shadow-2xs">
              CG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {t.caregiver_id_title}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/90 text-[#2794EB] text-[10px] font-mono font-bold border border-[#47D6B6]">
                  {t.active_link}
                </span>
              </div>
              <p className="text-2xl font-mono font-black text-white tracking-wider">
                {caregiverUser.caregiver_code || caregiverUser.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-end">
            {onLanguageChange && (
              <div className="flex items-center gap-1.5 bg-white/95 px-3 py-2 rounded-xl border border-[#47D6B6] shadow-2xs">
                <Globe className="w-3.5 h-3.5 text-[#2794EB] shrink-0" />
                <select
                  id="caregiver-language-select"
                  aria-label={t.language_label}
                  value={currentLang}
                  onChange={(e) => {
                    soundEffects.playGentleTap();
                    onLanguageChange(e.target.value as RegionalLanguage);
                  }}
                  className="bg-transparent text-xs font-black text-[#1E293B] focus:outline-none cursor-pointer"
                >
                  {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                    <option key={code} value={code} className="text-slate-900 bg-white">
                      {label.nativeName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span className="text-xs text-white/95 font-bold max-w-xs text-center sm:text-right hidden md:inline">
              {t.cg_id_instruction}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(caregiverUser.caregiver_code || caregiverUser.id);
                soundEffects.playGentleTap();
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#2794EB] border border-[#47D6B6] text-xs font-black transition-all cursor-pointer shadow-sm active:translate-y-0.5 whitespace-nowrap"
            >
              {copiedCode ? t.copied : t.copy_id}
            </button>
          </div>
        </div>
      )}

      {/* Prominent Ethical Guardrail Banner */}
      <div className="bg-[#FAFAFA] border-2 border-[#47D6B6] rounded-2xl p-4 flex items-start gap-3 text-[#1E293B] shadow-sm">
        <Info className="w-6 h-6 text-[#2794EB] shrink-0 mt-0.5" />
        <div>
          <h4 className="font-black text-sm tracking-wide uppercase text-[#1E293B]">
            {t.monitoring_protocol}
          </h4>
          <p className="text-sm leading-relaxed text-slate-600 font-medium">
            {trendData?.ethical_disclaimer || t.ethical_disclaimer_text}
          </p>
        </div>
      </div>

      {/* If no patient assigned to this caregiver, show strict privacy & access protection card */}
      {(!currentPatient || allPatients.length === 0) ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-[#47D6B6] shadow-sm text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 border-2 border-amber-300 flex items-center justify-center text-amber-600 shadow-2xs">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="max-w-xl mx-auto space-y-2">
            <h3 className="text-2xl font-black text-slate-800">
              {t.access_restricted_title}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {t.access_restricted_desc}
            </p>
          </div>

          {/* Caregiver Code instructions */}
          <div className="max-w-md mx-auto p-5 rounded-2xl bg-gradient-to-r from-[#2794EB]/20 via-[#47D6B6]/20 to-[#47D6B6]/20 border-2 border-[#47D6B6] text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                {t.caregiver_code_label}
              </span>
              <span className="text-xs font-mono font-black text-[#2794EB] bg-white px-2.5 py-1 rounded-lg border border-[#47D6B6]">
                {caregiverUser?.caregiver_code || caregiverUser?.id}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {t.share_code_instruction}
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(caregiverUser?.caregiver_code || caregiverUser?.id || '');
                soundEffects.playGentleTap();
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-[#47D6B6] text-xs font-black transition-all cursor-pointer shadow-xs"
            >
              {copiedCode ? t.copied : t.copy_code_btn}
            </button>
          </div>

          {/* Optional Direct Patient Linking Form if Caregiver is assisting */}
          {onConnectPatient && (
            <div className="max-w-md mx-auto pt-4 border-t border-slate-100 text-left space-y-3">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-[#2794EB]" />
                {t.link_patient_title}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                {t.link_patient_desc}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Patient ID / Name / Phone"
                  value={patientLinkInput}
                  onChange={(e) => setPatientLinkInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 outline-none focus:border-[#47D6B6] focus:bg-white"
                />
                <button
                  type="button"
                  disabled={isLinkingPatient || !patientLinkInput.trim()}
                  onClick={handleDirectConnectPatient}
                  className="px-4 py-2 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLinkingPatient ? '...' : t.connect_btn}
                </button>
              </div>
              {linkStatusMessage && (
                <p className={`text-xs font-bold ${linkStatusMessage.includes('Success') || linkStatusMessage.includes('connected') ? 'text-emerald-700' : 'text-red-600'}`}>
                  {linkStatusMessage}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Top Patient Selector & Profile Hero Bar */}
          <div 
            style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
            className="rounded-[32px] p-6 border-2 border-[#47D6B6] shadow-md flex flex-col md:flex-row items-center justify-between gap-6 text-white"
          >
            <div className="flex items-center gap-5">
              <div className="relative group shrink-0">
                <img
                  src={currentPatient.avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'}
                  alt={currentPatient.name}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md shrink-0"
                />
                {onEditProfile && (
                  <button
                    id="caregiver-patient-photo-edit-btn"
                    type="button"
                    onClick={() => {
                      soundEffects.playGentleTap();
                      onEditProfile(currentPatient);
                    }}
                    className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-lg bg-white hover:bg-slate-50 text-[#2794EB] border-2 border-[#47D6B6] shadow-xs cursor-pointer transition-transform group-hover:scale-110"
                    title="Change patient profile picture"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#2794EB]" />
                  </button>
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-white">
                    {currentPatient.name}
                  </h2>
                  <span 
                    className="px-2.5 py-1 rounded-full bg-white/95 text-[#2794EB] text-xs font-black font-mono flex items-center gap-1 border border-[#47D6B6] shadow-2xs"
                    title="Unique Patient ID Code"
                  >
                    <span className="text-slate-500 font-sans font-bold text-[10px] uppercase">ID:</span>
                    <span>{currentPatient.patient_id || currentPatient.id}</span>
                  </span>
                  {onEditProfile ? (
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playGentleTap();
                        onEditProfile(currentPatient);
                      }}
                      className="px-3 py-1 rounded-full bg-white/90 hover:bg-white text-[#2794EB] text-xs font-black flex items-center gap-1.5 border border-[#47D6B6] transition-all cursor-pointer shadow-xs active:scale-95"
                      title="Click to change age"
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#2794EB]" />
                      <span>{t.age}: {currentPatient.age || 74}</span>
                      <span className="text-[10px] text-[#2794EB] font-bold underline">{t.change}</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-white/90 text-[#2794EB] text-xs font-black flex items-center gap-1 border border-[#47D6B6]">
                      <Calendar className="w-3 h-3 text-[#2794EB]" />
                      {t.age}: {currentPatient.age || 74}
                    </span>
                  )}
                  {onEditProfile && (
                    <button
                      id="caregiver-patient-profile-edit-btn"
                      type="button"
                      onClick={() => {
                        soundEffects.playGentleTap();
                        onEditProfile(currentPatient);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-[#2794EB] border border-[#47D6B6] text-xs font-black transition-colors cursor-pointer"
                      title="Edit Patient Profile and Photo"
                    >
                      <Edit3 className="w-3 h-3 text-[#2794EB]" />
                      <span>{t.edit_details}</span>
                    </button>
                  )}
                </div>
                <p className="text-white/90 text-sm font-bold mt-1">
                  📍 {currentPatient.location || 'Guwahati, Assam'} · {t.primary_language}: {currentPatient.language_pref.toUpperCase()}
                </p>
                {currentPatient.diagnosis_note && (
                  <p className="text-xs text-white/80 italic mt-1 font-semibold">
                    {t.clinical_note}: {currentPatient.diagnosis_note}
                  </p>
                )}
              </div>
            </div>

            {/* Linked Patient Switcher */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-white/90 p-2 rounded-2xl border border-[#47D6B6]">
              <div className="flex items-center gap-1 px-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-black text-[#1E293B] uppercase">
                  {t.assigned_patients} ({allPatients.length}):
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {allPatients.map((p) => (
                  <button
                    key={p.id}
                    id={`switch-patient-${p.id}`}
                    onClick={() => onSwitchPatient(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      p.id === currentPatient.id
                        ? 'bg-[#2794EB] text-white shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-[#1E293B] border border-[#47D6B6]'
                    }`}
                  >
                    {p.name.split(' ')[0]}
                  </button>
                ))}
                {onConnectPatient && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsConnectModalOpen(true);
                      setLinkStatusMessage('');
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer flex items-center gap-1"
                    title="Connect another assigned patient"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.link_btn}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

      {/* KPI Overview Cards with Theme Palette — Connected Directly to Patient Gaming Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cognitive Gaming Score */}
        <div className="bg-[#FAFAFA] rounded-2xl p-5 border-2 border-[#47D6B6] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
              <span>{t.patient_gaming_score}</span>
            </span>
            <Gamepad2 className="w-5 h-5 text-[#2794EB]" />
          </div>
          {hasGamingData && analysis ? (
            <div>
              <div className="text-3xl font-black text-[#1E293B] flex items-baseline gap-1">
                <span>{analysis.gaming_score}</span>
                <span className="text-base font-bold text-slate-400"> / 100</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{t.derived_from} {analysis.total_games_played} {t.played_games}</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-black text-amber-700 flex items-baseline gap-1">
                <span>{t.pending}</span>
                <span className="text-xs font-bold text-slate-400">(0 / 100)</span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                {t.awaiting_first_game}
              </p>
            </div>
          )}
        </div>

        {/* Accuracy vs Baseline */}
        <div className="bg-[#FAFAFA] rounded-2xl p-5 border-2 border-[#47D6B6] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">
              {t.avg_accuracy}
            </span>
            <Activity className="w-5 h-5 text-[#2794EB]" />
          </div>
          {hasGamingData && analysis ? (
            <div>
              <div className="text-3xl font-black text-[#1E293B]">
                {analysis.average_accuracy_pct}%
              </div>
              <p className="text-xs text-slate-600 font-bold mt-1">
                {t.baseline}: {trendData?.baseline_accuracy || analysis.average_accuracy_pct}% (
                {trendData && trendData.deviation_from_baseline_pct >= 0 ? '+' : ''}
                {trendData?.deviation_from_baseline_pct || 0}%)
              </p>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-black text-slate-400">
                -- %
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                {t.awaiting_gameplay}
              </p>
            </div>
          )}
        </div>

        {/* Avg Response Speed */}
        <div className="bg-[#FAFAFA] rounded-2xl p-5 border-2 border-[#47D6B6] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">
              {t.avg_response_time}
            </span>
            <Clock className="w-5 h-5 text-[#2794EB]" />
          </div>
          {hasGamingData && analysis ? (
            <div>
              <div className="text-3xl font-black text-[#1E293B]">
                {analysis.average_response_time_sec}s
              </div>
              <p className="text-xs text-slate-600 font-bold mt-1">
                {analysis.average_response_time_sec <= 4.2
                  ? t.swift_processing
                  : analysis.average_response_time_sec <= 6.5
                  ? t.deliberation_processing
                  : t.relaxed_pacing}
              </p>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-black text-slate-400">
                -- s
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                {t.speed_untracked}
              </p>
            </div>
          )}
        </div>

        {/* Active Alerts */}
        <div className="bg-[#FAFAFA] rounded-2xl p-5 border-2 border-[#47D6B6] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">
              {t.active_alerts}
            </span>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-3xl font-black text-[#1E293B]">
            {activeAlerts.length}
          </div>
          <p className="text-xs text-slate-600 font-bold mt-1">
            {activeAlerts.length === 0 ? t.all_peaceful : t.requires_review}
          </p>
        </div>
      </div>

      {/* Baseline Observation & Gaming Performance Highlight Card */}
      {hasGamingData && analysis ? (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-2 border-[#47D6B6] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
                <Brain className="w-6 h-6 text-[#2794EB]" />
              </div>
              <div>
                <h4 className="text-base font-black text-emerald-950 flex items-center gap-2">
                  <span>{t.empirical_analysis}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                    {analysis.total_games_played} {t.sessions_recorded}
                  </span>
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  {t.eval_subtext}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-3 py-1 rounded-full font-black uppercase tracking-wider ${
                analysis.trend_direction === 'improving'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : analysis.trend_direction === 'attention_needed'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-blue-100 text-blue-900 border border-blue-300'
              }`}>
                {t.trajectory}: {analysis.trend_direction === 'improving' ? t.trajectory_improving : analysis.trend_direction === 'attention_needed' ? t.trajectory_attention_needed : t.trajectory_stable}
              </span>
              <span className="text-xs font-mono font-black bg-white px-2.5 py-1 rounded-lg border border-[#47D6B6] text-[#1E293B]">
                {t.score}: {analysis.gaming_score}/100
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2794EB]" />
                <span>{t.clinical_insight}</span>
              </span>
              <p className="text-slate-800 font-medium leading-relaxed">
                {analysis.clinical_insight}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#2794EB]" />
                <span>{t.reaction_speed}</span>
              </span>
              <p className="text-slate-800 font-medium leading-relaxed">
                {analysis.speed_analysis}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic pt-1 border-t border-emerald-200/50 flex items-center justify-between">
            <span>{t.formula_transparent}</span>
            <span>{t.ethical_tool_tag}</span>
          </p>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800 shrink-0">
            <Gamepad2 className="w-6 h-6 text-amber-700" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-black text-amber-950">
              {t.awaiting_baseline_title}
            </h4>
            <p className="text-slate-700 text-sm leading-relaxed font-medium">
              {t.awaiting_baseline_desc.replace('{name}', currentPatient ? currentPatient.name : 'the patient')}
            </p>
            <p className="text-xs text-slate-500 italic pt-1">
              {t.no_simulated_data}
            </p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b-2 border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            id="tab-trends"
            onClick={() => setActiveTab('trends')}
            style={activeTab === 'trends' ? { background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' } : undefined}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'trends'
                ? 'text-white border border-[#47D6B6] shadow-sm'
                : 'bg-[#FAFAFA] hover:bg-white text-[#1E293B] border border-[#47D6B6]'
            }`}
          >
            <Activity className={`w-4 h-4 ${activeTab === 'trends' ? 'text-white' : 'text-[#2794EB]'}`} />
            <span>{t.tab_trends}</span>
          </button>

          <button
            id="tab-care"
            onClick={() => setActiveTab('care')}
            style={activeTab === 'care' ? { background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' } : undefined}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'care'
                ? 'text-white border border-[#47D6B6] shadow-sm'
                : 'bg-[#FAFAFA] hover:bg-white text-[#1E293B] border border-[#47D6B6]'
            }`}
          >
            <Pill className={`w-4 h-4 ${activeTab === 'care' ? 'text-white' : 'text-[#2794EB]'}`} />
            <span>{t.tab_care}</span>
          </button>

          <button
            id="tab-consultation"
            onClick={() => setActiveTab('consultation')}
            style={activeTab === 'consultation' ? { background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' } : undefined}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'consultation'
                ? 'text-white border border-[#47D6B6] shadow-sm'
                : 'bg-[#FAFAFA] hover:bg-white text-[#1E293B] border border-[#47D6B6]'
            }`}
          >
            <Stethoscope className={`w-4 h-4 ${activeTab === 'consultation' ? 'text-white' : 'text-[#2794EB]'}`} />
            <span>{t.tab_consultation}</span>
          </button>

          <button
            id="tab-reminders"
            onClick={() => setActiveTab('reminders')}
            style={activeTab === 'reminders' ? { background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' } : undefined}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'reminders'
                ? 'text-white border border-[#47D6B6] shadow-sm'
                : 'bg-[#FAFAFA] hover:bg-white text-[#1E293B] border border-[#47D6B6]'
            }`}
          >
            <Clock className={`w-4 h-4 ${activeTab === 'reminders' ? 'text-white' : 'text-[#2794EB]'}`} />
            <span>{t.tab_reminders} ({reminders.length})</span>
            <span className="text-[10px] bg-white/90 text-[#1E293B] font-extrabold px-1.5 py-0.5 rounded-md ml-1 border border-[#47D6B6]">
              {t.cg_access_badge}
            </span>
          </button>

          <button
            id="tab-alerts"
            onClick={() => setActiveTab('alerts')}
            style={activeTab === 'alerts' ? { background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' } : undefined}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'text-white border border-[#47D6B6] shadow-sm'
                : 'bg-[#FAFAFA] hover:bg-white text-[#1E293B] border border-[#47D6B6]'
            }`}
          >
            <Bell className={`w-4 h-4 ${activeTab === 'alerts' ? 'text-white' : 'text-[#2794EB]'}`} />
            <span>{t.tab_alerts} ({activeAlerts.length})</span>
          </button>

          <button
            id="tab-people"
            onClick={() => setActiveTab('people')}
            style={activeTab === 'people' ? { background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' } : undefined}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'people'
                ? 'text-white border border-[#47D6B6] shadow-sm'
                : 'bg-[#FAFAFA] hover:bg-white text-[#1E293B] border border-[#47D6B6]'
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'people' ? 'text-white' : 'text-[#2794EB]'}`} />
            <span>{t.tab_people} ({familiarPeople.length})</span>
          </button>
        </div>

        {/* Quick Action Button for Journal */}
        <div className="flex items-center gap-2">
          {onOpenJournal && (
            <button
              onClick={onOpenJournal}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#1E293B] font-black text-xs flex items-center gap-1 border border-[#47D6B6] cursor-pointer shadow-2xs"
              title="Memory Reminiscence Journal"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#2794EB]" />
              <span>{t.tab_journal}</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB: Integrated Care Services */}
      {activeTab === 'care' && currentPatient && (
        <IntegratedCareView
          user={currentPatient}
          caregiverName={caregiverUser?.name}
          onAddReminder={onAddReminder}
          language={currentLang}
        />
      )}

      {/* TAB: Professional Consultation Portal */}
      {activeTab === 'consultation' && currentPatient && (
        <ConsultationPortalView
          user={currentPatient}
          language={currentLang}
        />
      )}

      {/* TAB 1: Patient Gaming Performance & Deep Cognitive Analysis */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* AI Cognitive Prescription & Game Recommendation Panel */}
          {recommendation && (
            <div className="bg-gradient-to-r from-blue-50/90 via-teal-50/70 to-emerald-50/90 rounded-[32px] p-6 md:p-8 border-3 border-[#47D6B6] shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#47D6B6]/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2794EB] to-[#47D6B6] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900">
                        🤖 AI Neuropsychology Game Prescription
                      </h3>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-[#2794EB] text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                        Smart AI
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-bold">
                      Clinical AI analysis based on {currentPatient?.name.split(' ')[0] || 'Patient'}'s empirical accuracy, speed, and cognitive domain fatigue
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {recommendation.confidence_score && (
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl">
                      ⚡ {recommendation.confidence_score}% Confidence
                    </span>
                  )}
                  {onRefreshRecommendation && (
                    <button
                      type="button"
                      id="caregiver-reanalyze-ai-btn"
                      onClick={handleRefreshAI}
                      disabled={isRefreshingAI}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#2794EB] border border-[#47D6B6] text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-60"
                      title="Run real-time AI re-analysis on patient logs"
                    >
                      <Sparkles className={`w-4 h-4 ${isRefreshingAI ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingAI ? 'Re-Analyzing...' : 'Re-Run AI Analysis'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Recommended Activity Card & Clinical Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Column 1: Prescribed Game & Difficulty */}
                <div className="bg-white/95 rounded-2xl p-5 border-2 border-[#47D6B6] space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                      Prescribed Activity
                    </span>
                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                      Level: {recommendation.recommended_difficulty}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-slate-900">
                      {recommendation.recommended_game_title || recommendation.next_game_type.replace('_', ' ').toUpperCase()}
                    </h4>
                    {recommendation.cognitive_focus_domain && (
                      <p className="text-xs text-[#2794EB] font-bold">
                        🎯 Target: {recommendation.cognitive_focus_domain}
                      </p>
                    )}
                  </div>

                  {recommendation.patient_encouragement_message && (
                    <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200/70 text-xs text-blue-900 font-medium">
                      🗣️ <strong>Patient Script:</strong> "{recommendation.patient_encouragement_message}"
                    </div>
                  )}
                </div>

                {/* Column 2: Clinical Rationale */}
                <div className="bg-white/95 rounded-2xl p-5 border-2 border-[#47D6B6] space-y-2 shadow-2xs">
                  <span className="text-xs font-black uppercase text-slate-500 tracking-wider block">
                    Clinical AI Rationale
                  </span>
                  <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                    {recommendation.clinical_reasoning || recommendation.rationale}
                  </p>
                  {recommendation.expected_therapeutic_benefit && (
                    <div className="pt-2 border-t border-slate-100 text-xs text-emerald-800 font-bold">
                      🌱 <strong>Therapeutic Goal:</strong> {recommendation.expected_therapeutic_benefit}
                    </div>
                  )}
                </div>

                {/* Column 3: Caregiver Actionable Tip */}
                <div className="bg-white/95 rounded-2xl p-5 border-2 border-[#47D6B6] space-y-2 shadow-2xs">
                  <span className="text-xs font-black uppercase text-slate-500 tracking-wider block">
                    Caregiver Co-Play Strategy
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                    {recommendation.caregiver_actionable_tip || 'Encourage the patient with gentle praise, allowing sufficient response time without rushing.'}
                  </p>
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic">
                    {recommendation.ethical_disclaimer || 'Cognitive engagement tool — not a medical substitute.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasGamingData && analysis ? (
            <>
              {/* 1. Transparent Gaming Score Breakdown Card */}
              <div className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-sm space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-slate-200 pb-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-[#47D6B6] text-[#0F172A] font-black text-xs uppercase tracking-wider">
                        {t.patient_game_analytics}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {currentPatient?.name || 'Patient'} • {analysis.total_games_played} {t.sessions_evaluated}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-[#1E293B]">
                      {t.cognitive_perf_index}
                    </h3>
                    <p className="text-xs text-slate-600 font-medium max-w-2xl">
                      {t.eval_subtext}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border-2 border-[#47D6B6] shrink-0 shadow-2xs">
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        {t.total_gaming_score}
                      </span>
                      <div className="text-4xl font-black text-[#1E293B] flex items-baseline justify-center gap-1">
                        <span>{analysis.gaming_score}</span>
                        <span className="text-base font-bold text-slate-400">/ 100</span>
                      </div>
                    </div>
                    <div className="h-10 w-0.5 bg-slate-200" />
                    <div className="text-left space-y-1">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider inline-block ${
                        analysis.trend_direction === 'improving'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : analysis.trend_direction === 'attention_needed'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-blue-100 text-blue-900 border border-blue-300'
                      }`}>
                        {analysis.trend_direction === 'improving' ? t.trajectory_improving : analysis.trend_direction === 'attention_needed' ? t.trajectory_attention_needed : t.trajectory_stable}
                      </span>
                      <p className="text-[11px] font-bold text-slate-600">
                        {analysis.total_stars} ⭐ {t.earned}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Score Formula Components (4 Pillars) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Accuracy Component */}
                  <div className="bg-white rounded-2xl p-4 border border-[#47D6B6] space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                        1. {t.recall_accuracy}
                      </span>
                      <Target className="w-4 h-4 text-[#2794EB]" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-[#1E293B]">
                        {analysis.score_breakdown.accuracy_pts}
                        <span className="text-xs text-slate-400 font-bold"> / 50 pts</span>
                      </span>
                      <span className="text-xs font-extrabold text-emerald-700">
                        {analysis.average_accuracy_pct}% avg
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-[#2794EB] h-full rounded-full transition-all"
                        style={{ width: `${(analysis.score_breakdown.accuracy_pts / 50) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      50% weight • {t.eval_subtext}
                    </p>
                  </div>

                  {/* Speed Agility Component */}
                  <div className="bg-white rounded-2xl p-4 border border-[#47D6B6] space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                        2. {t.reaction_speed_title}
                      </span>
                      <Clock className="w-4 h-4 text-[#47D6B6]" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-[#1E293B]">
                        {analysis.score_breakdown.speed_pts}
                        <span className="text-xs text-slate-400 font-bold"> / 25 pts</span>
                      </span>
                      <span className="text-xs font-extrabold text-[#1E293B]">
                        {analysis.average_response_time_sec}s avg
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-[#47D6B6] h-full rounded-full transition-all"
                        style={{ width: `${(analysis.score_breakdown.speed_pts / 25) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      25% weight • {t.reaction_speed}
                    </p>
                  </div>

                  {/* Focus & Error Control */}
                  <div className="bg-white rounded-2xl p-4 border border-[#47D6B6] space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                        3. {t.focus_precision}
                      </span>
                      <Zap className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-[#1E293B]">
                        {analysis.score_breakdown.focus_pts}
                        <span className="text-xs text-slate-400 font-bold"> / 15 pts</span>
                      </span>
                      <span className="text-xs font-extrabold text-slate-600">
                        {analysis.total_mistakes} total slips
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all"
                        style={{ width: `${(analysis.score_breakdown.focus_pts / 15) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      15% weight • {t.formula_transparent}
                    </p>
                  </div>

                  {/* Completion & Consistency */}
                  <div className="bg-white rounded-2xl p-4 border border-[#47D6B6] space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                        4. {t.completion_title}
                      </span>
                      <Award className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-[#1E293B]">
                        {analysis.score_breakdown.completion_pts}
                        <span className="text-xs text-slate-400 font-bold"> / 10 pts</span>
                      </span>
                      <span className="text-xs font-extrabold text-emerald-700">
                        100% finished
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${(analysis.score_breakdown.completion_pts / 10) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      10% weight • {t.formula_transparent}
                    </p>
                  </div>
                </div>

                {/* Cognitive Findings Summary Callout */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h5 className="text-sm font-black text-emerald-950">
                        {t.clinical_analysis_note}
                      </h5>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        {analysis.clinical_insight} {analysis.speed_analysis}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-black uppercase text-slate-500 block">
                      {t.recommended_next_game}
                    </span>
                    <span className="text-xs font-black text-[#0F172A] bg-white px-3 py-1 rounded-full border border-[#47D6B6] inline-block shadow-2xs">
                      {analysis.recommended_game.title}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Domain-by-Domain Cognitive Health Grid */}
              <div className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-black text-[#1E293B] flex items-center gap-2">
                      <Brain className="w-5 h-5 text-[#2794EB]" />
                      <span>{t.domain_breakdown_title}</span>
                    </h3>
                    <p className="text-slate-500 text-xs font-medium">
                      {t.domain_breakdown_subtitle}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">
                    {t.live_domain_tracking}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.domain_breakdown.map((domain) => (
                    <div 
                      key={domain.game_type}
                      className="bg-white rounded-2xl p-5 border-2 border-slate-200 hover:border-[#47D6B6] transition-all space-y-3 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                            {domain.domain}
                          </span>
                          <h4 className="text-base font-black text-[#1E293B]">
                            {domain.game_title}
                          </h4>
                        </div>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
                          domain.sessions_count === 0
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : domain.status === 'strong'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : domain.status === 'steady'
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                          {domain.sessions_count === 0 ? 'Unplayed' : domain.status.replace('_', ' ')}
                        </span>
                      </div>

                      {domain.sessions_count > 0 ? (
                        <div className="space-y-2 pt-1 border-t border-slate-100">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-600">Accuracy:</span>
                            <span className="text-[#1E293B] font-black">{domain.accuracy}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-[#2794EB] h-full rounded-full"
                              style={{ width: `${domain.accuracy}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-1">
                            <span>Response Speed:</span>
                            <span className="text-[#1E293B] font-mono">{domain.avg_response_time}s</span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                            <span>Games Played:</span>
                            <span className="text-[#1E293B] font-mono">{domain.sessions_count} sessions</span>
                          </div>

                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed pt-2 border-t border-slate-100">
                            {domain.analysis}
                          </p>
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <p className="text-xs text-slate-500 italic">
                            No games recorded in this domain yet.
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            Starting this activity will provide baseline data for {domain.domain.toLowerCase()}.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Interactive Progression Charts */}
              <div className="space-y-6">
                {/* Accuracy Trend vs Baseline */}
                <div className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-black text-[#1E293B]">
                        {t.game_accuracy_trend}
                      </h3>
                      <p className="text-slate-500 text-xs font-medium">
                        Session-by-session accuracy compared against {currentPatient?.name.split(' ')[0] || 'Patient'}'s empirical baseline ({analysis.average_accuracy_pct}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-[#2794EB]">
                        <span className="w-3 h-3 rounded-full bg-[#2794EB]" /> Session Accuracy
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <span className="w-3 h-0.5 bg-slate-400" /> Baseline ({analysis.average_accuracy_pct}%)
                      </span>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                        <YAxis domain={[30, 100]} stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: '2px solid #47D6B6',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="accuracy"
                          stroke="#2794EB"
                          strokeWidth={3}
                          dot={{ r: 5, fill: '#1E293B' }}
                          activeDot={{ r: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="baseline"
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Response Time & Activity Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Response Time Trend */}
                  <div className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-sm space-y-4">
                    <div>
                      <h3 className="text-xl font-black text-[#1E293B]">
                        {t.avg_response_time_sec}
                      </h3>
                      <p className="text-slate-500 text-xs font-medium">
                        Patient motor planning & reaction latency across gameplay sessions
                      </p>
                    </div>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              borderRadius: '16px',
                              border: '2px solid #47D6B6',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="response_time"
                            stroke="#47D6B6"
                            strokeWidth={3}
                            dot={{ r: 5, fill: '#2794EB' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Games Played Distribution */}
                  <div className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-sm space-y-4">
                    <div>
                      <h3 className="text-xl font-black text-[#1E293B]">
                        {t.cognitive_participation}
                      </h3>
                      <p className="text-slate-500 text-xs font-medium">
                        Distribution of cultural game activities completed by {currentPatient?.name.split(' ')[0] || 'Patient'}
                      </p>
                    </div>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="game" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              borderRadius: '16px',
                              border: '2px solid #47D6B6',
                            }}
                          />
                          <Bar dataKey="count" fill="#47D6B6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Session-by-Session Scorecard Log */}
              {analysis.recent_sessions_summary && analysis.recent_sessions_summary.length > 0 && (
                <div className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-black text-[#1E293B]">
                        {t.recent_scorecards}
                      </h3>
                      <p className="text-slate-500 text-xs font-medium">
                        Direct empirical logs of each completed game session
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">
                      {analysis.recent_sessions_summary.length} Recent Logs
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                    {analysis.recent_sessions_summary.map((sess) => (
                      <div key={sess.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                            <Gamepad2 className="w-5 h-5 text-[#2794EB]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-black text-sm text-[#1E293B]">
                                {sess.game_title}
                              </h5>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold uppercase">
                                {sess.difficulty_level}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 font-medium">
                              {sess.date}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                          <div className="text-center sm:text-right">
                            <span className="text-[10px] text-slate-400 uppercase block font-black">Accuracy</span>
                            <span className="text-sm font-black text-[#1E293B]">{sess.accuracy}%</span>
                          </div>
                          <div className="text-center sm:text-right">
                            <span className="text-[10px] text-slate-400 uppercase block font-black">Speed</span>
                            <span className="text-sm font-mono text-[#1E293B]">{sess.response_time}s</span>
                          </div>
                          <div className="text-center sm:text-right">
                            <span className="text-[10px] text-slate-400 uppercase block font-black">Mistakes</span>
                            <span className="text-sm font-bold text-slate-600">{sess.mistakes}</span>
                          </div>
                          <div className="text-center sm:text-right">
                            <span className="text-[10px] text-slate-400 uppercase block font-black">Stars</span>
                            <span className="text-sm text-amber-500">{'★'.repeat(sess.stars || 3)}</span>
                          </div>
                          <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-black">
                            {sess.note}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#FAFAFA] rounded-[32px] p-8 md:p-12 border-2 border-amber-200 text-center space-y-5 shadow-sm">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 border-2 border-amber-300 flex items-center justify-center mx-auto text-amber-700">
                <Gamepad2 className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-2xl font-black text-[#1E293B]">
                  {t.no_sessions_title}
                </h3>
                <p className="text-slate-600 text-sm font-medium leading-relaxed">
                  {t.no_sessions_desc}
                </p>
                <p className="text-xs text-slate-500 italic">
                  Once {currentPatient?.name.split(' ')[0] || 'the patient'} completes a game activity (e.g. Memory Match, Picture Recognition, or Sequence Recall), live accuracy trajectories, domain breakdowns, and clinical cognitive observations will generate automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Reminder Management (Schedule Reminders - Caregiver Access Only) */}
      {activeTab === 'reminders' && (
        <ScheduleRemindersManager
          currentPatient={currentPatient}
          allPatients={allPatients}
          onSwitchPatient={onSwitchPatient}
          reminders={reminders}
          onAddReminder={onAddReminder}
          onDeleteReminder={onDeleteReminder}
          onToggleReminder={onToggleReminder}
          onTriggerAlarm={onTriggerAlarm}
          caregiverName={caregiverUser.name}
          language={currentLang}
        />
      )}

      {/* TAB 3: Alerts & Safety Logs */}
      {activeTab === 'alerts' && (
        <div className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-sm space-y-6">
          <div>
            <h3 className="text-xl font-black text-[#1E293B]">
              {t.alerts_title}
            </h3>
            <p className="text-slate-500 text-xs font-medium">
              {t.alerts_subtitle}
            </p>
          </div>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-slate-500 text-sm py-6 text-center font-medium">
                {t.no_alerts}
              </p>
            ) : (
              alerts.map((al) => (
                <div
                  key={al.id}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-4 ${
                    al.resolved
                      ? 'bg-white border-slate-200 text-slate-400'
                      : al.type === 'sos'
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : 'bg-white border-[#47D6B6] text-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2.5 rounded-xl ${
                        al.type === 'sos' ? 'bg-rose-200 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-black uppercase ${
                            al.type === 'sos'
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {al.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {new Date(al.triggered_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#1E293B] pt-1">
                        {al.message}
                      </p>
                    </div>
                  </div>

                  {!al.resolved ? (
                    <button
                      onClick={() => onResolveAlert(al.id)}
                      className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-black shadow-sm cursor-pointer"
                    >
                      {t.acknowledge_resolve}
                    </button>
                  ) : (
                    <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> {t.resolved}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Familiar People Management */}
      {activeTab === 'people' && (
        <div className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-[#1E293B]">
                {t.loved_ones_title}
              </h3>
              <p className="text-slate-500 text-xs font-medium">
                {t.loved_ones_subtitle.replace('{name}', currentPatient.name.split(' ')[0])}
              </p>
            </div>

            <button
              onClick={() => setShowAddPersonModal(true)}
              style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-black text-sm border border-[#47D6B6] shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>{t.add_family_member}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {familiarPeople.map((person) => (
              <div
                key={person.id}
                className="p-4 rounded-2xl border-2 border-[#47D6B6]/40 flex items-start justify-between gap-4 hover:border-[#47D6B6] transition-colors bg-white shadow-2xs"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={person.photo_url}
                    alt={person.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#47D6B6] shrink-0"
                  />
                  <div>
                    <h4 className="text-base font-black text-[#1E293B]">
                      {person.name}
                    </h4>
                    <span className="text-xs font-black text-[#2794EB]">
                      {person.relation}
                    </span>
                    {person.notes && (
                      <p className="text-xs text-slate-600 pt-1 font-medium">
                        {person.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      soundEffects.playGentleTap();
                      downloadPhoto(person.photo_url, `${person.name.toLowerCase().replace(/\s+/g, '-')}-${person.relation.toLowerCase().replace(/\s+/g, '-')}.jpg`);
                      soundEffects.playSuccessChime();
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors"
                    title="Download family photograph"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onDeleteFamiliarPerson(person.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                    title="Remove person"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Reminder Modal */}
      {showAddReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-[32px] p-6 border-2 border-[#47D6B6] shadow-2xl space-y-5">
            <h3 className="text-2xl font-black text-[#1E293B]">
              {t.create_new_reminder}
            </h3>

            <form onSubmit={handleCreateReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  {t.reminder_title}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Blood Pressure Medication, Hydration"
                  value={remTitle}
                  onChange={(e) => setRemTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    {t.category}
                  </label>
                  <select
                    value={remType}
                    onChange={(e) => setRemType(e.target.value as ReminderType)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                  >
                    <option value="medication">Medication</option>
                    <option value="meal">Meal / Tea</option>
                    <option value="exercise">Gentle Walk</option>
                    <option value="appointment">Doctor Visit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    {t.scheduled_time}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 09:30 AM"
                    value={remTime}
                    onChange={(e) => setRemTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  {t.recurrence}
                </label>
                <select
                  value={remRecurrence}
                  onChange={(e) => setRemRecurrence(e.target.value as RecurrenceType)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="as_needed">As Needed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Gentle Instructions for Patient
                </label>
                <input
                  type="text"
                  placeholder="e.g. Take with warm water after morning tea"
                  value={remInstructions}
                  onChange={(e) => setRemInstructions(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddReminderModal(false)}
                  className="px-4 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 text-sm hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  className="px-4 py-3 rounded-xl text-white font-black text-sm border border-[#47D6B6] shadow-xs hover:brightness-105 active:scale-95 cursor-pointer"
                >
                  {t.save_reminder}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Familiar Person Modal */}
      {showAddPersonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-[32px] p-6 border-2 border-[#47D6B6] shadow-2xl space-y-5">
            <h3 className="text-2xl font-black text-[#1E293B]">
              {t.add_family_member}
            </h3>

            <form onSubmit={handleCreatePerson} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  {t.full_name}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nilav Barua"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  {t.relationship}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grandson (नाति)"
                  value={personRelation}
                  onChange={(e) => setPersonRelation(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Photo URL (or Unsplash URL)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={personPhoto}
                  onChange={(e) => setPersonPhoto(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Personal Memory Note / Story
                </label>
                <input
                  type="text"
                  placeholder="e.g. Studies in college, visits every Sunday with pitha"
                  value={personNotes}
                  onChange={(e) => setPersonNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98640 12345"
                  value={personPhone}
                  onChange={(e) => setPersonPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2794EB] text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPersonModal(false)}
                  className="px-4 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 text-sm hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  className="px-4 py-3 rounded-xl text-white font-black text-sm border border-[#47D6B6] shadow-xs hover:brightness-105 active:scale-95 cursor-pointer"
                >
                  {t.save_loved_one}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {/* Direct Connect Assigned Patient Modal */}
      {isConnectModalOpen && onConnectPatient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-[#47D6B6] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-black text-slate-800">
                  Connect Assigned Senior
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsConnectModalOpen(false);
                  setLinkStatusMessage('');
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Enter the patient's User ID (e.g. <span className="font-mono font-bold text-slate-800">user-1788728777084</span>), phone number, or full name to link their profile to your caregiver dashboard.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Patient ID / Name / Phone"
                value={patientLinkInput}
                onChange={(e) => setPatientLinkInput(e.target.value)}
                className="w-full px-4 py-3 text-sm font-bold rounded-xl border border-slate-300 bg-slate-50 outline-none focus:border-[#47D6B6] focus:bg-white"
              />

              {linkStatusMessage && (
                <p className={`text-xs font-bold p-2.5 rounded-xl ${linkStatusMessage.includes('Success') || linkStatusMessage.includes('connected') ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>
                  {linkStatusMessage}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsConnectModalOpen(false);
                    setLinkStatusMessage('');
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isLinkingPatient || !patientLinkInput.trim()}
                  onClick={handleDirectConnectPatient}
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  className="px-4 py-2.5 rounded-xl text-white font-black text-xs border border-[#47D6B6] shadow-xs hover:brightness-105 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isLinkingPatient ? 'Linking...' : 'Connect Patient'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
