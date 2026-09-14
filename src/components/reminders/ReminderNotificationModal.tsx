import React, { useEffect, useState, useRef } from 'react';
import { 
  Reminder, 
  RegionalLanguage, 
  ReminderType 
} from '../../types';
import { 
  Bell, 
  Volume2, 
  CheckCircle2, 
  Clock, 
  X, 
  Pill, 
  Coffee, 
  Brain, 
  Phone, 
  Utensils, 
  Footprints, 
  Stethoscope, 
  Droplets, 
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { 
  soundEffects, 
  triggerReminderAudioAlarm, 
  stopSpeaking 
} from '../../utils/speechAndAudio';

interface ReminderNotificationModalProps {
  reminder: Reminder | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (reminderId: string) => void;
  onSnooze?: (reminderId: string, minutes: number) => void;
  language?: RegionalLanguage;
  patientName?: string;
}

export const ReminderNotificationModal: React.FC<ReminderNotificationModalProps> = ({
  reminder,
  isOpen,
  onClose,
  onComplete,
  onSnooze,
  language = 'as',
  patientName = 'Dadaji',
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const cleanupAudioRef = useRef<(() => void) | null>(null);

  const startAlarmSound = () => {
    if (!reminder) return;
    if (cleanupAudioRef.current) {
      cleanupAudioRef.current();
    }

    setIsPlayingAudio(true);
    const spokenText = reminder.spoken_prompt || 
      (reminder.type === 'medication'
        ? `${patientName ? patientName + ', ' : ''}it is time for your medicine: ${reminder.title} at ${reminder.time}. Scheduled by your caregiver ${reminder.created_by || 'Caregiver'}. ${reminder.instructions || 'Please take it with water.'}`
        : `${patientName ? patientName + ', ' : ''}it is time for ${reminder.title}. ${reminder.instructions || ''}`);

    cleanupAudioRef.current = triggerReminderAudioAlarm(
      reminder.title,
      spokenText,
      reminder.priority || 'medium',
      language,
      () => {
        setIsPlayingAudio(false);
      }
    );
  };

  useEffect(() => {
    if (isOpen && reminder) {
      startAlarmSound();
    }

    return () => {
      if (cleanupAudioRef.current) {
        cleanupAudioRef.current();
      }
      stopSpeaking();
    };
  }, [isOpen, reminder?.id]);

  if (!isOpen || !reminder) return null;

  const handleComplete = () => {
    if (cleanupAudioRef.current) cleanupAudioRef.current();
    stopSpeaking();
    soundEffects.playSuccessChime();
    onComplete(reminder.id);
    onClose();
  };

  const handleSnooze = () => {
    if (cleanupAudioRef.current) cleanupAudioRef.current();
    stopSpeaking();
    soundEffects.playGentleTap(520);
    if (onSnooze) {
      onSnooze(reminder.id, 5);
    }
    onClose();
  };

  const handleDismiss = () => {
    if (cleanupAudioRef.current) cleanupAudioRef.current();
    stopSpeaking();
    onClose();
  };

  const getIconForType = (type: ReminderType) => {
    switch (type) {
      case 'medication':
        return <Pill className="w-10 h-10 text-rose-600" />;
      case 'meal':
        return <Utensils className="w-10 h-10 text-amber-600" />;
      case 'exercise':
        return <Footprints className="w-10 h-10 text-emerald-600" />;
      case 'hydration':
        return <Droplets className="w-10 h-10 text-cyan-600" />;
      case 'memory_game':
        return <Brain className="w-10 h-10 text-indigo-600" />;
      case 'chai_time':
        return <Coffee className="w-10 h-10 text-orange-600" />;
      case 'family_call':
        return <Phone className="w-10 h-10 text-purple-600" />;
      case 'appointment':
        return <Stethoscope className="w-10 h-10 text-blue-600" />;
      default:
        return <Clock className="w-10 h-10 text-amber-600" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
    >
      <div className="w-full max-w-lg bg-white rounded-[36px] border-4 border-amber-400 p-6 md:p-8 shadow-[0_16px_0_0_#F59E0B] relative overflow-hidden space-y-6 animate-scale-up">
        {/* Soft Ambient Background Glow */}
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-200/50 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-orange-200/40 rounded-full blur-2xl pointer-events-none" />

        {/* Top Dismiss Icon */}
        <button
          onClick={handleDismiss}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-amber-100 text-gray-500 cursor-pointer transition-colors"
          title="Dismiss Alarm"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Center Chime & Category Header */}
        <div className="text-center space-y-3 pt-2">
          {/* Pulsating Bell / Category Icon */}
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 rounded-3xl bg-amber-400/30 animate-ping" />
            <div className="relative w-20 h-20 rounded-3xl bg-amber-100 border-3 border-amber-300 flex items-center justify-center shadow-md">
              {getIconForType(reminder.type)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-white shadow-sm">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>{reminder.is_caregiver_scheduled ? 'Caregiver-Scheduled Routine' : 'Routine Reminder'} · {reminder.time}</span>
            </div>
            <h2 
              id="reminder-modal-title"
              className="text-2xl sm:text-3xl font-black text-gray-950 leading-tight"
            >
              {reminder.medication_name || reminder.title}
            </h2>

            {reminder.dosage && (
              <div className="mt-1 inline-block">
                <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-xs font-black">
                  💊 Dosage: {reminder.dosage}
                </span>
              </div>
            )}

            {reminder.is_caregiver_scheduled && (
              <p className="text-xs text-teal-800 font-bold mt-1">
                👨‍⚕️ Prescribed by: <span className="text-teal-950">{reminder.caregiver_name || reminder.created_by || 'Caregiver'}</span>
              </p>
            )}
          </div>
        </div>

        {/* Audio Status & Wave Indicator */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white ${isPlayingAudio ? 'bg-orange-500 animate-pulse' : 'bg-amber-600'}`}>
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-amber-950 block">
                {isPlayingAudio ? 'Melodic Chime & Voice Playing' : 'Voice Prompt Ready'}
              </span>
              <span className="text-[11px] text-amber-800 font-bold block">
                Audio notification enabled
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={startAlarmSound}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:translate-y-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay Sound</span>
          </button>
        </div>

        {/* Instructions / Spoken Prompt Details */}
        {(reminder.instructions || reminder.spoken_prompt) && (
          <div className="p-4 rounded-2xl bg-gray-50 border-2 border-gray-200 text-left space-y-1">
            {reminder.instructions && (
              <p className="text-sm font-bold text-gray-800">
                📝 <strong>Note:</strong> {reminder.instructions}
              </p>
            )}
            {reminder.spoken_prompt && (
              <p className="text-xs text-orange-800 font-medium italic pt-1">
                🗣️ "{reminder.spoken_prompt}"
              </p>
            )}
          </div>
        )}

        {/* Action Buttons: Accessible & Clear */}
        <div className="space-y-3 pt-2">
          {/* Main Completion Action */}
          <button
            id="alarm-mark-completed-btn"
            type="button"
            onClick={handleComplete}
            className="w-full min-h-[58px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-[0_6px_0_0_#047857] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer border-2 border-emerald-700"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-200" />
            <span>✓ Mark as Taken / Completed</span>
          </button>

          {/* Secondary Actions: Snooze & Dismiss */}
          <div className="grid grid-cols-2 gap-3">
            <button
              id="alarm-snooze-btn"
              type="button"
              onClick={handleSnooze}
              className="min-h-[48px] rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-xs sm:text-sm border border-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Clock className="w-4 h-4" />
              <span>Snooze (5 Mins)</span>
            </button>

            <button
              id="alarm-dismiss-btn"
              type="button"
              onClick={handleDismiss}
              className="min-h-[48px] rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs sm:text-sm border border-gray-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
