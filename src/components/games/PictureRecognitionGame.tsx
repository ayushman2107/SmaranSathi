import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  RefreshCw, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Lightbulb, 
  Maximize2, 
  X, 
  Sparkles, 
  BookOpen, 
  ArrowRight, 
  MapPin, 
  Award,
  VolumeX
} from 'lucide-react';
import { CulturalItem, DifficultyLevel, RegionalLanguage, GameSession, LevelFinishResult } from '../../types';
import { CULTURAL_ITEMS, UI_TRANSLATIONS } from '../../data/nerContent';
import { soundEffects, speakText, speakHindi, speakGameCheerHindi } from '../../utils/speechAndAudio';
import { getLevelConfig, PictureRecognitionLevelConfig } from '../../data/gameLevels';
import { GameLevelBanner } from './GameLevelBanner';

interface PictureRecognitionGameProps {
  difficulty?: DifficultyLevel;
  level?: number;
  language: RegionalLanguage;
  userId: string;
  onFinish: (sessionData: Omit<GameSession, 'id' | 'completed_at'>) => void;
  onFinishLevel?: (result: LevelFinishResult) => void;
  onBack: () => void;
  onExitToLevelSelect?: () => void;
}

export const PictureRecognitionGame: React.FC<PictureRecognitionGameProps> = ({
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
  const levelConfig = getLevelConfig<PictureRecognitionLevelConfig>('picture_recognition', level);
  const activeDifficulty = levelConfig.difficulty || propDifficulty;

  const [questions, setQuestions] = useState<{ item: CulturalItem; options: CulturalItem[] }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [questionTimerSec, setQuestionTimerSec] = useState<number | null>(levelConfig.timePerQuestionSec || null);
  
  // Interactive features
  const [showClue, setShowClue] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showFactCard, setShowFactCard] = useState(false);
  const [activeSpeechOptionId, setActiveSpeechOptionId] = useState<string | null>(null);
  
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

  // Question countdown timer if applicable
  useEffect(() => {
    if (!levelConfig.timePerQuestionSec || levelConfig.timePerQuestionSec <= 0) return;

    setQuestionTimerSec(levelConfig.timePerQuestionSec);
    const qTimer = setInterval(() => {
      setQuestionTimerSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(qTimer);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(qTimer);
  }, [currentIndex, levelConfig.timePerQuestionSec]);

  const handleTimeout = () => {
    if (selectedOptionId !== null || gameEndedRef.current) return;
    soundEffects.playGentleEncouragement();
    setMistakes((prev) => prev + 1);
    setAttempts((prev) => prev + 1);
    speakHindi('समय समाप्त हुआ! आइए अगला प्रश्न देखें।');
    advanceQuestion(correctAnswersCount);
  };

  const totalQuestions = levelConfig.questionsCount || 3;
  const optionsCount = levelConfig.optionsCount || 3;

  const setupQuestions = () => {
    gameEndedRef.current = false;
    const shuffledItems = [...CULTURAL_ITEMS].sort(() => Math.random() - 0.5);
    const chosenItems = shuffledItems.slice(0, totalQuestions);

    const generated = chosenItems.map((targetItem) => {
      // Pick other random distractors
      const distractors = CULTURAL_ITEMS.filter((i) => i.id !== targetItem.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.max(1, optionsCount - 1));

      const options = [targetItem, ...distractors].sort(() => Math.random() - 0.5);
      return { item: targetItem, options };
    });

    setQuestions(generated);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setIsCorrect(null);
    setShowClue(false);
    setShowFactCard(false);
    setShowLightbox(false);
    setAttempts(0);
    setMistakes(0);
    setCorrectAnswersCount(0);
    setStartTime(Date.now());
    setElapsedSec(0);
  };

  useEffect(() => {
    setupQuestions();
  }, [level, propDifficulty]);

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (currentQuestion) {
      const stateOriginHindi = currentQuestion.item.state_origin || 'पूर्वोत्तर';
      const prompt = `प्रश्न ${currentIndex + 1}। क्या आप ${stateOriginHindi} की इस सांस्कृतिक धरोहर को पहचान सकते हैं?`;
      speakHindi(prompt);
      setShowClue(false);
      setShowFactCard(false);
    }
  }, [currentIndex, currentQuestion]);

  const handleVoiceGuide = () => {
    if (!currentQuestion) return;
    soundEffects.playGentleTap();
    const stateOrigin = currentQuestion.item.state_origin || 'पूर्वोत्तर';
    const hindiPrompt = `तस्वीर को ध्यान से देखें। यह ${stateOrigin} की धरोहर है। नीचे दिए गए विकल्पों में से सही नाम चुनें।`;
    speakHindi(hindiPrompt);
  };

  const handleToggleClue = () => {
    soundEffects.playGentleTap();
    const nextClueState = !showClue;
    setShowClue(nextClueState);
    if (nextClueState && currentQuestion?.item.clue) {
      const clueText = currentQuestion.item.clue[language] || currentQuestion.item.clue.hi || currentQuestion.item.clue.en;
      speakHindi(`संकेत: ${clueText}`);
    }
  };

  const handleReadOptionAloud = (e: React.MouseEvent, option: CulturalItem) => {
    e.stopPropagation();
    soundEffects.playGentleTap();
    setActiveSpeechOptionId(option.id);
    const optionName = option.name[language] || option.name.hi || option.name.en;
    speakHindi(optionName);
    setTimeout(() => {
      setActiveSpeechOptionId(null);
    }, 2000);
  };

  const handleOptionClick = (option: CulturalItem) => {
    if (selectedOptionId !== null) return;

    setSelectedOptionId(option.id);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const correct = option.id === currentQuestion.item.id;
    setIsCorrect(correct);
    setShowFactCard(true);

    if (correct) {
      soundEffects.playSuccessChime();
      const itemNameHindi = option.name.hi || option.name.en;
      speakHindi(`बिल्कुल सही! यह ${itemNameHindi} है। बहुत बढ़िया!`);
      const newCorrect = correctAnswersCount + 1;
      setCorrectAnswersCount(newCorrect);
    } else {
      soundEffects.playGentleEncouragement();
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      const rightName = currentQuestion.item.name.hi || currentQuestion.item.name.en;
      speakHindi(`यह ${rightName} है। कोई बात नहीं, आइए इसके बारे में जानें!`);
    }
  };

  const handleNextQuestion = () => {
    soundEffects.playGentleTap();
    setShowFactCard(false);
    setShowClue(false);
    advanceQuestion(correctAnswersCount);
  };

  const advanceQuestion = (finalCorrectCount: number) => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setIsCorrect(null);
      setShowFactCard(false);
      setShowClue(false);
    } else {
      if (!gameEndedRef.current) {
        gameEndedRef.current = true;
        speakGameCheerHindi('win');
        setTimeout(() => {
          finishGame(attempts + 1, mistakes, finalCorrectCount);
        }, 400);
      }
    }
  };

  const finishGame = (finalAttempts: number, finalMistakes: number, finalCorrect: number) => {
    const elapsedSeconds = Math.max(3, Math.round((Date.now() - startTime) / 1000));
    const avgResponseTime = Number((elapsedSeconds / Math.max(1, finalAttempts)).toFixed(1));
    const accuracy = Math.max(
      35,
      Math.min(100, Math.round((finalCorrect / totalQuestions) * 100))
    );

    // Win condition check
    const won = finalCorrect >= levelConfig.minCorrectToPass;
    let stars = 0;
    if (won) {
      if (finalCorrect === totalQuestions) {
        stars = 3;
      } else if (finalCorrect >= totalQuestions - 1) {
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
        gameType: 'picture_recognition',
        score: calculatedScore,
        stars,
        timeSec: elapsedSeconds,
        accuracy,
        attempts: finalAttempts,
        mistakes: finalMistakes,
        completionRate: 100,
        winConditionMet: won
          ? `Correctly identified ${finalCorrect} out of ${totalQuestions} items (Needed: ≥ ${levelConfig.minCorrectToPass}).`
          : undefined,
        failReason: !won
          ? `Answered ${finalCorrect} out of ${totalQuestions} correctly (Needed: ≥ ${levelConfig.minCorrectToPass}). Relax and give it another try!`
          : undefined,
      });
    }

    onFinish({
      user_id: userId,
      game_type: 'picture_recognition',
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

  if (!currentQuestion) {
    return (
      <div className="p-12 text-center text-slate-600 font-bold bg-white rounded-3xl border border-slate-200 shadow-xs">
        <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p>Loading culturally rich Northeast photos...</p>
      </div>
    );
  }

  const currentItem = currentQuestion.item;
  const currentItemName = currentItem.name[language] || currentItem.name.hi || currentItem.name.en;
  const currentItemDesc = currentItem.description[language] || currentItem.description.hi || currentItem.description.en;
  const currentItemClue = currentItem.clue?.[language] || currentItem.clue?.hi || currentItem.clue?.en;
  const currentItemFact = currentItem.fun_fact?.[language] || currentItem.fun_fact?.hi || currentItem.fun_fact?.en;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Universal Level Banner with Hindi Voice */}
      <GameLevelBanner
        level={level}
        totalLevels={10}
        difficulty={activeDifficulty}
        levelTitle={levelConfig.title[language] || levelConfig.title.en}
        winConditionText={levelConfig.winConditionText[language] || levelConfig.winConditionText.en}
        hindiVoicePrompt={`चित्र पहचान स्तर ${level}। ${totalQuestions} में से कम से कम ${levelConfig.minCorrectToPass} सही पहचानें।`}
        onExitToLevelSelect={onExitToLevelSelect || onBack}
        attempts={attempts}
        timeSec={elapsedSec}
      />

      {/* Main Header & Controls */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-[28px] border-2 border-slate-200 shadow-xs flex-wrap gap-2">
        <button
          onClick={onBack}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-transform active:scale-95 cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6 text-slate-900" />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <span className="text-base">{currentItem.icon || '🌸'}</span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {t.picture_recognition}
            </h2>
          </div>
          <p className="text-slate-600 font-bold text-xs sm:text-sm">
            Question {currentIndex + 1} of {questions.length} · Correct: {correctAnswersCount}/{totalQuestions}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {levelConfig.timePerQuestionSec && levelConfig.timePerQuestionSec > 0 && (
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1 text-xs font-black ${
              questionTimerSec && questionTimerSec <= 5 ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-800'
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
            <span className="hidden sm:inline">निर्देश सुनें</span>
          </button>
          
          <button
            onClick={setupQuestions}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-transform active:scale-95 cursor-pointer"
            title="Restart"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Showcase with Zoom and Clue overlays */}
      <div className="relative rounded-[32px] overflow-hidden border-3 border-emerald-400/80 shadow-md bg-slate-950 group">
        <div className="relative max-h-[340px] sm:max-h-[380px] w-full flex items-center justify-center overflow-hidden">
          <img
            src={currentItem.image_url}
            alt={currentItem.name.en}
            className="w-full h-full object-cover max-h-[340px] sm:max-h-[380px] transition-transform duration-500 group-hover:scale-105"
            loading="eager"
          />
          
          {/* Subtle Top Gradient for Badges */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/40 pointer-events-none" />

          {/* Top Overlays: State Origin and Zoom Button */}
          <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-amber-300 font-black text-xs sm:text-sm border border-amber-400/40 flex items-center gap-1.5 shadow-sm">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentItem.state_native_name || currentItem.state_origin}</span>
              </span>
              <span className="px-3 py-1.5 rounded-full bg-emerald-600/90 backdrop-blur-md text-white font-black text-xs uppercase tracking-wider shadow-sm">
                {currentItem.category}
              </span>
            </div>

            {/* Inspect / Zoom Button for Elderly Visual Clarity */}
            <button
              onClick={() => setShowLightbox(true)}
              className="min-h-[42px] px-3 py-1.5 rounded-2xl bg-white/90 hover:bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer"
              title="Zoom image"
            >
              <Maximize2 className="w-4 h-4 text-slate-800" />
              <span className="hidden sm:inline">बड़ा देखें</span>
            </button>
          </div>

          {/* Bottom Interactive Bar: Clue Button */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-auto">
            {currentItemClue ? (
              <button
                onClick={handleToggleClue}
                className={`min-h-[44px] px-4 py-2 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                  showClue 
                    ? 'bg-amber-400 text-slate-950 border-2 border-amber-500' 
                    : 'bg-black/75 hover:bg-black/90 text-amber-300 border border-amber-400/50 backdrop-blur-md'
                }`}
              >
                <Lightbulb className={`w-4 h-4 ${showClue ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{showClue ? 'संकेत छिपाएँ' : '💡 संकेत (Clue)'}</span>
              </button>
            ) : <div />}

            <div className="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-slate-200 text-xs font-semibold">
              Heritage of Northeast India
            </div>
          </div>
        </div>

        {/* Clue Panel (if opened) */}
        {showClue && currentItemClue && (
          <div className="p-4 bg-amber-50 border-t-2 border-amber-300 flex items-start gap-3 animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-5 h-5 text-amber-800" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                  सांस्कृतिक संकेत (Cultural Clue)
                </span>
                <button
                  onClick={() => speakHindi(`संकेत: ${currentItemClue}`)}
                  className="text-amber-800 hover:text-amber-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>सुनें</span>
                </button>
              </div>
              <p className="text-sm sm:text-base font-bold text-amber-950 mt-1 leading-snug">
                {currentItemClue}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Question Guidance */}
      <div className="text-center py-1">
        <p className="text-base sm:text-lg font-black text-slate-800">
          तस्वीर में कौन सी सांस्कृतिक धरोहर दिखाई दे रही है?
        </p>
        <p className="text-xs text-slate-500 font-medium">
          सही विकल्प पर टैप करें (या आवाज़ सुनने के लिए 🔊 दबाएँ)
        </p>
      </div>

      {/* Options Grid */}
      <div className={`grid gap-3 pt-1 ${optionsCount === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-xl mx-auto' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {currentQuestion.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const isTarget = option.id === currentItem.id;
          const showAnswerFeedback = selectedOptionId !== null;

          let btnStyle = 'bg-white hover:bg-emerald-50/50 hover:border-emerald-300 border-2 border-slate-200 text-slate-900 shadow-xs';
          if (showAnswerFeedback) {
            if (isTarget) {
              btnStyle = 'bg-emerald-50 border-3 border-emerald-500 text-emerald-950 font-black shadow-md ring-2 ring-emerald-200 scale-[1.01]';
            } else if (isSelected) {
              btnStyle = 'bg-rose-50 border-2 border-rose-400 text-rose-950 font-bold';
            } else {
              btnStyle = 'bg-slate-100 border-2 border-slate-200 text-slate-400 opacity-50';
            }
          }

          return (
            <div
              key={option.id}
              onClick={() => handleOptionClick(option)}
              className={`min-h-[72px] p-4 rounded-[22px] flex items-center justify-between text-left transition-all duration-200 cursor-pointer ${btnStyle} ${selectedOptionId !== null ? 'cursor-default' : 'active:scale-98'}`}
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl shrink-0">
                  {option.icon || '🌸'}
                </div>
                <div className="min-w-0">
                  <span className="text-base sm:text-lg font-black block leading-snug truncate">
                    {option.name[language] || option.name.hi || option.name.en}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold block">
                    {option.state_native_name || option.state_origin} · {option.category}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Pronunciation Audio Icon */}
                <button
                  type="button"
                  onClick={(e) => handleReadOptionAloud(e, option)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    activeSpeechOptionId === option.id 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                  title="Listen to option name"
                  aria-label="Listen to option name"
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                {showAnswerFeedback && isTarget && (
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center animate-bounce">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                )}
                {showAnswerFeedback && isSelected && !isTarget && (
                  <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center">
                    <XCircle className="w-6 h-6" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cultural Fact / Insight Card on Answering */}
      {showFactCard && (
        <div className={`p-5 rounded-[28px] border-2 shadow-sm animate-fadeIn space-y-3 ${
          isCorrect ? 'bg-emerald-50/90 border-emerald-300' : 'bg-amber-50/90 border-amber-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-5 h-5 ${isCorrect ? 'text-emerald-600' : 'text-amber-600'}`} />
              <h3 className="font-black text-base sm:text-lg text-slate-900">
                {isCorrect ? 'शानदार उत्तर! (Well Done)' : 'सांस्कृतिक परिचय (Cultural Insight)'}
              </h3>
            </div>
            
            <button
              onClick={() => {
                const textToRead = `${currentItemName}। ${currentItemDesc}। ${currentItemFact || ''}`;
                speakHindi(textToRead);
              }}
              className="px-3 py-1.5 rounded-xl bg-white text-slate-800 font-black text-xs flex items-center gap-1 shadow-xs border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-emerald-600" />
              <span>पूरा विवरण सुनें</span>
            </button>
          </div>

          <p className="text-sm sm:text-base font-bold text-slate-800 leading-relaxed">
            {currentItemDesc}
          </p>

          {currentItemFact && (
            <div className="p-3 bg-white/80 rounded-2xl border border-slate-200/80 flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-slate-700 font-medium leading-normal">
                <span className="font-black text-amber-900">क्या आप जानते हैं? </span>
                {currentItemFact}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleNextQuestion}
              className="min-h-[50px] px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base flex items-center gap-2 shadow-md active:translate-y-0.5 transition-all cursor-pointer"
            >
              <span>{currentIndex + 1 < questions.length ? 'अगला प्रश्न देखें' : 'परिणाम देखें'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Lightbox Modal for Elderly Vision Clarity */}
      {showLightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-[32px] overflow-hidden border-2 border-slate-700 flex flex-col">
            {/* Lightbox Header */}
            <div className="p-4 bg-slate-950/80 flex items-center justify-between text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentItem.icon || '🌸'}</span>
                <div>
                  <h3 className="text-lg font-black text-white leading-tight">
                    {currentItemName}
                  </h3>
                  <p className="text-xs text-amber-300 font-semibold">
                    {currentItem.state_native_name || currentItem.state_origin}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowLightbox(false)}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Lightbox Image */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black/60">
              <img
                src={currentItem.image_url}
                alt={currentItem.name.en}
                className="max-h-[60vh] max-w-full object-contain rounded-2xl shadow-2xl"
              />
            </div>

            {/* Lightbox Caption */}
            <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-slate-300 flex-wrap gap-3">
              <p className="text-sm font-medium text-slate-200 max-w-xl">
                {currentItemDesc}
              </p>
              <button
                onClick={() => speakHindi(`${currentItemName}। ${currentItemDesc}`)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Volume2 className="w-4 h-4" />
                <span>सुनें</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

