import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Pill, 
  Coffee, 
  Brain, 
  Phone, 
  Utensils, 
  Footprints, 
  Stethoscope, 
  Droplets, 
  Volume2, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  Sparkles, 
  Check, 
  ShieldCheck, 
  Info,
  ChevronRight,
  Filter,
  Activity,
  UserCheck
} from 'lucide-react';
import { 
  Reminder, 
  ReminderType, 
  RecurrenceType, 
  ReminderPriority, 
  User,
  RegionalLanguage
} from '../../types';
import { soundEffects, speakText } from '../../utils/speechAndAudio';
import { Bell } from 'lucide-react';
import { CAREGIVER_TRANSLATIONS } from '../../data/caregiverTranslations';
import { computeMedicationStatus, getStatusBadgeConfig } from '../../utils/medicationScheduler';

interface ScheduleRemindersManagerProps {
  currentPatient: User;
  allPatients: User[];
  onSwitchPatient: (patientId: string) => void;
  reminders: Reminder[];
  onAddReminder: (reminder: Omit<Reminder, 'id' | 'created_at' | 'completed'>) => void;
  onDeleteReminder: (id: string) => void;
  onToggleReminder: (id: string) => void;
  onUpdateReminder?: (id: string, updates: Partial<Reminder>) => void;
  onTriggerAlarm?: (reminder: Reminder) => void;
  caregiverName?: string;
  language?: RegionalLanguage;
}

// Culturally resonant NER reminder templates for instant scheduling
const PRESET_TEMPLATES: {
  title: string;
  type: ReminderType;
  time: string;
  recurrence: RecurrenceType;
  priority: ReminderPriority;
  instructions: string;
  spokenPrompt: string;
  tag: string;
}[] = [
  {
    title: 'Morning Donepezil 5mg & Warm Milk',
    type: 'medication',
    time: '08:30 AM',
    recurrence: 'daily',
    priority: 'high',
    instructions: 'Take 1 tablet after light breakfast with lukewarm water or warm cow milk.',
    spokenPrompt: 'Dadaji, it is time for your morning memory medicine with breakfast.',
    tag: 'Prescription'
  },
  {
    title: 'Courtyard Garden Walk & Sunshine',
    type: 'exercise',
    time: '07:30 AM',
    recurrence: 'daily',
    priority: 'gentle',
    instructions: '15 minutes gentle strolling in the garden near the Tulsi plant with walking stick.',
    spokenPrompt: 'Good morning! Let us take a peaceful walk in the garden under the gentle sun.',
    tag: 'Mobility'
  },
  {
    title: 'Midday Hydration (Coconut Water / ORS)',
    type: 'hydration',
    time: '11:30 AM',
    recurrence: 'daily',
    priority: 'medium',
    instructions: 'Drink a glass of fresh tender coconut water or lemon-honey water to prevent MCI dehydration.',
    spokenPrompt: 'Time to drink some refreshing cool water or coconut water.',
    tag: 'Hydration'
  },
  {
    title: 'Traditional Lunch: Fish Curry & Rice',
    type: 'meal',
    time: '01:00 PM',
    recurrence: 'daily',
    priority: 'medium',
    instructions: 'Light Borali fish with fresh herbs and steamed Joha rice. Soft chew texture.',
    spokenPrompt: 'Lunch is served with warm soup and fish curry.',
    tag: 'Nutrition'
  },
  {
    title: 'Afternoon Memory Match with Grandkids',
    type: 'memory_game',
    time: '03:30 PM',
    recurrence: 'daily',
    priority: 'gentle',
    instructions: 'Open Smaran Sathi and play 2 rounds of Kaziranga Memory Match cards together.',
    spokenPrompt: 'Time for your favorite memory match game! Let us match the colorful flowers and birds.',
    tag: 'Cognitive'
  },
  {
    title: 'Veranda CTC Assam Tea & Roasted Pitha',
    type: 'chai_time',
    time: '05:00 PM',
    recurrence: 'daily',
    priority: 'gentle',
    instructions: 'Mild sweet ginger CTC tea and light rice pitha while watching the evening birds.',
    spokenPrompt: 'Tea time is ready on the veranda. Enjoy a warm cup of Assam tea.',
    tag: 'Reminiscence'
  },
  {
    title: 'Weekly Phone Call with Daughter (Bangalore)',
    type: 'family_call',
    time: '07:00 PM',
    recurrence: 'weekly',
    priority: 'medium',
    instructions: 'Video call on WhatsApp with daughter Anamika and 4-year-old granddaughter Hiya.',
    spokenPrompt: 'Anamika is calling from Bangalore! Let us talk to your granddaughter.',
    tag: 'Family'
  },
  {
    title: 'Dr. Hazarika Monthly Memory Checkup',
    type: 'appointment',
    time: '11:00 AM',
    recurrence: 'weekly',
    priority: 'high',
    instructions: 'Clinic visit at Silpukhuri Memory Care Unit. Bring cognitive session log from app.',
    spokenPrompt: 'Appointment with Dr. Hazarika today for regular wellness checkup.',
    tag: 'Clinical'
  }
];

export const ScheduleRemindersManager: React.FC<ScheduleRemindersManagerProps> = ({
  currentPatient,
  allPatients,
  onSwitchPatient,
  reminders,
  onAddReminder,
  onDeleteReminder,
  onToggleReminder,
  onTriggerAlarm,
  caregiverName = 'Caregiver',
  language = 'en',
}) => {
  const t = CAREGIVER_TRANSLATIONS[language] || CAREGIVER_TRANSLATIONS.en;
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'medication' | 'routine' | 'today'>('all');

  // Quick 1-minute test reminder scheduler so caregiver can see alarm sound in real-time
  const handleScheduleOneMinuteTest = () => {
    soundEffects.playGentleTap(520);
    const future = new Date(Date.now() + 60 * 1000);
    let hours = future.getHours();
    const minutes = future.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const timeStr = `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;

    onAddReminder({
      user_id: currentPatient.id,
      title: '🔔 Live Alarm Test: Evening Assam Tea & Tonic',
      type: 'chai_time',
      time: timeStr,
      recurrence: 'once',
      priority: 'high',
      audio_chime: true,
      instructions: 'Take warm ginger tea. Continuous background scheduler will sound the chime when clock strikes!',
      spoken_prompt: `Dadaji, it is ${timeStr}. Time for your warm tea and memory rest.`,
      created_by: caregiverName,
    });
  };
  
  // Schedule Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ReminderType>('medication');
  const [medicationName, setMedicationName] = useState('Donepezil');
  const [dosage, setDosage] = useState('5mg (1 Tablet)');
  const [frequency, setFrequency] = useState('Once Daily (Morning)');
  const [time, setTime] = useState('08:30 AM');
  const [customTime, setCustomTime] = useState('08:30');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('daily');
  const [priority, setPriority] = useState<ReminderPriority>('high');
  const [instructions, setInstructions] = useState('Take with warm water after breakfast.');
  const [spokenPrompt, setSpokenPrompt] = useState('');
  const [audioChime, setAudioChime] = useState(true);
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSuccessMessage, setFormSuccessMessage] = useState('');

  // Apply a quick preset template
  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    soundEffects.playGentleTap(520);
    setTitle(preset.title);
    setType(preset.type);
    if (preset.type === 'medication') {
      setMedicationName(preset.title.split(' ')[1] || preset.title);
      setDosage('5mg (1 Tablet)');
      setFrequency('Once Daily');
    }
    setTime(preset.time);
    setRecurrence(preset.recurrence);
    setPriority(preset.priority);
    setInstructions(preset.instructions);
    setSpokenPrompt(preset.spokenPrompt);
    setShowScheduleForm(true);
  };

  // Convert HTML5 time (HH:MM) to AM/PM format
  const handleTimeChange = (rawTime: string) => {
    setCustomTime(rawTime);
    if (!rawTime) return;
    const [hoursStr, minutesStr] = rawTime.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = minutesStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formatted = `${hours < 10 ? '0' + hours : hours}:${minutes} ${ampm}`;
    setTime(formatted);
  };

  // Submit Schedule Form
  const handleSubmitSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = type === 'medication' && medicationName.trim()
      ? (dosage.trim() ? `${medicationName.trim()} - ${dosage.trim()}` : medicationName.trim())
      : title.trim();

    if (!finalTitle) return;

    soundEffects.playSuccessChime();

    const isMed = type === 'medication';
    const spoken = spokenPrompt.trim() || 
      (isMed 
        ? `${currentPatient.name.split(' ')[0]}, it is time for your medicine: ${medicationName || finalTitle} ${dosage ? '(' + dosage + ')' : ''}. ${instructions}` 
        : finalTitle);

    onAddReminder({
      user_id: currentPatient.id,
      type,
      title: finalTitle,
      time,
      recurrence,
      instructions: instructions.trim(),
      created_by: caregiverName,
      scheduled_date: scheduledDate,
      priority: isMed ? (priority || 'high') : priority,
      audio_chime: audioChime,
      spoken_prompt: spoken,
      // MMS Specific Tagging
      is_caregiver_scheduled: isMed ? true : undefined,
      source: 'caregiver',
      caregiver_id: currentPatient.connected_caregiver_id || 'caregiver',
      caregiver_name: caregiverName,
      medication_name: isMed ? (medicationName.trim() || finalTitle) : undefined,
      dosage: isMed ? dosage.trim() : undefined,
      frequency: isMed ? frequency.trim() : undefined,
      scheduled_times: [time]
    });

    setFormSuccessMessage(`Scheduled "${finalTitle}" successfully for ${currentPatient.name}!`);
    setTitle('');
    setMedicationName('');
    setDosage('');
    setInstructions('');
    setSpokenPrompt('');
    setTimeout(() => {
      setFormSuccessMessage('');
      setShowScheduleForm(false);
    }, 1800);
  };

  // Filter reminders
  const filteredReminders = reminders.filter((r) => {
    if (activeFilter === 'medication') return r.type === 'medication';
    if (activeFilter === 'routine') return r.type !== 'medication' && r.type !== 'appointment';
    return true;
  });

  const getReminderIcon = (t: ReminderType) => {
    switch (t) {
      case 'medication':
        return <Pill className="w-5 h-5 text-rose-500" />;
      case 'meal':
        return <Utensils className="w-5 h-5 text-amber-500" />;
      case 'exercise':
        return <Footprints className="w-5 h-5 text-emerald-500" />;
      case 'hydration':
        return <Droplets className="w-5 h-5 text-cyan-500" />;
      case 'memory_game':
        return <Brain className="w-5 h-5 text-indigo-500" />;
      case 'chai_time':
        return <Coffee className="w-5 h-5 text-orange-500" />;
      case 'family_call':
        return <Phone className="w-5 h-5 text-purple-500" />;
      case 'appointment':
        return <Stethoscope className="w-5 h-5 text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const completedCount = reminders.filter(r => r.completed).length;
  const adherenceRate = reminders.length > 0 ? Math.round((completedCount / reminders.length) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Caregiver Access Header & Security Notice */}
      <div
        style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
        className="rounded-[32px] p-6 md:p-8 shadow-sm border-2 border-[#47D6B6] text-white"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/95 border-2 border-[#47D6B6] flex items-center justify-center text-[#2794EB] shadow-sm shrink-0">
              <CalendarIcon className="w-7 h-7 text-[#2794EB]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl md:text-3xl font-black text-white">
                  {t.scheduler_title || 'Caregiver Routine & Reminder Scheduler'}
                </h2>
                <span className="px-3 py-1 rounded-full bg-white/90 text-[#2794EB] border border-[#47D6B6] text-xs font-black flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  {t.cg_access_granted || 'Caregiver Access Granted'}
                </span>
              </div>
              <p className="text-sm font-bold text-white/90 mt-1">
                {t.authorized_caregiver || 'Authorized caregiver'}: <strong className="text-white">{caregiverName}</strong>. {t.reminders_sync_note || "Scheduled reminders automatically sync to the elderly user's tablet with voice readout and audio chimes."}
              </p>
            </div>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="quick-1min-alarm-test-btn"
              onClick={handleScheduleOneMinuteTest}
              className="px-4 py-3.5 rounded-2xl bg-white/95 hover:bg-white text-[#1E293B] font-black text-xs md:text-sm border border-[#47D6B6] flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
              title="Schedules a reminder for 1 minute from now to test live sound notification"
            >
              <Bell className="w-4 h-4 text-[#2794EB]" />
              <span>{t.quick_alarm_test || '⚡ Set 1-Min Alarm Test'}</span>
            </button>

            {/* Quick Schedule Button */}
            <button
              id="open-schedule-form-btn"
              onClick={() => {
                soundEffects.playGentleTap(500);
                setShowScheduleForm(!showScheduleForm);
              }}
              className="px-6 py-3.5 rounded-2xl bg-[#1E293B] hover:bg-slate-800 text-white font-black text-sm md:text-base flex items-center justify-center gap-2 border border-slate-700 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-5 h-5" />
              <span>{showScheduleForm ? (t.close_scheduler || 'Close Scheduler') : (t.schedule_new_routine || '➕ Schedule New Routine')}</span>
            </button>
          </div>
        </div>

        {/* Patient Switcher for Scheduling */}
        <div className="mt-6 pt-5 border-t border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-white/90">
              {t.assigned_patients}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {allPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    soundEffects.playGentleTap(450);
                    onSwitchPatient(p.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    p.id === currentPatient.id
                      ? 'bg-[#1E293B] text-white shadow-sm'
                      : 'bg-white/90 hover:bg-white text-slate-800 border border-white/60'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Adherence Mini Badge */}
          <div className="flex items-center gap-3 text-xs font-bold text-[#1E293B] bg-white/95 px-4 py-2 rounded-xl border border-white/60">
            <span>{t.daily_adherence}:</span>
            <span className="text-sm font-black text-emerald-800">
              {completedCount} / {reminders.length} ({adherenceRate}%)
            </span>
          </div>
        </div>
      </div>

      {/* Preset Cultural Templates (One-Click Auto-Fill) */}
      <div className="bg-[#FAFAFA] rounded-[32px] p-6 border-2 border-[#47D6B6] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg md:text-xl font-black text-gray-900">
              {t.one_click_presets || 'One-Click Regional Routine Presets'}
            </h3>
          </div>
          <span className="text-xs font-bold text-gray-500 hidden sm:inline">
            {t.tap_to_load || 'Tap to load into scheduler'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(tmpl)}
              className="p-3.5 rounded-2xl border-2 border-yellow-100 hover:border-amber-400 bg-yellow-50/50 hover:bg-yellow-50 text-left transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                    {tmpl.tag}
                  </span>
                  <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    {tmpl.time}
                  </span>
                </div>
                <h4 className="text-sm font-black text-gray-900 group-hover:text-amber-900 leading-snug">
                  {tmpl.title}
                </h4>
                <p className="text-xs text-gray-600 font-medium line-clamp-2">
                  {tmpl.instructions}
                </p>
              </div>

              <div className="pt-2 mt-2 border-t border-yellow-200/60 flex items-center justify-between text-xs font-black text-amber-700">
                <span>{t.use_template || 'Use Template'}</span>
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* SCHEDULE FORM ACCORDION */}
      {showScheduleForm && (
        <form onSubmit={handleSubmitSchedule} className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-md space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-xl font-black text-[#1E293B]">
                Schedule Routine for {currentPatient.name}
              </h3>
              <p className="text-xs font-bold text-slate-500">
                Define the timing, recurrence, and voice readout prompts
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowScheduleForm(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {formSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 font-black text-sm text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{formSuccessMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category / Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                Category / Routine Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ReminderType)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#47D6B6] focus:outline-none font-bold text-sm text-gray-900 bg-white cursor-pointer"
              >
                <option value="medication">💊 Medication Dose (MMS Tracked)</option>
                <option value="meal">🍲 Meal / Nutrition</option>
                <option value="exercise">🚶 Physical Activity / Courtyard Walk</option>
                <option value="hydration">💧 Hydration / Coconut Water</option>
                <option value="memory_game">🧠 Cognitive Game Play Session</option>
                <option value="chai_time">☕ Chai Time & Relaxation</option>
                <option value="family_call">📞 Family Audio / Video Call</option>
                <option value="appointment">🩺 Medical / Doctor Consultation</option>
              </select>
            </div>

            {/* Title / Name */}
            {type === 'medication' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-rose-700">
                  Medication Name *
                </label>
                <input
                  type="text"
                  required
                  value={medicationName}
                  onChange={(e) => {
                    setMedicationName(e.target.value);
                    setTitle(e.target.value);
                  }}
                  placeholder="e.g. Donepezil / Memantine / Metformin"
                  className="w-full px-4 py-3 rounded-xl border-2 border-rose-300 focus:border-rose-500 focus:outline-none font-bold text-sm text-gray-900 bg-rose-50/30"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                  Reminder Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Afternoon CTC Tea & Garden Stroll"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#47D6B6] focus:outline-none font-bold text-sm text-gray-900"
                />
              </div>
            )}

            {/* If medication: Dosage & Frequency */}
            {type === 'medication' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-rose-700">
                    Dosage / Strength *
                  </label>
                  <input
                    type="text"
                    required
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. 5mg (1 Tablet) / 10ml"
                    className="w-full px-4 py-3 rounded-xl border-2 border-rose-200 focus:border-rose-500 focus:outline-none font-bold text-sm text-gray-900 bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-rose-700">
                    Frequency / Interval *
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-rose-200 focus:border-rose-500 focus:outline-none font-bold text-sm text-gray-900 bg-white cursor-pointer"
                  >
                    <option value="Once Daily (Morning)">Once Daily (Morning)</option>
                    <option value="Once Daily (Night)">Once Daily (Night / Bedtime)</option>
                    <option value="Twice Daily (Morning & Evening)">Twice Daily (Morning & Evening)</option>
                    <option value="Thrice Daily (After Meals)">Thrice Daily (After Meals)</option>
                    <option value="Every 8 Hours">Every 8 Hours</option>
                    <option value="As Needed (PRN)">As Needed (PRN)</option>
                  </select>
                </div>
              </>
            )}

            {/* Time Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                Scheduled Time ({time})
              </label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#47D6B6] focus:outline-none font-bold text-sm text-gray-900 bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleTimeChange('08:00')}
                  className="px-2.5 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                >
                  8 AM
                </button>
                <button
                  type="button"
                  onClick={() => handleTimeChange('13:00')}
                  className="px-2.5 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                >
                  1 PM
                </button>
                <button
                  type="button"
                  onClick={() => handleTimeChange('17:00')}
                  className="px-2.5 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                >
                  5 PM
                </button>
                <button
                  type="button"
                  onClick={() => handleTimeChange('20:30')}
                  className="px-2.5 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                >
                  8:30 PM
                </button>
              </div>
            </div>

            {/* Recurrence */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                Recurrence Schedule
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#47D6B6] focus:outline-none font-bold text-sm text-gray-900 bg-white cursor-pointer"
              >
                <option value="daily">Everyday (Daily Routine)</option>
                <option value="weekdays">Weekdays (Monday to Friday)</option>
                <option value="weekly">Once a Week</option>
                <option value="as_needed">As Needed (PRN)</option>
                <option value="specific_time">Specific One-time Date</option>
              </select>
            </div>

            {/* Priority Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                Priority / Urgency
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPriority('gentle')}
                  className={`py-2.5 rounded-xl font-black text-xs transition-all border-2 cursor-pointer ${
                    priority === 'gentle'
                      ? 'bg-teal-500 text-white border-teal-600 shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  🌱 Gentle
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('medium')}
                  className={`py-2.5 rounded-xl font-black text-xs transition-all border-2 cursor-pointer ${
                    priority === 'medium'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  ⭐ Standard
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('high')}
                  className={`py-2.5 rounded-xl font-black text-xs transition-all border-2 cursor-pointer ${
                    priority === 'high'
                      ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  🚨 High Alert
                </button>
              </div>
            </div>

            {/* Audio Voice Chime */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                Notification Sound & Audio
              </label>
              <div className="flex items-center gap-3 p-2.5 rounded-xl border-2 border-gray-200 bg-gray-50">
                <input
                  type="checkbox"
                  id="audio-chime-checkbox"
                  checked={audioChime}
                  onChange={(e) => setAudioChime(e.target.checked)}
                  className="w-5 h-5 accent-[#2794EB] rounded cursor-pointer"
                />
                <label htmlFor="audio-chime-checkbox" className="text-xs font-bold text-gray-800 cursor-pointer">
                  Play gentle melodic bell & read aloud in patient's preferred language
                </label>
              </div>
            </div>
          </div>

          {/* Spoken Voice Readout Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-[#2794EB]" />
                Spoken Voice Guidance (Read Aloud by TTS)
              </label>
              <button
                type="button"
                onClick={() => {
                  const toSpeak = spokenPrompt.trim() || title.trim() || 'This is a test of your scheduled reminder prompt.';
                  speakText(toSpeak, currentPatient.language_pref);
                }}
                className="text-xs font-black text-[#2794EB] hover:text-[#17B3C1] bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Preview Audio</span>
              </button>
            </div>
            <input
              type="text"
              value={spokenPrompt}
              onChange={(e) => setSpokenPrompt(e.target.value)}
              placeholder={`e.g. ${currentPatient.name.split(' ')[0]}, it is time for your warm tea and memory medicine.`}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-[#47D6B6] focus:outline-none font-medium text-sm text-gray-900"
            />
          </div>

          {/* Caregiver Detailed Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-gray-700">
              Caregiver Clinical & Family Notes
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Ensure patient is seated upright. Take with half a glass of lukewarm water. Check pulse if sluggish."
              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-[#47D6B6] focus:outline-none font-medium text-sm text-gray-900"
            />
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowScheduleForm(false)}
              className="px-5 py-3 rounded-xl border border-gray-300 font-bold text-gray-700 text-sm hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
              className="px-6 py-3 rounded-xl text-white font-black text-sm border border-[#47D6B6] shadow-xs hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save & Publish Reminder to {currentPatient.name.split(' ')[0]}'s Screen</span>
            </button>
          </div>
        </form>
      )}

      {/* ALL SCHEDULED REMINDERS LIST */}
      <div className="bg-[#FAFAFA] rounded-[32px] p-6 md:p-8 border-2 border-[#47D6B6] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-[#1E293B]">
              {t.active_schedules_title || 'Active Schedules & Reminders'} ({filteredReminders.length})
            </h3>
            <p className="text-xs font-bold text-slate-500">
              {t.configured_routines_for || 'Currently configured routines for'} {currentPatient.name}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {t.filter_all || 'All'} ({reminders.length})
            </button>
            <button
              onClick={() => setActiveFilter('medication')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                activeFilter === 'medication'
                  ? 'bg-[#2794EB] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {t.filter_medications || '💊 Medications'}
            </button>
            <button
              onClick={() => setActiveFilter('routine')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                activeFilter === 'routine'
                  ? 'bg-[#47D6B6] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {t.filter_routines || '🗓️ Daily Routines'}
            </button>
          </div>
        </div>

        {filteredReminders.length === 0 ? (
          <div className="p-8 text-center bg-orange-50/50 rounded-2xl border-2 border-dashed border-orange-200 space-y-3">
            <Clock className="w-10 h-10 text-orange-400 mx-auto" />
            <h4 className="text-base font-black text-gray-800">
              {t.no_reminders_filter || 'No scheduled reminders matching this filter'}
            </h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {t.no_reminders_filter_sub || `Use the "Schedule New Routine" button or choose one of the regional presets above to add daily reminders for ${currentPatient.name}.`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section 1: Caregiver-Scheduled Medications (Distinct MMS Section) */}
            {(activeFilter === 'all' || activeFilter === 'medication') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                      <Pill className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      Caregiver-Scheduled Prescriptions & Medications
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                    {filteredReminders.filter(r => r.type === 'medication' || r.is_caregiver_scheduled).length} Prescriptions Active
                  </span>
                </div>

                {filteredReminders.filter(r => r.type === 'medication' || r.is_caregiver_scheduled).length === 0 ? (
                  <div className="p-4 rounded-2xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-400 font-bold">
                    No caregiver-scheduled medications found. Use the scheduler above to add prescriptions.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredReminders.filter(r => r.type === 'medication' || r.is_caregiver_scheduled).map((rem) => {
                      const status = computeMedicationStatus(rem);
                      const badge = getStatusBadgeConfig(status);

                      return (
                        <div
                          key={rem.id}
                          className={`p-4 rounded-2xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                            rem.completed
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : status === 'missed'
                              ? 'bg-red-50/60 border-red-300'
                              : status === 'due'
                              ? 'bg-amber-50/60 border-amber-300 shadow-sm'
                              : 'bg-white border-rose-100 hover:border-rose-200 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start gap-3.5">
                            <button
                              onClick={() => {
                                soundEffects.playGentleTap(500);
                                onToggleReminder(rem.id);
                              }}
                              className="mt-0.5 text-emerald-600 focus:outline-none cursor-pointer"
                              title={rem.completed ? 'Mark pending' : 'Mark completed / taken'}
                            >
                              {rem.completed ? (
                                <CheckCircle2 className="w-7 h-7 fill-emerald-100 text-emerald-600" />
                              ) : (
                                <Circle className="w-7 h-7 text-gray-300 hover:text-emerald-500" />
                              )}
                            </button>

                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                                  <Pill className="w-4 h-4" />
                                </div>
                                <h4 className={`text-base font-black ${rem.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {rem.medication_name || rem.title}
                                </h4>

                                {rem.dosage && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                                    💊 {rem.dosage}
                                  </span>
                                )}

                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {rem.time}
                                </span>

                                {/* MMS Live Adherence Status Badge */}
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border flex items-center gap-1 ${badge.bg}`}>
                                  <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                                  <span>{badge.label}</span>
                                </span>
                              </div>

                              {rem.instructions && (
                                <p className="text-xs text-slate-700 font-medium pl-1">
                                  📝 <strong>Instructions:</strong> {rem.instructions}
                                </p>
                              )}

                              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-bold pl-1 pt-0.5 flex-wrap">
                                <span className="flex items-center gap-1 text-slate-700">
                                  <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                                  Scheduled by: <strong className="text-teal-700">{rem.caregiver_name || rem.created_by || caregiverName}</strong>
                                </span>
                                {rem.frequency && (
                                  <span>• Frequency: <strong>{rem.frequency}</strong></span>
                                )}
                                {rem.spoken_prompt && (
                                  <span className="text-orange-800 italic">
                                    "🗣️ {rem.spoken_prompt}"
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                soundEffects.playGentleTap(520);
                                if (onTriggerAlarm) {
                                  onTriggerAlarm(rem);
                                } else {
                                  const text = rem.spoken_prompt || rem.title;
                                  speakText(text, currentPatient.language_pref);
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:translate-y-0.5 cursor-pointer"
                              title="Test Alarm Sound & Voice Notification"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              <span>Test Alarm</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const text = rem.spoken_prompt || rem.title;
                                speakText(text, currentPatient.language_pref);
                              }}
                              className="p-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 cursor-pointer transition-colors"
                              title="Test Voice Readout"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                soundEffects.playGentleTap(350);
                                onDeleteReminder(rem.id);
                              }}
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer transition-colors"
                              title="Cancel / Delete Prescription"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Other Daily Routines & Activities */}
            {(activeFilter === 'all' || activeFilter === 'routine') && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-teal-100 text-teal-700">
                      <Clock className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      Daily Routines, Hydration & Wellness Schedules
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    {filteredReminders.filter(r => r.type !== 'medication' && !r.is_caregiver_scheduled).length} Routines Active
                  </span>
                </div>

                {filteredReminders.filter(r => r.type !== 'medication' && !r.is_caregiver_scheduled).length === 0 ? (
                  <div className="p-4 rounded-2xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-400 font-bold">
                    No daily routines matching this filter.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredReminders.filter(r => r.type !== 'medication' && !r.is_caregiver_scheduled).map((rem) => (
                      <div
                        key={rem.id}
                        className={`p-4 rounded-2xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                          rem.completed
                            ? 'bg-emerald-50/50 border-emerald-200 opacity-80'
                            : rem.priority === 'high'
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <button
                            onClick={() => {
                              soundEffects.playGentleTap(500);
                              onToggleReminder(rem.id);
                            }}
                            className="mt-0.5 text-emerald-600 focus:outline-none cursor-pointer"
                            title={rem.completed ? 'Mark pending' : 'Mark completed'}
                          >
                            {rem.completed ? (
                              <CheckCircle2 className="w-7 h-7 fill-emerald-100 text-emerald-600" />
                            ) : (
                              <Circle className="w-7 h-7 text-gray-300 hover:text-emerald-500" />
                            )}
                          </button>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="p-1.5 rounded-lg bg-gray-50 border border-gray-200">
                                {getReminderIcon(rem.type)}
                              </div>
                              <h4 className={`text-base font-black ${rem.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                {rem.title}
                              </h4>
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-orange-100 text-orange-800 border border-orange-200">
                                {rem.time}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 uppercase">
                                {rem.recurrence}
                              </span>
                              {rem.priority === 'high' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                  Urgent
                                </span>
                              )}
                            </div>

                            {rem.instructions && (
                              <p className="text-xs text-gray-600 font-medium pl-1">
                                {rem.instructions}
                              </p>
                            )}

                            <div className="flex items-center gap-3 text-[11px] text-gray-400 font-bold pl-1 pt-0.5">
                              <span>By: {rem.created_by || 'Caregiver'}</span>
                              {rem.spoken_prompt && (
                                <span className="text-orange-700 italic">
                                  "🗣️ {rem.spoken_prompt}"
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              soundEffects.playGentleTap(520);
                              if (onTriggerAlarm) {
                                onTriggerAlarm(rem);
                              } else {
                                const text = rem.spoken_prompt || rem.title;
                                speakText(text, currentPatient.language_pref);
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:translate-y-0.5 cursor-pointer"
                            title="Test Alarm Sound & Voice Notification"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>Test Alarm</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const text = rem.spoken_prompt || rem.title;
                              speakText(text, currentPatient.language_pref);
                            }}
                            className="p-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 cursor-pointer transition-colors"
                            title="Test Voice Readout"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              soundEffects.playGentleTap(350);
                              onDeleteReminder(rem.id);
                            }}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer transition-colors"
                            title="Delete Reminder"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
