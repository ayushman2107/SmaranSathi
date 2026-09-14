import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, RefreshCw, ArrowLeft, Play, Sparkles, Music, Activity, RotateCcw, Zap } from 'lucide-react';
import { DifficultyLevel, RegionalLanguage, GameSession, LevelFinishResult } from '../../types';
import { UI_TRANSLATIONS } from '../../data/nerContent';
import { soundEffects, speakHindi, speakGameCheerHindi } from '../../utils/speechAndAudio';
import { getLevelConfig, SequenceRecallLevelConfig } from '../../data/gameLevels';
import { GameLevelBanner } from './GameLevelBanner';

interface SequenceItem {
  id: number;
  label: Record<string, string>;
  subLabel: string;
  icon: string;
  color: string;
  activeColor: string;
  soundIndex: number;
  noteFrequency: string;
  acousticType: string;
}

const SEQUENCE_ITEMS: SequenceItem[] = [
  {
    id: 0,
    label: { en: 'Bihu Dhol', as: 'বিহু ঢোল', kha: 'Ka Ksing', mni: 'ঢোল', hi: 'बिहू ढोल' },
    subLabel: 'Deep Folk Drum (गूंजता ढोल)',
    icon: '🥁',
    color: 'bg-amber-100 border-amber-300 text-amber-950',
    activeColor: 'bg-amber-400 border-amber-600 scale-105 shadow-2xl ring-4 ring-amber-300',
    soundIndex: 0,
    noteFrequency: 'Rich 240Hz Bass + High Attack',
    acousticType: 'Folk Percussion'
  },
  {
    id: 1,
    label: { en: 'Pepa Horn', as: 'ম’হৰ শিঙৰ পেঁপা', kha: 'Ka Pepa', mni: 'পেপা', hi: 'पेपा वाद्य' },
    subLabel: 'Bright Buffalo Horn (मधुर पेपा)',
    icon: '🎺',
    color: 'bg-emerald-100 border-emerald-300 text-emerald-950',
    activeColor: 'bg-emerald-400 border-emerald-600 scale-105 shadow-2xl ring-4 ring-emerald-300',
    soundIndex: 1,
    noteFrequency: 'High 659Hz E5 Brass',
    acousticType: 'Traditional Wind'
  },
  {
    id: 2,
    label: { en: 'Kaji Nemu', as: 'কাজি নেমু', kha: 'Sohjew', mni: 'চম্প্রা', hi: 'काजी नेमु' },
    subLabel: 'Crystal Bell Chime (क्रिस्टल घंटी)',
    icon: '🍋',
    color: 'bg-yellow-100 border-yellow-300 text-yellow-950',
    activeColor: 'bg-yellow-400 border-yellow-600 scale-105 shadow-2xl ring-4 ring-yellow-300',
    soundIndex: 2,
    noteFrequency: 'Sparkling 1046Hz C6 Chime',
    acousticType: 'High Crystal Pitch'
  },
  {
    id: 3,
    label: { en: 'Rhino Friend', as: 'এশিঙীয়া গঁড়', kha: 'Ka Rhino', mni: 'রাইনো', hi: 'गैंडा मित्र' },
    subLabel: 'Resonant Folk Gong (स्वर्णिम घंट)',
    icon: '🦏',
    color: 'bg-indigo-100 border-indigo-300 text-indigo-950',
    activeColor: 'bg-indigo-400 border-indigo-600 scale-105 shadow-2xl ring-4 ring-indigo-300',
    soundIndex: 3,
    noteFrequency: 'Harmonic 523Hz C5 to C7',
    acousticType: 'Harmonic Gong'
  },
];

interface SequenceRecallGameProps {
  difficulty?: DifficultyLevel;
  level?: number;
  language: RegionalLanguage;
  userId: string;
  onFinish: (sessionData: Omit<GameSession, 'id' | 'completed_at'>) => void;
  onFinishLevel?: (result: LevelFinishResult) => void;
  onBack: () => void;
  onExitToLevelSelect?: () => void;
}

export const SequenceRecallGame: React.FC<SequenceRecallGameProps> = ({
  difficulty: propDifficulty = 'easy',
  level = 1,
  language,
  userId,
  onFinish,
  onFinishLevel,
  onBack,
  onExitToLevelSelect,
}) => {
  const t = UI_TRANSLATIONS[language] || UI_TRANSLATIONS.en;
  const levelConfig = getLevelConfig<SequenceRecallLevelConfig>('sequence_recall', level);
  const activeDifficulty = levelConfig.difficulty || propDifficulty;

  const [sequence, setSequence] = useState<number[]>([]);
  const [userStep, setUserStep] = useState<number>(0);
  const [activeItem, setActiveItem] = useState<number | null>(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState<boolean>(false);
  const [round, setRound] = useState<number>(1);
  const [totalRounds, setTotalRounds] = useState<number>(levelConfig.roundsCount || 2);
  const [attempts, setAttempts] = useState<number>(0);
  const [mistakes, setMistakes] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  
  // High Sound & Audio Clarity Settings
  const [highSoundBoost, setHighSoundBoost] = useState<boolean>(true);
  const [soundTempoMode, setSoundTempoMode] = useState<'normal' | 'relaxed'>('normal');
  const [lastPlayedNoteName, setLastPlayedNoteName] = useState<string>('');
  const [audioWaveActive, setAudioWaveActive] = useState<boolean>(false);
  
  const gameEndedRef = useRef(false);

  // Timer ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (!gameEndedRef.current) {
        setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const triggerInstrumentSound = (index: number) => {
    const item = SEQUENCE_ITEMS[index];
    if (item) {
      setLastPlayedNoteName(item.label[language] || item.label.en);
    }
    setAudioWaveActive(true);
    setTimeout(() => setAudioWaveActive(false), 400);
    
    // Play high sound audio tone
    soundEffects.playRhythmInstrumentTone(index, {
      highBoost: highSoundBoost,
      volume: highSoundBoost ? 2.0 : 1.3
    });
  };

  const startRound = (roundNum: number) => {
    const length = levelConfig.sequenceLength || 2;
    const newSeq: number[] = [];
    for (let i = 0; i < length; i++) {
      newSeq.push(Math.floor(Math.random() * SEQUENCE_ITEMS.length));
    }
    setSequence(newSeq);
    setUserStep(0);
    playSequence(newSeq);
  };

  const playSequence = async (seq: number[]) => {
    setIsPlayingSequence(true);
    setActiveItem(null);

    // Initial pause before rhythm starts
    await new Promise((resolve) => setTimeout(resolve, 500));

    const baseInterval = levelConfig.stepIntervalMs || 900;
    const stepInterval = soundTempoMode === 'relaxed' ? Math.round(baseInterval * 1.35) : baseInterval;
    const toneDuration = Math.min(550, Math.floor(stepInterval * 0.65));
    const pauseDuration = Math.max(180, Math.floor(stepInterval * 0.35));

    for (let i = 0; i < seq.length; i++) {
      const itemIdx = seq[i];
      setActiveItem(itemIdx);
      triggerInstrumentSound(itemIdx);
      await new Promise((resolve) => setTimeout(resolve, toneDuration));
      setActiveItem(null);
      await new Promise((resolve) => setTimeout(resolve, pauseDuration));
    }

    setIsPlayingSequence(false);
  };

  const initGame = () => {
    gameEndedRef.current = false;
    setRound(1);
    setTotalRounds(levelConfig.roundsCount || 2);
    setAttempts(0);
    setMistakes(0);
    setStartTime(Date.now());
    setElapsedSec(0);
    startRound(1);
  };

  useEffect(() => {
    initGame();
  }, [level, propDifficulty]);

  useEffect(() => {
    const promptHindi = `उच्च ध्वनि लय और स्वर खेल, स्तर ${level}। धुन सुनकर याद रखें और उसी क्रम में दोहराएं।`;
    speakHindi(promptHindi);
  }, [level]);

  const handleVoiceGuide = () => {
    soundEffects.playGentleTap(580);
    const hindiInstruction = `उच्च ध्वनि मोड चालू है। धुन को ध्यान से सुनें। जब धुन समाप्त हो, तो उन्हीं वाद्ययंत्रों को उसी क्रम में दबाएं। कुल ${totalRounds} राउंड हैं।`;
    speakHindi(hindiInstruction);
  };

  const handleItemClick = (index: number) => {
    if (isPlayingSequence || sequence.length === 0) return;

    triggerInstrumentSound(index);
    setActiveItem(index);
    setTimeout(() => setActiveItem(null), 300);

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (sequence[userStep] === index) {
      // Correct step
      const nextStep = userStep + 1;
      setUserStep(nextStep);

      if (nextStep === sequence.length) {
        // Round completed successfully!
        soundEffects.playSuccessChime();

        if (round < totalRounds) {
          speakHindi('बहुत सुंदर! अगला सुर राउंड शुरू हो रहा है।');
          setTimeout(() => {
            setRound((prev) => prev + 1);
            startRound(round + 1);
          }, 1100);
        } else {
          // Completed all rounds!
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            speakGameCheerHindi('win');
            setTimeout(() => {
              finishGame(newAttempts, mistakes);
            }, 400);
          }
        }
      }
    } else {
      // Mistake feedback
      soundEffects.playGentleEncouragement();
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setUserStep(0);
      speakHindi('कोई बात नहीं, सुर और धुन को दोबारा ध्यान से सुनिए।');
      setTimeout(() => {
        playSequence(sequence);
      }, 1200);
    }
  };

  const finishGame = (finalAttempts: number, finalMistakes: number) => {
    const elapsedSeconds = Math.max(3, Math.round((Date.now() - startTime) / 1000));
    const avgResponseTime = Number((elapsedSeconds / Math.max(1, finalAttempts)).toFixed(1));
    const accuracy = Math.max(
      45,
      Math.min(100, Math.round((totalRounds / Math.max(totalRounds, totalRounds + finalMistakes)) * 100))
    );

    // Win condition check
    const won = finalMistakes <= levelConfig.maxMistakesAllowed;
    let stars = 0;
    if (won) {
      if (finalMistakes === 0) {
        stars = 3;
      } else if (finalMistakes <= 1) {
        stars = 2;
      } else {
        stars = 1;
      }
    }

    const calculatedScore = won ? Math.round(levelConfig.pointsBase + (accuracy * 2) + Math.max(0, 100 - elapsedSeconds * 2)) : Math.round(accuracy);

    if (onFinishLevel) {
      onFinishLevel({
        won,
        level,
        gameType: 'sequence_recall',
        score: calculatedScore,
        stars,
        timeSec: elapsedSeconds,
        accuracy,
        attempts: finalAttempts,
        mistakes: finalMistakes,
        completionRate: 100,
        winConditionMet: won
          ? `Completed all ${totalRounds} rounds with ${finalMistakes} mistakes (Allowed: ≤ ${levelConfig.maxMistakesAllowed}).`
          : undefined,
        failReason: !won
          ? `Made ${finalMistakes} mistakes (Maximum allowed: ${levelConfig.maxMistakesAllowed}). Listen closely to the high sound rhythm and try again!`
          : undefined,
      });
    }

    onFinish({
      user_id: userId,
      game_type: 'sequence_recall',
      level_number: level,
      accuracy,
      response_time: avgResponseTime,
      attempts: finalAttempts,
      mistakes: finalMistakes,
      completion_rate: 100,
      difficulty_level: activeDifficulty,
      stars: Math.max(1, stars),
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Universal Level Banner with Hindi Voice Guide */}
      <GameLevelBanner
        level={level}
        totalLevels={10}
        difficulty={activeDifficulty}
        levelTitle={levelConfig.title[language] || levelConfig.title.en}
        winConditionText={levelConfig.winConditionText[language] || levelConfig.winConditionText.en}
        hindiVoicePrompt={`स्वर और लय की याददाश्त स्तर ${level}। ${totalRounds} राउंड्स में उच्च ध्वनि धुन को ध्यान से सुनकर दोहराएं।`}
        onExitToLevelSelect={onExitToLevelSelect || onBack}
        attempts={attempts}
        timeSec={elapsedSec}
      />

      {/* Header with High Sound Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-[28px] border-2 border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={onBack}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-transform active:scale-95 cursor-pointer"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-6 h-6 text-slate-900" />
          </button>

          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-orange-100 border border-orange-300 text-orange-950 text-xs font-black uppercase tracking-wider mb-0.5">
              <Music className="w-3.5 h-3.5 text-orange-700" />
              <span>Rhythm & Melodic Memory</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {t.sequence_recall}
            </h2>
            <p className="text-slate-600 font-bold text-xs sm:text-sm">
              Round {round} of {totalRounds} · {levelConfig.sequenceLength} Notes Melody
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Replay Rhythm Button */}
            <button
              onClick={() => playSequence(sequence)}
              disabled={isPlayingSequence}
              className="min-h-[48px] px-3.5 py-2 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black shadow-sm active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs sm:text-sm"
              title="Replay sequence sound"
            >
              <RotateCcw className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">Replay Rhythm</span>
            </button>

            {/* Voice Guide Button */}
            <button
              onClick={handleVoiceGuide}
              className="min-h-[48px] px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-xs active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm"
              title="Listen in Hindi"
            >
              <Volume2 className="w-5 h-5 text-white" />
              <span className="hidden sm:inline">हिंदी आवाज़</span>
            </button>

            <button
              onClick={initGame}
              className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-transform active:scale-95 cursor-pointer"
              title="Restart Game"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* High Sound & Clarity Control Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
          {/* High Sound Boost Mode Button */}
          <button
            onClick={() => {
              setHighSoundBoost(!highSoundBoost);
              soundEffects.playGentleTap(highSoundBoost ? 350 : 700);
            }}
            className={`px-3.5 py-1.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer border-2 ${
              highSoundBoost
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <Zap className={`w-4 h-4 ${highSoundBoost ? 'text-yellow-200 fill-yellow-200 animate-pulse' : 'text-slate-500'}`} />
            <span>High Sound Mode (उच्च ध्वनि): {highSoundBoost ? 'BOOSTED (तेज़)' : 'Standard'}</span>
          </button>

          {/* Tempo Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
            <span className="px-2 text-slate-500 font-black">Tempo:</span>
            <button
              onClick={() => setSoundTempoMode('normal')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-black ${
                soundTempoMode === 'normal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => setSoundTempoMode('relaxed')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-black ${
                soundTempoMode === 'relaxed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Relaxed (धीमा)
            </button>
          </div>
        </div>
      </div>

      {/* Visual Audio Wave & Live Guidance Banner */}
      <div className={`text-center py-3.5 px-6 rounded-2xl border-2 transition-all duration-300 shadow-xs ${
        isPlayingSequence
          ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-200'
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center justify-center gap-3">
          {/* Animated Equalizer Wave Bars */}
          <div className="flex items-end gap-1 h-5">
            {[14, 20, 10, 18, 12, 16].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  audioWaveActive || isPlayingSequence
                    ? 'bg-orange-500 animate-pulse'
                    : 'bg-slate-300'
                }`}
                style={{ height: audioWaveActive || isPlayingSequence ? `${h}px` : '6px' }}
              />
            ))}
          </div>

          <p className="text-base sm:text-lg font-black text-slate-900">
            {isPlayingSequence ? (
              <span className="text-orange-950 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-600 animate-spin" />
                उच्च ध्वनि में धुन बज रही है... ध्यान से सुनें!
              </span>
            ) : (
              <span className="text-emerald-900 font-black">
                अब आपकी बारी! उसी क्रम में वाद्ययंत्रों पर टैप करें ({userStep}/{sequence.length})
              </span>
            )}
          </p>

          <div className="flex items-end gap-1 h-5">
            {[12, 18, 14, 20, 10, 16].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  audioWaveActive || isPlayingSequence
                    ? 'bg-orange-500 animate-pulse'
                    : 'bg-slate-300'
                }`}
                style={{ height: audioWaveActive || isPlayingSequence ? `${h}px` : '6px' }}
              />
            ))}
          </div>
        </div>

        {lastPlayedNoteName && (
          <p className="text-xs font-bold text-orange-800 mt-1">
            Active Sound: <strong>{lastPlayedNoteName}</strong>
          </p>
        )}
      </div>

      {/* Interactive Sequence Tiles (Large accessible tap targets >= 140px with high visual response) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 max-w-lg mx-auto pt-1">
        {SEQUENCE_ITEMS.map((item, idx) => {
          const isGlowing = activeItem === idx;
          const localizedName = item.label[language] || item.label.en;

          return (
            <button
              key={item.id}
              id={`seq-item-${item.id}`}
              onClick={() => handleItemClick(idx)}
              disabled={isPlayingSequence}
              className={`min-h-[140px] sm:min-h-[160px] rounded-[28px] border-4 p-4 flex flex-col items-center justify-center gap-1.5 transition-all duration-150 select-none relative overflow-hidden ${
                isGlowing 
                  ? `${item.activeColor}` 
                  : `${item.color} shadow-xs hover:border-slate-400 hover:shadow-md`
              } active:scale-95 cursor-pointer disabled:cursor-not-allowed`}
            >
              {/* Radiating Soundwave Glow Effect when active */}
              {isGlowing && (
                <span className="absolute inset-0 rounded-[28px] bg-white/40 animate-ping pointer-events-none" />
              )}

              <span className={`text-5xl sm:text-6xl filter drop-shadow-md transition-transform duration-150 ${isGlowing ? 'scale-125' : ''}`}>
                {item.icon}
              </span>

              <span className="text-lg sm:text-xl font-black text-slate-950 tracking-tight text-center">
                {localizedName}
              </span>

              <span className="text-[11px] sm:text-xs font-bold text-slate-700 text-center">
                {item.subLabel}
              </span>

              {/* Note Acoustic Pill */}
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white/80 border border-slate-300 text-slate-800 mt-0.5">
                {item.noteFrequency}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step Progress Beads with Checked States */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 max-w-md mx-auto flex items-center justify-between px-6">
        <span className="text-xs font-black uppercase text-slate-600">Rhythm Steps:</span>
        <div className="flex justify-center items-center gap-2.5">
          {sequence.map((itemIdx, i) => {
            const isCompleted = i < userStep;
            const isCurrent = i === userStep && !isPlayingSequence;
            return (
              <div
                key={i}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                  isCompleted
                    ? 'bg-emerald-600 text-white scale-110 shadow-xs'
                    : isCurrent
                    ? 'bg-orange-500 text-white animate-bounce shadow-xs'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isCompleted ? '✓' : i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

