import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import { CandidatePortal } from './components/CandidatePortal';
import { ExamEngine } from './components/ExamEngine';
import { ResultSheet } from './components/ResultSheet';
import { AdminPanel } from './components/AdminPanel';
import { 
  getExams, 
  getQuestions, 
  getAllAttempts, 
  createAttempt, 
  getAttempt 
} from './firebaseService';
import { Exam, Question, ExamAttempt } from './types';
import { 
  Sun, 
  Moon, 
  Lock, 
  User, 
  GraduationCap, 
  AlertCircle, 
  RefreshCw,
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';

function MainApp() {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<'candidate' | 'admin'>('candidate');
  
  // Database collections state
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active exam / candidate session states
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<ExamAttempt | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [isPracticeMode, setIsPracticeMode] = useState(false);

  // Unfinished exam resume prompt
  const [resumePrompt, setResumePrompt] = useState<ExamAttempt | null>(null);

  // Direct Exam Link parameter (e.g. ?examId=exam_123)
  const [directExamId, setDirectExamId] = useState<string>('');

  // 1. Fetch data on mount
  const loadDatabaseData = async () => {
    setIsLoading(true);
    try {
      const [exList, qList, attList] = await Promise.all([
        getExams(),
        getQuestions(),
        getAllAttempts()
      ]);
      setExams(exList);
      setQuestions(qList);
      setAttempts(attList);
    } catch (err) {
      console.error('Error synchronizing database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();

    // Parse query params for direct exam links
    const params = new URLSearchParams(window.location.search);
    const exId = params.get('examId');
    if (exId) {
      setDirectExamId(exId);
    }

    // Check for unfinished exam in local storage
    const savedAttemptId = localStorage.getItem('active_attempt_id');
    if (savedAttemptId) {
      getAttempt(savedAttemptId).then(att => {
        if (att && !att.isCompleted) {
          setResumePrompt(att);
        }
      });
    }
  }, []);

  const handleStartExam = async (
    exam: Exam, 
    name: string, 
    studentId: string, 
    isPractice: boolean,
    passwordInput?: string
  ) => {
    setCandidateName(name);
    setCandidateId(studentId);
    setIsPracticeMode(isPractice);

    // Filter or select questions depending on mode
    let examQuestions: Question[] = [];
    if (exam.mode === 'static') {
      examQuestions = questions.filter(q => exam.questionIds?.includes(q.id));
    } else {
      // Dynamic mix selection from category rules
      const rules = exam.categoryRules || {};
      Object.entries(rules).forEach(([category, count]) => {
        const available = questions.filter(q => q.category === category);
        // Shuffle and pick "count" number of questions
        const shuffled = [...available].sort(() => 0.5 - Math.random());
        examQuestions.push(...shuffled.slice(0, count));
      });
    }

    // Create a new attempt
    const newAttempt: ExamAttempt = {
      id: 'attempt_' + Math.random().toString(36).substr(2, 9),
      examId: exam.id,
      examTitle: exam.title,
      candidateName: name,
      candidateId: studentId || undefined,
      startedAt: new Date().toISOString(),
      timeTaken: 0,
      score: 0,
      percentage: 0,
      correctCount: 0,
      incorrectCount: 0,
      skippedCount: 0,
      answers: {},
      bookmarkedQuestions: [],
      tabSwitches: 0,
      rightClicks: 0,
      copyPasteAttempts: 0,
      isCompleted: false
    };

    try {
      await createAttempt(newAttempt);
      // Cache details in memory
      setActiveExam(exam);
      setActiveAttempt(newAttempt);
      
      // Save attempt ID to local storage for resume safety
      localStorage.setItem('active_attempt_id', newAttempt.id);
    } catch (err) {
      alert('Error establishing candidate session connection.');
    }
  };

  const handleResumeAttempt = (att: ExamAttempt) => {
    const exam = exams.find(e => e.id === att.examId);
    if (exam) {
      setActiveExam(exam);
      setActiveAttempt(att);
      setCandidateName(att.candidateName);
      setCandidateId(att.candidateId || '');
      setResumePrompt(null);
    }
  };

  const handleCancelResume = () => {
    localStorage.removeItem('active_attempt_id');
    setResumePrompt(null);
  };

  const handleExamSubmitted = (completedAttempt: ExamAttempt) => {
    setActiveAttempt(completedAttempt);
    // Remove local storage resume cache
    localStorage.removeItem('active_attempt_id');
    loadDatabaseData(); // refresh attempts logs
  };

  const handleExitToLobby = () => {
    setActiveExam(null);
    setActiveAttempt(null);
    setDirectExamId('');
    // Remove query params smoothly
    if (window.history.pushState) {
      const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.pushState({path:newurl},'',newurl);
    }
  };

  // Determine active questions list for exam taker or result sheet review
  const getActiveExamQuestions = () => {
    if (!activeExam) return [];
    if (activeExam.mode === 'static') {
      return questions.filter(q => activeExam.questionIds?.includes(q.id));
    }
    // For random exams where active questions are generated, retrieve category questions
    const rules = activeExam.categoryRules || {};
    let filtered: Question[] = [];
    Object.keys(rules).forEach(cat => {
      filtered.push(...questions.filter(q => q.category === cat));
    });
    return filtered;
  };

  // Hide Navbar fully when inside active exam for proctoring fullscreen feel
  const isCurrentlyInExam = activeExam && activeAttempt && !activeAttempt.isCompleted;

  return (
    <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* 1. Header Toolbar Navbar */}
      {!isCurrentlyInExam && (
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-6 py-4 shadow-sm transition-colors duration-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            
            {/* Brand Logo */}
            <div 
              onClick={handleExitToLobby}
              className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">ExamPortal</span>
            </div>

            {/* View selectors and Dark Mode toggle */}
            <div className="flex items-center gap-4">
              
              {/* Mode switch */}
              <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1">
                <button
                  onClick={() => setView('candidate')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                    view === 'candidate' 
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" /> Student lobby
                </button>
                <button
                  onClick={() => setView('admin')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                    view === 'admin' 
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" /> Admin Control
                </button>
              </div>

              {/* Refresh Sync */}
              <button
                onClick={loadDatabaseData}
                disabled={isLoading}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
                title="Synchronise database"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* Dark mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
                title="Toggle visual theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

            </div>

          </div>
        </header>
      )}

      {/* 2. Primary Workspace Switch Router */}
      <div className="relative">
        {isLoading ? (
          <div className="py-24 text-center space-y-4">
            <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">Synchronising system databases...</p>
          </div>
        ) : (
          <div className="pb-16 animate-fade-in">
            {activeExam && activeAttempt ? (
              // Active taking exam or viewing final scoresheet
              activeAttempt.isCompleted ? (
                <ResultSheet
                  attempt={activeAttempt}
                  exam={activeExam}
                  questions={getActiveExamQuestions()}
                  onExit={handleExitToLobby}
                />
              ) : (
                <ExamEngine
                  exam={activeExam}
                  questions={getActiveExamQuestions()}
                  candidateName={candidateName}
                  candidateId={candidateId}
                  isPractice={isPracticeMode}
                  attempt={activeAttempt}
                  onSubmitted={handleExamSubmitted}
                  onExit={handleExitToLobby}
                />
              )
            ) : view === 'candidate' ? (
              <CandidatePortal
                exams={exams}
                questions={questions}
                onStartExam={handleStartExam}
                directExamId={directExamId}
              />
            ) : (
              <AdminPanel
                exams={exams}
                questions={questions}
                attempts={attempts}
                onRefresh={loadDatabaseData}
              />
            )}
          </div>
        )}
      </div>

      {/* 3. Resume Unfinished Exam Notification Popover Modal */}
      {resumePrompt && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-5 shadow-2xl">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Unfinished Attempt Detected</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                You were in the middle of taking <strong className="text-slate-900 dark:text-white">"{resumePrompt.examTitle}"</strong> as <span className="underline font-semibold">{resumePrompt.candidateName}</span>. Would you like to resume where you left off?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-1.5">
              <button
                onClick={handleCancelResume}
                className="py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                Discard & Start New
              </button>
              <button
                onClick={() => handleResumeAttempt(resumePrompt)}
                className="py-2.5 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-all"
              >
                Yes, Resume Attempt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
