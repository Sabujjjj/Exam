import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  Bookmark, 
  BookmarkCheck,
  AlertTriangle, 
  Check, 
  X, 
  Eye, 
  Maximize2, 
  Minimize2,
  ChevronUp,
  Cpu,
  RefreshCw,
  BookOpen,
  Keyboard,
  Info
} from 'lucide-react';
import { Exam, Question, ExamAttempt } from '../types';
import { updateAttempt, updateQuestionStats } from '../firebaseService';

interface ExamEngineProps {
  exam: Exam;
  questions: Question[];
  candidateName: string;
  candidateId?: string;
  isPractice: boolean;
  attempt: ExamAttempt;
  onSubmitted: (attempt: ExamAttempt) => void;
  onExit: () => void;
}

export const ExamEngine: React.FC<ExamEngineProps> = ({
  exam,
  questions,
  candidateName,
  candidateId,
  isPractice,
  attempt,
  onSubmitted,
  onExit
}) => {
  // Current question index
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [qId: string]: string[] }>(attempt.answers || {});
  const [bookmarked, setBookmarked] = useState<string[]>(attempt.bookmarkedQuestions || []);
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  
  // Timers and states
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (exam.duration === 0) return 0; // Untimed
    // Calc if resuming, otherwise full duration
    const secondsPassed = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    const totalSeconds = exam.duration * 60;
    const remaining = totalSeconds - secondsPassed;
    return remaining > 0 ? remaining : 0;
  });

  const [preExamCountdown, setPreExamCountdown] = useState<number>(5); // 5 seconds pre-check countdown
  const [examStarted, setExamStarted] = useState(isPractice); // Skip countdown in practice
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Tracking logs (Anti-cheating)
  const [tabSwitches, setTabSwitches] = useState(0);
  const [rightClicks, setRightClicks] = useState(0);
  const [copyPasteAttempts, setCopyPasteAttempts] = useState(0);
  const [cheatWarning, setCheatWarning] = useState<string | null>(null);

  // Practice mode reveal correct state per question
  const [checkedAnswers, setCheckedAnswers] = useState<{ [qId: string]: boolean }>({});

  // Question tracking time (to calculate average time spent on each question)
  const [timePerQuestion, setTimePerQuestion] = useState<{ [qId: string]: number }>({});
  const lastTimeRef = useRef<number>(Date.now());

  // Full screen node ref
  const engineContainerRef = useRef<HTMLDivElement>(null);

  // Auto save trigger indicator
  const [isSaving, setIsSaving] = useState(false);

  // 1. Initialise tracking for current question timing
  useEffect(() => {
    lastTimeRef.current = Date.now();
  }, [currentIndex]);

  // Track time spent on each question
  useEffect(() => {
    if (!examStarted) return;
    const interval = setInterval(() => {
      const currentQId = questions[currentIndex]?.id;
      if (currentQId) {
        setTimePerQuestion(prev => ({
          ...prev,
          [currentQId]: (prev[currentQId] || 0) + 1
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex, examStarted, questions]);

  // 2. Pre-exam Countdown
  useEffect(() => {
    if (isPractice || examStarted) return;
    const interval = setInterval(() => {
      setPreExamCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setExamStarted(true);
          enterFullscreen();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [examStarted, isPractice]);

  // 3. Exam Timer countdown and auto-submit
  useEffect(() => {
    if (!examStarted || exam.duration === 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit(true); // Auto submit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [examStarted]);

  // 4. Anti-cheating Event Listeners (Only if NOT in Practice mode)
  useEffect(() => {
    if (isPractice || !examStarted) return;

    // A. Tab switches / visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => {
          const next = prev + 1;
          setCheatWarning(`Tab Switch Warning! You have navigated away from the exam ${next} time(s). Casual tab switching is reported to the exam administrator.`);
          return next;
        });
      }
    };

    // B. Right clicks
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setRightClicks(prev => prev + 1);
      setCheatWarning('Right-click menu is disabled during the examination for security purposes.');
    };

    // C. Copy and Paste
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      setCopyPasteAttempts(prev => prev + 1);
      setCheatWarning('Copy and Paste operations are strictly disabled to prevent plagiarism.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopyPaste as any);
    window.addEventListener('paste', handleCopyPaste as any);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopyPaste as any);
      window.removeEventListener('paste', handleCopyPaste as any);
    };
  }, [examStarted, isPractice]);

  // Keyboard Shortcuts (A, B, C, D to answer, Arrows for navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!examStarted) return;
      const currentQ = questions[currentIndex];
      if (!currentQ) return;

      // Arrows for navigation
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }

      // Space to toggle marked for review
      if (e.key === ' ') {
        e.preventDefault();
        toggleMarkedForReview(currentQ.id);
      }

      // Choice options shortcuts
      if (currentQ.type === 'single' || currentQ.type === 'boolean') {
        const optionKeys = ['a', 'b', 'c', 'd', '1', '2', '3', '4'];
        const keyIndex = optionKeys.indexOf(e.key.toLowerCase());
        const mappedIdx = keyIndex >= 4 ? keyIndex - 4 : keyIndex;
        if (mappedIdx !== -1 && mappedIdx < currentQ.options.length) {
          handleSelectOption(currentQ.id, currentQ.options[mappedIdx], 'single');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, examStarted, questions, answers]);

  // 5. Periodic Auto-save (Every 7 seconds)
  useEffect(() => {
    if (!examStarted) return;
    const interval = setInterval(async () => {
      setIsSaving(true);
      try {
        await updateAttempt(attempt.id, {
          answers,
          bookmarkedQuestions: bookmarked,
          tabSwitches,
          rightClicks,
          copyPasteAttempts,
          timeTaken: Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000)
        });
      } catch (error) {
        console.warn('Auto-save error, will try again:', error);
      } finally {
        setTimeout(() => setIsSaving(false), 800);
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [answers, bookmarked, tabSwitches, rightClicks, copyPasteAttempts, examStarted]);

  // Fullscreen Management
  const enterFullscreen = () => {
    if (engineContainerRef.current) {
      engineContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.warn('Fullscreen request rejected or not supported by iframe:', err);
      });
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Handle answers input
  const handleSelectOption = (qId: string, option: string, type: 'single' | 'multiple') => {
    const current = answers[qId] || [];
    if (type === 'single') {
      setAnswers({ ...answers, [qId]: [option] });
    } else {
      // Multiple choice checkboxes
      if (current.includes(option)) {
        setAnswers({ ...answers, [qId]: current.filter(o => o !== option) });
      } else {
        setAnswers({ ...answers, [qId]: [...current, option] });
      }
    }
  };

  const handleFillAnswer = (qId: string, value: string) => {
    setAnswers({ ...answers, [qId]: [value] });
  };

  // Bookmarking
  const toggleBookmark = (qId: string) => {
    setBookmarked(prev => 
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  // Marked for Review
  const toggleMarkedForReview = (qId: string) => {
    setMarkedForReview(prev => 
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Submit assessment calculation
  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && !window.confirm('Are you absolutely sure you want to submit your exam?')) {
      return;
    }

    // Exit fullscreen
    exitFullscreen();

    // Calculate score
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    const correctQuestionIds = new Set<string>();
    const skippedQuestionIds = new Set<string>();

    questions.forEach(q => {
      const studentAnswers = answers[q.id] || [];
      if (studentAnswers.length === 0) {
        skippedCount++;
        skippedQuestionIds.add(q.id);
        return;
      }

      // Check correctness
      let isCorrect = false;
      if (q.type === 'single' || q.type === 'boolean') {
        isCorrect = studentAnswers[0] === q.correctAnswers[0];
      } else if (q.type === 'multiple') {
        // Sort and compare strings or match lists
        const sortedStudent = [...studentAnswers].sort();
        const sortedCorrect = [...q.correctAnswers].sort();
        isCorrect = sortedStudent.length === sortedCorrect.length && sortedStudent.every((val, idx) => val === sortedCorrect[idx]);
      } else if (q.type === 'fill') {
        const studentAns = (studentAnswers[0] || '').trim().toLowerCase();
        isCorrect = q.correctAnswers.some(ans => ans.trim().toLowerCase() === studentAns);
      }

      if (isCorrect) {
        correctCount++;
        correctQuestionIds.add(q.id);
        score += 1; // 1 mark per correct question
      } else {
        incorrectCount++;
        score -= (exam.negativeMarking || 0); // subtract negative marking weight
      }
    });

    const timeTaken = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    const percentage = questions.length > 0 ? (score / questions.length) * 100 : 0;

    const completedAttempt: ExamAttempt = {
      ...attempt,
      isCompleted: true,
      answers,
      bookmarkedQuestions: bookmarked,
      score: Math.max(0, score), // cap score at 0
      percentage,
      correctCount,
      incorrectCount,
      skippedCount,
      timeTaken,
      tabSwitches,
      rightClicks,
      copyPasteAttempts,
      submittedAt: new Date().toISOString()
    };

    try {
      // 1. Save completed attempt to Firestore
      await updateAttempt(attempt.id, completedAttempt);

      // 2. Increment global stats on each question in Firestore (only if not practice)
      if (!isPractice) {
        await updateQuestionStats(answers, questions, correctQuestionIds, skippedQuestionIds, timePerQuestion);
      }
    } catch (err) {
      console.error('Error finalising attempt submission:', err);
    }

    onSubmitted(completedAttempt);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];

  if (!examStarted) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-6"
        >
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/50 rounded-full flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
            <Cpu className="w-10 h-10 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Prepare for Assessment</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exam: <strong className="text-slate-800 dark:text-slate-200">{exam.title}</strong>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-xs mx-auto">
              Proctoring system is setting up. Copying, right-click, and tab-switching will trigger security flags.
            </p>
          </div>

          <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400 animate-bounce">
            {preExamCountdown}
          </div>

          <div className="text-[10px] uppercase font-bold tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/30 py-1.5 px-3 rounded-full inline-block">
            🔔 Do not leave your browser or window
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      ref={engineContainerRef}
      className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200"
    >
      {/* Exam Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 py-3.5 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Title and metadata */}
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
              EX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1">{exam.title}</h2>
                {isPractice && (
                  <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded">
                    Practice Mode
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Candidate: {candidateName} {candidateId ? `(ID: ${candidateId})` : ''}</p>
            </div>
          </div>

          {/* Controls: Save indicator, Timer, Fullscreen, Submit */}
          <div className="flex items-center gap-4">
            
            {/* Auto save indicator */}
            {isSaving && (
              <span className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded">
                <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
              </span>
            )}

            {/* Timers */}
            {exam.duration > 0 && (
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                timeLeft < 60 
                  ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-900/30 dark:text-rose-400 animate-pulse' 
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}

            {/* Keyboard Shortcuts Info */}
            <div className="group relative hidden lg:block">
              <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <Keyboard className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-10 w-64 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl hidden group-hover:block z-50 text-xs text-slate-600 dark:text-slate-400 text-left space-y-2">
                <div className="font-bold border-b pb-1.5 text-slate-800 dark:text-white">Keyboard Shortcuts</div>
                <div className="flex justify-between"><span>A, B, C, D</span> <span>Select Option</span></div>
                <div className="flex justify-between"><span>← / →</span> <span>Prev / Next Question</span></div>
                <div className="flex justify-between"><span>Space</span> <span>Mark for Review</span></div>
              </div>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:shadow-sm"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Submit */}
            <button
              onClick={() => handleSubmit(false)}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full shadow-md transition-all shrink-0"
            >
              Finish & Submit
            </button>
          </div>

        </div>
      </header>

      {/* Cheat Warning Toast */}
      <AnimatePresence>
        {cheatWarning && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs py-2 px-4 flex items-center justify-between font-semibold"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{cheatWarning}</span>
            </div>
            <button 
              onClick={() => setCheatWarning(null)}
              className="text-amber-500 hover:text-amber-800 dark:hover:text-amber-200"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 items-start">
        
        {/* Left Side: Question Pane */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          
          {/* Question toolbar */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="text-xs font-bold text-slate-500">
              QUESTION {currentIndex + 1} OF {questions.length}
            </span>
            <div className="flex items-center gap-2">
              
              {/* Category tag */}
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {currentQuestion.category}
              </span>

              {/* Difficulty tag */}
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                currentQuestion.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                currentQuestion.difficulty === 'hard' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' :
                'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              }`}>
                {currentQuestion.difficulty}
              </span>

              {/* Bookmark button */}
              <button
                onClick={() => toggleBookmark(currentQuestion.id)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600"
              >
                {bookmarked.includes(currentQuestion.id) ? (
                  <BookmarkCheck className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>

              {/* Mark for review checkbox */}
              <button
                onClick={() => toggleMarkedForReview(currentQuestion.id)}
                className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold ${
                  markedForReview.includes(currentQuestion.id)
                    ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30'
                    : 'text-slate-400 hover:text-amber-600'
                }`}
              >
                <Flag className="w-4 h-4" />
                <span className="hidden sm:inline">Mark for review</span>
              </button>

            </div>
          </div>

          {/* Question Text & Media */}
          <div className="space-y-4 text-left">
            <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-relaxed whitespace-pre-wrap">
              {currentQuestion.text}
            </h1>

            {/* Question image if configured */}
            {currentQuestion.imageUrl && (
              <div className="p-2 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-2xl max-h-80 overflow-hidden flex justify-center">
                <img 
                  src={currentQuestion.imageUrl} 
                  alt="Question Diagram" 
                  referrerPolicy="no-referrer"
                  className="max-h-72 object-contain rounded-xl"
                />
              </div>
            )}
          </div>

          {/* Question Input Answers */}
          <div className="space-y-3.5 text-left pt-2">
            
            {/* SINGLE CHOICE (True/False or Multiple options) */}
            {currentQuestion.type === 'single' && (
              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((opt, oIdx) => {
                  const isSelected = (answers[currentQuestion.id] || []).includes(opt);
                  const isChecked = checkedAnswers[currentQuestion.id];
                  const isCorrect = currentQuestion.correctAnswers.includes(opt);
                  
                  let optionClass = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700';
                  if (isSelected) {
                    optionClass = 'border-indigo-600 bg-indigo-50/15 dark:bg-indigo-950/20 ring-1 ring-indigo-500';
                  }

                  if (isChecked) {
                    if (isCorrect) {
                      optionClass = 'border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/30 ring-1 ring-emerald-500';
                    } else if (isSelected) {
                      optionClass = 'border-rose-600 bg-rose-50/20 dark:bg-rose-950/30 ring-1 ring-rose-500';
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => !isChecked && handleSelectOption(currentQuestion.id, opt, 'single')}
                      disabled={isChecked}
                      className={`w-full p-4 text-left rounded-xl border text-sm font-semibold flex items-center justify-between transition-all ${optionClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-500 font-bold uppercase">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="text-slate-800 dark:text-slate-200">{opt}</span>
                      </div>
                      {isChecked && isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {isChecked && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* TRUE / FALSE SELECTION */}
            {currentQuestion.type === 'boolean' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {['True', 'False'].map((opt, oIdx) => {
                  const isSelected = (answers[currentQuestion.id] || []).includes(opt);
                  const isChecked = checkedAnswers[currentQuestion.id];
                  const isCorrect = currentQuestion.correctAnswers.includes(opt);

                  let optionClass = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700';
                  if (isSelected) {
                    optionClass = 'border-indigo-600 bg-indigo-50/15 dark:bg-indigo-950/20 ring-1 ring-indigo-500';
                  }

                  if (isChecked) {
                    if (isCorrect) {
                      optionClass = 'border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/30 ring-1 ring-emerald-500';
                    } else if (isSelected) {
                      optionClass = 'border-rose-600 bg-rose-50/20 dark:bg-rose-950/30 ring-1 ring-rose-500';
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => !isChecked && handleSelectOption(currentQuestion.id, opt, 'single')}
                      disabled={isChecked}
                      className={`p-4 text-center rounded-xl border text-sm font-extrabold flex justify-center items-center gap-2 transition-all ${optionClass}`}
                    >
                      {opt}
                      {isChecked && isCorrect && <Check className="w-4 h-4 text-emerald-600" />}
                      {isChecked && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-600" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* MULTIPLE CHOICE CHECKBOXES */}
            {currentQuestion.type === 'multiple' && (
              <div className="grid grid-cols-1 gap-3">
                <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Multiple options can be correct. Choose all that apply.
                </div>
                {currentQuestion.options.map((opt, oIdx) => {
                  const isSelected = (answers[currentQuestion.id] || []).includes(opt);
                  const isChecked = checkedAnswers[currentQuestion.id];
                  const isCorrect = currentQuestion.correctAnswers.includes(opt);

                  let optionClass = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300';
                  if (isSelected) {
                    optionClass = 'border-indigo-600 bg-indigo-50/15 dark:bg-indigo-950/20 ring-1 ring-indigo-500';
                  }

                  if (isChecked) {
                    if (isCorrect) {
                      optionClass = 'border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/30 ring-1 ring-emerald-500';
                    } else if (isSelected) {
                      optionClass = 'border-rose-600 bg-rose-50/20 dark:bg-rose-950/30 ring-1 ring-rose-500';
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => !isChecked && handleSelectOption(currentQuestion.id, opt, 'multiple')}
                      disabled={isChecked}
                      className={`w-full p-4 text-left rounded-xl border text-sm font-semibold flex items-center justify-between transition-all ${optionClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded"
                        />
                        <span className="text-slate-800 dark:text-slate-200">{opt}</span>
                      </div>
                      {isChecked && isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {isChecked && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* FILL IN THE BLANK TEXT INPUT */}
            {currentQuestion.type === 'fill' && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Type your answer here..."
                  value={(answers[currentQuestion.id] || [])[0] || ''}
                  onChange={(e) => handleFillAnswer(currentQuestion.id, e.target.value)}
                  disabled={checkedAnswers[currentQuestion.id]}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                
                {checkedAnswers[currentQuestion.id] && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold">
                    Correct Answers: {currentQuestion.correctAnswers.join(' or ')}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Practice Mode immediate checking answer block */}
          {isPractice && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-left">
              {!checkedAnswers[currentQuestion.id] ? (
                <button
                  onClick={() => setCheckedAnswers({ ...checkedAnswers, [currentQuestion.id]: true })}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
                >
                  Check Answer & Show Explanation
                </button>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2.5 text-xs text-slate-600 dark:text-slate-400"
                >
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                    <BookOpen className="w-4 h-4 text-indigo-500" /> Explanation Summary:
                  </div>
                  <p className="leading-relaxed leading-normal">{currentQuestion.explanation || 'No detailed explanation registered for this question.'}</p>
                </motion.div>
              )}
            </div>
          )}

          {/* Bottom navigation buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-50 transition-all border border-slate-200 dark:border-slate-700"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-50 transition-all border border-slate-200 dark:border-slate-700"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Right Side: Question Palette & Logs */}
        <div className="lg:col-span-4 space-y-6 text-left">
          
          {/* Question Palette Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="font-bold text-slate-950 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4.5 h-4.5 text-indigo-500" /> Question Palette
              </h3>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded">
                {Object.keys(answers).length} / {questions.length} Answered
              </span>
            </div>

            {/* Grid of question buttons */}
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-5 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isSelected = currentIndex === idx;
                const isAnswered = (answers[q.id] || []).length > 0;
                const isMarked = markedForReview.includes(q.id);
                const isBookmarked = bookmarked.includes(q.id);

                let btnStyle = 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900';
                
                if (isAnswered) {
                  btnStyle = 'bg-indigo-600 border-indigo-600 text-white font-bold';
                }
                
                if (isMarked) {
                  btnStyle = 'bg-amber-500 border-amber-500 text-white font-bold';
                }

                if (isSelected) {
                  btnStyle += ' ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 w-full rounded-lg text-xs font-semibold border flex items-center justify-center relative transition-all shadow-sm ${btnStyle}`}
                  >
                    {idx + 1}
                    {isBookmarked && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend indicators */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-600 inline-block" /> Answered
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-slate-300 inline-block bg-white" /> Unanswered
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> For Review
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" /> Bookmarked
              </div>
            </div>
          </div>

          {/* Practice/Anti-cheating stats feedback */}
          {!isPractice && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3.5">
              <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> Active Proctoring Log
              </h4>

              <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-800">
                  <span>Tab Switches</span>
                  <span className={tabSwitches > 0 ? 'text-rose-600' : 'text-slate-500'}>
                    {tabSwitches} / 3 Allowed
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-800">
                  <span>Invalid Right Clicks</span>
                  <span>{rightClicks}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-800">
                  <span>Copy/Paste Violations</span>
                  <span>{copyPasteAttempts}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 leading-normal bg-white dark:bg-slate-950 p-2 border rounded-lg">
                Proctoring system records changes in tab states. Switching screens may lead to direct exam locking or score penalties.
              </div>
            </div>
          )}

        </div>

      </main>

    </div>
  );
};
