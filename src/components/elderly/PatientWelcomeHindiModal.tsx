import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UserCheck, 
  Building2, 
  MapPin, 
  Briefcase, 
  Volume2, 
  CheckCircle2, 
  Sparkles,
  Clock
} from 'lucide-react';
import { User } from '../../types';
import { soundEffects, speakText } from '../../utils/speechAndAudio';

interface PatientWelcomeHindiModalProps {
  patient: User | null;
  isOpen: boolean;
  onClose: () => void;
  durationSeconds?: number;
}

export const PatientWelcomeHindiModal: React.FC<PatientWelcomeHindiModalProps> = ({
  patient,
  isOpen,
  onClose,
  durationSeconds = 15,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(durationSeconds);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasSpokenRef = useRef(false);

  // Fallback helper
  const getFieldOrFallback = (val?: string | null): string => {
    if (!val || val.trim() === '') {
      return 'जानकारी उपलब्ध नहीं है';
    }
    return val.trim();
  };

  const patientName = getFieldOrFallback(patient?.name);
  const patientId = getFieldOrFallback(patient?.patient_id || patient?.id);
  const patientDepartment = getFieldOrFallback(patient?.department);
  const patientBranch = getFieldOrFallback(patient?.branch || patient?.location);
  const patientCity = getFieldOrFallback(patient?.city || patient?.location);
  const patientOccupation = getFieldOrFallback(patient?.occupation);

  // Timer Countdown Effect
  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(durationSeconds);
      hasSpokenRef.current = false;
      return;
    }

    setSecondsRemaining(durationSeconds);
    soundEffects.playGentleChime(560);

    // Auto-read welcome in Hindi once
    if (!hasSpokenRef.current && patient?.name) {
      hasSpokenRef.current = true;
      const speechMsg = `नमस्ते, ${patient.name} जी। आप एक पंजीकृत मरीज़ हैं। अस्पताल डैशबोर्ड में आपका स्वागत है।`;
      speakText(speechMsg, 'hi');
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isOpen, durationSeconds, onClose, patient?.name]);

  const handleSpeak = () => {
    setIsSpeaking(true);
    const speechMsg = `नमस्ते, ${patientName} जी। आप एक पंजीकृत मरीज़ हैं। विभाग: ${patientDepartment}। शाखा: ${patientBranch}। शहर: ${patientCity}। पेशा: ${patientOccupation}।`;
    speakText(speechMsg, 'hi');
    setTimeout(() => setIsSpeaking(false), 4000);
  };

  if (!isOpen || !patient) return null;

  const progressPercent = (secondsRemaining / durationSeconds) * 100;

  return (
    <div 
      id="patient-welcome-hindi-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto transition-opacity duration-300 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEffects.playGentleTap();
          onClose();
        }
      }}
    >
      <div
        id="patient-welcome-hindi-modal-card"
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-blue-100 overflow-hidden text-slate-900 my-8 transform transition-all duration-300 scale-100 animate-scaleUp"
      >
        {/* Top 15-Second Progress / Countdown Bar */}
        <div className="w-full bg-blue-100/70 h-2 relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Modal Header Banner (Hospital Blue Theme) */}
        <div className="px-6 pt-5 pb-4 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white flex items-start justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20 text-white shadow-inner shrink-0">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 text-blue-50 px-2.5 py-0.5 rounded-full border border-white/20">
                  मरीज़ सत्यापन एवं स्वागत
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold bg-emerald-500/30 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300/30">
                  <CheckCircle2 className="w-3 h-3" /> सक्रिय
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                अस्पताल पोर्टल में आपका स्वागत है
              </h3>
            </div>
          </div>

          {/* Small ✕ Close Button */}
          <button
            id="patient-welcome-modal-close-btn"
            onClick={() => {
              soundEffects.playGentleTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 ml-2"
            aria-label="बंद करें"
            title="बंद करें (Close)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Content (Large, Clean Hindi Typography) */}
        <div className="p-6 sm:p-7 space-y-5 bg-white">
          {/* Dynamic Greeting */}
          <div className="text-center sm:text-left border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight">
                नमस्ते, <span className="text-blue-600">{patientName}</span> जी
              </h2>
              <button
                onClick={handleSpeak}
                disabled={isSpeaking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 cursor-pointer transition-all active:scale-95"
                title="आवाज़ में सुनें"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isSpeaking ? 'सुनाया जा रहा है...' : 'आवाज़ सुनें'}</span>
              </button>
            </div>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50/80 border border-blue-200/80 text-blue-900 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>आप एक पंजीकृत मरीज़ हैं</span>
              <span className="text-xs text-blue-700 font-mono bg-white px-2 py-0.5 rounded-md border border-blue-200">
                ID: {patientId}
              </span>
            </div>
          </div>

          {/* Dynamic Details Sections */}
          <div className="space-y-3">
            {/* Department & Branch */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 mb-1">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>अस्पताल विभाग एवं शाखा विवरण</span>
              </div>
              <p className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                विभाग: <span className="text-blue-900">{patientDepartment}</span> | शाखा: <span className="text-blue-900">{patientBranch}</span>
              </p>
            </div>

            {/* City & Occupation/Work */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 mb-1">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>स्थान एवं व्यवसाय (कार्य)</span>
              </div>
              <div className="flex items-center gap-2 text-base sm:text-lg font-black text-slate-900 leading-snug">
                <span>शहर: <strong className="text-slate-800 font-black">{patientCity}</strong></span>
                <span className="text-slate-300">|</span>
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="w-4 h-4 text-slate-400 inline" />
                  कार्य: <strong className="text-slate-800 font-black">{patientOccupation}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Countdown Status & Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>यह संदेश <strong className="text-blue-700 font-mono text-sm">{secondsRemaining}</strong> सेकंड में स्वतः बंद हो जाएगा</span>
            </div>

            <button
              id="patient-welcome-modal-ok-btn"
              onClick={() => {
                soundEffects.playGentleTap();
                onClose();
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>डैशबोर्ड पर जाएं</span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-md font-mono">✕</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
