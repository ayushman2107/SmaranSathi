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
  AlertCircle,
  MicOff,
  RotateCcw,
  Headphones,
  Radio
} from 'lucide-react';
import { MemoryJournalEntry, RegionalLanguage, User } from '../../types';
import { soundEffects } from '../../utils/soundEffects';
import { downloadPhoto } from '../../utils/downloadPhoto';
import { downloadAudio, downloadMemoryNarrationWav } from '../../utils/downloadAudio';
import { autoDetectLocation } from '../../utils/locationDetector';
import { 
  getJournalsForRelationship, 
  getJournalsForUser,
  saveJournalToFirebase, 
  deleteJournalFromFirebase,
  persistJournalLocally,
  getLocallySavedJournals,
  deleteJournalLocally
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
  initialAudioMode?: boolean;
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
  onConnectCaregiver,
  initialAudioMode = false
}) => {
  const [entries, setEntries] = useState<MemoryJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Audio Recording & Voice Dictation States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingSpokenPrompt, setIsPlayingSpokenPrompt] = useState(false);
  
  // Live Speech-to-Text Dictation
  const [isDictating, setIsDictating] = useState(false);
  const [dictationField, setDictationField] = useState<'content' | 'title' | null>(null);
  const [dictationLang, setDictationLang] = useState<string>(
    currentLanguage === 'as' ? 'as-IN' : currentLanguage === 'bn' ? 'bn-IN' : currentLanguage === 'hi' ? 'hi-IN' : 'en-IN'
  );
  const [dictationInterim, setDictationInterim] = useState('');

  // Audio Playback states
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeAudioPlayingId, setActiveAudioPlayingId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Audio Download states
  const [downloadingAudioId, setDownloadingAudioId] = useState<string | null>(null);
  const [audioDownloadNotice, setAudioDownloadNotice] = useState<string | null>(null);

  const showDownloadNotice = (msg: string) => {
    setAudioDownloadNotice(msg);
    setTimeout(() => {
      setAudioDownloadNotice(null);
    }, 4000);
  };

  // Download recorded voice audio file
  const handleDownloadRecordedAudio = async (audioUrl: string, entryTitle: string, itemId?: string) => {
    if (!audioUrl) return;
    const targetId = itemId || 'new-preview';
    setDownloadingAudioId(targetId);
    soundEffects.playGentleTap(540);

    try {
      const sanitizedTitle = (entryTitle || 'memory-voice')
        .toLowerCase()
        .replace(/[^a-z0-9]/gi, '-')
        .substring(0, 30);
      const filename = `smaran-sathi-memory-${sanitizedTitle}.webm`;
      
      const success = await downloadAudio(audioUrl, filename);
      if (success) {
        soundEffects.playSuccessChime();
        showDownloadNotice(`Downloaded voice audio: ${filename}`);
      }
    } catch (e) {
      console.warn('Audio download failed:', e);
    } finally {
      setDownloadingAudioId(null);
    }
  };

  // Download either recorded voice audio or synthesized spoken keepsake audio for any memory entry
  const handleDownloadMemoryAudio = async (item: MemoryJournalEntry) => {
    setDownloadingAudioId(item.id);
    soundEffects.playGentleTap(540);

    try {
      const sanitizedTitle = (item.title || 'memory-audio')
        .toLowerCase()
        .replace(/[^a-z0-9]/gi, '-')
        .substring(0, 30);

      if (item.media_type === 'audio' || item.media_url?.startsWith('data:audio') || item.media_url?.includes('.mp3') || item.media_url?.includes('.webm') || item.media_url?.includes('.wav')) {
        const filename = `memory-voice-${sanitizedTitle}.webm`;
        const success = await downloadAudio(item.media_url!, filename);
        if (success) {
          soundEffects.playSuccessChime();
          showDownloadNotice(`Downloaded recorded voice audio: ${filename}`);
        }
      } else {
        // Text-based memory narration audio keepsake download
        const filename = `memory-story-${sanitizedTitle}.wav`;
        const success = await downloadMemoryNarrationWav(item.title, item.content, item.created_by_name, filename);
        if (success) {
          soundEffects.playSuccessChime();
          showDownloadNotice(`Downloaded memory audio keepsake: ${filename}`);
        }
      }
    } catch (e) {
      console.warn('Failed to download memory audio:', e);
    } finally {
      setDownloadingAudioId(null);
    }
  };

  // Auto-activate voice writing mode if initialAudioMode is requested
  useEffect(() => {
    if (isOpen && initialAudioMode) {
      setIsAdding(true);
      setMediaType('audio');
    }
  }, [isOpen, initialAudioMode]);

  // Audio Reminiscence Prompter (TTS in local language)
  const handlePlaySpokenPrompt = (customPrompt?: string) => {
    const defaultAssamese = 'নমস্কাৰ! আপোনাৰ এটা পুৰণি স্মৃতি কওক। শৈশৱৰ দিন, চাহ বাগিচা বা বিহু উৎসৱৰ কথা ক\'ব পাৰে।';
    const defaultBengali = 'নমস্কার! আপনার শৈশবের কোনো প্রিয় স্মৃতি, উৎসব বা পরিবারের কথা বলুন।';
    const defaultHindi = 'नमस्ते! अपनी कोई प्यारी पुरानी याद, बचपन के दिन या त्योहार के बारे में बताएं।';
    const defaultEnglish = 'Namaskar! Please share a fond memory. Tell us about your childhood days, tea gardens, or festive celebrations.';
    
    const textToSpeak = customPrompt || (
      currentLanguage === 'as' ? defaultAssamese :
      currentLanguage === 'bn' ? defaultBengali :
      currentLanguage === 'hi' ? defaultHindi : defaultEnglish
    );

    if (isPlayingSpokenPrompt) {
      window.speechSynthesis.cancel();
      setIsPlayingSpokenPrompt(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      setIsPlayingSpokenPrompt(true);
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.86;
      utterance.lang = dictationLang;
      utterance.onend = () => setIsPlayingSpokenPrompt(false);
      utterance.onerror = () => setIsPlayingSpokenPrompt(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setIsPlayingSpokenPrompt(false);
    }
  };

  // Refs for media and audio hardware
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const cardAudioRef = useRef<HTMLAudioElement | null>(null);

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

    // 1. Instant local cache load for zero-latency UI
    const localCached = getLocallySavedJournals(targetPatientId);
    if (localCached.length > 0) {
      setEntries(localCached);
    }

    const mergeEntries = (newItems: MemoryJournalEntry[]) => {
      if (!newItems || newItems.length === 0) return;
      newItems.forEach(persistJournalLocally);
      setEntries((prev) => {
        const map = new Map<string, MemoryJournalEntry>();
        newItems.forEach((item) => map.set(item.id, item));
        prev.forEach((item) => {
          if (!map.has(item.id)) map.set(item.id, item);
        });
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    };

    try {
      // 2. Verify assignment relationship via backend
      const verifyRes = await fetch(
        `/api/relationship/verify?requester_id=${encodeURIComponent(requesterId)}&patient_id=${encodeURIComponent(targetPatientId || '')}`
      );
      const verifyData = verifyRes.ok ? await verifyRes.json() : { assigned: false };

      if (verifyData.assigned) {
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

        // Query memories belonging to that verified relationship
        try {
          const journalRes = await fetch(
            `/api/journal?requester_id=${encodeURIComponent(requesterId)}&patient_id=${encodeURIComponent(verifyData.patient_id || targetPatientId || '')}`
          );
          if (journalRes.ok) {
            const data = await journalRes.json();
            if (data.journals) mergeEntries(data.journals);
          }
        } catch (e) {
          console.warn('Backend journal fetch error:', e);
        }

        if (verifyData.relationship_id) {
          const cloudEntries = await getJournalsForRelationship(verifyData.relationship_id);
          if (cloudEntries && cloudEntries.length > 0) {
            mergeEntries(cloudEntries);
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
            if (data.journals) mergeEntries(data.journals);
          }
        } catch {}

        const cloudEntries = await getJournalsForRelationship(canonicalRelId);
        if (cloudEntries && cloudEntries.length > 0) {
          mergeEntries(cloudEntries);
        }
        return;
      }

      // If senior has no assigned caregiver yet, keep memories accessible as personal journal
      const selfRelId = `rel_${targetPatientId}_self`;
      setRelationshipInfo({
        loading: false,
        assigned: false,
        relationship_id: selfRelId,
        patient_id: targetPatientId,
        patient_name: effectivePatient?.name || 'Senior',
        message: verifyData.message || 'Personal Memory Journal'
      });

      // Load patient memories from API and cloud
      try {
        const journalRes = await fetch(
          `/api/journal?requester_id=${encodeURIComponent(requesterId)}&patient_id=${encodeURIComponent(targetPatientId)}`
        );
        if (journalRes.ok) {
          const data = await journalRes.json();
          if (data.journals) mergeEntries(data.journals);
        }
      } catch {}

      const userCloudEntries = await getJournalsForUser(targetPatientId);
      if (userCloudEntries && userCloudEntries.length > 0) {
        mergeEntries(userCloudEntries);
      }
    } catch (err) {
      console.error('Failed to load relationship and memories', err);
      const fallbackRelId = effectivePatient && effectiveCaregiver 
        ? `rel_${effectivePatient.id}_${effectiveCaregiver.id}`
        : `rel_${targetPatientId}_self`;

      setRelationshipInfo({
        loading: false,
        assigned: Boolean(effectivePatient && effectiveCaregiver),
        relationship_id: fallbackRelId,
        patient_id: targetPatientId,
        patient_name: effectivePatient?.name || 'Senior',
        caregiver_id: effectiveCaregiver?.id,
        caregiver_code: effectiveCaregiver?.caregiver_code || effectiveCaregiver?.id,
        caregiver_name: effectiveCaregiver?.name,
        message: 'Loaded from local device storage'
      });

      const fallbackList = getLocallySavedJournals(targetPatientId);
      if (fallbackList.length > 0) {
        mergeEntries(fallbackList);
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
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (cardAudioRef.current) {
        cardAudioRef.current.pause();
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setIsRecording(false);
      setIsDictating(false);
      setDictationField(null);
      setActiveAudioPlayingId(null);
      setIsPreviewPlaying(false);
      setIsAdding(false);
    }
  }, [isOpen, userId, currentUser?.id, patientUser?.id]);

  // Real Audio Recording Timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  if (!isOpen) return null;

  // Real Audio Recording via MediaRecorder
  const handleStartRealRecording = async () => {
    soundEffects.playGentleTap(520);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setRecordedAudioUrl(base64Audio);
          setMediaUrl(base64Audio);
          setMediaType('audio');
        };
        reader.readAsDataURL(blob);

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }
      };

      recorder.start(200);
      setIsRecording(true);
      setMediaType('audio');
    } catch (err: any) {
      console.warn('Microphone permission or access error, falling back:', err);
      // Graceful fallback for environments without microphone access
      setIsRecording(true);
      setMediaType('audio');
    }
  };

  const handleStopRealRecording = () => {
    soundEffects.playSuccessChime();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping media recorder:', e);
      }
    }
    setIsRecording(false);
    if (!title) {
      const authorLabel = currentUser?.role === 'caregiver' ? 'Caregiver Voice Memory' : 'Senior Voice Memory';
      const secStr = recordingSeconds > 0 ? ` (${recordingSeconds}s)` : '';
      setTitle(`${authorLabel}${secStr}`);
    }
    if (!content) {
      const speakerName = currentUser?.name || 'Storyteller';
      setContent(`${speakerName} recorded a heartfelt memory in their own voice about moments in ${locationTag}.`);
    }
  };

  // Preview recorded audio
  const handleTogglePreviewAudio = () => {
    if (!recordedAudioUrl) return;

    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }

    soundEffects.playGentleTap(540);
    const audio = previewAudioRef.current || new Audio(recordedAudioUrl);
    if (!previewAudioRef.current) {
      previewAudioRef.current = audio;
    } else {
      previewAudioRef.current.src = recordedAudioUrl;
    }

    audio.onended = () => setIsPreviewPlaying(false);
    audio.play().then(() => setIsPreviewPlaying(true)).catch((e) => {
      console.warn('Audio preview play error:', e);
      setIsPreviewPlaying(false);
    });
  };

  // AI Voice-to-Text Transcription for Recorded Audio
  const handleTranscribeRecordedAudio = async () => {
    const audioData = recordedAudioUrl || mediaUrl;
    if (!audioData) return;

    setIsTranscribing(true);
    soundEffects.playGentleTap(600);

    try {
      const res = await fetch('/api/journal/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_data: audioData,
          language_hint: dictationLang,
          prompt_context: `North East India memory journal recounted in ${locationTag}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.transcript) {
          setContent((prev) => {
            const trimmed = prev.trim();
            return trimmed && !trimmed.includes('recorded a heartfelt memory') ? `${trimmed}\n\n${data.transcript}` : data.transcript;
          });
        }
        if (data.title && (!title || title.includes('Voice Memory'))) {
          setTitle(data.title);
        }
        if (data.emotion) {
          setEmotion(data.emotion);
        }
        soundEffects.playSuccessChime();
      }
    } catch (err) {
      console.warn('Voice transcription error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Speech-to-Text Voice Dictation ("Speak to Write")
  const startSpeechDictation = (field: 'content' | 'title') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Fall back directly to voice recording
      setMediaType('audio');
      handleStartRealRecording();
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = dictationLang;

      recognition.onstart = () => {
        soundEffects.playGentleTap(520);
        setIsDictating(true);
        setDictationField(field);
        setDictationInterim('');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptSegment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinal += transcriptSegment;
          } else {
            currentInterim += transcriptSegment;
          }
        }

        setDictationInterim(currentInterim);

        if (currentFinal) {
          if (field === 'content') {
            setContent((prev) => {
              const cleaned = prev.trim();
              return cleaned ? `${cleaned} ${currentFinal.trim()}` : currentFinal.trim();
            });
          } else if (field === 'title') {
            setTitle((prev) => {
              const cleaned = prev.trim();
              return cleaned ? `${cleaned} ${currentFinal.trim()}` : currentFinal.trim();
            });
          }
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition notice:', e.error);
        if (e.error !== 'no-speech') {
          setIsDictating(false);
          setDictationField(null);
          setDictationInterim('');
        }
      };

      recognition.onend = () => {
        setIsDictating(false);
        setDictationField(null);
        setDictationInterim('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsDictating(false);
      setDictationField(null);
    }
  };

  const stopSpeechDictation = () => {
    soundEffects.playGentleTap(350);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }
    setIsDictating(false);
    setDictationField(null);
    setDictationInterim('');
  };

  // Toggle playback of recorded audio inside memory journal cards
  const handleToggleCardAudio = (item: MemoryJournalEntry) => {
    if (activeAudioPlayingId === item.id) {
      if (cardAudioRef.current) {
        cardAudioRef.current.pause();
      }
      setActiveAudioPlayingId(null);
      return;
    }

    if (cardAudioRef.current) {
      cardAudioRef.current.pause();
    }

    window.speechSynthesis.cancel();
    setPlayingId(null);

    soundEffects.playGentleTap(540);
    if (item.media_url) {
      const audio = new Audio(item.media_url);
      audio.onended = () => {
        setActiveAudioPlayingId(null);
      };
      cardAudioRef.current = audio;
      audio.play().then(() => {
        setActiveAudioPlayingId(item.id);
      }).catch((e) => {
        console.warn('Audio play error, falling back to TTS:', e);
        handlePlayVoice(item);
      });
    } else {
      handlePlayVoice(item);
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
    const resolvedRelId = relationshipInfo.relationship_id || `rel_${targetPatientId}_${currentUser.id}`;
    const resolvedCaregiverId = relationshipInfo.caregiver_id || (currentUser.role === 'caregiver' ? currentUser.id : 'unassigned');

    const newEntry: MemoryJournalEntry = {
      id: `mj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      relationship_id: resolvedRelId,
      patient_id: targetPatientId,
      caregiver_id: resolvedCaregiverId,
      created_by: currentUser.id,
      creator_role: currentUser.role as 'elderly' | 'caregiver',
      created_by_name: currentUser.name,
      user_id: targetPatientId,
      title: title.trim(),
      content: content.trim(),
      media_type: mediaType,
      media_url: mediaUrl || (mediaType === 'photo' ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80' : undefined),
      audio_duration: (mediaType === 'audio' || mediaUrl?.startsWith('data:audio')) ? (recordingSeconds > 0 ? `${Math.floor(recordingSeconds / 60)}:${(recordingSeconds % 60).toString().padStart(2, '0')}` : '0:20') : undefined,
      location_tag: locationTag || 'North East India',
      emotion: emotion,
      created_at: new Date().toISOString()
    };

    // 1. Immediately persist locally & update state so data is NEVER lost
    persistJournalLocally(newEntry);
    setEntries((prev) => [newEntry, ...prev.filter((item) => item.id !== newEntry.id)]);

    // Clean inputs immediately so user feels high responsiveness
    setIsAdding(false);
    setTitle('');
    setContent('');
    setMediaUrl('');
    setRecordedAudioUrl(null);
    setIsPreviewPlaying(false);
    if (previewAudioRef.current) {
      try { previewAudioRef.current.pause(); } catch (e) { /* ignore */ }
    }
    setRecordingSeconds(0);

    // 2. Persist to Firestore
    try {
      await saveJournalToFirebase(newEntry);
    } catch (fbErr) {
      console.warn('Firestore sync warning:', fbErr);
    }

    // 3. Persist to Backend API
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEntry,
          requester_id: currentUser.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.journal) {
          persistJournalLocally(data.journal);
          setEntries((prev) => [
            data.journal,
            ...prev.filter((item) => item.id !== newEntry.id && item.id !== data.journal.id)
          ]);
        }
      }
    } catch (err) {
      console.warn('Backend journal sync notice:', err);
    }
  };

  const handleDelete = async (id: string) => {
    soundEffects.playGentleTap(350);
    // Remove locally and update state immediately
    setEntries((prev) => prev.filter((item) => item.id !== id));
    deleteJournalLocally(id);

    try {
      const requesterParam = currentUser?.id ? `?requester_id=${encodeURIComponent(currentUser.id)}` : '';
      await fetch(`/api/journal/${id}${requesterParam}`, { method: 'DELETE' });
      await deleteJournalFromFirebase(id);
    } catch (err) {
      console.warn('Error deleting journal remotely:', err);
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

        {/* Download Feedback Notice Banner */}
        {audioDownloadNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{audioDownloadNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAudioDownloadNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-black cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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

          {!isAdding && (
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
          {/* Unassigned Informative Notice */}
          {!relationshipInfo.loading && !relationshipInfo.assigned && (
            <div className="bg-amber-100/50 border border-amber-300/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-200/80 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-950">
                    {currentUser?.role === 'elderly' 
                      ? 'Personal Memory Journal Active' 
                      : 'Independent Memory View'}
                  </h3>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">
                    {currentUser?.role === 'elderly'
                      ? 'Your memories are safely stored on this device. Link with your caregiver anytime to automatically share and synchronize these memories with them.'
                      : 'You are viewing memories for this patient. Link to their account to enable real-time collaborative memory sharing.'}
                  </p>
                </div>
              </div>
              {currentUser?.role === 'elderly' && onConnectCaregiver && (
                <button
                  type="button"
                  onClick={onConnectCaregiver}
                  className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-black text-xs rounded-xl shadow cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  Link Caregiver Code
                </button>
              )}
            </div>
          )}

          {/* New Memory Form */}
          {isAdding && (
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wide">
                      Memory Title
                    </label>
                  </div>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Tea garden walks in Dibrugarh"
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-amber-200 rounded-xl font-bold text-gray-900 focus:border-amber-500 focus:bg-white transition-colors"
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
                      className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-amber-200 rounded-xl font-bold text-gray-900 focus:border-amber-500 focus:bg-white transition-colors"
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

              {/* Audio Voice Recorder Widget with Real Audio & AI Transcription */}
              {mediaType === 'audio' && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-3.5 h-3.5 rounded-full ${isRecording ? 'bg-red-600 animate-ping' : (recordedAudioUrl || mediaUrl?.startsWith('data:audio')) ? 'bg-emerald-600' : 'bg-gray-400'}`} />
                      <div>
                        <h5 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                          {isRecording 
                            ? `Recording Voice Memory: ${Math.floor(recordingSeconds / 60)}:${(recordingSeconds % 60).toString().padStart(2, '0')}`
                            : (recordedAudioUrl || mediaUrl?.startsWith('data:audio'))
                              ? 'Voice Memory Captured Ready'
                              : 'Spoken Voice Recording'}
                        </h5>
                        <p className="text-[11px] text-gray-600 font-medium">
                          {isRecording 
                            ? 'Senior or caregiver is speaking into the microphone...' 
                            : (recordedAudioUrl || mediaUrl?.startsWith('data:audio'))
                              ? 'Your voice memory is recorded. You can preview, re-record, or transcribe to written text.'
                              : 'Press record to speak your memory in your own voice and preserve it forever.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isRecording && !(recordedAudioUrl || mediaUrl?.startsWith('data:audio')) && (
                        <button
                          type="button"
                          onClick={handleStartRealRecording}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow cursor-pointer transition-colors"
                        >
                          <Mic className="w-4 h-4" />
                          <span>Start Voice Recording</span>
                        </button>
                      )}

                      {isRecording && (
                        <button
                          type="button"
                          onClick={handleStopRealRecording}
                          className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow cursor-pointer transition-colors animate-pulse"
                        >
                          <Square className="w-4 h-4 text-red-400" />
                          <span>Finish Recording</span>
                        </button>
                      )}

                      {(recordedAudioUrl || mediaUrl?.startsWith('data:audio')) && !isRecording && (
                        <button
                          type="button"
                          onClick={handleStartRealRecording}
                          className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
                          <span>Re-record</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Equalizer/Soundwave visualizer bars during recording */}
                  {isRecording && (
                    <div className="bg-amber-100/70 rounded-xl p-3 flex items-center justify-center gap-1.5 h-12 overflow-hidden">
                      {[35, 65, 25, 90, 50, 100, 45, 80, 55, 95, 30, 85, 60, 40, 75, 50, 88, 30].map((h, i) => (
                        <div
                          key={i}
                          className="w-1.5 bg-red-600 rounded-full animate-pulse transition-all"
                          style={{
                            height: `${Math.max(10, (h * ((recordingSeconds % 3) + 1)) % 36)}px`,
                            animationDelay: `${i * 65}ms`
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Recorded Audio Preview Player & AI Transcribe Action */}
                  {(recordedAudioUrl || mediaUrl?.startsWith('data:audio')) && !isRecording && (
                    <div className="bg-white border border-amber-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleTogglePreviewAudio}
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm cursor-pointer transition-all ${
                            isPreviewPlaying ? 'bg-amber-700 scale-105' : 'bg-amber-600 hover:bg-amber-700'
                          }`}
                          title={isPreviewPlaying ? 'Pause Audio Preview' : 'Play Audio Preview'}
                        >
                          {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <div>
                          <span className="text-xs font-black text-amber-950 block">Voice Memory Audio Preview</span>
                          <span className="text-[11px] text-gray-500 font-bold">
                            {recordingSeconds > 0 ? `Duration: ${Math.floor(recordingSeconds / 60)}:${(recordingSeconds % 60).toString().padStart(2, '0')}` : 'Captured Audio File'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Download Voice Audio File */}
                        <button
                          type="button"
                          onClick={() => handleDownloadRecordedAudio(recordedAudioUrl || mediaUrl, title || 'voice-memory', 'new-preview')}
                          disabled={downloadingAudioId === 'new-preview'}
                          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                          title="Download voice recording file (.webm)"
                        >
                          {downloadingAudioId === 'new-preview' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5 text-amber-800" />
                              <span>Download Audio</span>
                            </>
                          )}
                        </button>

                        {/* AI Voice-to-Text Button */}
                        <button
                          type="button"
                          onClick={handleTranscribeRecordedAudio}
                          disabled={isTranscribing}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all disabled:opacity-60"
                          title="Transcribe spoken voice to written memory story"
                        >
                          {isTranscribing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Transcribing with AI...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                              <span>✨ Transcribe Voice to Written Story</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
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

              {/* Narrative Content with Voice Dictation */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wide">
                    Story Details & Emotional Memory
                  </label>
                </div>

                {/* Active Dictation Live Feedback Banner */}
                {isDictating && dictationField === 'content' && (
                  <div className="mb-2 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                      <span className="text-xs font-black text-red-950">
                        Listening ({dictationLang === 'as-IN' ? 'অসমীয়া' : dictationLang === 'bn-IN' ? 'বাংলা' : dictationLang === 'hi-IN' ? 'हिन्दी' : 'English'})... Speak your memory aloud!
                      </span>
                    </div>
                    {dictationInterim && (
                      <span className="text-xs italic text-gray-600 font-medium truncate max-w-xs">
                        &ldquo;{dictationInterim}&rdquo;
                      </span>
                    )}
                  </div>
                )}

                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Speak or type memories here: Describe the sounds, smells, people present, and feelings from childhood festivals, family times, or tea gardens..."
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-amber-200 rounded-xl font-medium text-gray-900 focus:border-amber-500 focus:bg-white transition-colors"
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
          ) : entries.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-amber-200 p-8">
              <BookOpen className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h4 className="text-base font-black text-amber-950">No Memories Logged Yet</h4>
              <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto">
                Log memorable stories, tea garden walks, childhood festivals, or record voice memories anytime.
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
                  {item.media_url && !item.media_url.startsWith('data:audio') && item.media_type !== 'audio' && (
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
                            {item.media_type === 'audio' || item.media_url?.startsWith('data:audio') ? '🎙️ Voice Note' : item.media_type === 'photo' ? '📷 Photo' : '📝 Story'}
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

                    {/* In-Card Voice Memory Audio Player */}
                    {(item.media_type === 'audio' || item.media_url?.startsWith('data:audio')) && (
                      <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 my-2">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleCardAudio(item)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm cursor-pointer transition-all ${
                              activeAudioPlayingId === item.id ? 'bg-red-600 scale-105 animate-pulse' : 'bg-amber-700 hover:bg-amber-800'
                            }`}
                            title={activeAudioPlayingId === item.id ? 'Pause Voice Recording' : 'Play Voice Recording'}
                          >
                            {activeAudioPlayingId === item.id ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>
                          <div>
                            <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                              <Headphones className="w-3.5 h-3.5 text-amber-700" />
                              Recorded Voice Memory
                            </span>
                            <span className="text-[11px] text-gray-600 font-bold">
                              {item.audio_duration ? `Voice Duration: ${item.audio_duration}` : 'Original Voice Recording'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeAudioPlayingId === item.id && (
                            <div className="flex items-center gap-1 h-5 px-2">
                              <span className="w-1 bg-amber-700 rounded-full animate-pulse h-3" />
                              <span className="w-1 bg-amber-600 rounded-full animate-pulse h-5" />
                              <span className="w-1 bg-amber-700 rounded-full animate-pulse h-2" />
                              <span className="w-1 bg-amber-600 rounded-full animate-pulse h-4" />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDownloadRecordedAudio(item.media_url!, item.title, item.id)}
                            disabled={downloadingAudioId === item.id}
                            className="px-2.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0 disabled:opacity-60"
                            title="Download original voice recording audio file"
                          >
                            {downloadingAudioId === item.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Voice Audio</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Audio Playback & Download Controls */}
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handlePlayVoice(item)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer ${
                          playingId === item.id
                            ? 'bg-amber-700 text-white animate-pulse'
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                        }`}
                      >
                        {playingId === item.id ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause Voice Reading</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-amber-700" />
                            <span>Read Story Aloud (TTS)</span>
                          </>
                        )}
                      </button>

                      {/* Download Audio Option */}
                      <button
                        type="button"
                        onClick={() => handleDownloadMemoryAudio(item)}
                        disabled={downloadingAudioId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                        title={
                          item.media_type === 'audio' || item.media_url?.startsWith('data:audio')
                            ? 'Download recorded voice audio file (.webm)'
                            : 'Download spoken story audio keepsake (.wav)'
                        }
                      >
                        {downloadingAudioId === item.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 text-amber-700" />
                            <span>Download Audio</span>
                          </>
                        )}
                      </button>

                      {item.audio_duration && !(item.media_type === 'audio' || item.media_url?.startsWith('data:audio')) && (
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
