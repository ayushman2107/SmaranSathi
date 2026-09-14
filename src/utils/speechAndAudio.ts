import React from 'react';
import { RegionalLanguage } from '../types';

class AudioService {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // Gentle pentatonic success chime (warm sine wave, smooth envelope)
  playSuccessChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.45);
      });
    } catch {
      // AudioContext policy safe catch
    }
  }

  // Gentle soft pop for tap or selection
  playGentleTap(freq = 440) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  // Gentle chime for reminder announcement
  playGentleChime(freq?: number) {
    if (freq) {
      this.playGentleTap(freq);
    } else {
      this.playSuccessChime();
    }
  }

  // Melodic, resonant multi-tone alarm for scheduled reminders
  playReminderAlarm(priority: 'high' | 'medium' | 'gentle' = 'medium') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Frequencies for soothing temple bells / harmonic chime
      const notePatterns = {
        gentle: [523.25, 783.99],
        medium: [659.25, 783.99, 1046.50],
        high: [783.99, 1046.50, 1318.51, 1567.98]
      };

      const notes = notePatterns[priority] || notePatterns.medium;

      // Repeat the melody sequence twice gently (0s and 1.3s)
      [0, 1.3].forEach((offset) => {
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + offset + i * 0.18);

          // Warm attack, sustained resonance, gentle decay
          const startTime = now + offset + i * 0.18;
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.18, startTime + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.9);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.95);
        });
      });
    } catch {
      // Audio policy safe
    }
  }

  // Encouraging warm tone (never harsh, soft wobble)
  playGentleEncouragement() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [392.00, 440.00]; // G4, A4

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.08, now + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.38);
      });
    } catch {}
  }

  // High sound / High-clarity instrument-specific rhythm tones
  playRhythmInstrumentTone(index: number, options?: { volume?: number; highBoost?: boolean }) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const volMultiplier = options?.volume !== undefined ? options.volume : (options?.highBoost ? 1.6 : 1.3);

      switch (index % 4) {
        case 0: {
          // 🥁 BIHU DHOL (Acoustic Folk Drum): Deep resonant strike + high slap click
          const oscBody = ctx.createOscillator();
          const oscSlap = ctx.createOscillator();
          const gainBody = ctx.createGain();
          const gainSlap = ctx.createGain();

          oscBody.type = 'sine';
          oscBody.frequency.setValueAtTime(240, now);
          oscBody.frequency.exponentialRampToValueAtTime(80, now + 0.35);

          gainBody.gain.setValueAtTime(0, now);
          gainBody.gain.linearRampToValueAtTime(0.38 * volMultiplier, now + 0.008);
          gainBody.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

          oscSlap.type = 'triangle';
          oscSlap.frequency.setValueAtTime(720, now);
          oscSlap.frequency.exponentialRampToValueAtTime(220, now + 0.08);

          gainSlap.gain.setValueAtTime(0, now);
          gainSlap.gain.linearRampToValueAtTime(0.28 * volMultiplier, now + 0.005);
          gainSlap.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

          oscBody.connect(gainBody);
          gainBody.connect(ctx.destination);
          oscSlap.connect(gainSlap);
          gainSlap.connect(ctx.destination);

          oscBody.start(now);
          oscBody.stop(now + 0.45);
          oscSlap.start(now);
          oscSlap.stop(now + 0.15);
          break;
        }
        case 1: {
          // 🎺 PEPA HORN (Assamese Buffalo Horn Pipe): Piercing, bright, high brass tone with harmonic overtones
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          const biquad = ctx.createBiquadFilter();

          osc1.type = 'sawtooth';
          osc1.frequency.setValueAtTime(659.25, now); // E5 high pitch
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(987.77, now); // B5 fifth overtone

          biquad.type = 'lowpass';
          biquad.frequency.setValueAtTime(3400, now);
          biquad.Q.setValueAtTime(3.8, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.32 * volMultiplier, now + 0.03);
          gain.gain.setValueAtTime(0.26 * volMultiplier, now + 0.28);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

          osc1.connect(biquad);
          osc2.connect(biquad);
          biquad.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.6);
          osc2.stop(now + 0.6);
          break;
        }
        case 2: {
          // 🍋 KAJI NEMU / CITRUS CHIME (Crystalline Bright Bell / High Marimba): Sparkle C6 & G6
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(1046.50, now); // C6 crystal high note
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1567.98, now); // G6 high shimmer

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.35 * volMultiplier, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.7);
          osc2.stop(now + 0.7);
          break;
        }
        case 3:
        default: {
          // 🦏 RHINO FRIEND / MAJESTIC FOLK GONG: Resonant high melodic gong with sparkling upper partials
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const osc3 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(523.25, now); // C5
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(1046.50, now); // C6
          osc3.type = 'sine';
          osc3.frequency.setValueAtTime(2093.00, now); // C7 high crystal sparkle

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.32 * volMultiplier, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

          osc1.connect(gain);
          osc2.connect(gain);
          osc3.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc3.start(now);
          osc1.stop(now + 0.8);
          osc2.stop(now + 0.8);
          osc3.stop(now + 0.8);
          break;
        }
      }
    } catch {}
  }

  // Sequence tone with high clarity / high sound synthesis
  playSequenceTone(index: number, options?: { volume?: number; highBoost?: boolean }) {
    this.playRhythmInstrumentTone(index, {
      volume: options?.volume,
      highBoost: options?.highBoost ?? true
    });
  }
}

export const soundEffects = new AudioService();

// Voice Cache & Selection Helper
let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  if (cachedVoices.length > 0) return cachedVoices;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

/**
 * Finds the best voice for a given language code (prioritizing high quality Hindi and Indian voices)
 */
function findBestVoice(langCode: string): SpeechSynthesisVoice | null {
  const voices = loadVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Specific search for Hindi voices if requested
  if (langCode.startsWith('hi')) {
    const hindiVoice = voices.find(
      (v) =>
        v.lang === 'hi-IN' ||
        v.lang === 'hi_IN' ||
        v.lang.toLowerCase().startsWith('hi') ||
        v.name.toLowerCase().includes('hindi') ||
        v.name.toLowerCase().includes('swara') ||
        v.name.toLowerCase().includes('hemant') ||
        v.name.toLowerCase().includes('kalpana') ||
        v.name.toLowerCase().includes('lekha')
    );
    if (hindiVoice) return hindiVoice;
  }

  // 2. Exact match on BCP-47 tag
  const exact = voices.find((v) => v.lang.toLowerCase() === langCode.toLowerCase());
  if (exact) return exact;

  // 3. Match on language prefix (e.g. 'en', 'hi', 'bn')
  const prefix = langCode.split('-')[0].toLowerCase();
  const prefixMatch = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  if (prefixMatch) return prefixMatch;

  // 4. Fallback Indian accent voice
  const indianVoice = voices.find((v) => v.lang.includes('IN') || v.name.toLowerCase().includes('india'));
  if (indianVoice) return indianVoice;

  return null;
}

export type GameVoiceMode = 'hindi' | 'regional';

const VOICE_PREF_KEY = 'smriti_game_voice_pref';
const VOICE_MUTE_KEY = 'smriti_voice_muted';

let isVoiceMutedState = false;

// Initialize mute state from localStorage safely
if (typeof window !== 'undefined') {
  try {
    const storedMute = localStorage.getItem(VOICE_MUTE_KEY);
    if (storedMute !== null) {
      isVoiceMutedState = storedMute === 'true';
    }
  } catch {}
}

const muteSubscribers: Array<(muted: boolean) => void> = [];
const speakingSubscribers: Array<(speaking: boolean) => void> = [];
let isGloballySpeaking = false;

function notifySpeakingSubscribers(speaking: boolean) {
  isGloballySpeaking = speaking;
  speakingSubscribers.forEach((cb) => {
    try {
      cb(speaking);
    } catch {}
  });
}

export function isCurrentlySpeaking(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  return isGloballySpeaking || window.speechSynthesis.speaking;
}

export function addSpeakingListener(callback: (speaking: boolean) => void): () => void {
  speakingSubscribers.push(callback);
  return () => {
    const idx = speakingSubscribers.indexOf(callback);
    if (idx !== -1) {
      speakingSubscribers.splice(idx, 1);
    }
  };
}

export function useSpeakingState(): boolean {
  const [speaking, setSpeaking] = React.useState<boolean>(isCurrentlySpeaking());

  React.useEffect(() => {
    setSpeaking(isCurrentlySpeaking());
    const unsub = addSpeakingListener((newVal) => {
      setSpeaking(newVal);
    });

    const interval = setInterval(() => {
      const active = isCurrentlySpeaking();
      if (active !== isGloballySpeaking) {
        notifySpeakingSubscribers(active);
      }
    }, 400);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return speaking;
}

export function isVoiceMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(VOICE_MUTE_KEY);
    if (stored !== null) {
      isVoiceMutedState = stored === 'true';
    }
  } catch {}
  return isVoiceMutedState;
}

export function setVoiceMuted(muted: boolean): void {
  isVoiceMutedState = muted;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(VOICE_MUTE_KEY, muted ? 'true' : 'false');
    } catch {}
    if (muted) {
      stopSpeaking();
    }
  }
  muteSubscribers.forEach((cb) => {
    try {
      cb(muted);
    } catch {}
  });
}

export function toggleVoiceMute(): boolean {
  const next = !isVoiceMuted();
  setVoiceMuted(next);
  return next;
}

export function addVoiceMuteListener(callback: (muted: boolean) => void): () => void {
  muteSubscribers.push(callback);
  return () => {
    const idx = muteSubscribers.indexOf(callback);
    if (idx !== -1) {
      muteSubscribers.splice(idx, 1);
    }
  };
}

export function getGameVoicePreference(): GameVoiceMode {
  if (typeof window === 'undefined') return 'hindi';
  try {
    const stored = localStorage.getItem(VOICE_PREF_KEY);
    if (stored === 'regional' || stored === 'hindi') return stored;
  } catch {}
  return 'hindi'; // Default to Hindi voice for games as requested
}

export function setGameVoicePreference(mode: GameVoiceMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOICE_PREF_KEY, mode);
  } catch {}
}

/**
 * Speaks text in Hindi with elder-friendly pacing and voice mapping
 */
export function speakHindi(text: string, onEnd?: () => void) {
  if (isVoiceMuted()) {
    if (onEnd) onEnd();
    return;
  }
  speakText(text, 'hi', onEnd);
}

/**
 * Text to Speech using Web Speech API with regional & Hindi voice optimization
 */
export function speakText(
  text: string, 
  lang: RegionalLanguage | string = 'hi', 
  onEnd?: () => void
) {
  if (isVoiceMuted()) {
    if (onEnd) onEnd();
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel(); // cancel prior speech
    const utterance = new SpeechSynthesisUtterance(text);

    // Map regional language to TTS BCP 47 language code
    const langMap: Record<string, string> = {
      en: 'en-IN',
      as: 'bn-IN', // Assamese TTS frequently maps smoothly to bn-IN
      kha: 'en-IN', // Khasi Latin script phonetic fallback
      mni: 'hi-IN', // Manipuri fallback
      hi: 'hi-IN',
    };

    const targetLangCode = langMap[lang] || 'hi-IN';
    utterance.lang = targetLangCode;

    // Pick best matching native voice
    const bestVoice = findBestVoice(targetLangCode);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.rate = 0.84; // Calm, deliberate cadence for elderly clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      notifySpeakingSubscribers(true);
    };

    utterance.onend = () => {
      notifySpeakingSubscribers(false);
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      notifySpeakingSubscribers(false);
      if (onEnd) onEnd();
    };

    notifySpeakingSubscribers(true);
    window.speechSynthesis.speak(utterance);
  } catch {
    notifySpeakingSubscribers(false);
    if (onEnd) onEnd();
  }
}

/**
 * Speaks game instructions with support for Hindi voice preference
 */
export function speakGamePrompt(
  prompts: {
    en: string;
    hi: string;
    as?: string;
    kha?: string;
    mni?: string;
  },
  currentLang: RegionalLanguage = 'hi',
  forceHindi = false,
  onEnd?: () => void
) {
  const pref = getGameVoicePreference();
  if (forceHindi || pref === 'hindi' || currentLang === 'hi') {
    speakText(prompts.hi || prompts.en, 'hi', onEnd);
  } else {
    const text = (prompts as Record<string, string | undefined>)[currentLang] || prompts.en;
    speakText(text || prompts.hi || prompts.en, currentLang, onEnd);
  }
}

export function stopSpeaking() {
  notifySpeakingSubscribers(false);
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Cheerful encouragement in Hindi for games
 */
export function speakGameCheerHindi(type: 'correct' | 'win' | 'try_again' | 'streak', customMsg?: string) {
  if (customMsg) {
    speakHindi(customMsg);
    return;
  }

  const cheers = {
    correct: [
      'बहुत बढ़िया! बिल्कुल सही उत्तर!',
      'शाबाश! आपने सही चुना है!',
      'शानदार! बहुत सुंदर प्रयास!'
    ],
    win: [
      'बधाई हो! आपने यह स्तर सफलतापूर्वक पूरा कर लिया है!',
      'अद्भुत! आपका प्रदर्शन बहुत शानदार रहा!',
      'शाबाश! आपने सभी लक्ष्य पूरे कर लिए हैं!'
    ],
    try_again: [
      'कोई बात नहीं, ध्यान से देखें और दोबारा प्रयास करें!',
      'अच्छा प्रयास! एक बार फिर कोशिश कीजिए!',
      'धीरज रखिए, आप यह आसानी से कर सकते हैं।'
    ],
    streak: [
      'वाह! लगातार सही उत्तर! कमाल कर दिया!',
      'बहुत खूब! आपकी याददाश्त बहुत तेज है!'
    ]
  };

  const list = cheers[type];
  const chosen = list[Math.floor(Math.random() * list.length)];
  speakHindi(chosen);
}

// Full Audio Alarm sequence: Harmonic melodic chime + Spoken voice prompt in regional language
export function triggerReminderAudioAlarm(
  title: string,
  spokenPrompt?: string,
  priority: 'high' | 'medium' | 'gentle' = 'medium',
  lang: RegionalLanguage | string = 'hi',
  onEnd?: () => void
): () => void {
  // 1. Play the resonant musical chime
  soundEffects.playReminderAlarm(priority);

  // 2. Queue the spoken verbal reminder in the user's regional or Hindi language after opening bell
  const speechText = spokenPrompt && spokenPrompt.trim().length > 0 
    ? spokenPrompt 
    : `ध्यान दें: ${title} का समय हो गया है।`;

  const timer = setTimeout(() => {
    speakText(speechText, lang, onEnd);
  }, 1500);

  // Return cancel/silence function
  return () => {
    clearTimeout(timer);
    stopSpeaking();
  };
}

/**
 * React hook for consuming and updating global voice mute state
 */
export function useVoiceMute(): {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
} {
  const [muted, setMutedState] = React.useState<boolean>(isVoiceMuted());

  React.useEffect(() => {
    setMutedState(isVoiceMuted());
    const unsub = addVoiceMuteListener((newVal) => {
      setMutedState(newVal);
    });
    return unsub;
  }, []);

  const toggleMute = React.useCallback(() => {
    toggleVoiceMute();
  }, []);

  const setMuted = React.useCallback((val: boolean) => {
    setVoiceMuted(val);
  }, []);

  return { isMuted: muted, toggleMute, setMuted };
}
