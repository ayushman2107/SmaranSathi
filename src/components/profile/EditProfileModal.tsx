import React, { useState } from 'react';
import { 
  X, 
  Camera, 
  User as UserIcon, 
  Phone, 
  MapPin, 
  Globe, 
  Calendar, 
  FileText, 
  Lock, 
  ShieldCheck, 
  Check, 
  Sparkles, 
  Heart, 
  AlertCircle,
  Stethoscope,
  Smile,
  Scan,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Download,
  Locate,
  Navigation,
  Loader2
} from 'lucide-react';
import { FaceRegistrationScanner } from '../auth/FaceRegistrationScanner';
import { User, RegionalLanguage, DementiaStage } from '../../types';
import { LANGUAGE_LABELS, UI_TRANSLATIONS } from '../../data/nerContent';
import { NER_STATES_DATA } from '../../data/nerLocations';
import { soundEffects } from '../../utils/speechAndAudio';
import { downloadPhoto } from '../../utils/downloadPhoto';
import { autoDetectLocation, DetectedLocationResult } from '../../utils/locationDetector';
import { 
  searchCaregiverByCodeOrName, 
  unlinkElderlyFromCaregiverInFirebase,
  findUserByPhoneNumber,
  normalizePhoneNumber
} from '../../lib/firebase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSave: (updatedUser: User) => Promise<void> | void;
}

const POPULAR_LOCATIONS = [
  'Guwahati, Assam',
  'Shillong, Meghalaya',
  'Dibrugarh, Assam',
  'Jorhat, Assam',
  'Imphal, Manipur',
  'Silchar, Assam',
  'Tezpur, Assam',
  'Kohima, Nagaland',
  'Aizawl, Mizoram',
  'Itanagar, Arunachal'
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
}) => {
  if (!isOpen) return null;

  const isElderly = user.role === 'elderly';

  // Form States
  const [name, setName] = useState(user.name || '');
  const [avatar, setAvatar] = useState(
    user.avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'
  );
  const [phone, setPhone] = useState(user.phone || '');
  const [location, setLocation] = useState(user.location || 'Guwahati, Assam');
  const [languagePref, setLanguagePref] = useState<RegionalLanguage>(user.language_pref || 'as');
  const [pin, setPin] = useState(user.pin || '1234');
  
  // Face ID Biometric States
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(user.face_descriptor || null);
  const [faceRegisteredAt, setFaceRegisteredAt] = useState<string | null>(user.face_registered_at || null);
  const [isFaceScannerOpen, setIsFaceScannerOpen] = useState(false);
  
  // Role-specific fields
  const patientId = user.patient_id || (user.role === 'elderly' ? `PT-${Math.floor(1000 + Math.random() * 9000)}` : '');
  const [age, setAge] = useState<number>(user.age || 72);
  const [diagnosisNote, setDiagnosisNote] = useState(user.diagnosis_note || '');
  const [dementiaStage, setDementiaStage] = useState<DementiaStage>(user.dementia_stage || 'mild');
  const [caregiverCode, setCaregiverCode] = useState(user.caregiver_code || '');
  const [emergencyName, setEmergencyName] = useState(user.emergency_contact?.name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(user.emergency_contact?.phone || '');
  const [emergencyRelation, setEmergencyRelation] = useState(user.emergency_contact?.relation || '');

  // Caregiver assignment & access control
  const [connectedCaregiverId, setConnectedCaregiverId] = useState(user.connected_caregiver_id || '');
  const [connectedCaregiverName, setConnectedCaregiverName] = useState(user.connected_caregiver_name || '');
  const [isChangingCaregiver, setIsChangingCaregiver] = useState(false);
  const [caregiverInputCode, setCaregiverInputCode] = useState('');
  const [caregiverStatusMsg, setCaregiverStatusMsg] = useState('');
  const [isVerifyingCaregiver, setIsVerifyingCaregiver] = useState(false);

  // Automatic Location Identification
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [autoDetectedInfo, setAutoDetectedInfo] = useState<DetectedLocationResult | null>(null);

  const handleAutoDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const result = await autoDetectLocation();
      if (result) {
        setLocation(result.formattedLocation || `${result.cityName}, ${result.stateName}`);
        setAutoDetectedInfo(result);
        soundEffects.playSuccessChime();
      }
    } catch (err) {
      console.warn('Auto location detection failed:', err);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Handle assigning caregiver code
  const handleAssignCaregiver = async () => {
    if (!caregiverInputCode.trim()) {
      setCaregiverStatusMsg('Please enter a Caregiver ID (e.g. CG-2125).');
      return;
    }
    setIsVerifyingCaregiver(true);
    setCaregiverStatusMsg('');
    try {
      const matched = await searchCaregiverByCodeOrName(caregiverInputCode.trim());
      if (matched) {
        setConnectedCaregiverId(matched.caregiver_code || matched.id);
        setConnectedCaregiverName(matched.name);
        setCaregiverStatusMsg(`Caregiver ${matched.name} found and assigned! Save profile to confirm.`);
        setIsChangingCaregiver(false);
        setCaregiverInputCode('');
        soundEffects.playSuccessChime();
      } else {
        // Allow manual code assignment if caregiver will sign up later
        const code = caregiverInputCode.trim().toUpperCase();
        setConnectedCaregiverId(code);
        setConnectedCaregiverName('Assigned Caregiver');
        setCaregiverStatusMsg(`Code ${code} saved as your assigned caregiver. Save profile to confirm.`);
        setIsChangingCaregiver(false);
        setCaregiverInputCode('');
        soundEffects.playGentleTap();
      }
    } catch (e) {
      console.warn('Error looking up caregiver:', e);
      setConnectedCaregiverId(caregiverInputCode.trim().toUpperCase());
      setConnectedCaregiverName('Assigned Caregiver');
      setIsChangingCaregiver(false);
    } finally {
      setIsVerifyingCaregiver(false);
    }
  };

  // Handle removing assigned caregiver
  const handleUnassignCaregiver = async () => {
    soundEffects.playGentleTap();
    setConnectedCaregiverId('');
    setConnectedCaregiverName('');
    setCaregiverStatusMsg('Caregiver unassigned. Save profile to update permissions.');
    try {
      await unlinkElderlyFromCaregiverInFirebase(user.id);
      fetch('/api/caregivers/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elderly_id: user.id })
      }).catch(() => {});
    } catch (e) {
      console.warn('Error unlinking in Firebase:', e);
    }
  };

  // UI feedback & saving states
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Name cannot be empty.');
      return;
    }
    if (!pin || pin.length < 4) {
      setErrorMessage('Please enter a valid 4-digit PIN.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    // Check phone number uniqueness if modified
    if (phone.trim()) {
      const cleanPhone = normalizePhoneNumber(phone);
      if (cleanPhone.length >= 10) {
        const existingWithPhone = await findUserByPhoneNumber(cleanPhone, user.id);
        if (existingWithPhone && existingWithPhone.id !== user.id) {
          setErrorMessage(
            `This phone number (+91 ${cleanPhone.slice(-10)}) is already registered to ${existingWithPhone.name}. Only one user can register per phone number.`
          );
          setIsSaving(false);
          soundEffects.playGentleEncouragement();
          return;
        }
      }
    }

    const updatedUser: User = {
      ...user,
      name: name.trim(),
      avatar,
      language_pref: languagePref,
      pin: pin.slice(-4),
      age: Number(age) || (isElderly ? 72 : 35),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(diagnosisNote.trim() ? { diagnosis_note: diagnosisNote.trim() } : {}),
      ...(isElderly ? { 
        patient_id: user.patient_id || patientId,
        dementia_stage: dementiaStage,
        connected_caregiver_id: connectedCaregiverId.trim() || undefined,
        connected_caregiver_name: connectedCaregiverName.trim() || undefined,
      } : {}),
      ...(!isElderly && (caregiverCode.trim() || user.caregiver_code) ? { caregiver_code: caregiverCode.trim() || user.caregiver_code } : {}),
      ...((emergencyName.trim() && emergencyPhone.trim()) ? {
        emergency_contact: {
          name: emergencyName.trim(),
          phone: emergencyPhone.trim(),
          relation: emergencyRelation.trim() || 'Family Member'
        }
      } : (user.emergency_contact ? { emergency_contact: user.emergency_contact } : {})),
      face_descriptor: faceDescriptor && faceDescriptor.length > 0 ? faceDescriptor : null,
      face_registered_at: faceDescriptor && faceDescriptor.length > 0 ? (faceRegisteredAt || new Date().toISOString()) : null,
    };

    try {
      await onSave(updatedUser);
      soundEffects.playSuccessChime();
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setErrorMessage('Could not update profile. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div 
        id="edit-profile-dialog"
        className="relative w-full max-w-2xl bg-white rounded-[32px] border-4 border-[#47D6B6] shadow-2xl my-8 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div 
          className="flex items-center justify-between px-6 py-5 text-white border-b-3 border-[#17B3C1]"
          style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Edit Profile & Face ID
              </h2>
              <p className="text-xs sm:text-sm font-bold text-white/80">
                {isElderly ? 'Senior Companion Account' : 'Caregiver Specialist Account'}
              </p>
            </div>
          </div>

          <button
            id="close-edit-profile-btn"
            type="button"
            onClick={() => {
              soundEffects.playGentleTap();
              onClose();
            }}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer transition-colors border border-white/30"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-gray-800">
          
          {/* 1. Biometric Profile Photo (Synced with Face Authentication) */}
          <div className="bg-stone-50 rounded-3xl p-5 border-2 border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#2794EB]" />
                Profile Photo
              </label>
              {faceDescriptor && faceDescriptor.length > 0 ? (
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Face ID Photo
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-0.5 rounded-full border border-slate-300">
                  Standard Photo
                </span>
              )}
            </div>

            {/* Current Avatar Preview & Face ID Sync explanation */}
            <div className="flex flex-col sm:flex-row items-center gap-5 bg-white p-4 rounded-2xl border-2 border-stone-200 shadow-2xs">
              <div className="relative shrink-0">
                <img
                  src={avatar}
                  alt={name || 'Avatar'}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-[#47D6B6] shadow-md bg-stone-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80';
                  }}
                />
                {faceDescriptor && faceDescriptor.length > 0 && (
                  <div 
                    className="absolute -bottom-2 -right-2 p-1.5 rounded-xl text-white shadow-md border-2 border-white"
                    style={{ backgroundColor: '#2794EB' }}
                    title="Face Biometrics Verified"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-2.5">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center justify-center sm:justify-start gap-1.5">
                    <span>Face Authentication Profile Photo</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#2794EB]" />
                  </h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mt-0.5">
                    Your profile photo is automatically updated and synced when you authenticate your face or re-enroll your Face ID biometrics.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playGentleTap();
                      setIsFaceScannerOpen(true);
                    }}
                    className="py-2.5 px-4 rounded-xl text-white font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer shadow-2xs hover:shadow-md transition-all active:scale-98 border border-[#47D6B6]"
                    style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  >
                    <Camera className="w-4 h-4 text-white" />
                    <span>Scan Face to Update</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playGentleTap();
                      downloadPhoto(avatar, `${(name || 'profile').toLowerCase().replace(/\s+/g, '-')}-photo.jpg`);
                      soundEffects.playSuccessChime();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer border border-slate-300 transition-colors"
                    title="Download profile photograph"
                  >
                    <Download className="w-4 h-4 text-slate-700" />
                    <span>Download Photo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Basic Profile Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-amber-600" />
              General Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isElderly ? "e.g., Bhaben Barua" : "e.g., Dr. Priya Barua"}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-sm font-bold bg-stone-50"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">
                  Phone / WhatsApp Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98640 12345"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-sm font-bold bg-stone-50"
                  />
                </div>
              </div>

              {/* Location (North Eastern Region of India Only) */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>Location (North East Region, India)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAutoDetectLocation}
                      disabled={isDetectingLocation}
                      className="text-[10px] font-black text-amber-950 bg-amber-200 hover:bg-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400 flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-60"
                      title="Automatically identify current location via GPS/Network"
                    >
                      {isDetectingLocation ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-amber-800" />
                          <span>Detecting...</span>
                        </>
                      ) : (
                        <>
                          <Locate className="w-3 h-3 text-amber-800" />
                          <span>Auto-Detect</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] font-black text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full">
                      NER India Only
                    </span>
                  </div>
                </div>

                {autoDetectedInfo && (
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 bg-white/90 px-2.5 py-1 rounded-lg border border-amber-300">
                    <span className="flex items-center gap-1 truncate">
                      <Navigation className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Identified: <strong>{location}</strong></span>
                    </span>
                    <span className="text-[9px] uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-black shrink-0 ml-1">
                      {autoDetectedInfo.source === 'gps' ? 'GPS Live' : 'Auto'}
                    </span>
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Guwahati (Kamrup Metro), Assam"
                    className="w-full pl-3 pr-3 py-2 rounded-xl border-2 border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-xs font-bold bg-white"
                  />
                </div>
                {/* State quick selectors */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-stone-500">Quick Select NE State:</span>
                  <div className="flex flex-wrap gap-1">
                    {NER_STATES_DATA.map((st) => (
                      <button
                        key={st.code}
                        type="button"
                        onClick={() => {
                          const firstCity = st.major_cities[0] || st.name;
                          setLocation(`${firstCity}, ${st.name}`);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 border border-amber-200 text-stone-800 font-bold transition-colors cursor-pointer"
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Language Preference */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">
                  Primary Language
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                  <select
                    value={languagePref}
                    onChange={(e) => setLanguagePref(e.target.value as RegionalLanguage)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-sm font-bold bg-stone-50 cursor-pointer"
                  >
                    {Object.entries(LANGUAGE_LABELS).map(([code, meta]) => (
                      <option key={code} value={code}>
                        {meta.nativeName} ({meta.name} - {meta.region})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Role-Specific Settings */}
          {isElderly ? (
            <div className="bg-amber-50/70 rounded-3xl p-5 border-2 border-amber-200 space-y-4">
              <h3 className="text-sm font-black text-amber-950 uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4 text-amber-600" />
                Senior Care & Health Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Age (Interactive Stepper & Presets) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      Senior Citizen Age
                    </label>
                    <span className="text-[11px] font-black text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                      {age} Years Old
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAge((prev) => Math.max(45, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-white hover:bg-amber-100 border-2 border-amber-300 font-black text-xl text-amber-950 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                      title="Decrease age by 1 year"
                    >
                      -
                    </button>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min={45}
                        max={120}
                        value={age}
                        onChange={(e) => setAge(Math.max(1, Number(e.target.value)))}
                        className="w-full text-center py-2 rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base font-black bg-white text-gray-900"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAge((prev) => Math.min(120, prev + 1))}
                      className="w-10 h-10 rounded-xl bg-white hover:bg-amber-100 border-2 border-amber-300 font-black text-xl text-amber-950 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                      title="Increase age by 1 year"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Age Presets */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-stone-500 font-bold">Quick set:</span>
                    {[65, 70, 75, 80, 85].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAge(preset)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-black transition-all cursor-pointer ${
                          age === preset
                            ? 'bg-amber-700 text-white shadow-xs'
                            : 'bg-white hover:bg-amber-100 text-stone-700 border border-amber-300'
                        }`}
                      >
                        {preset}y
                      </button>
                    ))}
                  </div>
                </div>

                {/* Patient ID Code (Locked - Read-Only) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      Patient ID Code (Locked)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (patientId) {
                          navigator.clipboard?.writeText(patientId);
                          soundEffects.playSuccessChime();
                        }
                      }}
                      className="text-[10px] font-black text-amber-800 hover:underline cursor-pointer"
                    >
                      Copy ID
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="patient-id-input"
                      type="text"
                      readOnly
                      value={patientId}
                      placeholder="e.g. PT-1001"
                      className="w-full font-mono uppercase pl-3 pr-9 py-2.5 rounded-xl border-2 border-stone-200 bg-stone-100 text-stone-700 outline-none text-sm font-black cursor-not-allowed select-all"
                    />
                    <Lock className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-gray-500 font-semibold">
                    Permanent identifier locked for medical record consistency and caregiver synchronization.
                  </p>
                </div>

                {/* Dementia Stage / Cognitive Support Level */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    Cognitive Care Stage
                  </label>
                  <select
                    value={dementiaStage}
                    onChange={(e) => setDementiaStage(e.target.value as DementiaStage)}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-sm font-bold bg-white cursor-pointer"
                  >
                    <option value="healthy_aging">Active Healthy Aging (Mental Vitality)</option>
                    <option value="early">Early Stage (Gentle Word/Story Recall)</option>
                    <option value="mild">Mild Stage (Familiar People & Visual Support)</option>
                    <option value="moderate">Moderate Stage (Assisted Audio & Calming Music)</option>
                  </select>
                </div>
              </div>

              {/* Diagnosis / Memory Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                  Personal Interests & Memory Notes
                </label>
                <textarea
                  rows={2}
                  value={diagnosisNote}
                  onChange={(e) => setDiagnosisNote(e.target.value)}
                  placeholder="e.g., Loves old Bihu songs, enjoyed tea garden walks, prefers large font pictures."
                  className="w-full px-3 py-2 rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-xs font-medium bg-white"
                />
              </div>

              {/* Emergency Contact */}
              <div className="space-y-2 pt-1 border-t border-amber-200/80">
                <label className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  Primary Emergency Contact
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name (e.g. Priya)"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-amber-200 bg-white outline-none focus:border-amber-500"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (+91 98640...)"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-amber-200 bg-white outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Relation (e.g. Granddaughter)"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-amber-200 bg-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Assigned Caregiver & Access Control */}
              <div className="space-y-3 pt-3 border-t border-amber-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Assigned Caregiver & Privacy
                  </label>
                  {connectedCaregiverId ? (
                    <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Assigned
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                      No Caregiver Linked
                    </span>
                  )}
                </div>

                {connectedCaregiverId ? (
                  <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                          <Stethoscope className="w-4 h-4 text-emerald-600" />
                          {connectedCaregiverName || 'Caregiver'}
                        </div>
                        <div className="text-xs text-slate-500 font-mono font-bold">
                          Code: {connectedCaregiverId}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                        Authorized
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Privacy Protected: Only this assigned caregiver can view your memory health records, schedule medications, and monitor safety alerts.
                    </p>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingCaregiver(!isChangingCaregiver);
                          setCaregiverStatusMsg('');
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                      >
                        {isChangingCaregiver ? 'Cancel' : 'Change Caregiver'}
                      </button>
                      <button
                        type="button"
                        onClick={handleUnassignCaregiver}
                        className="px-3 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Unassign
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-white border border-amber-200 shadow-2xs space-y-2">
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Caregivers cannot access or monitor your account until you assign them. Enter your family or professional caregiver's ID code (e.g. <span className="font-mono font-bold text-slate-800">CG-2125</span>) to grant them access.
                    </p>
                  </div>
                )}

                {/* Change or Assign Caregiver Form */}
                {(!connectedCaregiverId || isChangingCaregiver) && (
                  <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                    <label className="text-[11px] font-black text-amber-950 uppercase tracking-wide">
                      Enter Caregiver ID:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. CG-2125"
                        value={caregiverInputCode}
                        onChange={(e) => setCaregiverInputCode(e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 bg-white uppercase outline-none focus:border-amber-500 font-mono"
                      />
                      <button
                        type="button"
                        disabled={isVerifyingCaregiver}
                        onClick={handleAssignCaregiver}
                        className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isVerifyingCaregiver ? 'Verifying...' : 'Assign'}
                      </button>
                    </div>
                  </div>
                )}

                {caregiverStatusMsg && (
                  <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                    {caregiverStatusMsg}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Caregiver Specific Settings */
            <div className="bg-blue-50/70 rounded-3xl p-5 border-2 border-blue-200 space-y-4">
              <h3 className="text-sm font-black text-blue-950 uppercase tracking-wider flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-blue-700" />
                Caregiver Clinical Credentials
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Caregiver Age */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      Caregiver Age
                    </label>
                    <span className="text-[11px] font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full">
                      {age} Years Old
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAge((prev) => Math.max(18, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-white hover:bg-blue-100 border-2 border-blue-200 font-black text-xl text-blue-950 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                      title="Decrease age"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={18}
                      max={100}
                      value={age}
                      onChange={(e) => setAge(Math.max(18, Number(e.target.value)))}
                      className="w-full text-center py-2 rounded-xl border-2 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-base font-black bg-white text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setAge((prev) => Math.min(100, prev + 1))}
                      className="w-10 h-10 rounded-xl bg-white hover:bg-blue-100 border-2 border-blue-200 font-black text-xl text-blue-950 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                      title="Increase age"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Caregiver Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">
                    Caregiver Code (For Seniors to Link)
                  </label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 absolute left-3 top-3.5 text-blue-600" />
                    <input
                      type="text"
                      value={caregiverCode}
                      onChange={(e) => setCaregiverCode(e.target.value.toUpperCase())}
                      placeholder="CG-101"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm font-black bg-white uppercase"
                    />
                  </div>
                </div>

                {/* Specialty / Role Description */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700">
                    Clinical Role / Relation
                  </label>
                  <input
                    type="text"
                    value={diagnosisNote}
                    onChange={(e) => setDiagnosisNote(e.target.value)}
                    placeholder="Geriatric Specialist / Family Caregiver"
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm font-bold bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. Face ID Biometric Authentication */}
          <div className="bg-stone-50 rounded-3xl p-5 border-2 border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Scan className="w-4 h-4 text-[#2794EB]" />
                Face ID Biometric Sign-In
              </label>
              {faceDescriptor && faceDescriptor.length > 0 ? (
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Face Enrolled
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-0.5 rounded-full border border-slate-300">
                  Not Enrolled
                </span>
              )}
            </div>

            {faceDescriptor && faceDescriptor.length > 0 ? (
              <div className="p-4 rounded-2xl bg-white border-2 border-emerald-200 space-y-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#2794EB] to-[#17B3C1] flex items-center justify-center text-white shrink-0 shadow-2xs">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black text-slate-900">Biometric Profile Active</h4>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      128-point biometric descriptor linked to this account for instant camera sign-in.
                    </p>
                    {faceRegisteredAt && (
                      <p className="text-[11px] text-slate-400 font-bold mt-1">
                        Enrolled on {new Date(faceRegisteredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playGentleTap();
                      setIsFaceScannerOpen(true);
                    }}
                    className="py-2 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs active:scale-98"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Re-scan / Update Face</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playGentleTap();
                      setFaceDescriptor(null);
                      setFaceRegisteredAt(null);
                      setSuccessMessage('Face ID removed. Remember to click "Save Profile" below.');
                    }}
                    className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors active:scale-98"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Remove Face ID</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-white border-2 border-dashed border-stone-300 space-y-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#2794EB] shrink-0">
                    <Camera className="w-5 h-5 text-[#2794EB]" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-black text-slate-900">One-Tap Camera Sign-In</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Enroll your face to sign in instantly using the front camera with zero memorized PINs. All processing is 100% private in-browser.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playGentleTap();
                    setIsFaceScannerOpen(true);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-2xs hover:shadow-md transition-all active:scale-98 border border-[#47D6B6]"
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                >
                  <Camera className="w-4 h-4 text-white" />
                  <span>Enroll Face ID Now</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. Security PIN */}
          <div className="bg-stone-50 rounded-3xl p-5 border-2 border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                Access PIN (4 Digits)
              </label>
              <span className="text-xs font-bold text-gray-500">
                Used to quickly sign in
              </span>
            </div>
            <div className="relative max-w-xs">
              <Lock className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
              <input
                type="password"
                maxLength={4}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-digit PIN"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base font-black tracking-widest bg-white"
              />
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                soundEffects.playGentleTap();
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-sm cursor-pointer transition-colors border border-stone-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-white font-black text-sm cursor-pointer shadow-md transition-all active:scale-98 flex items-center gap-2 border border-[#47D6B6] hover:brightness-110"
              style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Biometric Face Registration Modal Scanner */}
      <FaceRegistrationScanner
        isOpen={isFaceScannerOpen}
        onClose={() => setIsFaceScannerOpen(false)}
        userName={name.trim() || user.name}
        onFaceCaptured={(descriptor, photoDataUrl) => {
          setFaceDescriptor(descriptor);
          setFaceRegisteredAt(new Date().toISOString());
          if (photoDataUrl) {
            setAvatar(photoDataUrl);
          }
          setSuccessMessage('Face ID and profile photo updated successfully! Click "Save Profile" below to apply changes.');
          soundEffects.playSuccessChime();
        }}
      />
    </div>
  );
};
