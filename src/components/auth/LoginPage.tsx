import React, { useState, useEffect } from 'react';
import { 
  User, 
  UserRole, 
  RegionalLanguage,
  Reminder
} from '../../types';
import { 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  User as UserIcon, 
  Volume2, 
  CheckCircle2, 
  KeyRound, 
  UserPlus, 
  LogIn, 
  Stethoscope,
  Info,
  RotateCcw,
  Check,
  Camera,
  Scan,
  Globe,
  MapPin,
  Compass,
  Locate,
  Navigation,
  Loader2,
  Phone,
  AlertCircle
} from 'lucide-react';
import { AppLogo } from '../common/AppLogo';
import { FaceLoginModal } from './FaceLoginModal';
import { FaceRegistrationScanner } from './FaceRegistrationScanner';
import { soundEffects, speakText } from '../../utils/speechAndAudio';
import { autoDetectLocation, DetectedLocationResult } from '../../utils/locationDetector';
import { 
  findUserByCredentials, 
  saveUserToFirebase, 
  saveRememberedUser,
  getRememberedUser,
  clearRememberedUser,
  saveReminderToFirebase,
  linkElderlyToCaregiverInFirebase,
  findUserByPhoneNumber,
  normalizePhoneNumber,
  formatPhoneNumberDisplay
} from '../../lib/firebase';
import { LANGUAGE_LABELS } from '../../data/nerContent';
import { NER_STATES_DATA } from '../../data/nerLocations';

const LOGIN_I18N: Record<RegionalLanguage, {
  tagline: string;
  subtitle: string;
  senior_tab: string;
  caregiver_tab: string;
  senior_login_title: string;
  caregiver_login_title: string;
  senior_reg_title: string;
  caregiver_reg_title: string;
  tab_login: string;
  tab_register: string;
  enter_pin: string;
  pin_hint: string;
  your_name: string;
  your_name_hint: string;
  phone_optional: string;
  phone_label: string;
  phone_placeholder: string;
  phone_rule_badge: string;
  phone_duplicate_warn: string;
  caregiver_code_label: string;
  location_section_title: string;
  location_state_label: string;
  location_city_label: string;
  location_region_badge: string;
  face_id_login_btn: string;
  enter_smaran_sathi: string;
  register_smaran_sathi: string;
  voice_help: string;
  remember_me: string;
  privacy_note: string;
  switch_account: string;
  welcome_back: string;
  continue_btn: string;
  select_language: string;
  voice_greeting: string;
}> = {
  en: {
    tagline: 'हर कदम पर आपका हमसफ़र।',
    subtitle: 'AI Cognitive Engagement & Assistive Memory Companion for North East India',
    senior_tab: '👵 Senior Citizen',
    caregiver_tab: '🩺 Caregiver & Doctor',
    senior_login_title: 'Senior Citizen Sign-In',
    caregiver_login_title: 'Caregiver & Clinical Portal',
    senior_reg_title: 'New Senior Profile Registration',
    caregiver_reg_title: 'Caregiver Registration',
    tab_login: 'Sign In (PIN / Face ID)',
    tab_register: 'Create New Profile',
    enter_pin: 'Enter 4-Digit Security PIN',
    pin_hint: 'Simple 4 numbers for instant access',
    your_name: 'Your Full Name',
    your_name_hint: 'Enter your name',
    phone_optional: 'Phone Number (Optional)',
    phone_label: 'Mobile / Phone Number',
    phone_placeholder: '10-digit mobile number',
    phone_rule_badge: '1 Account Per Number',
    phone_duplicate_warn: 'This phone number is already registered to another account. Only 1 account can be registered per phone number.',
    caregiver_code_label: 'Connect Caregiver Code (Optional)',
    location_section_title: 'Location (North Eastern Region, India)',
    location_state_label: 'Select State (NE India)',
    location_city_label: 'Select City / District',
    location_region_badge: 'North Eastern Region Only',
    face_id_login_btn: '1-Tap Login with Face ID',
    enter_smaran_sathi: 'Enter Smaran Sathi',
    register_smaran_sathi: 'Register & Enter Portal',
    voice_help: 'Listen to Voice Instructions',
    remember_me: 'Remember me on this device',
    privacy_note: 'Strict Data Privacy: No personal or caregiver details are shared with other users.',
    switch_account: 'Switch Account / New User',
    welcome_back: 'Welcome back,',
    continue_btn: 'Continue as',
    select_language: 'Language / ভাষা / Ktien / লোন',
    voice_greeting: 'Welcome to Smaran Sathi. Har kadam par aapka humsafar.'
  },
  as: {
    tagline: 'প্ৰতি খোজতে আপোনাৰ সংগী।',
    subtitle: 'উত্তৰ-পূব ভাৰতৰ বাবে এআই চালিত স্মৃতি সহচৰ আৰু সক্ৰিয়তা মঞ্চ',
    senior_tab: '👵 প্ৰবীণ নাগৰিক',
    caregiver_tab: '🩺 পৰিচৰ্যা ও চিকিৎসক',
    senior_login_title: 'প্ৰবীণ নাগৰিক প্ৰৱেশ',
    caregiver_login_title: 'পৰিচৰ্যা কাৰিকৰী কেন্দ্ৰ',
    senior_reg_title: 'নতুন প্ৰবীণ প্ৰফাইল পঞ্জীয়ন',
    caregiver_reg_title: 'পৰিচৰ্যা পঞ্জীয়ন',
    tab_login: 'লগইন (PIN / Face ID)',
    tab_register: 'নতুন প্ৰফাইল বনাওক',
    enter_pin: '৪-অংকৰ সুৰক্ষা পিন দিয়ক',
    pin_hint: 'সহজ ৪-অংকৰ পিন',
    your_name: 'আপোনাৰ সম্পূৰ্ণ নাম',
    your_name_hint: 'আপোনাৰ নাম লিখক',
    phone_optional: 'ফোন নম্বৰ (ঐচ্ছিক)',
    phone_label: 'মোবাইল / ফোন নম্বৰ',
    phone_placeholder: '১০-অংকৰ মোবাইল নম্বৰ',
    phone_rule_badge: '১ নম্বৰত ১টা একাউণ্ট',
    phone_duplicate_warn: 'এই ফোন নম্বৰটো ইতিমধ্যে পঞ্জীয়ন কৰা হৈছে। এটা নম্বৰত কেৱল ১টা একাউণ্টহে হ’ব পাৰে।',
    caregiver_code_label: 'পৰিচৰ্যাকৰ্তাৰ ক’ড (ঐচ্ছিক)',
    location_section_title: 'স্থান (উত্তৰ-পূৰ্বাঞ্চল, ভাৰত)',
    location_state_label: 'ৰাজ্য বাছক (উত্তৰ-পূব ভাৰত)',
    location_city_label: 'চহৰ / জিলা বাছক',
    location_region_badge: 'কেৱল উত্তৰ-পূৰ্বাঞ্চল অঞ্চল',
    face_id_login_btn: 'মুখমণ্ডল Face ID ৰে ১-টেপত লগইন',
    enter_smaran_sathi: 'স্মৰণ সাথীত প্ৰৱেশ কৰক',
    register_smaran_sathi: 'পঞ্জীয়ন কৰি প্ৰৱেশ কৰক',
    voice_help: 'মাতৰ নিৰ্দেশনা শুনক',
    remember_me: 'এই ডিভাইচত মনত ৰাখক',
    privacy_note: 'গোপনীয়তা সুৰক্ষিত: কোনো অন্য ব্যক্তিৰ তথ্য প্ৰকাশ কৰা নহয়।',
    switch_account: 'একাউণ্ট সলনি কৰক',
    welcome_back: 'পুনৰ স্বাগতম,',
    continue_btn: 'প্ৰৱেশ কৰক হিচাপে',
    select_language: 'ভাষা বাছক (Language)',
    voice_greeting: 'স্মৰণ সাথীলৈ আপোনাক স্বাগতম। প্ৰতি খোজতে আপোনাৰ সংগী।'
  },
  kha: {
    tagline: 'Man la ka jam iaka paralok jongphi.',
    subtitle: 'Ka AI Memory Companion na bynta ka Dong Shatei Lam Mihngi',
    senior_tab: '👵 Ki Rangbah',
    caregiver_tab: '🩺 Nongsumar & Doctor',
    senior_login_title: 'Ka Jingrung Ki Rangbah',
    caregiver_login_title: 'Ka Portal Nongsumar',
    senior_reg_title: 'Thoh Kyrteng Rangbah Bathymmai',
    caregiver_reg_title: 'Thoh Kyrteng Nongsumar',
    tab_login: 'Rung (PIN / Face ID)',
    tab_register: 'Thaw Profile Bathymmai',
    enter_pin: 'Thep 4-Digit Security PIN',
    pin_hint: 'PIN ba 4 tylli ki dak',
    your_name: 'Kyrteng Bapura',
    your_name_hint: 'Thep la ka kyrteng',
    phone_optional: 'Phone Number (Jied)',
    phone_label: 'Number Mobile / Phone',
    phone_placeholder: '10-digit mobile number',
    phone_rule_badge: '1 Account Mar Kawei ka Number',
    phone_duplicate_warn: 'Kane ka phone number la don lypa. Tang marwei lah ban register na kawei ka number.',
    caregiver_code_label: 'Code Nongsumar (Jied)',
    location_section_title: 'Ka Shnong (Dong Shatei Lam Mihngi)',
    location_state_label: 'Jied Jylla (NE India)',
    location_city_label: 'Jied Shnong / District',
    location_region_badge: 'Tang na Dong Shatei Lam Mihngi',
    face_id_login_btn: 'Rung da ka Khmat Face ID',
    enter_smaran_sathi: 'Rung sha Smaran Sathi',
    register_smaran_sathi: 'Thoh Kyrteng & Rung',
    voice_help: 'Sngap ia ki Jingbatai',
    remember_me: 'Kynmaw ia nga hangne',
    privacy_note: 'Ka jingiada ba skhem: Ym don ba iohi ia ki jingtip jong phi.',
    switch_account: 'Pynkylla Account',
    welcome_back: 'Khublei pdiang,',
    continue_btn: 'Rung kum',
    select_language: 'Jied Ktien (Language)',
    voice_greeting: 'Khublei wan sha ka Smaran Sathi.'
  },
  mni: {
    tagline: 'খোকথাং খুদিংদা অদোমগী খোঙলোই।',
    subtitle: 'অৱাং নোংপোক ভারতকীদমক এআই মেমোরি কম্পেনিয়ন',
    senior_tab: '👵 অহল-লমন',
    caregiver_tab: '🩺 কেয়ৰগিভৰ ও ডাক্তৰ',
    senior_login_title: 'অহল-লমন চঙফম',
    caregiver_login_title: 'কেয়ৰগিভৰ পোৰ্টেল',
    senior_reg_title: 'অনৌবা অহল প্ৰোফাইল শেমগৎলু',
    caregiver_reg_title: 'কেয়ৰগিভৰ ৰেজিস্ট্ৰেশন',
    tab_login: 'চঙলু (PIN / Face ID)',
    tab_register: 'অনৌবা প্ৰোফাইল শেমগৎলু',
    enter_pin: '৪-মশিংগী PIN থাপ্লু',
    pin_hint: 'অদোমগী সিকিউৰিতী PIN',
    your_name: 'অদোমগী মমিং',
    your_name_hint: 'মমিং ইরো',
    phone_optional: 'ফোন নম্বৰ (অপ্সনেল)',
    phone_label: 'মোবাইল / ফোন নম্বৰ',
    phone_placeholder: '১০-মশিংগী মোবাইল নম্বৰ',
    phone_rule_badge: 'নম্বৰ অমদা একাউন্ট অমা খক্তা',
    phone_duplicate_warn: 'ফোন নম্বৰসি হান্না ৰেজিস্টাৰ তৌৰবনি। নম্বৰ অমদা একাউন্ট অমা খক্তা শেমবা য়াই।',
    caregiver_code_label: 'কেয়ৰগিভৰ কোড (অপ্সনেল)',
    location_section_title: 'মফম (অৱাং নোংপোক ভারত খক্তদা)',
    location_state_label: 'ষ্টেট খল্লু (NE India)',
    location_city_label: 'সহৰ / জিলা খল্লু',
    location_region_badge: 'অৱাং নোংপোক ভারত খক্তগীদমক',
    face_id_login_btn: 'Face ID মমৈনা চঙলু',
    enter_smaran_sathi: 'স্মৰণ সাথীদা চঙলু',
    register_smaran_sathi: 'ৰেজিস্টাৰ তৌদুনা চঙলু',
    voice_help: 'খোন্থা নিৰ্দেশনা তাউ',
    remember_me: 'ডিভাইসসিদা নীংশিংদুনা থম্মু',
    privacy_note: 'সিকিউৰিটী অমসুং প্ৰাইভেসি ঙাক্লি: অতোপ্পগী দেতা উবা ফংদে।',
    switch_account: 'একাউণ্ট হোংদোক্লু',
    welcome_back: 'তৰাম্না ওকচরি,',
    continue_btn: 'চঙলু মমিংনা',
    select_language: 'লোন খল্লু (Language)',
    voice_greeting: 'স্মৰণ সাথীদা তৰাম্না ওকচরি।'
  },
  hi: {
    tagline: 'हर कदम पर आपका हमसफ़र।',
    subtitle: 'पूर्वोत्तर भारत के लिए एआई आधारित स्मृति व संज्ञान साथी',
    senior_tab: '👵 वरिष्ठ नागरिक',
    caregiver_tab: '🩺 केयरगिवर व डॉक्टर',
    senior_login_title: 'वरिष्ठ नागरिक प्रवेश',
    caregiver_login_title: 'केयरगिवर व क्लीनिकल पोर्टल',
    senior_reg_title: 'नया वरिष्ठ प्रोफ़ाइल पंजीकरण',
    caregiver_reg_title: 'केयरगिवर पंजीकरण',
    tab_login: 'लॉग इन (PIN / Face ID)',
    tab_register: 'नया प्रोफ़ाइल बनाएं',
    enter_pin: '4-अंकों का सुरक्षा पिन दर्ज करें',
    pin_hint: 'त्वरित प्रवेश के लिए 4 अंकों का पिन',
    your_name: 'आपका पूरा नाम',
    your_name_hint: 'अपना नाम दर्ज करें',
    phone_optional: 'फ़ोन नंबर (वैकल्पिक)',
    phone_label: 'मोबाइल / फ़ोन नंबर',
    phone_placeholder: '10-अंकों का मोबाइल नंबर',
    phone_rule_badge: '1 नंबर पर 1 ही खाता',
    phone_duplicate_warn: 'यह फ़ोन नंबर पहले से पंजीकृत है। एक नंबर से केवल 1 खाता ही बनाया जा सकता है।',
    caregiver_code_label: 'केयरगिवर कोड जोड़ें (वैकल्पिक)',
    location_section_title: 'स्थान (केवल पूर्वोत्तर भारत / North East India)',
    location_state_label: 'राज्य चुनें (पूर्वोत्तर भारत)',
    location_city_label: 'शहर / ज़िला चुनें',
    location_region_badge: 'केवल पूर्वोत्तर भारत (NER)',
    face_id_login_btn: 'फेस आईडी (Face ID) से 1-टैप लॉगिन',
    enter_smaran_sathi: 'स्मरण साथी में प्रवेश करें',
    register_smaran_sathi: 'पंजीकरण कर प्रवेश करें',
    voice_help: 'आवाज़ में निर्देश सुनें',
    remember_me: 'इस डिवाइस पर याद रखें',
    privacy_note: 'सख्त डेटा गोपनीयता: किसी अन्य उपयोगकर्ता या केयरगिवर की जानकारी नहीं दिखाई जाती।',
    switch_account: 'खाता बदलें / नया उपयोगकर्ता',
    welcome_back: 'स्वागत है,',
    continue_btn: 'के रूप में जारी रखें',
    select_language: 'भाषा चुनें (Language)',
    voice_greeting: 'नमस्ते, स्मरण साथी में आपका स्वागत है। हर कदम पर आपका हमसफ़र।'
  }
};

interface LoginPageProps {
  onLogin: (user: User) => void;
  users: User[];
  onRegisterUser: (newUser: User) => void;
  currentLanguage?: RegionalLanguage;
  onLanguageChange?: (lang: RegionalLanguage) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  users,
  onRegisterUser,
  currentLanguage = 'as',
  onLanguageChange,
}) => {
  const [activeTab, setActiveTab] = useState<UserRole>('elderly');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedLang, setSelectedLang] = useState<RegionalLanguage>(currentLanguage);

  // Remembered user from Firebase / LocalStorage
  const [rememberedUser, setRememberedUserState] = useState<User | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  // Elderly Form Fields
  const [elderlyName, setElderlyName] = useState('');
  const [elderlyPin, setElderlyPin] = useState('');
  const [elderlyPhone, setElderlyPhone] = useState('');
  const [elderlyAge, setElderlyAge] = useState<number>(72);
  const [elderlyCaregiverCode, setElderlyCaregiverCode] = useState('');
  const [elderlyPatientId, setElderlyPatientId] = useState(`PT-${Math.floor(1000 + Math.random() * 9000)}`);
  const [elderlyState, setElderlyState] = useState('Assam');
  const [elderlyCity, setElderlyCity] = useState('Guwahati (Kamrup Metro)');

  // Caregiver Form Fields
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverCode, setCaregiverCode] = useState(`CG-${Math.floor(1000 + Math.random() * 9000)}`);
  const [caregiverPin, setCaregiverPin] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [caregiverRelation, setCaregiverRelation] = useState('Primary Family Caregiver');
  const [caregiverState, setCaregiverState] = useState('Assam');
  const [caregiverCity, setCaregiverCity] = useState('Guwahati (Kamrup Metro)');

  // Status & Feedback
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Face ID Biometric Authentication States
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'login' | 'enroll'>('login');
  const [isRegScannerOpen, setIsRegScannerOpen] = useState(false);
  const [registeredFaceDescriptor, setRegisteredFaceDescriptor] = useState<number[] | null>(null);
  const [registeredFacePhoto, setRegisteredFacePhoto] = useState<string | null>(null);

  // Automatic Location Detection State
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [detectedLocationInfo, setDetectedLocationInfo] = useState<DetectedLocationResult | null>(null);

  // Phone Number Uniqueness & Validation States
  const [elderlyPhoneDuplicate, setElderlyPhoneDuplicate] = useState<User | null>(null);
  const [elderlyPhoneAvailable, setElderlyPhoneAvailable] = useState<boolean>(false);
  const [isCheckingElderlyPhone, setIsCheckingElderlyPhone] = useState<boolean>(false);

  const [caregiverPhoneDuplicate, setCaregiverPhoneDuplicate] = useState<User | null>(null);
  const [caregiverPhoneAvailable, setCaregiverPhoneAvailable] = useState<boolean>(false);
  const [isCheckingCaregiverPhone, setIsCheckingCaregiverPhone] = useState<boolean>(false);

  // Phone uniqueness verification helper
  const verifyPhoneUniqueness = async (rawPhone: string, role: UserRole): Promise<User | null> => {
    const clean = normalizePhoneNumber(rawPhone);
    if (!clean || clean.length < 10) {
      if (role === 'elderly') {
        setElderlyPhoneDuplicate(null);
        setElderlyPhoneAvailable(false);
        setIsCheckingElderlyPhone(false);
      } else {
        setCaregiverPhoneDuplicate(null);
        setCaregiverPhoneAvailable(false);
        setIsCheckingCaregiverPhone(false);
      }
      return null;
    }

    if (role === 'elderly') {
      setIsCheckingElderlyPhone(true);
    } else {
      setIsCheckingCaregiverPhone(true);
    }

    try {
      // 1. Check in Firestore & local registry
      const fromDb = await findUserByPhoneNumber(clean);
      // 2. Check in loaded props users array
      const fromProps = users.find((u) => u.phone && normalizePhoneNumber(u.phone) === clean);
      const duplicate = fromDb || fromProps || null;

      if (role === 'elderly') {
        setElderlyPhoneDuplicate(duplicate);
        setElderlyPhoneAvailable(!duplicate);
      } else {
        setCaregiverPhoneDuplicate(duplicate);
        setCaregiverPhoneAvailable(!duplicate);
      }
      return duplicate;
    } catch (err) {
      console.warn('Error checking phone uniqueness:', err);
      return null;
    } finally {
      if (role === 'elderly') {
        setIsCheckingElderlyPhone(false);
      } else {
        setIsCheckingCaregiverPhone(false);
      }
    }
  };

  const handleElderlyPhoneChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setElderlyPhone(clean);
    setErrorMessage('');
    verifyPhoneUniqueness(clean, 'elderly');
  };

  const handleCaregiverPhoneChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setCaregiverPhone(clean);
    setErrorMessage('');
    verifyPhoneUniqueness(clean, 'caregiver');
  };

  // Helper to switch to Login tab with pre-filled phone number
  const switchToLoginWithPhone = (phoneNum: string, role: UserRole) => {
    const cleanPhone = normalizePhoneNumber(phoneNum);
    setActiveTab(role);
    setAuthMode('login');
    if (role === 'elderly') {
      setElderlyName(cleanPhone || phoneNum);
      setElderlyPin('');
    } else {
      setCaregiverName(cleanPhone || phoneNum);
      setCaregiverPin('');
    }
    setErrorMessage(`Phone number verified. Please enter the 4-digit PIN for your account to sign in.`);
    soundEffects.playGentleTap();
  };

  const t = LOGIN_I18N[selectedLang] || LOGIN_I18N.en;

  // Automatically detect location on initial mount / register view
  const triggerAutoDetectLocation = async (manual: boolean = false) => {
    setIsDetectingLocation(true);
    try {
      const result = await autoDetectLocation();
      if (result && result.stateName && result.cityName) {
        setElderlyState(result.stateName);
        setElderlyCity(result.cityName);
        setCaregiverState(result.stateName);
        setCaregiverCity(result.cityName);
        setDetectedLocationInfo(result);
        if (manual) {
          soundEffects.playSuccessChime();
        }
      }
    } catch (err) {
      console.warn('Auto location detection note:', err);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  useEffect(() => {
    // Automatically identify location in background
    triggerAutoDetectLocation(false);
  }, []);

  // Check for remembered user on mount
  useEffect(() => {
    const cached = getRememberedUser();
    if (cached) {
      setRememberedUserState(cached);
    }
  }, []);

  // Update selected language if prop changes
  useEffect(() => {
    if (currentLanguage) {
      setSelectedLang(currentLanguage);
    }
  }, [currentLanguage]);

  // Handle language switch from side selector
  const handleSelectLanguage = (lang: RegionalLanguage) => {
    soundEffects.playGentleTap();
    setSelectedLang(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
    const greeting = LOGIN_I18N[lang]?.voice_greeting || 'Welcome to Smaran Sathi';
    speakText(greeting, lang);
  };

  // Regional speech assistance for elderly users
  const handleVoiceHelp = () => {
    soundEffects.playGentleTap();
    const message = activeTab === 'elderly'
      ? t.voice_greeting
      : 'Caregiver Portal. Sign in with your PIN or register your account in Smaran Sathi.';
    speakText(message, selectedLang);
  };

  // Switch role tab
  const handleSelectRole = (role: UserRole) => {
    soundEffects.playGentleTap();
    setActiveTab(role);
    setErrorMessage('');
  };

  // Quick Resume for Remembered User
  const handleQuickResume = () => {
    if (!rememberedUser) return;
    soundEffects.playSuccessChime();
    onLogin(rememberedUser);
  };

  // Forget remembered user
  const handleForgetRemembered = () => {
    soundEffects.playGentleTap();
    clearRememberedUser();
    setRememberedUserState(null);
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const isElderly = activeTab === 'elderly';
    const identifier = isElderly ? elderlyName.trim() : caregiverName.trim();
    const pin = isElderly ? elderlyPin.trim() : caregiverPin.trim();

    if (!pin) {
      setErrorMessage('Please enter your 4-digit PIN.');
      setLoading(false);
      soundEffects.playGentleEncouragement();
      return;
    }

    try {
      // 1. Direct Firebase Firestore verification
      let matchedUser: User | null = null;
      try {
        matchedUser = await findUserByCredentials(activeTab, pin, identifier);
      } catch (fbErr) {
        console.warn('Firebase query fallback:', fbErr);
      }

      // 2. If not found via direct Firebase query, check backend API
      if (!matchedUser) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: activeTab,
            identifier: identifier || undefined,
            pin,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            matchedUser = data.user;
          }
        }
      }

      // 3. Client state fallback
      if (!matchedUser) {
        const cleanPhoneId = normalizePhoneNumber(identifier);
        matchedUser = users.find(
          (u) =>
            u.role === activeTab &&
            u.pin === pin &&
            (!identifier ||
              u.name.toLowerCase() === identifier.toLowerCase() ||
              u.phone === identifier ||
              (cleanPhoneId && cleanPhoneId.length >= 10 && u.phone && normalizePhoneNumber(u.phone) === cleanPhoneId) ||
              u.caregiver_code?.toLowerCase() === identifier.toLowerCase() ||
              u.patient_id?.toLowerCase() === identifier.toLowerCase() ||
              u.id.toLowerCase() === identifier.toLowerCase())
        ) || null;
      }

      if (matchedUser) {
        soundEffects.playSuccessChime();
        saveUserToFirebase(matchedUser).catch(() => {});
        
        if (rememberMe) {
          saveRememberedUser(matchedUser);
        } else {
          clearRememberedUser();
        }

        onLogin(matchedUser);
      } else {
        soundEffects.playGentleEncouragement();
        setErrorMessage(
          `No ${activeTab === 'elderly' ? 'senior' : 'caregiver'} account found with that PIN. If you are new, tap "Create New Profile" to register.`
        );
      }
    } catch (err) {
      setErrorMessage('Login failed. Please check your credentials or create a new profile.');
    } finally {
      setLoading(false);
    }
  };

  // Seed default routine reminders for newly created elderly
  const seedInitialUserReminders = async (user: User) => {
    const initialReminders: Reminder[] = [
      {
        id: `rem-${user.id}-1`,
        user_id: user.id,
        title: 'Morning Blood Pressure & Vitamin',
        type: 'medication',
        time: '08:30 AM',
        recurrence: 'daily',
        priority: 'high',
        instructions: 'Take with half glass of warm water after light breakfast.',
        spoken_prompt: 'Namaskar! It is time for your morning medicine. Please drink warm water.',
        completed: false,
        created_by: 'system_onboarding',
        created_at: new Date().toISOString(),
      },
      {
        id: `rem-${user.id}-2`,
        user_id: user.id,
        title: 'Mid-Morning Memory Card Practice',
        type: 'memory_game',
        time: '11:00 AM',
        recurrence: 'daily',
        priority: 'medium',
        instructions: 'Complete 1 gentle round of regional memory cards.',
        spoken_prompt: 'Time for your daily memory game! Let us match the beautiful cultural pictures.',
        completed: false,
        created_by: 'system_onboarding',
        created_at: new Date().toISOString(),
      },
      {
        id: `rem-${user.id}-3`,
        user_id: user.id,
        title: 'Evening Assam Chai & Relaxation',
        type: 'chai_time',
        time: '04:30 PM',
        recurrence: 'daily',
        priority: 'gentle',
        instructions: 'Enjoy warm tea and listen to familiar folk melodies.',
        spoken_prompt: 'It is tea time! Relax and enjoy your cup of tea.',
        completed: false,
        created_by: 'system_onboarding',
        created_at: new Date().toISOString(),
      }
    ];

    for (const rem of initialReminders) {
      await saveReminderToFirebase(rem);
    }
  };

  // Submit Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const isElderly = activeTab === 'elderly';

    if (isElderly) {
      if (!elderlyName.trim()) {
        setErrorMessage('Please enter your full name.');
        setLoading(false);
        return;
      }

      // Strict Phone Number Validation and Uniqueness Check
      const cleanElderlyPhone = normalizePhoneNumber(elderlyPhone);
      if (!elderlyPhone.trim() || cleanElderlyPhone.length !== 10) {
        setErrorMessage('Please enter a valid 10-digit mobile phone number for registration.');
        setLoading(false);
        soundEffects.playGentleEncouragement();
        return;
      }

      const duplicateElderly = await verifyPhoneUniqueness(cleanElderlyPhone, 'elderly');
      if (duplicateElderly) {
        setElderlyPhoneDuplicate(duplicateElderly);
        setErrorMessage(
          `This phone number (+91 ${cleanElderlyPhone.slice(-10)}) is already registered to ${duplicateElderly.name} (${duplicateElderly.role === 'elderly' ? 'Senior Citizen' : 'Caregiver'}). Only 1 user can register per phone number.`
        );
        setLoading(false);
        soundEffects.playGentleEncouragement();
        return;
      }

      if (!elderlyPin || elderlyPin.length < 4) {
        setErrorMessage('Please create a 4-digit PIN.');
        setLoading(false);
        return;
      }

      const formattedPatientId = elderlyPatientId.trim().toUpperCase() || `PT-${Math.floor(1000 + Math.random() * 9000)}`;

      const newElderly: User = {
        id: `user-${Date.now()}`,
        patient_id: formattedPatientId,
        name: elderlyName.trim(),
        role: 'elderly',
        language_pref: selectedLang,
        pin: elderlyPin.slice(-4),
        age: Number(elderlyAge) || 72,
        phone: formatPhoneNumberDisplay(cleanElderlyPhone),
        location: `${elderlyCity}, ${elderlyState}, North East India`,
        diagnosis_note: 'Enjoys regional memory activities and cultural stories.',
        location_sharing: false,
        avatar: registeredFacePhoto || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
        created_at: new Date().toISOString(),
        ...(registeredFaceDescriptor ? {
          face_descriptor: registeredFaceDescriptor,
          face_registered_at: new Date().toISOString(),
        } : {}),
        ...(elderlyCaregiverCode.trim() ? {
          connected_caregiver_id: elderlyCaregiverCode.trim().toUpperCase(),
          connected_caregiver_name: 'Assigned Caregiver',
        } : {}),
      };

      try {
        // Backend API check & persistence with phone uniqueness verification
        try {
          const apiRes = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newElderly),
          });
          if (apiRes.status === 409) {
            const errData = await apiRes.json();
            setErrorMessage(errData.message || 'This phone number is already registered to another user.');
            setLoading(false);
            soundEffects.playGentleEncouragement();
            return;
          }
        } catch (apiErr) {
          console.warn('API POST /api/users warning:', apiErr);
        }

        await saveUserToFirebase(newElderly);
        
        if (elderlyCaregiverCode.trim()) {
          const cleanCode = elderlyCaregiverCode.trim().toUpperCase();
          const matchedCg = users.find(
            (u) =>
              u.role === 'caregiver' &&
              (u.caregiver_code?.toUpperCase() === cleanCode || u.id.toUpperCase() === cleanCode)
          );
          if (matchedCg) {
            await linkElderlyToCaregiverInFirebase(newElderly.id, matchedCg);
          }
        }

        await seedInitialUserReminders(newElderly);

        if (rememberMe) {
          saveRememberedUser(newElderly);
        }

        soundEffects.playSuccessChime();
        onRegisterUser(newElderly);
        onLogin(newElderly);
      } catch (err: any) {
        if (err?.message?.includes('already registered')) {
          setErrorMessage(err.message);
          setLoading(false);
          soundEffects.playGentleEncouragement();
          return;
        }
        soundEffects.playSuccessChime();
        if (rememberMe) saveRememberedUser(newElderly);
        onRegisterUser(newElderly);
        onLogin(newElderly);
      } finally {
        setLoading(false);
      }
    } else {
      // Caregiver Registration
      if (!caregiverName.trim()) {
        setErrorMessage('Please enter your caregiver name.');
        setLoading(false);
        return;
      }

      // Strict Phone Number Validation and Uniqueness Check
      const cleanCaregiverPhone = normalizePhoneNumber(caregiverPhone);
      if (!caregiverPhone.trim() || cleanCaregiverPhone.length !== 10) {
        setErrorMessage('Please enter a valid 10-digit mobile phone number for registration.');
        setLoading(false);
        soundEffects.playGentleEncouragement();
        return;
      }

      const duplicateCaregiver = await verifyPhoneUniqueness(cleanCaregiverPhone, 'caregiver');
      if (duplicateCaregiver) {
        setCaregiverPhoneDuplicate(duplicateCaregiver);
        setErrorMessage(
          `This phone number (+91 ${cleanCaregiverPhone.slice(-10)}) is already registered to ${duplicateCaregiver.name} (${duplicateCaregiver.role === 'elderly' ? 'Senior Citizen' : 'Caregiver'}). Only 1 user can register per phone number.`
        );
        setLoading(false);
        soundEffects.playGentleEncouragement();
        return;
      }

      if (!caregiverPin || caregiverPin.length < 4) {
        setErrorMessage('Please create a 4-digit PIN.');
        setLoading(false);
        return;
      }

      const formattedCode = caregiverCode.trim().toUpperCase() || `CG-${Math.floor(1000 + Math.random() * 9000)}`;

      const newCaregiver: User = {
        id: `caregiver-${Date.now()}`,
        name: caregiverName.trim(),
        role: 'caregiver',
        language_pref: 'en',
        pin: caregiverPin.slice(-4),
        phone: formatPhoneNumberDisplay(cleanCaregiverPhone),
        caregiver_code: formattedCode,
        location: `${caregiverCity}, ${caregiverState}, North East India`,
        diagnosis_note: caregiverRelation,
        avatar: registeredFacePhoto || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
        created_at: new Date().toISOString(),
        ...(registeredFaceDescriptor ? {
          face_descriptor: registeredFaceDescriptor,
          face_registered_at: new Date().toISOString(),
        } : {}),
      };

      try {
        // Backend API check & persistence with phone uniqueness verification
        try {
          const apiRes = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCaregiver),
          });
          if (apiRes.status === 409) {
            const errData = await apiRes.json();
            setErrorMessage(errData.message || 'This phone number is already registered to another user.');
            setLoading(false);
            soundEffects.playGentleEncouragement();
            return;
          }
        } catch (apiErr) {
          console.warn('API POST /api/users warning:', apiErr);
        }

        await saveUserToFirebase(newCaregiver);

        if (rememberMe) {
          saveRememberedUser(newCaregiver);
        }

        soundEffects.playSuccessChime();
        onRegisterUser(newCaregiver);
        onLogin(newCaregiver);
      } catch (err: any) {
        if (err?.message?.includes('already registered')) {
          setErrorMessage(err.message);
          setLoading(false);
          soundEffects.playGentleEncouragement();
          return;
        }
        soundEffects.playSuccessChime();
        if (rememberMe) saveRememberedUser(newCaregiver);
        onRegisterUser(newCaregiver);
        onLogin(newCaregiver);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8 relative">
      
      {/* ========================================================================= */}
      {/* SIDE LANGUAGE SELECTOR (Docked on Right Side for Desktop & Sticky Top Bar) */}
      {/* ========================================================================= */}
      <aside 
        aria-label="Language selection"
        className="lg:fixed lg:right-6 lg:top-8 z-40 w-full lg:w-64 max-w-xl mx-auto lg:mx-0 mb-4 lg:mb-0"
      >
        <div className="bg-white rounded-3xl p-3.5 border-2 border-[#47D6B6] shadow-md space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-black text-[#1E293B]">
              <Globe className="w-4 h-4 text-[#2794EB]" />
              <span>{t.select_language}</span>
            </div>
            <span className="text-[10px] font-bold text-[#17B3C1] bg-[#BFF8D4] px-2 py-0.5 rounded-full">
              5 Languages
            </span>
          </div>

          {/* Grid of Regional Languages */}
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-1 gap-1.5">
            {(Object.entries(LANGUAGE_LABELS) as [RegionalLanguage, { name: string; nativeName: string; region: string }][]).map(
              ([code, label]) => {
                const isSelected = selectedLang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleSelectLanguage(code)}
                    className={`px-3 py-2 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#2794EB] to-[#17B3C1] text-white border-[#2794EB] shadow-xs scale-[1.02]'
                        : 'bg-[#FAFAFA] hover:bg-slate-100 text-[#1E293B] border-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-[#1E293B]'}`}>
                        {label.nativeName}
                      </p>
                      <p className={`text-[10px] font-bold truncate ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
                        {label.name} · {label.region}
                      </p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-1" />}
                  </button>
                );
              }
            )}
          </div>
        </div>
      </aside>

      {/* Main Form Center Column */}
      <div className="max-w-xl w-full mx-auto space-y-5">
        
        {/* Brand Hero Section with Theme Gradient */}
        <div 
          style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
          className="rounded-[32px] p-6 sm:p-7 text-center space-y-3 shadow-md border-2 border-[#47D6B6]/40"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/95 shadow-md border-2 border-[#47D6B6] mb-1 p-2">
            <AppLogo className="w-12 h-12" animate />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center justify-center gap-2.5 flex-wrap">
              <span>स्मरण साथी</span>
              <span className="text-[#2794EB] bg-white border border-[#47D6B6] text-lg sm:text-xl px-3 py-0.5 rounded-full font-black shadow-2xs">
                Smaran Sathi
              </span>
            </h1>
            <div className="pt-1 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#47D6B6] text-[#2794EB] shadow-2xs">
                <span className="text-base">🌸</span>
                <span className="text-sm sm:text-base font-black tracking-wide">
                  {t.tagline}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-white/90 font-bold max-w-md mx-auto pt-1">
            {t.subtitle}
          </p>
        </div>

        {/* 1-Tap "Remembered User" Quick Resume Banner (Only shown if user deliberately remembered on this device) */}
        {rememberedUser && (
          <div 
            style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
            className="rounded-[28px] p-5 text-white shadow-md border-2 border-[#47D6B6] space-y-3 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#2794EB] bg-white border border-[#47D6B6] px-2.5 py-0.5 rounded-md">
                Active Session
              </span>
              <button
                type="button"
                onClick={handleForgetRemembered}
                className="text-xs font-black text-white hover:text-slate-100 underline cursor-pointer"
              >
                {t.switch_account}
              </button>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={rememberedUser.avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'}
                alt={rememberedUser.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-black text-white truncate">
                  {t.welcome_back} {rememberedUser.name}!
                </h3>
                <p className="text-xs font-bold text-white/90 truncate">
                  {rememberedUser.role === 'elderly' ? '👵 Senior Citizen' : '🩺 Caregiver'} · PIN: ••••
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleQuickResume}
              className="w-full min-h-[52px] rounded-xl bg-white hover:bg-slate-50 text-[#1E293B] font-black text-base flex items-center justify-center gap-2 border-2 border-[#47D6B6] hover:border-[#47D6B6] shadow-sm cursor-pointer transition-all active:translate-y-0.5"
            >
              <span>{t.continue_btn} {rememberedUser.name.split(' ')[0]}</span>
              <ArrowRight className="w-5 h-5 text-[#2794EB]" />
            </button>
          </div>
        )}

        {/* Dedicated Role Selector Portal */}
        <div className="bg-[#FAFAFA] rounded-[28px] p-2.5 border-2 border-[#47D6B6] shadow-sm">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleSelectRole('elderly')}
              style={activeTab === 'elderly' ? { background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' } : undefined}
              className={`min-h-[54px] rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'elderly'
                  ? 'text-white shadow-sm border border-[#47D6B6]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Sparkles className={`w-5 h-5 ${activeTab === 'elderly' ? 'text-white' : 'text-[#2794EB]'}`} />
              <span>{t.senior_tab}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectRole('caregiver')}
              style={activeTab === 'caregiver' ? { background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' } : undefined}
              className={`min-h-[54px] rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'caregiver'
                  ? 'text-white shadow-sm border border-[#47D6B6]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Stethoscope className={`w-5 h-5 ${activeTab === 'caregiver' ? 'text-white' : 'text-[#2794EB]'}`} />
              <span>{t.caregiver_tab}</span>
            </button>
          </div>
        </div>

        {/* Main Authentication Box */}
        <div className="bg-[#FAFAFA] rounded-[32px] p-6 sm:p-8 border-2 border-[#47D6B6] shadow-sm space-y-6">
          
          {/* Header Description & Audio Assist */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b-2 border-slate-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#1E293B] flex items-center gap-2">
                {activeTab === 'elderly' ? (
                  <>
                    <Sparkles className="w-6 h-6 text-[#2794EB]" />
                    <span>{authMode === 'login' ? t.senior_login_title : t.senior_reg_title}</span>
                  </>
                ) : (
                  <>
                    <Stethoscope className="w-6 h-6 text-[#2794EB]" />
                    <span>{authMode === 'login' ? t.caregiver_login_title : t.caregiver_reg_title}</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                {activeTab === 'elderly' 
                  ? 'Simple cognitive companions, memory albums, and daily routines'
                  : 'Private clinical trends, scheduling & emergency monitoring'}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-emerald-800 bg-emerald-50/90 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>North Eastern Region (NER), India</span>
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  8 States Supported
                </span>
              </div>
            </div>

            {/* Spoken Audio Helper Button */}
            <button
              type="button"
              onClick={handleVoiceHelp}
              className="px-3 py-2 rounded-2xl bg-white hover:bg-blue-50 text-[#2794EB] border-2 border-[#47D6B6] text-xs font-black flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
              title={t.voice_help}
            >
              <Volume2 className="w-4 h-4 text-[#2794EB] animate-pulse" />
              <span className="hidden sm:inline">Voice Help</span>
            </button>
          </div>

          {/* Mode Switcher: Sign In vs Create Profile */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                soundEffects.playGentleTap();
                setAuthMode('login');
                setErrorMessage('');
              }}
              className={`min-h-[46px] rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-[#1E293B] shadow-sm border border-[#47D6B6]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-4 h-4 text-[#2794EB]" />
              <span>{t.tab_login}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEffects.playGentleTap();
                setAuthMode('register');
                setErrorMessage('');
              }}
              className={`min-h-[46px] rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-[#1E293B] shadow-sm border border-[#47D6B6]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4 text-[#17B3C1]" />
              <span>{t.tab_register}</span>
            </button>
          </div>

          {/* Error Message Notice */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-800 text-xs sm:text-sm font-black flex items-start gap-2.5 animate-shake">
              <Info className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: SENIOR CITIZEN FORM                                               */}
          {/* ========================================================================= */}
          {activeTab === 'elderly' ? (
            authMode === 'login' ? (
              /* Senior Login Mode */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                
                {/* 1-Tap Biometric Face Login Button */}
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playGentleTap();
                    setFaceModalMode('login');
                    setIsFaceModalOpen(true);
                  }}
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  className="w-full min-h-[58px] rounded-2xl text-white font-black text-base sm:text-lg flex items-center justify-center gap-3 border-2 border-[#47D6B6] shadow-[0_4px_14px_rgba(39, 148, 235,0.25)] hover:brightness-105 active:scale-98 transition-all cursor-pointer"
                >
                  <Scan className="w-6 h-6 text-white" />
                  <span>{t.face_id_login_btn}</span>
                </button>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-black text-[#1E293B] flex items-center justify-between">
                    <span>{t.enter_pin}:</span>
                    <span className="text-xs text-[#2794EB] font-bold">{t.pin_hint}</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={elderlyPin}
                      onChange={(e) => setElderlyPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • •"
                      className="w-full min-h-[58px] pl-12 pr-4 text-2xl font-black tracking-[0.5em] bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] focus:ring-2 focus:ring-[#47D6B6]/20 rounded-2xl outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Optional Name / Phone to resolve if multiple matching PINs */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[#1E293B] flex items-center justify-between">
                    <span>{t.your_name} / Phone (Optional):</span>
                    <span className="text-xs text-[#2794EB] font-bold">Name or Mobile No.</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={elderlyName}
                      onChange={(e) => setElderlyName(e.target.value)}
                      placeholder="Enter name, phone number, or ID"
                      className="w-full min-h-[50px] pl-12 pr-4 text-sm sm:text-base font-bold bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] rounded-2xl outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Remember Me Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#47D6B6]">
                  <label htmlFor="remember-elderly" className="flex items-center gap-2.5 text-xs sm:text-sm font-black text-[#1E293B] cursor-pointer select-none">
                    <input
                      id="remember-elderly"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2794EB] focus:ring-[#2794EB]"
                    />
                    <span>{t.remember_me}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  className="w-full min-h-[58px] rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2 border-2 border-[#47D6B6] shadow-[0_4px_14px_rgba(39, 148, 235,0.25)] hover:brightness-105 cursor-pointer transition-all active:translate-y-1 disabled:opacity-50"
                >
                  {loading ? (
                    <span>Opening Session...</span>
                  ) : (
                    <>
                      <span>{t.enter_smaran_sathi}</span>
                      <ArrowRight className="w-5 h-5 text-white" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Senior Registration Mode */
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[#1E293B]">
                    Full Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={elderlyName}
                    onChange={(e) => setElderlyName(e.target.value)}
                    placeholder="Enter senior citizen full name"
                    className="w-full min-h-[50px] px-4 text-base font-bold bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] rounded-xl outline-none shadow-2xs"
                  />
                </div>

                {/* Phone Number with 1-User-Per-Number Constraint */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#1E293B] flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#2794EB]" />
                      <span>{t.phone_label}:</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {t.phone_rule_badge}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-black text-slate-500 select-none flex items-center gap-1">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </span>
                    <input
                      type="tel"
                      required
                      value={elderlyPhone}
                      onChange={(e) => handleElderlyPhoneChange(e.target.value)}
                      placeholder={t.phone_placeholder}
                      maxLength={10}
                      className={`w-full min-h-[50px] pl-16 pr-10 text-base font-bold bg-white text-[#1E293B] border-2 rounded-xl outline-none shadow-2xs transition-all ${
                        elderlyPhoneDuplicate
                          ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
                          : elderlyPhoneAvailable
                          ? 'border-emerald-500 bg-emerald-50/20 focus:border-emerald-500'
                          : 'border-[#47D6B6] focus:border-[#47D6B6]'
                      }`}
                    />
                    <div className="absolute right-3">
                      {isCheckingElderlyPhone ? (
                        <Loader2 className="w-4 h-4 text-[#2794EB] animate-spin" />
                      ) : elderlyPhoneDuplicate ? (
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                      ) : elderlyPhoneAvailable ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : null}
                    </div>
                  </div>

                  {/* Duplicate Phone Warning & Quick-Switch */}
                  {elderlyPhoneDuplicate && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs space-y-1.5 animate-fadeIn">
                      <div className="flex items-start gap-1.5 font-black">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>This phone number is already registered to {elderlyPhoneDuplicate.name} ({elderlyPhoneDuplicate.role === 'elderly' ? 'Senior' : 'Caregiver'}). Only 1 account can be registered per phone number.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => switchToLoginWithPhone(elderlyPhone, elderlyPhoneDuplicate.role)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer shadow-xs transition-colors"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In with this Number Instead</span>
                      </button>
                    </div>
                  )}
                  {elderlyPhoneAvailable && (
                    <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 pl-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Phone number verified & available for new profile</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-[#1E293B]">
                      Age:
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={110}
                      value={elderlyAge}
                      onChange={(e) => setElderlyAge(Number(e.target.value))}
                      className="w-full min-h-[50px] px-4 text-base font-bold bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] rounded-xl outline-none shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-[#1E293B]">
                      4-Digit PIN:
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={elderlyPin}
                      onChange={(e) => setElderlyPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 1234"
                      className="w-full min-h-[50px] px-4 text-xl font-black tracking-[0.4em] bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] rounded-xl outline-none shadow-2xs"
                    />
                  </div>
                </div>

                {/* Location Picker (North Eastern Region of India Only) with Auto-Detection */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border-2 border-emerald-300/90 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-black text-[#1E293B] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{t.location_section_title}:</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => triggerAutoDetectLocation(true)}
                        disabled={isDetectingLocation}
                        className="text-[10px] font-black text-emerald-950 bg-emerald-200 hover:bg-emerald-300 px-2.5 py-1 rounded-full border border-emerald-400 flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-60 shadow-2xs"
                        title="Automatically identify your location using GPS/Network"
                      >
                        {isDetectingLocation ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-800" />
                            <span>Detecting...</span>
                          </>
                        ) : (
                          <>
                            <Locate className="w-3 h-3 text-emerald-800" />
                            <span>Auto-Detect Location</span>
                          </>
                        )}
                      </button>
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 hidden sm:inline-flex items-center gap-1">
                        <Compass className="w-3 h-3 text-emerald-600" />
                        {t.location_region_badge}
                      </span>
                    </div>
                  </div>

                  {detectedLocationInfo && (
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <span className="flex items-center gap-1 truncate">
                        <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Identified: <strong>{elderlyCity}, {elderlyState}</strong></span>
                      </span>
                      <span className="text-[9px] uppercase tracking-wider bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-black shrink-0 ml-1">
                        {detectedLocationInfo.source === 'gps' ? 'GPS Live' : 'Auto'}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">
                        {t.location_state_label}:
                      </label>
                      <select
                        value={elderlyState}
                        onChange={(e) => {
                          const newState = e.target.value;
                          setElderlyState(newState);
                          const stateObj = NER_STATES_DATA.find(s => s.name === newState);
                          if (stateObj && stateObj.major_cities.length > 0) {
                            setElderlyCity(stateObj.major_cities[0]);
                          }
                        }}
                        className="w-full min-h-[46px] px-3 text-xs sm:text-sm font-bold bg-white text-[#1E293B] border-2 border-emerald-400 focus:border-emerald-500 rounded-xl outline-none shadow-2xs cursor-pointer"
                      >
                        {NER_STATES_DATA.map((st) => (
                          <option key={st.code} value={st.name}>
                            {st.name} {st.native_name ? `(${st.native_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">
                        {t.location_city_label}:
                      </label>
                      <select
                        value={elderlyCity}
                        onChange={(e) => setElderlyCity(e.target.value)}
                        className="w-full min-h-[46px] px-3 text-xs sm:text-sm font-bold bg-white text-[#1E293B] border-2 border-emerald-400 focus:border-emerald-500 rounded-xl outline-none shadow-2xs cursor-pointer"
                      >
                        {NER_STATES_DATA.find(s => s.name === elderlyState)?.major_cities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Assigned Caregiver Code (Optional & Private) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#1E293B] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      {t.caregiver_code_label}:
                    </label>
                    <span className="text-[10px] font-bold text-slate-500">e.g. CG-XXXX</span>
                  </div>
                  <input
                    type="text"
                    value={elderlyCaregiverCode}
                    onChange={(e) => setElderlyCaregiverCode(e.target.value.toUpperCase())}
                    placeholder="Enter Caregiver Code (if given by your caregiver)"
                    className="w-full min-h-[50px] px-4 text-sm font-bold bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] rounded-xl outline-none uppercase shadow-2xs"
                  />
                </div>

                {/* Face ID Biometric Registration Option */}
                <div className="p-3.5 rounded-2xl bg-white border-2 border-[#47D6B6] space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#2794EB] to-[#47D6B6] flex items-center justify-center text-white">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#1E293B]">Face ID Biometric Sign-In</h4>
                        <p className="text-[11px] text-slate-500 font-bold">100% in-browser face recognition</p>
                      </div>
                    </div>
                    {registeredFaceDescriptor ? (
                      <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Face Enrolled
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-[#2794EB] bg-blue-50 px-2 py-0.5 rounded-md">
                        Optional
                      </span>
                    )}
                  </div>

                  {registeredFaceDescriptor ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Biometric vector ready to save</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRegScannerOpen(true)}
                        className="text-xs font-black text-[#2794EB] hover:underline cursor-pointer"
                      >
                        Re-scan
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRegScannerOpen(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#F0FDF4] hover:bg-emerald-100 text-[#1E293B] border border-[#47D6B6] text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Camera className="w-4 h-4 text-[#2794EB]" />
                      <span>Scan Face for Face ID</span>
                    </button>
                  )}
                </div>

                {/* Remember Me Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#47D6B6]">
                  <label htmlFor="remember-elderly-reg" className="flex items-center gap-2.5 text-xs sm:text-sm font-black text-[#1E293B] cursor-pointer select-none">
                    <input
                      id="remember-elderly-reg"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2794EB] focus:ring-[#2794EB]"
                    />
                    <span>{t.remember_me}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  className="w-full min-h-[56px] rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 border-2 border-[#47D6B6] shadow-[0_4px_14px_rgba(39, 148, 235,0.25)] hover:brightness-105 cursor-pointer transition-all active:translate-y-1 mt-2"
                >
                  {loading ? (
                    <span>Registering Account...</span>
                  ) : (
                    <>
                      <span>{t.register_smaran_sathi}</span>
                      <ArrowRight className="w-5 h-5 text-white" />
                    </>
                  )}
                </button>
              </form>
            )
          ) : (
            /* ========================================================================= */
            /* TAB 2: CAREGIVER / DOCTOR FORM                                            */
            /* ========================================================================= */
            authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                
                {/* 1-Tap Biometric Face Login Button */}
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playGentleTap();
                    setFaceModalMode('login');
                    setIsFaceModalOpen(true);
                  }}
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  className="w-full min-h-[58px] rounded-2xl text-white font-black text-base sm:text-lg flex items-center justify-center gap-3 border-2 border-[#47D6B6] shadow-[0_4px_14px_rgba(39, 148, 235,0.25)] hover:brightness-105 active:scale-98 transition-all cursor-pointer"
                >
                  <Scan className="w-6 h-6 text-white" />
                  <span>{t.face_id_login_btn}</span>
                </button>

                <div className="space-y-2">
                  <label className="block text-sm font-black text-[#1E293B] flex items-center justify-between">
                    <span>Caregiver Name / Code / Phone:</span>
                    <span className="text-xs text-[#2794EB] font-bold">Registered Details</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={caregiverName}
                      onChange={(e) => setCaregiverName(e.target.value)}
                      placeholder="Enter Caregiver Name, Code or Mobile No."
                      className="w-full min-h-[54px] pl-12 pr-4 text-base font-bold bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] focus:ring-2 focus:ring-[#47D6B6]/20 rounded-2xl outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-black text-[#1E293B] flex items-center justify-between">
                    <span>4-Digit Security PIN:</span>
                    <span className="text-xs text-[#2794EB] font-bold">4 Numbers</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={caregiverPin}
                      onChange={(e) => setCaregiverPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • •"
                      className="w-full min-h-[58px] pl-12 pr-4 text-2xl font-black tracking-[0.5em] bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] focus:ring-2 focus:ring-[#47D6B6]/20 rounded-2xl outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Remember Me Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#47D6B6]">
                  <label htmlFor="remember-caregiver" className="flex items-center gap-2.5 text-xs sm:text-sm font-black text-[#1E293B] cursor-pointer select-none">
                    <input
                      id="remember-caregiver"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2794EB] focus:ring-[#2794EB]"
                    />
                    <span>{t.remember_me}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  className="w-full min-h-[58px] rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2 border-2 border-[#47D6B6] shadow-[0_4px_14px_rgba(39, 148, 235,0.25)] hover:brightness-105 cursor-pointer transition-all active:translate-y-1 disabled:opacity-50"
                >
                  {loading ? (
                    <span>Verifying Credentials...</span>
                  ) : (
                    <>
                      <span>Access Caregiver Dashboard</span>
                      <ArrowRight className="w-5 h-5 text-white" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[#1E293B]">
                    Caregiver Full Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={caregiverName}
                    onChange={(e) => setCaregiverName(e.target.value)}
                    placeholder="Enter caregiver name"
                    className="w-full min-h-[50px] px-4 text-base font-bold bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] rounded-xl outline-none shadow-2xs"
                  />
                </div>

                {/* Phone Number with 1-User-Per-Number Constraint */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#1E293B] flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#2794EB]" />
                      <span>{t.phone_label}:</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {t.phone_rule_badge}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-black text-slate-500 select-none flex items-center gap-1">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </span>
                    <input
                      type="tel"
                      required
                      value={caregiverPhone}
                      onChange={(e) => handleCaregiverPhoneChange(e.target.value)}
                      placeholder={t.phone_placeholder}
                      maxLength={10}
                      className={`w-full min-h-[50px] pl-16 pr-10 text-base font-bold bg-white text-[#1E293B] border-2 rounded-xl outline-none shadow-2xs transition-all ${
                        caregiverPhoneDuplicate
                          ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
                          : caregiverPhoneAvailable
                          ? 'border-emerald-500 bg-emerald-50/20 focus:border-emerald-500'
                          : 'border-[#47D6B6] focus:border-[#47D6B6]'
                      }`}
                    />
                    <div className="absolute right-3">
                      {isCheckingCaregiverPhone ? (
                        <Loader2 className="w-4 h-4 text-[#2794EB] animate-spin" />
                      ) : caregiverPhoneDuplicate ? (
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                      ) : caregiverPhoneAvailable ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : null}
                    </div>
                  </div>

                  {/* Duplicate Phone Warning & Quick-Switch */}
                  {caregiverPhoneDuplicate && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs space-y-1.5 animate-fadeIn">
                      <div className="flex items-start gap-1.5 font-black">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>This phone number is already registered to {caregiverPhoneDuplicate.name} ({caregiverPhoneDuplicate.role === 'elderly' ? 'Senior' : 'Caregiver'}). Only 1 account can be registered per phone number.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => switchToLoginWithPhone(caregiverPhone, caregiverPhoneDuplicate.role)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer shadow-xs transition-colors"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In with this Number Instead</span>
                      </button>
                    </div>
                  )}
                  {caregiverPhoneAvailable && (
                    <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 pl-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Phone number verified & available for new caregiver profile</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-[#1E293B] flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-stone-500" />
                      Caregiver Code (Locked):
                    </label>
                    <div className="relative">
                      <input
                        id="caregiver-code-registration-input"
                        type="text"
                        readOnly
                        value={caregiverCode}
                        placeholder="e.g. CG-XXXX"
                        className="w-full min-h-[50px] pl-4 pr-9 font-mono font-black text-sm uppercase bg-stone-100 text-stone-700 border-2 border-stone-200 rounded-xl outline-none cursor-not-allowed select-all shadow-2xs"
                      />
                      <Lock className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-[#1E293B]">
                      4-Digit PIN:
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={caregiverPin}
                      onChange={(e) => setCaregiverPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 4321"
                      className="w-full min-h-[50px] px-4 text-lg font-black tracking-[0.3em] bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] rounded-xl outline-none shadow-2xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[#1E293B]">
                    Relation / Role:
                  </label>
                  <select
                    value={caregiverRelation}
                    onChange={(e) => setCaregiverRelation(e.target.value)}
                    className="w-full min-h-[50px] px-4 text-sm font-bold bg-white text-[#1E293B] border-2 border-[#47D6B6] focus:border-[#47D6B6] rounded-xl outline-none shadow-2xs"
                  >
                    <option value="Primary Family Caregiver">Primary Family Caregiver (Son/Daughter/Spouse)</option>
                    <option value="Attending Doctor / Neurologist">Attending Doctor / Neurologist</option>
                    <option value="Geriatric Nurse / Care Assistant">Geriatric Nurse / Care Assistant</option>
                    <option value="Social Worker / Community Volunteer">Social Worker / Community Volunteer</option>
                  </select>
                </div>

                {/* Location Picker (North Eastern Region of India Only) with Auto-Detection */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border-2 border-emerald-300/90 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-black text-[#1E293B] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{t.location_section_title}:</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => triggerAutoDetectLocation(true)}
                        disabled={isDetectingLocation}
                        className="text-[10px] font-black text-emerald-950 bg-emerald-200 hover:bg-emerald-300 px-2.5 py-1 rounded-full border border-emerald-400 flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-60 shadow-2xs"
                        title="Automatically identify your location using GPS/Network"
                      >
                        {isDetectingLocation ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-800" />
                            <span>Detecting...</span>
                          </>
                        ) : (
                          <>
                            <Locate className="w-3 h-3 text-emerald-800" />
                            <span>Auto-Detect Location</span>
                          </>
                        )}
                      </button>
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 hidden sm:inline-flex items-center gap-1">
                        <Compass className="w-3 h-3 text-emerald-600" />
                        {t.location_region_badge}
                      </span>
                    </div>
                  </div>

                  {detectedLocationInfo && (
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <span className="flex items-center gap-1 truncate">
                        <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Identified: <strong>{caregiverCity}, {caregiverState}</strong></span>
                      </span>
                      <span className="text-[9px] uppercase tracking-wider bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-black shrink-0 ml-1">
                        {detectedLocationInfo.source === 'gps' ? 'GPS Live' : 'Auto'}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">
                        {t.location_state_label}:
                      </label>
                      <select
                        value={caregiverState}
                        onChange={(e) => {
                          const newState = e.target.value;
                          setCaregiverState(newState);
                          const stateObj = NER_STATES_DATA.find(s => s.name === newState);
                          if (stateObj && stateObj.major_cities.length > 0) {
                            setCaregiverCity(stateObj.major_cities[0]);
                          }
                        }}
                        className="w-full min-h-[46px] px-3 text-xs sm:text-sm font-bold bg-white text-[#1E293B] border-2 border-emerald-400 focus:border-emerald-500 rounded-xl outline-none shadow-2xs cursor-pointer"
                      >
                        {NER_STATES_DATA.map((st) => (
                          <option key={st.code} value={st.name}>
                            {st.name} {st.native_name ? `(${st.native_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">
                        {t.location_city_label}:
                      </label>
                      <select
                        value={caregiverCity}
                        onChange={(e) => setCaregiverCity(e.target.value)}
                        className="w-full min-h-[46px] px-3 text-xs sm:text-sm font-bold bg-white text-[#1E293B] border-2 border-emerald-400 focus:border-emerald-500 rounded-xl outline-none shadow-2xs cursor-pointer"
                      >
                        {NER_STATES_DATA.find(s => s.name === caregiverState)?.major_cities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Face ID Biometric Registration Option */}
                <div className="p-3.5 rounded-2xl bg-white border-2 border-[#47D6B6] space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#2794EB] to-[#47D6B6] flex items-center justify-center text-white">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#1E293B]">Face ID Biometric Sign-In</h4>
                        <p className="text-[11px] text-slate-500 font-bold">100% in-browser face recognition</p>
                      </div>
                    </div>
                    {registeredFaceDescriptor ? (
                      <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Face Enrolled
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-[#2794EB] bg-blue-50 px-2 py-0.5 rounded-md">
                        Optional
                      </span>
                    )}
                  </div>

                  {registeredFaceDescriptor ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Biometric vector ready to save</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRegScannerOpen(true)}
                        className="text-xs font-black text-[#2794EB] hover:underline cursor-pointer"
                      >
                        Re-scan
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRegScannerOpen(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#F0FDF4] hover:bg-emerald-100 text-[#1E293B] border border-[#47D6B6] text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Camera className="w-4 h-4 text-[#2794EB]" />
                      <span>Scan Face for Face ID</span>
                    </button>
                  )}
                </div>

                {/* Remember Me Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#47D6B6]">
                  <label htmlFor="remember-caregiver-reg" className="flex items-center gap-2.5 text-xs sm:text-sm font-black text-[#1E293B] cursor-pointer select-none">
                    <input
                      id="remember-caregiver-reg"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2794EB] focus:ring-[#2794EB]"
                    />
                    <span>{t.remember_me}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: 'linear-gradient(to right, #2794EB, #17B3C1, #47D6B6, #BFF8D4)' }}
                  className="w-full min-h-[56px] rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 border-2 border-[#47D6B6] shadow-[0_4px_14px_rgba(39, 148, 235,0.25)] hover:brightness-105 cursor-pointer transition-all active:translate-y-1 mt-2"
                >
                  {loading ? (
                    <span>Registering Account...</span>
                  ) : (
                    <>
                      <span>{t.register_smaran_sathi}</span>
                      <ArrowRight className="w-5 h-5 text-white" />
                    </>
                  )}
                </button>
              </form>
            )
          )}

          {/* Privacy Protection Notice */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{t.privacy_note}</span>
            </span>
          </div>
        </div>

      </div>

      {/* Face ID Login Modal */}
      <FaceLoginModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        users={users}
        onLogin={(matchedUser) => {
          if (rememberMe) {
            saveRememberedUser(matchedUser);
          }
          onLogin(matchedUser);
        }}
        onUpdateUser={(updatedUser) => {
          saveUserToFirebase(updatedUser).catch(() => {});
          if (rememberedUser?.id === updatedUser.id) {
            setRememberedUserState(updatedUser);
          }
        }}
        initialMode={faceModalMode}
      />

      {/* Dedicated Face Registration Scanner for Signup Flow */}
      <FaceRegistrationScanner
        isOpen={isRegScannerOpen}
        onClose={() => setIsRegScannerOpen(false)}
        userName={
          activeTab === 'elderly'
            ? (elderlyName.trim() || 'Senior Citizen')
            : (caregiverName.trim() || 'Caregiver')
        }
        onFaceCaptured={(descriptor, photoDataUrl) => {
          setRegisteredFaceDescriptor(descriptor);
          if (photoDataUrl) {
            setRegisteredFacePhoto(photoDataUrl);
          }
        }}
      />
    </div>
  );
};
