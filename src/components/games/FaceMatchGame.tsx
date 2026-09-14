import React, { useState, useEffect, useRef } from 'react';
import { Volume2, RefreshCw, ArrowLeft, Heart, CheckCircle2, Clock } from 'lucide-react';
import { FamiliarPerson, DifficultyLevel, RegionalLanguage, GameSession, LevelFinishResult } from '../../types';
import { UI_TRANSLATIONS } from '../../data/nerContent';
import { soundEffects, speakHindi, speakGameCheerHindi } from '../../utils/speechAndAudio';
import { getLevelConfig, FaceMatchLevelConfig } from '../../data/gameLevels';
import { GameLevelBanner } from './GameLevelBanner';

const DEMO_FAMILY_MEMBERS: FamiliarPerson[] = [
  {
    id: 'demo-1',
    user_id: 'demo',
    name: 'Priyanka Borah',
    relation: 'Daughter (বেটী / बेटी)',
    photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    notes: 'Lives in Guwahati, visits on Sundays with sweets',
    voice_prompt: 'नमस्ते माँ, मैं प्रियंका हूँ!',
  },
  {
    id: 'demo-2',
    user_id: 'demo',
    name: 'Rahul Sharma',
    relation: 'Grandson (নাতি / पोता)',
    photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
    notes: 'Loves playing cricket and eating pitha',
    voice_prompt: 'दादाजी, प्रणाम!',
  },
  {
    id: 'demo-3',
    user_id: 'demo',
    name: 'Ananya Phukan',
    relation: 'Doctor & Niece (ডাক্তাৰ / भतीजी)',
    photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
    notes: 'Calls every evening to check on medicine',
    voice_prompt: 'चाचाजी, दवाई समय पर ले लीजियेगा।',
  },
  {
    id: 'demo-4',
    user_id: 'demo',
    name: 'Devraj Saikia',
    relation: 'Son (ল’ৰা / बेटा)',
    photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    notes: 'Brings morning fresh tea leaves and newspapers',
    voice_prompt: 'पिताजी, सुबह की चाय तैयार है।',
  },
];

interface FaceMatchGameProps {
  difficulty?: DifficultyLevel;
  level?: number;
  language: RegionalLanguage;
  userId: string;
  familiarPeople: FamiliarPerson[];
  onFinish: (sessionData: Omit<GameSession, 'id' | 'completed_at'>) => void;
  onFinishLevel?: (result: LevelFinishResult) => void;
  onBack: () => void;
  onExitToLevelSelect?: () => void;
}

export const FaceMatchGame: React.FC<FaceMatchGameProps> = ({
  difficulty: propDifficulty = 'easy',
  level = 1,
  language,
  userId,
  familiarPeople,
  onFinish,
  onFinishLevel,
  onBack,
  onExitToLevelSelect,
}) => {
  const t = UI_TRANSLATIONS[language] || UI_TRANSLATIONS.en;
  const levelConfig = getLevelConfig<FaceMatchLevelConfig>('face_match', level);
  const activeDifficulty = levelConfig.difficulty || propDifficulty;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [questionTimerSec, setQuestionTimerSec] = useState<number>(levelConfig.timePerQuestionSec || 0);
  const gameEndedRef = useRef(false);

  // Pool of people combining real familiar people + supplementary demo people
  const allPeople = React.useMemo(() => {
    const existing = [...familiarPeople];
    for (const demo of DEMO_FAMILY_MEMBERS) {
      if (!existing.some((p) => p.name.toLowerCase() === demo.name.toLowerCase())) {
        existing.push(demo);
      }
    }
    return existing;
  }, [familiarPeople]);

  const totalRounds = Math.min(allPeople.length, levelConfig.roundsCount || 2);
  const currentPerson = allPeople[currentIndex % allPeople.length];

  // Options count (2, 3, or 4 options)
  const options = React.useMemo(() => {
    if (!currentPerson) return [];
    const others = allPeople.filter((p) => p.id !== currentPerson.id);
    const neededOthers = Math.max(1, (levelConfig.optionsCount || 2) - 1);
    const chosenOthers = others.slice(0, neededOthers);
    return [currentPerson, ...chosenOthers].sort(() => Math.random() - 0.5);
  }, [currentPerson, allPeople, levelConfig.optionsCount]);

  // Overall timer ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (!gameEndedRef.current) {
        setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // Countdown per question if timePerQuestionSec > 0
  useEffect(() => {
    if (!levelConfig.timePerQuestionSec || levelConfig.timePerQuestionSec <= 0 || gameEndedRef.current) return;

    setQuestionTimerSec(levelConfig.timePerQuestionSec);
    const cd = setInterval(() => {
      setQuestionTimerSec((prev) => {
        if (prev <= 1) {
          clearInterval(cd);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(cd);
  }, [currentIndex, levelConfig.timePerQuestionSec]);

  const handleTimeExpired = () => {
    if (selectedPersonId !== null || gameEndedRef.current) return;
    soundEffects.playGentleEncouragement();
    setMistakes((prev) => prev + 1);
    setAttempts((prev) => prev + 1);
    speakHindi('समय पूरा हुआ! आइए अगला चेहरा देखें।');
    advance(correctCount);
  };

  useEffect(() => {
    gameEndedRef.current = false;
    setAttempts(0);
    setMistakes(0);
    setCorrectCount(0);
    setCurrentIndex(0);
    setSelectedPersonId(null);
    setIsCorrect(null);
    setStartTime(Date.now());
    setElapsedSec(0);
  }, [level, propDifficulty]);

  useEffect(() => {
    if (currentPerson) {
      const prompt = `प्रियजनों की पहचान स्तर ${level}। क्या आप अपने इस प्रियजन को पहचान सकते हैं?`;
      speakHindi(prompt);
    }
  }, [currentIndex, currentPerson, level]);

  const handleVoiceGuide = () => {
    if (!currentPerson) return;
    soundEffects.playGentleTap();
    const hindiPrompt = `तस्वीर में मुस्कुराते चेहरे को देखें। नीचे दिए गए नामों में से सही व्यक्ति का नाम चुनें।`;
    speakHindi(hindiPrompt);
  };

  const handleOptionClick = (person: FamiliarPerson) => {
    if (selectedPersonId !== null) return;

    setSelectedPersonId(person.id);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const correct = person.id === currentPerson.id;
    setIsCorrect(correct);

    if (correct) {
      soundEffects.playSuccessChime();
      const message = `बहुत सुंदर! यह ${person.name} हैं, आपके प्यारे ${person.relation}!`;
      speakHindi(message);
      const newCorrect = correctCount + 1;
      setCorrectCount(newCorrect);

      setTimeout(() => {
        advance(newCorrect);
      }, 1600);
    } else {
      soundEffects.playGentleEncouragement();
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      speakHindi('उनकी प्यारी मुस्कान को एक बार और ध्यान से देखें।');

      setTimeout(() => {
        advance(correctCount);
      }, 1400);
    }
  };

  const advance = (finalCorrect: number) => {
    if (currentIndex + 1 < totalRounds) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedPersonId(null);
      setIsCorrect(null);
    } else {
      if (!gameEndedRef.current) {
        gameEndedRef.current = true;
        speakGameCheerHindi('win');
        setTimeout(() => {
          finishGame(attempts + 1, mistakes, finalCorrect, totalRounds);
        }, 400);
      }
    }
  };

  const finishGame = (
    finalAttempts: number,
    finalMistakes: number,
    finalCorrect: number,
    roundsTotal: number
  ) => {
    const elapsedSeconds = Math.max(3, Math.round((Date.now() - startTime) / 1000));
    const avgResponseTime = Number((elapsedSeconds / Math.max(1, finalAttempts)).toFixed(1));
    const accuracy = Math.max(
      40,
      Math.min(100, Math.round((finalCorrect / roundsTotal) * 100))
    );

    // Win check
    const won = finalCorrect >= levelConfig.minCorrectToPass;
    let stars = 0;
    if (won) {
      if (finalCorrect === roundsTotal) {
        stars = 3;
      } else if (finalCorrect >= roundsTotal - 1) {
        stars = 2;
      } else {
        stars = 1;
      }
    }

    const calculatedScore = won
      ? Math.round(levelConfig.pointsBase + (accuracy * 2) + Math.max(0, 100 - elapsedSeconds * 2))
      : Math.round(accuracy);

    if (onFinishLevel) {
      onFinishLevel({
        won,
        level,
        gameType: 'face_match',
        score: calculatedScore,
        stars,
        timeSec: elapsedSeconds,
        accuracy,
        attempts: finalAttempts,
        mistakes: finalMistakes,
        completionRate: 100,
        winConditionMet: won
          ? `Recognized ${finalCorrect} out of ${roundsTotal} loved ones (Target: ≥ ${levelConfig.minCorrectToPass}).`
          : undefined,
        failReason: !won
          ? `Recognized ${finalCorrect} out of ${roundsTotal} loved ones (Target was ≥ ${levelConfig.minCorrectToPass}). Take your time and try again!`
          : undefined,
      });
    }

    onFinish({
      user_id: userId,
      game_type: 'face_match',
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

  if (!currentPerson) return null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Universal Level Banner with Hindi Voice */}
      <GameLevelBanner
        level={level}
        totalLevels={10}
        difficulty={activeDifficulty}
        levelTitle={levelConfig.title[language] || levelConfig.title.en}
        winConditionText={levelConfig.winConditionText[language] || levelConfig.winConditionText.en}
        hindiVoicePrompt={`प्रियजनों की पहचान स्तर ${level}। ${totalRounds} में से कम से कम ${levelConfig.minCorrectToPass} प्रियजनों को पहचानें।`}
        onExitToLevelSelect={onExitToLevelSelect || onBack}
        attempts={attempts}
        timeSec={elapsedSec}
      />

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-[28px] border-2 border-slate-200 shadow-xs flex-wrap gap-2">
        <button
          onClick={onBack}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-transform active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6 text-slate-900" />
        </button>

        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {t.face_match}
          </h2>
          <p className="text-slate-600 font-bold text-xs sm:text-sm">
            Person {currentIndex + 1} of {totalRounds} · Correct: {correctCount}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {levelConfig.timePerQuestionSec && levelConfig.timePerQuestionSec > 0 && (
            <div className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1 text-xs font-black ${
              questionTimerSec <= 5 ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{questionTimerSec}s</span>
            </div>
          )}

          {/* Hindi Voice Guide */}
          <button
            onClick={handleVoiceGuide}
            className="min-h-[48px] px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-xs active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm"
            title="Listen in Hindi"
          >
            <Volume2 className="w-5 h-5 text-white" />
            <span className="hidden sm:inline">हिंदी आवाज़</span>
          </button>

          <button
            onClick={() => {
              setCurrentIndex(0);
              setSelectedPersonId(null);
              setIsCorrect(null);
              setCorrectCount(0);
              setAttempts(0);
              setMistakes(0);
            }}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-transform active:scale-95 cursor-pointer"
            title="Restart"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Face Card */}
      <div className="bg-white rounded-[28px] p-5 sm:p-7 border-2 border-rose-200 shadow-sm text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <img
              src={currentPerson.photo_url}
              alt={currentPerson.name}
              className="w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover border-4 border-rose-300 shadow-md"
            />
            <div className="absolute bottom-1 right-1 bg-rose-500 text-white p-2 rounded-full shadow-md">
              <Heart className="w-5 h-5 fill-current" />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              यह आपके परिवार के कौन से सदस्य हैं?
            </h3>
            {familiarPeople.some((p) => p.id === currentPerson.id) && (
              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full font-black text-[11px] shadow-2xs">
                ❤️ Caregiver Added
              </span>
            )}
          </div>
          <p className="text-slate-500 font-bold text-xs sm:text-sm">
            पहचानने के लिए नीचे सही नाम पर टैप करें
          </p>
        </div>

        {/* Family Details & Memory Notes added by Caregiver */}
        {(currentPerson.notes || currentPerson.relation) && (
          <div className="bg-amber-50 border-2 border-amber-200/80 rounded-2xl p-3.5 max-w-md mx-auto text-left space-y-1 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-900 uppercase tracking-wide flex items-center gap-1">
                <span>📖 Family Memory Details</span>
              </span>
              <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">
                {currentPerson.relation}
              </span>
            </div>
            {currentPerson.notes && (
              <p className="text-sm font-medium text-amber-950 pt-0.5">
                {currentPerson.notes}
              </p>
            )}
          </div>
        )}

        {/* Options */}
        <div className={`grid gap-2.5 pt-1 ${options.length > 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
          {options.map((opt) => {
            const isSelected = selectedPersonId === opt.id;
            const isTarget = opt.id === currentPerson.id;

            let btnClass = 'bg-white hover:bg-rose-50/60 border-2 border-slate-200 shadow-xs text-slate-900 cursor-pointer';
            if (selectedPersonId !== null) {
              if (isTarget) {
                btnClass = 'bg-emerald-100 border-2 border-emerald-500 text-emerald-950 font-black shadow-md';
              } else if (isSelected) {
                btnClass = 'bg-rose-100 border-2 border-rose-300 text-rose-950 font-bold';
              } else {
                btnClass = 'bg-slate-100 border-2 border-slate-200 text-slate-400 opacity-60';
              }
            }

            return (
              <button
                key={opt.id}
                id={`face-opt-${opt.id}`}
                onClick={() => handleOptionClick(opt)}
                disabled={selectedPersonId !== null}
                className={`min-h-[64px] p-4 rounded-2xl flex items-center justify-between text-left transition-all duration-200 ${btnClass}`}
              >
                <div>
                  <span className="text-base sm:text-lg font-black block leading-tight">
                    {opt.name}
                  </span>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">
                    {opt.relation}
                  </span>
                </div>

                {selectedPersonId !== null && isTarget && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
