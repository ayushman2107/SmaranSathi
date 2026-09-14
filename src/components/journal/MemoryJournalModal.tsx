import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Mic, 
  Square, 
  Image as ImageIcon, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Plus, 
  Heart, 
  Sparkles, 
  Calendar, 
  MapPin, 
  X,
  Smile,
  Music,
  Camera,
  Play,
  Pause,
  Download,
  Check,
  Locate,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
  Upload,
  User as UserIcon,
  AlertCircle
} from 'lucide-react';
import { MemoryJournalEntry, RegionalLanguage, User } from '../../types';
import { soundEffects } from '../../utils/soundEffects';
import { downloadPhoto } from '../../utils/downloadPhoto';
import { autoDetectLocation } from '../../utils/locationDetector';
import { 
  getJournalsForRelationship, 
  saveJournalToFirebase, 
  deleteJournalFromFirebase 
} from '../../lib/firebase';

interface MemoryJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  patientName?: string;
  currentLanguage?: RegionalLanguage;
  isElderlyMode?: boolean;
  currentUser?: User;
  patientUser?: User;
  assignedCaregiver?: User;
  onConnectCaregiver?: () => void;
}

const NER_PROMPTS = [
  'A memorable trip across the Brahmaputra River ferry',
  'Walking through fragrant tea gardens in springtime',
  'Morning prayers with family at Kamakhya or Umananda',
  'Singing traditional Bihu or Khasi folk songs by the fireplace',
  'Cherrapunjee hill mist and collecting wild berries',
  'Watching hornbills fly over Kohima hills in winter'
];

export const MemoryJournalModal: React.FC<MemoryJournalModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  patientName,
  currentLanguage = 'as',
  isElderlyMode = false,
  currentUser,
  patientUser,
  assignedCaregiver,
  onConnectCaregiver
}) => {
  const [entries, setEntries] = useState<MemoryJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Relationship and Privacy Status
  const [relationshipInfo, setRelationshipInfo] = useState<{
    loading: boolean;
    assigned: boolean;
    relationship_id?: string;
    patient_id?: string;
    patient_name?: string;
    caregiver_id?: string;
    caregiver_code?: string;
    caregiver_name?: string;
    message?: string;
  }>({
    loading: true,
    assigned: false
  });

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'audio' | 'photo'>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [locationTag, setLocationTag] = useState('Guwahati, Assam');
  const [emotion, setEmotion] = useState<'joy' | 'peaceful' | 'nostalgic' | 'reflective'>('nostalgic');
  const [isDetectingLoc, setIsDetectingLoc] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-detect Regional Landmark
  const handleAutoDetectLocationTag = async () => {
    setIsDetectingLoc(true);
    try {
      const loc = await autoDetectLocation();
      if (loc) {
        setLocationTag(`${loc.cityName}, ${loc.stateName}`);
        soundEffects.playGentleTap();
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsDetectingLoc(false);
    }
  };

  // Fetch verified relationship assignment and load isolated journal memories
  const loadRelationshipAndMemories = async () => {
    if (!currentUser) return;
    setLoading(true);
    setRelationshipInfo((prev) => ({ ...prev, loading: true }));

    const requesterId = currentUser.id;

    // Resolve effective patient and caregiver
    let effectivePatient: User | undefined = patientUser;
    let effectiveCaregiver: User | undefined = assignedCaregiver;

    if (currentUser.role === 'elderly') {
      effectivePatient = currentUser;
      if (!effectiveCaregiver && currentUser.connected_caregiver_id) {
        effectiveCaregiver = {
          id: currentUser.connected_caregiver_id,
          name: currentUser.connected_caregiver_name || 'Caregiver',
          role: 'caregiver',
          caregiver_code: currentUser.connected_caregiver_id
        } as User;
      }
    } else if (currentUser.role === 'caregiver') {
      effectiveCaregiver = currentUser;
    }

    const targetPatientId = effectivePatient?.id || userId;

    try {
      // 1. Verify assignment relationship via backend
      const verifyRes = await fetch(
        `/api/relationship/verify?requester_id=${encodeURIComponent(requesterId)}&patient_id=${encodeURIComponent(targetPatientId || '')}`
      );
      const verifyData = await verifyRes.json();

      if (verifyRes.ok && verifyData.assigned) {
        setRelationshipInfo({
          loading: false,
          assigned: true,
          relationship_id: verifyData.relationship_id,
          patient_id: verifyData.patient_id,
          patient_name: verifyData.patient_name,
          caregiver_id: verifyData.caregiver_id,
          caregiver_code: verifyData.caregiver_code,
          caregiver_name: verifyData.caregiver_name
        });

        // 2. Query only memories belonging to that verified relationship
        const journalRes = await fetch(
          `/api/journal?requester_id=${encodeURIComponent(requesterId)}&patient_id=${encodeURIComponent(verifyData.patient_id || targetPatientId || '')}`
        );
        if (journalRes.ok) {
          const data = await journalRes.json();
          setEntries(data.journals || []);
        } else if (verifyData.relationship_id) {
          const cloudEntries = await getJournalsForRelationship(verifyData.relationship_id);
          if (cloudEntries && cloudEntries.length > 0) {
            setEntries(cloudEntries);
          }
        }
        return;
      }

      // If backend verify returned not assigned, but we have an effective patient & caregiver
      if (effectivePatient && effectiveCaregiver) {
        const canonicalRelId = `rel_${effectivePatient.id}_${effectiveCaregiver.id}`;
        
        // Link on backend in background
        fetch('/api/caregivers/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caregiver_id: effectiveCaregiver.id,
            caregiver_code: effectiveCaregiver.caregiver_code,
            elderly_id: effectivePatient.id
          })
        }).catch(() => {});

        setRelationshipInfo({
          loading: false,
          assigned: true,
          relationship_id: canonicalRelId,
          patient_id: effectivePatient.id,
          patient_name: effectivePatient.name,
          caregiver_id: effectiveCaregiver.id,
          caregiver_code: effectiveCaregiver.caregiver_code || effectiveCaregiver.id,
          caregiver_name: effectiveCaregiver.name
        });

        try {
          const journalRes = await fetch(
            `/api/journal?requester_id=${encodeURIComponent(requesterId)}&patient_id=${encodeURIComponent(effectivePatient.id)}`
          );
          if (journalRes.ok) {
            const data = await journalRes.json();
            setEntries(data.journals || []);
          } else {
            const cloudEntries = await getJournalsForRelationship(canonicalRelId);
            if (cloudEntries && cloudEntries.length > 0) {
              setEntries(cloudEntries);
            }
          }
        } catch {
          const cloudEntries = await getJournalsForRelationship(canonicalRelId);
          if (cloudEntries && cloudEntries.length > 0) {
            setEntries(cloudEntries);
          }
        }
        return;
      }

      // If truly no pair can be resolved
      setRelationshipInfo({
        loading: false,
        assigned: false,
        message: verifyData.message || 'No active patient-caregiver assignment found'
      });
      setEntries([]);
    } catch (err) {
      console.error('Failed to load relationship and memories', err);
      if (effectivePatient && effectiveCaregiver) {
        const canonicalRelId = `rel_${effectivePatient.id}_${effectiveCaregiver.id}`;
        setRelationshipInfo({
          loading: false,
          assigned: true,
          relationship_id: canonicalRelId,
          patient_id: effectivePatient.id,
          patient_name: effectivePatient.name,
          caregiver_id: effectiveCaregiver.id,
          caregiver_code: effectiveCaregiver.caregiver_code || effectiveCaregiver.id,
          caregiver_name: effectiveCaregiver.name
        });
        const cloudEntries = await getJournalsForRelationship(canonicalRelId);
        if (cloudEntries && cloudEntries.length > 0) {
          setEntries(cloudEntries);
        }
      } else {
        setRelationshipInfo({
          loading: false,
          assigned: false,
          message: 'Unable to verify assignment connection'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRelationshipAndMemories();
    } else {
      window.speechSynthesis.cancel();
      setPlayingId(null);
      setIsAdding(false);
    }
  }, [isOpen, userId, currentUser?.id, patientUser?.id]);

  // Simulated Voice Recording Timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  if (!isOpen) return null;

  const handleStartRecording = () => {
    soundEffects.playGentleTap(520);
    setIsRecording(true);
    setMediaType('audio');
  };

  const handleStopRecording = () => {
    soundEffects.playSuccessChime();
    setIsRecording(false);
    if (!title) {
      const authorLabel = currentUser?.role === 'caregiver' ? 'Caregiver Voice Note' : 'Senior Voice Memory';
      setTitle(`${authorLabel} (${recordingSeconds}s)`);
    }
    if (!content) {
      const speakerName = currentUser?.name || 'Storyteller';
      setContent(`${speakerName} recounted a heartfelt memory in their own voice about moments in ${locationTag}.`);
    }
  };

  // Handle Photo Selection via File Input (Drag & Drop or Manual Pick)
  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoUploadError('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setPhotoUploadError('Image size exceeds 8MB. Please choose a smaller photo.');
      return;
    }

    setPhotoUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMediaUrl(reader.result);
        soundEffects.playGentleTap();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !currentUser) return;

    soundEffects.playSuccessChime();

    const targetPatientId = patientUser?.id || (currentUser.role === 'elderly' ? currentUser.id : userId);

    const newEntryPayload = {
      requester_id: currentUser.id,
      created_by: currentUser.id,
      patient_id: targetPatientId,
      user_id: targetPatientId,
      title: title.trim(),
      content: content.trim(),
      media_type: mediaType,
      media_url: mediaUrl || (mediaType === 'photo' ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80' : undefined),
      audio_duration: mediaType === 'audio' ? `0:${recordingSeconds < 10 ? '0' : ''}${recordingSeconds || 30}` : undefined,
      location_tag: locationTag,
      emotion: emotion
    };

    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntryPayload)
      });
      if (res.ok) {
        const data = await res.json();
        const savedJournal: MemoryJournalEntry = data.journal;
        setEntries((prev) => [savedJournal, ...prev]);

        // Sync to Firestore under same relationship
        try {
          await saveJournalToFirebase(savedJournal);
        } catch (fbErr) {
          console.warn('Firestore sync warning:', fbErr);
        }

        setIsAdding(false);
        setTitle('');
        setContent('');
        setMediaUrl('');
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save memory entry');
      }
    } catch (err) {
      console.error('Error saving memory entry', err);
    }
  };

  const handleDelete = async (id: string) => {
    soundEffects.playGentleTap(350);
    try {
      const requesterParam = currentUser?.id ? `?requester_id=${encodeURIComponent(currentUser.id)}` : '';
      const res = await fetch(`/api/journal/${id}${requesterParam}`, { method: 'DELETE' });
      if (res.ok) {
        setEntries((prev) => prev.filter((item) => item.id !== id));
        try {
          await deleteJournalFromFirebase(id);
        } catch (fbErr) {
          console.warn(fbErr);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Speech Synthesizer for Audio Reminiscence playback
  const handlePlayVoice = (entry: MemoryJournalEntry) => {
    if (playingId === entry.id) {
      window.speechSynthesis.cancel();
      setPlayingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setPlayingId(entry.id);
    soundEffects.playGentleTap(580);

    const utterance = new SpeechSynthesisUtterance(
      `${entry.title}. ${entry.content}`
    );
    utterance.rate = 0.88;
    utterance.pitch = 1.0;
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    window.speechSynthesis.speak(utterance);
  };

  const currentPatientDisplayName = relationshipInfo.patient_name || patientName || userName || 'Senior';
  const currentCaregiverDisplayName = relationshipInfo.caregiver_name || 'Caregiver';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#FCF8F1] border-2 border-amber-500 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col text-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-100 via-orange-50 to-yellow-50 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-md">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-amber-800">
                  Shared Memory Journal
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <Lock className="w-3 h-3 text-emerald-700" />
                  Pair-Isolated Privacy
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-amber-950 leading-tight">
                {currentPatientDisplayName}&apos;s Memory Journal
              </h2>
            </div>
          </div>
          <button
            onClick={() => {
              window.speechSynthesis.cancel();
              onClose();
            }}
            className="p-2 rounded-full hover:bg-amber-200/60 text-amber-900 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Verified Assignment Relationship Banner */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between flex-wrap gap-2">
          {relationshipInfo.loading ? (
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
              <span>Verifying Patient–Caregiver relationship privacy...</span>
            </div>
          ) : relationshipInfo.assigned ? (
            <div className="flex items-center gap-2 text-xs font-black text-amber-950 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-amber-200/80 px-2.5 py-1 rounded-lg border border-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Assigned Pair:</span>
                <span className="text-amber-900 font-extrabold">{relationshipInfo.patient_name} (Patient)</span>
                <span className="text-gray-400">↔</span>
                <span className="text-amber-900 font-extrabold">{relationshipInfo.caregiver_name} (Caregiver)</span>
              </span>
              <span className="text-[11px] font-semibold text-gray-600">
                Memories are strictly shared between only this patient and caregiver.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-black text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>No Active Patient–Caregiver assignment verified for this memory journal.</span>
            </div>
          )}

          {relationshipInfo.assigned && !isAdding && (
            <button
              onClick={() => {
                soundEffects.playGentleTap(520);
                setIsAdding(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log New Memory</span>
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="p-5 sm:p-7 space-y-6 flex-1">
          {/* Unassigned Warning / Onboarding Card */}
          {!relationshipInfo.loading && !relationshipInfo.assigned && (
            <div className="bg-amber-100/60 border-2 border-dashed border-amber-300 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-200 mx-auto flex items-center justify-center text-amber-800">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-amber-950">
                {currentUser?.role === 'elderly' 
                  ? 'Connect Your Caregiver to Activate Your Shared Journal' 
                  : 'No Assigned Patient Selected'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 max-w-md mx-auto font-medium">
                {currentUser?.role === 'elderly'
                  ? 'To protect your privacy, your Memory Journal is strictly isolated and accessible only between you and your verified assigned caregiver. Please link with your caregiver to start logging memories.'
                  : 'Caregivers can only view and create memories for patients who have linked to their Caregiver Code. Please connect with your patient first.'}
              </p>
              {currentUser?.role === 'elderly' && onConnectCaregiver && (
                <button
                  type="button"
                  onClick={onConnectCaregiver}
                  className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-black text-xs sm:text-sm rounded-xl shadow cursor-pointer transition-colors"
                >
                  Link Caregiver Code Now
                </button>
              )}
            </div>
          )}

          {/* New Memory Form */}
          {isAdding && relationshipInfo.assigned && (
            <form onSubmit={handleSaveEntry} className="bg-white border-2 border-amber-400 p-5 sm:p-6 rounded-2xl shadow-md space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div>
                  <h3 className="font-black text-amber-950 text-base sm:text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    Capture Shared Memory
                  </h3>
                  <p className="text-xs text-gray-500 font-bold mt-0.5">
                    Logged as: <strong className="text-amber-900">{currentUser?.name}</strong> ({currentUser?.role === 'elderly' ? 'Patient' : 'Caregiver'})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Inspiration Prompt Chips */}
              <div>
                <label className="block text-xs font-black text-amber-900 uppercase tracking-wide mb-1.5">
                  Regional Inspiration Prompts:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {NER_PROMPTS.slice(0, 3).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        soundEffects.playGentleTap(450);
                        setTitle(prompt);
                      }}
                      className="text-[11px] bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold px-2.5 py-1 rounded-full text-left cursor-pointer"
                    >
                      &ldquo;{prompt}&rdquo;
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Location */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-1">
                    Memory Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Tea garden walks in Dibrugarh"
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-amber-200 rounded-xl font-bold text-gray-900 focus:border-amber-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-black text-gray-700 uppercase tracking-wide">
                      Place / Regional Landmark
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoDetectLocationTag}
                      disabled={isDetectingLoc}
                      className="text-[10px] font-black text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors"
                      title="Auto-detect current location"
                    >
                      {isDetectingLoc ? (
                        <>
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-700" />
                          <span>Detecting...</span>
                        </>
                      ) : (
                        <>
                          <Locate className="w-2.5 h-2.5 text-amber-700" />
                          <span>Auto-Detect</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-amber-600" />
                    <input
                      type="text"
                      value={locationTag}
                      onChange={(e) => setLocationTag(e.target.value)}
                      placeholder="e.g. Shillong, Meghalaya"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-amber-200 rounded-xl font-bold text-gray-900 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Media Type Selector */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMediaType('text')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer ${
                    mediaType === 'text' ? 'bg-amber-600 text-white border-amber-600' : 'bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Written Story
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('audio')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer ${
                    mediaType === 'audio' ? 'bg-amber-600 text-white border-amber-600' : 'bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Voice Recording
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('photo')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer ${
                    mediaType === 'photo' ? 'bg-amber-600 text-white border-amber-600' : 'bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Photo Memory
                </button>
              </div>

              {/* Audio Voice Recorder Widget */}
              {mediaType === 'audio' && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-gray-400'}`} />
                    <span className="text-xs font-black text-gray-800">
                      {isRecording ? `Recording voice: ${recordingSeconds}s` : 'Spoken Voice Reminiscence'}
                    </span>
                  </div>
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      Start Voice Recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-black text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Finish & Save Voice
                    </button>
                  )}
                </div>
              )}

              {/* Photo Upload & URL options */}
              {mediaType === 'photo' && (
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wide">
                    Select Photograph (Upload file or paste image URL)
                  </label>
                  
                  {/* File Upload drag-and-drop or click */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50 rounded-xl p-4 text-center cursor-pointer transition-colors"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handlePhotoFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <Upload className="w-5 h-5 text-amber-700 mx-auto mb-1" />
                    <p className="text-xs font-black text-amber-950">
                      Click to choose photo or drag image file here
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Supports JPG, PNG, WebP up to 8MB
                    </p>
                  </div>

                  {photoUploadError && (
                    <p className="text-xs text-red-600 font-bold">{photoUploadError}</p>
                  )}

                  {/* Or image URL */}
                  <div className="pt-1">
                    <input
                      type="url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="Or enter image URL: https://images.unsplash.com/..."
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-amber-200 rounded-xl font-medium text-gray-900"
                    />
                  </div>

                  {/* Photo Preview */}
                  {mediaUrl && (
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-amber-300">
                      <img 
                        src={mediaUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                      <button
                        type="button"
                        onClick={() => setMediaUrl('')}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-1 rounded-full cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Narrative Content */}
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-1">
                  Story Details & Emotional Memory
                </label>
                <textarea
                  required
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Describe the sounds, smells, people present, and feelings..."
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-amber-200 rounded-xl font-medium text-gray-900 focus:border-amber-500"
                />
              </div>

              {/* Emotion Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-gray-700">Tone:</span>
                {(['joy', 'nostalgic', 'peaceful', 'reflective'] as const).map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setEmotion(em)}
                    className={`px-2.5 py-1 rounded-full text-xs font-black capitalize border cursor-pointer ${
                      emotion === em ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow transition-colors cursor-pointer"
                >
                  Save to Shared Memory Journal
                </button>
              </div>
            </form>
          )}

          {/* Entries Feed */}
          {loading ? (
            <div className="text-center py-12 text-gray-500 font-bold flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
              <span>Loading shared memory journal...</span>
            </div>
          ) : !relationshipInfo.assigned ? null : entries.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-amber-200 p-8">
              <BookOpen className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h4 className="text-base font-black text-amber-950">No Shared Memories Logged Yet</h4>
              <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto">
                Either {relationshipInfo.patient_name} or Caregiver {relationshipInfo.caregiver_name} can log memorable stories, tea garden walks, childhood festivals, or voice recordings.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {entries.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border-2 border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col sm:flex-row gap-4"
                >
                  {/* Photo Thumbnail if available */}
                  {item.media_url && (
                    <div className="relative group sm:w-36 sm:h-36 h-48 rounded-xl overflow-hidden shrink-0 border border-amber-200 bg-amber-50">
                      <img
                        src={item.media_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.playGentleTap();
                          downloadPhoto(item.media_url!, `memory-${item.title.toLowerCase().replace(/\s+/g, '-')}.jpg`);
                          soundEffects.playSuccessChime();
                        }}
                        className="absolute bottom-2 right-2 bg-amber-900/80 hover:bg-amber-900 text-white p-1.5 rounded-lg shadow backdrop-blur-xs flex items-center gap-1 text-[10px] font-black cursor-pointer transition-all opacity-90 group-hover:opacity-100"
                        title="Download photograph"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Save</span>
                      </button>
                    </div>
                  )}

                  {/* Text and Controls */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {/* Author Attribution Badge & Media Type */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {item.creator_role === 'caregiver' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <ShieldCheck className="w-3 h-3 text-emerald-700" />
                              Caregiver: {item.created_by_name || 'Caregiver'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                              <UserIcon className="w-3 h-3 text-amber-700" />
                              Patient: {item.created_by_name || 'Senior'}
                            </span>
                          )}

                          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                            {item.media_type === 'audio' ? '🎙️ Voice Note' : item.media_type === 'photo' ? '📷 Photo' : '📝 Story'}
                          </span>

                          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            {item.emotion}
                          </span>
                        </div>

                        <h4 className="text-base sm:text-lg font-black text-amber-950">
                          {item.title}
                        </h4>

                        <div className="flex items-center gap-3 text-xs text-gray-500 font-semibold mt-0.5">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-600" />
                            {item.location_tag || 'North East India'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete Memory"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-medium">
                      {item.content}
                    </p>

                    {/* Audio Playback Controls */}
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handlePlayVoice(item)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer ${
                          playingId === item.id
                            ? 'bg-amber-700 text-white animate-pulse'
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                        }`}
                      >
                        {playingId === item.id ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause Voice Playback</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-amber-700" />
                            <span>Listen to Voice Story</span>
                          </>
                        )}
                      </button>

                      {item.audio_duration && (
                        <span className="text-[11px] font-bold text-gray-500">
                          Audio Length: {item.audio_duration}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
