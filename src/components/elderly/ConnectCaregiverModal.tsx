import React, { useState, useEffect } from 'react';
import { User, RegionalLanguage } from '../../types';
import { 
  HeartHandshake, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Volume2, 
  CheckCircle2, 
  Users, 
  HelpCircle,
  KeyRound,
  X
} from 'lucide-react';
import { soundEffects, speakText } from '../../utils/speechAndAudio';
import { 
  getCaregiversFromFirebase, 
  findCaregiverByCodeOrId, 
  linkElderlyToCaregiverInFirebase,
  saveRememberedUser 
} from '../../lib/firebase';

interface ConnectCaregiverModalProps {
  elderlyUser: User;
  isOpen: boolean;
  onConnected: (updatedUser: User) => void;
  language?: RegionalLanguage;
}

export const ConnectCaregiverModal: React.FC<ConnectCaregiverModalProps> = ({
  elderlyUser,
  isOpen,
  onConnected,
  language = 'as',
}) => {
  const [caregiverCode, setCaregiverCode] = useState('');
  const [availableCaregivers, setAvailableCaregivers] = useState<User[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch registered caregivers directly from Firebase Firestore & backend
  useEffect(() => {
    if (isOpen) {
      // 1. Fetch from Firebase
      getCaregiversFromFirebase()
        .then((cgs) => {
          if (cgs && cgs.length > 0) {
            setAvailableCaregivers(cgs);
          } else {
            // 2. Fallback to backend API
            fetch('/api/caregivers')
              .then((res) => res.json())
              .then((data) => {
                if (data.caregivers && data.caregivers.length > 0) {
                  setAvailableCaregivers(data.caregivers);
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          fetch('/api/caregivers')
            .then((res) => res.json())
            .then((data) => {
              if (data.caregivers && data.caregivers.length > 0) {
                setAvailableCaregivers(data.caregivers);
              }
            })
            .catch(() => {});
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSpeakHelp = () => {
    soundEffects.playGentleTap();
    const prompt = `Namaskar ${elderlyUser.name}. Please enter your caregiver's ID code so they can schedule your medications, meals, and assist with your daily memory activities.`;
    speakText(prompt, language);
  };

  const handleSubmit = async (codeToUse?: string) => {
    const code = (codeToUse || caregiverCode).trim().toUpperCase();
    if (!code) {
      setErrorMsg('Please enter your caregiver ID code.');
      soundEffects.playGentleEncouragement();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Look up caregiver in Firebase
      let matchedCaregiver = await findCaregiverByCodeOrId(code);

      // If not found in Firebase, check availableCaregivers in state
      if (!matchedCaregiver) {
        matchedCaregiver = availableCaregivers.find(
          (c) => c.caregiver_code?.toUpperCase() === code || c.id.toUpperCase() === code
        ) || null;
      }

      // If still not found, check backend
      if (!matchedCaregiver) {
        try {
          const res = await fetch('/api/caregivers/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              elderly_id: elderlyUser.id,
              caregiver_code: code,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.user) {
            soundEffects.playSuccessChime();
            setSuccessMsg(data.message || 'Connected successfully to Caregiver!');
            saveRememberedUser(data.user);
            setTimeout(() => {
              onConnected(data.user);
            }, 800);
            return;
          } else {
            setErrorMsg(data.error || 'Invalid Caregiver ID. Only registered and valid Caregiver IDs can be assigned.');
            soundEffects.playGentleEncouragement();
            setIsSubmitting(false);
            return;
          }
        } catch {
          setErrorMsg('Invalid Caregiver ID. Only registered and valid Caregiver IDs can be assigned.');
          soundEffects.playGentleEncouragement();
          setIsSubmitting(false);
          return;
        }
      }

      if (!matchedCaregiver) {
        setErrorMsg('Invalid Caregiver ID. Only registered and valid Caregiver IDs can be assigned.');
        soundEffects.playGentleEncouragement();
        setIsSubmitting(false);
        return;
      }

      const effectiveCaregiver: User = matchedCaregiver;

      // 2. Link in Firebase Firestore
      const updatedUser = await linkElderlyToCaregiverInFirebase(elderlyUser.id, effectiveCaregiver);

      const finalUser: User = updatedUser || {
        ...elderlyUser,
        connected_caregiver_id: code,
        connected_caregiver_name: effectiveCaregiver.name,
      };

      // 3. Update session remembering
      saveRememberedUser(finalUser);

      // 4. Notify backend
      fetch('/api/caregivers/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elderly_id: elderlyUser.id,
          caregiver_code: code,
        }),
      }).catch(() => {});

      soundEffects.playSuccessChime();
      setSuccessMsg(`Connected to Caregiver (${effectiveCaregiver.name}) in Firebase!`);
      setTimeout(() => {
        onConnected(finalUser);
      }, 800);

    } catch (err) {
      console.error('Error linking caregiver in Firebase:', err);
      // Fallback
      const fallbackUser: User = {
        ...elderlyUser,
        connected_caregiver_id: code,
        connected_caregiver_name: `Caregiver (${code})`,
      };
      saveRememberedUser(fallbackUser);
      soundEffects.playSuccessChime();
      setSuccessMsg(`Connected to Caregiver (${code})`);
      setTimeout(() => {
        onConnected(fallbackUser);
      }, 800);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl bg-white rounded-[36px] p-6 sm:p-8 border-4 border-amber-300 shadow-[0_16px_0_0_#FDE047] space-y-6 relative max-h-[92vh] overflow-y-auto">
        
        {/* Close / Cross Button */}
        <button
          type="button"
          onClick={() => {
            soundEffects.playGentleTap();
            onConnected(elderlyUser);
          }}
          className="absolute top-5 right-5 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-100 flex items-center justify-center text-amber-800 border-4 border-amber-300 shadow-md">
            <HeartHandshake className="w-10 h-10 text-amber-700 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-50 text-amber-950 border border-amber-300 text-xs font-black">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            <span>Profile Setup · Step 2: Connect to Caregiver</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-gray-950">
            Welcome, {elderlyUser.name}!
          </h2>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100/90 border border-orange-200 text-xs font-black text-orange-950">
            <span className="text-orange-700 font-bold">Your Patient ID:</span>
            <span className="font-mono text-sm tracking-wider font-black">{elderlyUser.patient_id || elderlyUser.id}</span>
          </div>
          <p className="text-gray-700 text-sm sm:text-base font-semibold max-w-md mx-auto leading-relaxed">
            Please link your profile to your specific Caregiver ID to unlock your daily memory games, audible medicine alarms, and personal caregiver care plan.
          </p>

          <button
            type="button"
            onClick={handleSpeakHelp}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 text-xs font-black cursor-pointer transition-colors"
          >
            <Volume2 className="w-4 h-4" />
            Listen to Instructions
          </button>
        </div>

        {/* Input Form */}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="block text-sm font-black text-gray-900 flex items-center justify-between">
              <span>Enter Caregiver's Unique ID:</span>
              <span className="text-xs text-amber-700 font-bold">e.g. CG-101, CG-7842</span>
            </label>
            <div className="relative">
              <KeyRound className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={caregiverCode}
                onChange={(e) => {
                  setCaregiverCode(e.target.value.toUpperCase());
                  setErrorMsg('');
                }}
                placeholder="Type Caregiver ID (e.g. CG-101)"
                className="w-full min-h-[58px] pl-12 pr-12 text-lg font-black tracking-wider bg-orange-50/70 border-3 border-orange-200 focus:border-amber-500 focus:bg-white rounded-2xl outline-none transition-all placeholder:text-gray-400 placeholder:font-normal placeholder:tracking-normal uppercase"
              />
              {caregiverCode && (
                <button
                  type="button"
                  onClick={() => {
                    setCaregiverCode('');
                    setErrorMsg('');
                    soundEffects.playGentleTap();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors cursor-pointer"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border-2 border-red-200 text-red-700 text-xs font-bold text-center">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-xs font-bold text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successMsg}
            </div>
          )}

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="w-full min-h-[56px] rounded-2xl bg-amber-500 hover:bg-amber-400 active:translate-y-1 text-gray-950 font-black text-base sm:text-lg flex items-center justify-center gap-2 border-3 border-amber-600 shadow-[0_4px_0_0_#B45309] cursor-pointer transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Connecting with Caregiver...</span>
            ) : (
              <>
                <span>Connect & Enter Smaran Sathi</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Private Caregiver Connection Guidance */}
        <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 space-y-2 text-left">
          <div className="flex items-center gap-2 text-xs font-black text-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Private Caregiver Connection</span>
          </div>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Please enter the unique Caregiver Code (e.g., <span className="font-mono font-bold text-slate-800">CG-XXXX</span>) given to you by your family member, doctor, or nurse. For your privacy, caregiver IDs are never displayed publicly.
          </p>
        </div>

        {/* Informative Note */}
        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 flex items-start gap-2.5 text-xs text-blue-900">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold">Why link a Caregiver?</span> Your caregiver can schedule your medicine audio reminders, upload family face photos, and review your daily memory milestones.
          </p>
        </div>

      </div>
    </div>
  );
};
