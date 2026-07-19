import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Play, 
  Search, 
  HelpCircle, 
  Clock, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  Sparkles, 
  Cpu, 
  Lock, 
  BookOpen, 
  ArrowRight,
  TrendingUp,
  Bookmark
} from 'lucide-react';
import { Exam, Question } from '../types';

interface CandidatePortalProps {
  exams: Exam[];
  questions: Question[];
  onStartExam: (exam: Exam, name: string, studentId: string, isPractice: boolean, passwordInput?: string) => void;
  directExamId?: string;
}

export const CandidatePortal: React.FC<CandidatePortalProps> = ({ 
  exams, 
  questions, 
  onStartExam,
  directExamId 
}) => {
  const [candidateName, setCandidateName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [examPassword, setExamPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Random Exam Builder state
  const [isBuildingRandom, setIsBuildingRandom] = useState(false);
  const [randomTitle, setRandomTitle] = useState('Daily Practice Challenge');
  const [randomDuration, setRandomDuration] = useState(30); // minutes
  const [categoryCounts, setCategoryCounts] = useState<{ [cat: string]: number }>({});

  // Extract unique categories from question bank
  const categories = Array.from(new Set(questions.map(q => q.category || 'General'))).filter(Boolean) as string[];

  // Group questions by category for counts
  const categoryAvailabilities = categories.reduce((acc, cat) => {
    acc[cat] = questions.filter(q => q.category === cat).length;
    return acc;
  }, {} as { [cat: string]: number }) as { [cat: string]: number };

  useEffect(() => {
    // If we have a direct exam ID, select it
    if (directExamId) {
      const exam = exams.find(e => e.id === directExamId);
      if (exam) {
        setSelectedExam(exam);
      }
    }
  }, [directExamId, exams]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPasswordError('');

    if (!candidateName.trim()) {
      setErrorMessage('Please enter your name to start.');
      return;
    }

    if (!selectedExam) return;

    // Check password if exam requires one
    if (selectedExam.examPassword && !isPracticeMode) {
      if (examPassword !== selectedExam.examPassword) {
        setPasswordError('Incorrect Exam Password. Please request from your instructor.');
        return;
      }
    }

    onStartExam(selectedExam, candidateName, candidateId, isPracticeMode, examPassword);
  };

  const handleGenerateRandomExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      setErrorMessage('Please enter your name first.');
      return;
    }

    // Filter categories with count > 0
    const activeRules = (Object.entries(categoryCounts) as [string, number][]).reduce((acc, [cat, cnt]) => {
      if (cnt > 0) acc[cat] = cnt;
      return acc;
    }, {} as { [cat: string]: number });

    const totalQuestions = (Object.values(activeRules) as number[]).reduce((a, b) => a + b, 0);

    if (totalQuestions === 0) {
      setErrorMessage('Please specify at least 1 question from any category.');
      return;
    }

    // Build a temporary dynamic Exam object
    const randomExam: Exam = {
      id: 'random_' + Math.random().toString(36).substr(2, 9),
      title: randomTitle || 'Custom Practice Exam',
      subject: 'Dynamic Practice',
      description: 'Automatically generated custom practice session.',
      duration: randomDuration,
      totalMarks: totalQuestions,
      passingMarks: Math.ceil(totalQuestions * 0.5),
      showAnswersImmediately: true,
      negativeMarking: 0.25,
      shuffleQuestions: true,
      shuffleOptions: true,
      mode: 'dynamic',
      categoryRules: activeRules,
      createdAt: new Date().toISOString()
    };

    onStartExam(randomExam, candidateName, candidateId, true);
  };

  const handleIncrementCategory = (cat: string) => {
    const current = categoryCounts[cat] || 0;
    const max = categoryAvailabilities[cat] || 0;
    if (current < max) {
      setCategoryCounts({ ...categoryCounts, [cat]: current + 5 });
    }
  };

  const handleDecrementCategory = (cat: string) => {
    const current = categoryCounts[cat] || 0;
    if (current >= 5) {
      setCategoryCounts({ ...categoryCounts, [cat]: current - 5 });
    } else if (current > 0) {
      setCategoryCounts({ ...categoryCounts, [cat]: 0 });
    }
  };

  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exam.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 px-2">
      {/* Welcome Banner */}
      <div className="text-center space-y-3 py-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-full text-xs font-semibold tracking-wider uppercase border border-amber-200/50"
        >
          <Sparkles className="w-3.5 h-3.5" /> Assessment Portal
        </motion.div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Welcome to the Exam Platform
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto text-sm md:text-base">
          Enter your name and choose an exam from below, or set up a custom practice session using questions from our category bank.
        </p>
      </div>

      {/* Main Form Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Side: Name and Exam selector / Custom Builder */}
        <div className="md:col-span-8 space-y-6">
          
          {/* Step 1: Identity Information */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">1</span>
              Enter Candidate Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Your Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter name for certificate"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Candidate ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ID-2026-09"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                />
              </div>
            </div>
          </div>

          {/* Toggle: Select Exam vs Build Practice */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setIsBuildingRandom(false)}
              className={`flex-1 pb-3 text-center text-sm font-semibold border-b-2 transition-all ${
                !isBuildingRandom 
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Choose Scheduled Exam ({filteredExams.length})
            </button>
            <button
              onClick={() => setIsBuildingRandom(true)}
              className={`flex-1 pb-3 text-center text-sm font-semibold border-b-2 transition-all ${
                isBuildingRandom 
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🚀 Customize Random Exam
            </button>
          </div>

          {!isBuildingRandom ? (
            /* scheduled exams selector */
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search exams by title, subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm transition-all"
                />
              </div>

              {/* Exam grid list */}
              {filteredExams.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                  <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No scheduled exams match your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredExams.map((exam) => {
                    const isSelected = selectedExam?.id === exam.id;
                    return (
                      <motion.div
                        key={exam.id}
                        whileHover={{ y: -2 }}
                        onClick={() => {
                          setSelectedExam(exam);
                          setIsPracticeMode(false);
                          setPasswordError('');
                          setErrorMessage('');
                        }}
                        className={`cursor-pointer text-left p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/25 dark:bg-indigo-950/20 shadow-md ring-1 ring-indigo-500/35'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              {exam.subject}
                            </span>
                            {exam.examPassword && (
                              <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">
                                <Lock className="w-2.5 h-2.5" /> Password Protected
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-2">
                            {exam.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            {exam.description || 'No description provided.'}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {exam.duration > 0 ? `${exam.duration}m` : 'Untimed'}
                          </span>
                          <span>
                            {exam.mode === 'static' 
                              ? `${exam.questionIds?.length || 0} Questions` 
                              : `Dynamic Selection`}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Custom random generator dashboard */
            <form onSubmit={handleGenerateRandomExam} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-500" /> Generate Practice Exam
                </h3>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full font-semibold">
                  Practice mode: answers shown immediately!
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Exam Title
                  </label>
                  <input
                    type="text"
                    required
                    value={randomTitle}
                    onChange={(e) => setRandomTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={randomDuration}
                    onChange={(e) => setRandomDuration(parseInt(e.target.value) || 30)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>
              </div>

              {/* Category Sliders */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Select Question Mix (From Question Bank)
                </div>
                {categories.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500">
                    No questions available in question bank to select categories. Import questions first.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map(cat => {
                      const count = categoryCounts[cat] || 0;
                      const max = categoryAvailabilities[cat] || 0;
                      return (
                        <div key={cat} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl">
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{cat}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{max} available</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleDecrementCategory(cat)}
                              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-sm flex items-center justify-center font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                              disabled={count === 0}
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-slate-800 dark:text-white">
                              {count}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleIncrementCategory(cat)}
                              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-sm flex items-center justify-center font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                              disabled={count >= max}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 p-3.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/30 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={!candidateName.trim() || (Object.values(categoryCounts) as number[]).reduce((a, b) => a + b, 0) === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all"
              >
                <Cpu className="w-4 h-4" /> Generate and Start Practice Exam
              </button>
            </form>
          )}

        </div>

        {/* Right Side: Info / Settings Checklist Panel */}
        <div className="md:col-span-4 space-y-6">
          {selectedExam && !isBuildingRandom && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 text-left"
            >
              <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> Exam Rules & Info
              </h3>

              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-500">Passing Marks</span>
                  <span className="font-bold text-slate-800 dark:text-white">{selectedExam.passingMarks} / {selectedExam.totalMarks} Marks</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-500">Duration</span>
                  <span className="font-bold text-slate-800 dark:text-white">{selectedExam.duration > 0 ? `${selectedExam.duration} Minutes` : 'Unlimited'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-500">Negative Marking</span>
                  <span className={`font-bold ${selectedExam.negativeMarking > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                    {selectedExam.negativeMarking > 0 ? `Yes, -${selectedExam.negativeMarking} per wrong` : 'No negative marks'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-500">Show Answers</span>
                  <span className="font-bold text-slate-800 dark:text-white">{selectedExam.showAnswersImmediately ? 'Immediately after' : 'Not shown'}</span>
                </div>
              </div>

              {/* Mode Toggle (Practice vs Exam) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Practice Mode</span>
                  <input
                    type="checkbox"
                    checked={isPracticeMode}
                    onChange={(e) => {
                      setIsPracticeMode(e.target.checked);
                      setPasswordError('');
                    }}
                    className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-800 rounded focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  In Practice Mode, you have infinite time, can bookmark questions, and see correct answers and explanations immediately as you practice! No anti-cheating is active.
                </p>
              </div>

              {/* Password requirement input */}
              {selectedExam.examPassword && !isPracticeMode && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Required Exam Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500" />
                    <input
                      type="password"
                      placeholder="Ask your exam provider"
                      value={examPassword}
                      onChange={(e) => setExamPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                    />
                  </div>
                  {passwordError && (
                    <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">{passwordError}</div>
                  )}
                </div>
              )}

              {/* Rules and anti-cheating warning */}
              {!isPracticeMode && (
                <div className="p-3.5 border border-rose-200/50 dark:border-rose-900/30 bg-rose-50/35 dark:bg-rose-950/10 rounded-xl space-y-2 text-rose-700 dark:text-rose-400">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" /> Live Monitoring Active
                  </div>
                  <ul className="text-[10px] list-disc list-inside leading-relaxed space-y-1 opacity-90">
                    <li>Do not leave full-screen mode</li>
                    <li>Do not switch tabs / minimize browser</li>
                    <li>Copy/Paste and Right-click are disabled</li>
                    <li>Unfair activities are logged and penalised</li>
                  </ul>
                </div>
              )}

              {errorMessage && (
                <div className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={handleStart}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Play className="w-4 h-4" /> Start Scheduled Exam <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Quick tips panel if no exam is selected */}
          {(!selectedExam || isBuildingRandom) && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 text-left space-y-4">
              <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-500" /> Quick Instructions
              </h4>
              <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5 list-decimal list-inside leading-relaxed">
                <li>Choose a scheduled exam from the list or create your own custom mix using the <strong className="text-slate-900 dark:text-white">Customize Random Exam</strong> tool.</li>
                <li>Write your <strong className="text-slate-900 dark:text-white">Full Name</strong> so it's registered on the scoreboard.</li>
                <li>Use <strong className="text-slate-900 dark:text-white">Practice Mode</strong> for direct feedback on answers, bookmarking, and zero timers or browser constraints!</li>
                <li>You can resume incomplete exams as long as you use the same browser and don't clear local storage.</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
