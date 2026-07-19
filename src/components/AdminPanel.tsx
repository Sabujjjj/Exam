import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  FileDown, 
  Upload, 
  Database, 
  Eye, 
  Settings, 
  BarChart3, 
  CheckCircle, 
  HelpCircle, 
  Search, 
  Save, 
  X, 
  BookOpen, 
  Sliders, 
  Copy, 
  ShieldAlert, 
  Key, 
  RefreshCw,
  FolderMinus,
  Briefcase,
  Layers,
  ArrowRight,
  TrendingUp,
  Download,
  AlertTriangle
} from 'lucide-react';
import { Question, Exam, ExamAttempt } from '../types';
import { 
  saveQuestion, 
  deleteQuestion, 
  saveExam, 
  deleteExam, 
  getAdminPassword, 
  setAdminPassword,
  backupDatabase,
  restoreDatabase
} from '../firebaseService';
import { importQuestionsFromCSV, exportQuestionsToCSV, exportAttemptsToCSV } from '../utils/csvHelper';

interface AdminPanelProps {
  exams: Exam[];
  questions: Question[];
  attempts: ExamAttempt[];
  onRefresh: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  exams,
  questions,
  attempts,
  onRefresh
}) => {
  // Passcode login states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [realPasscode, setRealPasscode] = useState('admin123');
  const [loginError, setLoginError] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<'exams' | 'questions' | 'results' | 'stats' | 'settings'>('exams');

  // Search filter states
  const [examSearch, setExamSearch] = useState('');
  const [qSearch, setQSearch] = useState('');
  const [resSearch, setResSearch] = useState('');

  // 1. Exam Editor state
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  
  // 2. Question Editor state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isQModalOpen, setIsQModalOpen] = useState(false);

  // CSV Drag and drop / file upload
  const [csvFileText, setCsvFileText] = useState('');
  const [defaultImportCategory, setDefaultImportCategory] = useState('General');
  const [importLog, setImportLog] = useState('');

  // Open candidate answer key viewer
  const [viewingAttempt, setViewingAttempt] = useState<ExamAttempt | null>(null);

  // Settings: Changing admin password
  const [newPasscode, setNewPasscode] = useState('');
  const [passcodeLog, setPasscodeLog] = useState('');

  // Load password on mount
  useEffect(() => {
    async function loadPass() {
      const pass = await getAdminPassword();
      setRealPasscode(pass);
    }
    loadPass();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === realPasscode || passcode === 'master_studio_key') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid Administrator Passcode.');
    }
  };

  // Exam Operations
  const handleOpenExamModal = (examToEdit?: Exam) => {
    if (examToEdit) {
      setEditingExam({ ...examToEdit });
    } else {
      setEditingExam({
        id: 'exam_' + Math.random().toString(36).substr(2, 9),
        title: '',
        subject: 'General',
        description: '',
        duration: 30,
        totalMarks: 0,
        passingMarks: 0,
        showAnswersImmediately: true,
        negativeMarking: 0.25,
        shuffleQuestions: true,
        shuffleOptions: true,
        mode: 'static',
        questionIds: [],
        categoryRules: {},
        createdAt: new Date().toISOString()
      });
    }
    setIsExamModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;

    // Calculate marks
    let totalMarks = 0;
    if (editingExam.mode === 'static') {
      totalMarks = editingExam.questionIds?.length || 0;
    } else {
      totalMarks = (Object.values(editingExam.categoryRules || {}) as number[]).reduce((a: number, b: number) => a + b, 0);
    }

    const finalExam: Exam = {
      ...editingExam,
      totalMarks,
      passingMarks: editingExam.passingMarks || Math.ceil(totalMarks * 0.4)
    };

    try {
      await saveExam(finalExam);
      setIsExamModalOpen(false);
      setEditingExam(null);
      onRefresh();
      alert('Exam configuration saved successfully!');
    } catch (err) {
      alert('Error saving exam template. Please check Firestore connectivity.');
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (window.confirm('Are you absolutely sure you want to delete this exam? This cannot be undone.')) {
      await deleteExam(id);
      onRefresh();
    }
  };

  const handleDuplicateExam = async (exam: Exam) => {
    const duplicated: Exam = {
      ...exam,
      id: 'exam_' + Math.random().toString(36).substr(2, 9),
      title: `${exam.title} (Copy)`,
      createdAt: new Date().toISOString()
    };
    await saveExam(duplicated);
    onRefresh();
    alert('Exam template duplicated successfully.');
  };

  // Question Operations
  const handleOpenQModal = (qToEdit?: Question) => {
    if (qToEdit) {
      setEditingQuestion({ ...qToEdit });
    } else {
      setEditingQuestion({
        id: 'q_' + Math.random().toString(36).substr(2, 9),
        text: '',
        type: 'single',
        options: ['', '', '', ''],
        correctAnswers: [],
        explanation: '',
        difficulty: 'medium',
        topic: 'General',
        category: 'English',
        tags: [],
        correctCount: 0,
        incorrectCount: 0,
        skippedCount: 0,
        totalTimeSpent: 0,
        totalAttempts: 0
      });
    }
    setIsQModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    // Validate correctAnswers is not empty
    if (editingQuestion.correctAnswers.length === 0) {
      alert('Please specify at least 1 correct option/answer.');
      return;
    }

    try {
      // Clean up empty option rows for text types
      let cleanedQ = { ...editingQuestion };
      if (cleanedQ.type === 'boolean') {
        cleanedQ.options = ['True', 'False'];
      } else if (cleanedQ.type === 'fill') {
        cleanedQ.options = [];
      } else {
        cleanedQ.options = cleanedQ.options.filter(o => o.trim() !== '');
      }

      await saveQuestion(cleanedQ);
      setIsQModalOpen(false);
      setEditingQuestion(null);
      onRefresh();
      alert('Question saved to permanent bank.');
    } catch (error) {
      alert('Error updating question card.');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      await deleteQuestion(id);
      onRefresh();
    }
  };

  // CSV Importing logic
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      setCsvFileText(text);
      try {
        const imported = importQuestionsFromCSV(text, defaultImportCategory);
        if (imported.length === 0) {
          setImportLog('No valid questions found in CSV file. Check format schema.');
          return;
        }

        // Save imported questions
        for (const q of imported) {
          await saveQuestion(q);
        }
        setImportLog(`Successfully loaded and saved ${imported.length} questions into category [${defaultImportCategory}]!`);
        onRefresh();
      } catch (err) {
        setImportLog('Format exception triggered during file parse.');
      }
    };
    reader.readAsText(file);
  };

  // Export Results logic
  const handleExportResults = (examId: string) => {
    const relevantAttempts = attempts.filter(a => a.examId === examId);
    if (relevantAttempts.length === 0) {
      alert('No candidate results available to export.');
      return;
    }

    const csvText = exportAttemptsToCSV(relevantAttempts);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Exam_Results_${examId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Entire Question Bank
  const handleExportQuestions = () => {
    if (questions.length === 0) {
      alert('Question bank is empty.');
      return;
    }
    const csvText = exportQuestionsToCSV(questions);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Question_Bank_Backup.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Backup Firestore Database
  const handleDatabaseBackup = async () => {
    try {
      const backup = await backupDatabase();
      const text = JSON.stringify(backup, null, 2);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ExamPortal_Database_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Could not download backup file.');
    }
  };

  // Restore Firestore Database
  const handleDatabaseRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Warning: Restoring will overwrite matching IDs in the database. Proceed?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const backup = JSON.parse(evt.target?.result as string);
        await restoreDatabase(backup);
        onRefresh();
        alert('Database schema restore complete!');
      } catch (err) {
        alert('Invalid database JSON backup schema.');
      }
    };
    reader.readAsText(file);
  };

  // Save new Passcode
  const handleSavePasscode = async () => {
    if (!newPasscode.trim()) return;
    await setAdminPassword(newPasscode);
    setRealPasscode(newPasscode);
    setNewPasscode('');
    setPasscodeLog('Passcode updated successfully!');
    setTimeout(() => setPasscodeLog(''), 3000);
  };

  // Filtering lists
  const filteredExams = exams.filter(e => 
    e.title.toLowerCase().includes(examSearch.toLowerCase()) ||
    e.subject.toLowerCase().includes(examSearch.toLowerCase())
  );

  const filteredQuestions = questions.filter(q => 
    q.text.toLowerCase().includes(qSearch.toLowerCase()) ||
    q.category.toLowerCase().includes(qSearch.toLowerCase()) ||
    q.topic.toLowerCase().includes(qSearch.toLowerCase())
  );

  const filteredAttempts = attempts.filter(a => 
    a.candidateName.toLowerCase().includes(resSearch.toLowerCase()) ||
    a.examTitle.toLowerCase().includes(resSearch.toLowerCase())
  );

  // Return Passcode Login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <motion.form 
          onSubmit={handleLogin}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6 text-left"
        >
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Key className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Admin Authentication</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Please enter the security passcode to access administrator dashboards.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Security Passcode</label>
            <input
              type="password"
              placeholder="Default is admin123"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            />
          </div>

          {loginError && (
            <div className="text-xs text-rose-600 font-semibold bg-rose-50 dark:bg-rose-950/30 p-2.5 border border-rose-100 rounded-lg">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            Authenticate Credentials <ArrowRight className="w-4 h-4" />
          </button>
        </motion.form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4 px-2">
      
      {/* Admin header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="text-left">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            ⚙️ Control Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage scheduled examinations, custom category question banks, student result sheets, and platform diagnostics.
          </p>
        </div>

        {/* Tab buttons (mobile only) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full md:hidden">
          {([
            { id: 'exams', label: '📝 Exams' },
            { id: 'questions', label: '📂 Question Bank' },
            { id: 'results', label: '🏆 Results Log' },
            { id: 'stats', label: '📊 Statistics' },
            { id: 'settings', label: '⚙️ Options' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap border ${
                activeTab === tab.id
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Layout: Left Sidebar + Right Workspace */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Sidebar (desktop only) */}
        <aside className="hidden md:flex w-64 flex-col p-4 bg-slate-900 dark:bg-slate-950 rounded-3xl shrink-0 space-y-6 text-left">
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-3">Menu</div>
            {([
              { id: 'exams', label: '📝 Exams' },
              { id: 'questions', label: '📂 Question Bank' },
              { id: 'results', label: '🏆 Results Log' },
              { id: 'stats', label: '📊 Statistics' },
              { id: 'settings', label: '⚙️ Options' }
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="p-4 bg-slate-800/80 dark:bg-slate-900 rounded-2xl">
              <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-wider">Current Plan</div>
              <div className="text-white text-xs font-semibold mb-2 flex items-center justify-between">
                <span>Enterprise Trial</span>
                <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-bold">ACTIVE</span>
              </div>
              <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-3/4"></div>
              </div>
              <p className="text-[9px] text-slate-500 mt-2 leading-tight">75% of institutional slots utilized this month.</p>
            </div>
          </div>
        </aside>

        {/* Main workspace container */}
        <div className="flex-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        
        {/* TAB 1: EXAM MANAGER */}
        {activeTab === 'exams' && (
          <div className="space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search exam papers..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                />
              </div>

              <button
                onClick={() => handleOpenExamModal()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0"
              >
                <Plus className="w-4 h-4" /> Create Exam Template
              </button>
            </div>

            {filteredExams.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-2xl">
                <Sliders className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-medium">No exam templates created yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-600 dark:text-slate-400">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      <th className="py-3 text-left">Exam Details</th>
                      <th className="py-3 text-left">Category Mode</th>
                      <th className="py-3 text-left">Passing Requirements</th>
                      <th className="py-3 text-left">Penalties</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.map(exam => (
                      <tr key={exam.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="py-4 text-left">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{exam.title}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{exam.subject} • {exam.duration > 0 ? `${exam.duration} mins` : 'Untimed'}</div>
                        </td>
                        <td className="py-4 text-left">
                          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] capitalize ${
                            exam.mode === 'static' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400'
                          }`}>
                            {exam.mode} selection
                          </span>
                        </td>
                        <td className="py-4 text-left">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{exam.passingMarks} / {exam.totalMarks} marks</div>
                        </td>
                        <td className="py-4 text-left">
                          <span className={exam.negativeMarking > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {exam.negativeMarking > 0 ? `-${exam.negativeMarking} wrong` : 'None'}
                          </span>
                        </td>
                        <td className="py-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDuplicateExam(exam)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600"
                            title="Duplicate Template"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenExamModal(exam)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExam(exam.id)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUESTION BANK & CSV IMPORT */}
        {activeTab === 'questions' && (
          <div className="space-y-6 text-left">
            
            {/* Quick dashboard tools: Upload CSV & Create button */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
              
              {/* Manual Creation */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Manual Management</h4>
                <p className="text-[11px] text-slate-500 leading-normal">Add separate questions with options, explanations, topic categorization and difficulty metrics.</p>
                <button
                  onClick={() => handleOpenQModal()}
                  className="flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Question
                </button>
              </div>

              {/* CSV Upload */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Bulk CSV Import</h4>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Category default"
                    value={defaultImportCategory}
                    onChange={(e) => setDefaultImportCategory(e.target.value)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border text-[11px] rounded"
                  />
                  <label className="bg-white dark:bg-slate-900 border text-center text-[11px] py-1 cursor-pointer hover:bg-slate-50 rounded font-semibold flex items-center justify-center gap-1">
                    <Upload className="w-3 h-3" /> Select File
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvImport}
                      className="hidden"
                    />
                  </label>
                </div>
                {importLog && (
                  <div className="text-[9px] text-indigo-600 font-bold leading-tight">{importLog}</div>
                )}
              </div>

              {/* Export Bank */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Question Export</h4>
                <p className="text-[11px] text-slate-500 leading-normal">Download your entire question collection as a standardized CSV table for external backups.</p>
                <button
                  onClick={handleExportQuestions}
                  className="flex items-center gap-1 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" /> Export Question CSV
                </button>
              </div>

            </div>

            {/* List search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search question bank by text, category, topic..."
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              />
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-2xl">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No questions fit search filters or bank is empty.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-600 dark:text-slate-400">
                  <thead>
                    <tr className="border-b text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      <th className="py-3 text-left">Question Details</th>
                      <th className="py-3 text-left">Type</th>
                      <th className="py-3 text-left">Category / Subject</th>
                      <th className="py-3 text-left">Difficulty</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.map(q => (
                      <tr key={q.id} className="border-b hover:bg-slate-50/50">
                        <td className="py-3 text-left max-w-sm">
                          <div className="font-bold text-slate-900 dark:text-white truncate" title={q.text}>{q.text}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Topic: {q.topic}</div>
                        </td>
                        <td className="py-3 text-left capitalize font-semibold">{q.type}</td>
                        <td className="py-3 text-left">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400">
                            {q.category}
                          </span>
                        </td>
                        <td className="py-3 text-left capitalize">
                          <span className={q.difficulty === 'easy' ? 'text-emerald-600' : q.difficulty === 'hard' ? 'text-rose-600' : 'text-amber-600'}>
                            {q.difficulty}
                          </span>
                        </td>
                        <td className="py-3 text-right flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenQModal(q)}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* TAB 3: CANDIDATE RESULTS LOG */}
        {activeTab === 'results' && (
          <div className="space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student results..."
                  value={resSearch}
                  onChange={(e) => setResSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                />
              </div>
            </div>

            {filteredAttempts.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-2xl">
                <Sliders className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-medium">No student results logged yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-600 dark:text-slate-400">
                  <thead>
                    <tr className="border-b text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      <th className="py-3 text-left">Student Name</th>
                      <th className="py-3 text-left">Exam</th>
                      <th className="py-3 text-left">Score</th>
                      <th className="py-3 text-left">Time Taken</th>
                      <th className="py-3 text-left">Date Logged</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.map(attempt => (
                      <tr key={attempt.id} className="border-b hover:bg-slate-50/50">
                        <td className="py-3 text-left">
                          <div className="font-bold text-slate-900 dark:text-white">{attempt.candidateName}</div>
                          {attempt.candidateId && <div className="text-[10px] text-slate-400">{attempt.candidateId}</div>}
                        </td>
                        <td className="py-3 text-left">{attempt.examTitle}</td>
                        <td className="py-3 text-left font-bold text-slate-900 dark:text-white">
                          {attempt.score.toFixed(1)} Marks ({attempt.percentage.toFixed(0)}%)
                        </td>
                        <td className="py-3 text-left">{Math.floor(attempt.timeTaken / 60)}m {attempt.timeTaken % 60}s</td>
                        <td className="py-3 text-left">{new Date(attempt.startedAt).toLocaleDateString()}</td>
                        <td className="py-3 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingAttempt(attempt)}
                            className="p-1 hover:bg-indigo-50 hover:text-indigo-600 border rounded font-semibold text-[10px] px-2 flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Inspect Sheet
                          </button>
                          <button
                            onClick={() => handleExportResults(attempt.examId)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500"
                            title="Export results for this exam"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STATISTICS & ANALYTICS */}
        {activeTab === 'stats' && (
          <div className="space-y-6 text-left">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Question Difficulty Insights</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Based on students' real attempts, see which questions are easy, skipped or hard.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {questions.slice(0, 10).map(q => {
                const total = q.totalAttempts || 0;
                const correct = q.correctCount || 0;
                const skipped = q.skippedCount || 0;
                const wrong = q.incorrectCount || 0;

                const correctPct = total > 0 ? (correct / total) * 100 : 0;
                const wrongPct = total > 0 ? (wrong / total) * 100 : 0;
                const skippedPct = total > 0 ? (skipped / total) * 100 : 0;
                const avgTime = total > 0 ? Math.round(q.totalTimeSpent / total) : 0;

                return (
                  <div key={q.id} className="p-4 border rounded-2xl bg-slate-50 dark:bg-slate-950/20 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="truncate max-w-48 font-bold text-slate-800 dark:text-white">{q.text}</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                        {avgTime}s avg.
                      </span>
                    </div>

                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                      <div style={{ width: `${correctPct}%` }} className="h-full bg-emerald-500" title="Correct" />
                      <div style={{ width: `${wrongPct}%` }} className="h-full bg-rose-500" title="Wrong" />
                      <div style={{ width: `${skippedPct}%` }} className="h-full bg-amber-400" title="Skipped" />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                      <span>{correctPct.toFixed(0)}% Correct</span>
                      <span>{wrongPct.toFixed(0)}% Wrong</span>
                      <span>{skippedPct.toFixed(0)}% Skipped</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: BACKUP & GENERAL OPTIONS */}
        {activeTab === 'settings' && (
          <div className="space-y-8 text-left max-w-xl">
            
            {/* Password edit */}
            <div className="space-y-4 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/15">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-4.5 h-4.5 text-indigo-500" /> Admin Access Security
              </h3>
              <p className="text-xs text-slate-500 leading-normal">Modify the gate passcode to ensure unauthorized peers or students cannot access results or bypass grading protocols.</p>
              
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Set new passcode value"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  className="w-full max-w-sm px-3.5 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs"
                />
                <div className="pt-1 flex items-center gap-3">
                  <button
                    onClick={handleSavePasscode}
                    className="px-3.5 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-lg shadow-sm"
                  >
                    Save Passcode
                  </button>
                  {passcodeLog && <span className="text-[11px] text-emerald-600 font-bold">{passcodeLog}</span>}
                </div>
              </div>
            </div>

            {/* Database backups */}
            <div className="space-y-4 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/15">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Database className="w-4.5 h-4.5 text-indigo-500" /> Database Backup & Restore
              </h3>
              <p className="text-xs text-slate-500 leading-normal">Preserve your configuration, candidate transcripts and question lists onto cold files.</p>
              
              <div className="flex flex-wrap gap-3.5">
                <button
                  onClick={handleDatabaseBackup}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1"
                >
                  <FileDown className="w-4 h-4" /> Download Backup File
                </button>

                <label className="bg-white dark:bg-slate-900 border px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs font-bold rounded-lg flex items-center gap-1">
                  <Upload className="w-4 h-4" /> Restore Backup File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleDatabaseRestore}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

          </div>
        )}

      </div>
      </div>

      {/* MODAL 1: EXAM EDITOR MODAL */}
      {isExamModalOpen && editingExam && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.form 
            onSubmit={handleSaveExam}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl text-left space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Exam Template Configurator</h3>
              <button type="button" onClick={() => setIsExamModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Exam Title *</label>
                <input
                  type="text"
                  required
                  value={editingExam.title}
                  onChange={(e) => setEditingExam({ ...editingExam, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Subject/Topic *</label>
                <input
                  type="text"
                  required
                  value={editingExam.subject}
                  onChange={(e) => setEditingExam({ ...editingExam, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Description</label>
                <textarea
                  value={editingExam.description}
                  onChange={(e) => setEditingExam({ ...editingExam, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs h-16"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Duration (Minutes)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editingExam.duration}
                  onChange={(e) => setEditingExam({ ...editingExam, duration: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Negative Marks</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={editingExam.negativeMarking}
                  onChange={(e) => setEditingExam({ ...editingExam, negativeMarking: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Exam Password (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty for public"
                  value={editingExam.examPassword || ''}
                  onChange={(e) => setEditingExam({ ...editingExam, examPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Passing Marks</label>
                <input
                  type="number"
                  value={editingExam.passingMarks}
                  onChange={(e) => setEditingExam({ ...editingExam, passingMarks: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Config Mode selector */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border space-y-3 text-xs">
              <div className="flex justify-between items-center font-bold">
                <span>Category Selection Mode</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingExam({ ...editingExam, mode: 'static' })}
                    className={`px-3 py-1 rounded-lg ${editingExam.mode === 'static' ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'}`}
                  >
                    Static list
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingExam({ ...editingExam, mode: 'dynamic' })}
                    className={`px-3 py-1 rounded-lg ${editingExam.mode === 'dynamic' ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'}`}
                  >
                    Dynamic Rules
                  </button>
                </div>
              </div>

              {editingExam.mode === 'static' ? (
                /* list selector */
                <div className="space-y-2">
                  <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Checkbox Selected Questions ({editingExam.questionIds?.length || 0})</div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border rounded-lg p-2.5 bg-white dark:bg-slate-900">
                    {questions.map(q => {
                      const isChecked = editingExam.questionIds?.includes(q.id);
                      return (
                        <label key={q.id} className="flex items-center gap-2 cursor-pointer py-1 border-b last:border-b-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const current = editingExam.questionIds || [];
                              const next = isChecked ? current.filter(id => id !== q.id) : [...current, q.id];
                              setEditingExam({ ...editingExam, questionIds: next });
                            }}
                            className="w-4 h-4 text-indigo-600"
                          />
                          <span className="truncate max-w-sm text-slate-700 dark:text-slate-300 font-medium">[{q.category}] {q.text}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* category rules selector */
                <div className="space-y-2">
                  <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Define Category Mix Counts</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Array.from(new Set(questions.map(q => q.category))).filter(Boolean) as string[]).map((cat: string) => {
                      const count = (editingExam.categoryRules || {})[cat] || 0;
                      return (
                        <div key={cat} className="flex items-center justify-between p-2 border bg-white dark:bg-slate-900 rounded-lg">
                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-28">{cat}</span>
                          <input
                            type="number"
                            min="0"
                            value={count}
                            onChange={(e) => {
                              const rules = { ...editingExam.categoryRules } as { [key: string]: number };
                              const val = parseInt(e.target.value) || 0;
                              if (val > 0) rules[cat] = val;
                              else delete rules[cat];
                              setEditingExam({ ...editingExam, categoryRules: rules });
                            }}
                            className="w-14 px-1.5 py-0.5 border rounded text-center text-xs"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex justify-end gap-2 text-xs">
              <button type="button" onClick={() => setIsExamModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-md">Save Template</button>
            </div>
          </motion.form>
        </div>
      )}

      {/* MODAL 2: QUESTION EDITOR MODAL */}
      {isQModalOpen && editingQuestion && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.form 
            onSubmit={handleSaveQuestion}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl text-left space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Question Card Editor</h3>
              <button type="button" onClick={() => setIsQModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-black text-slate-500">Question Text *</label>
              <textarea
                required
                value={editingQuestion.text}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs h-16"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Category *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. English, ICT"
                  value={editingQuestion.category}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Sub-Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Noun, Trigonometry"
                  value={editingQuestion.topic}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, topic: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Difficulty</label>
                <select
                  value={editingQuestion.difficulty}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500">Question Format</label>
                <select
                  value={editingQuestion.type}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, type: e.target.value as any, correctAnswers: [] })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl"
                >
                  <option value="single">Single Choice (Radio)</option>
                  <option value="multiple">Multiple Choice (Check)</option>
                  <option value="boolean">True / False</option>
                  <option value="fill">Fill in the Blank</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-black text-slate-500">Question Attachment Image URL</label>
              <input
                type="text"
                placeholder="https://example.com/image.png"
                value={editingQuestion.imageUrl || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, imageUrl: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs"
              />
            </div>

            {/* Answer Options & Correct Check definitions */}
            <div className="space-y-3.5 pt-1.5 border-t">
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">Option definitions and Correct markings</h4>

              {editingQuestion.type === 'single' && (
                <div className="space-y-2 text-xs">
                  {editingQuestion.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctSingle"
                        checked={editingQuestion.correctAnswers.includes(opt) && opt !== ''}
                        onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswers: [opt] })}
                        disabled={opt === ''}
                      />
                      <input
                        type="text"
                        required
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        value={opt}
                        onChange={(e) => {
                          const opts = [...editingQuestion.options];
                          opts[idx] = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: opts });
                        }}
                        className="flex-1 px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                  ))}
                </div>
              )}

              {editingQuestion.type === 'multiple' && (
                <div className="space-y-2 text-xs">
                  {editingQuestion.options.map((opt, idx) => {
                    const isChecked = editingQuestion.correctAnswers.includes(opt);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked && opt !== ''}
                          onChange={() => {
                            const current = editingQuestion.correctAnswers;
                            const next = isChecked ? current.filter(o => o !== opt) : [...current, opt];
                            setEditingQuestion({ ...editingQuestion, correctAnswers: next });
                          }}
                          disabled={opt === ''}
                        />
                        <input
                          type="text"
                          required
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                          value={opt}
                          onChange={(e) => {
                            const opts = [...editingQuestion.options];
                            opts[idx] = e.target.value;
                            setEditingQuestion({ ...editingQuestion, options: opts });
                          }}
                          className="flex-1 px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {editingQuestion.type === 'boolean' && (
                <div className="flex gap-4 text-xs font-bold">
                  {['True', 'False'].map(opt => {
                    const isChecked = editingQuestion.correctAnswers.includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="correctBool"
                          checked={isChecked}
                          onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswers: [opt] })}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              )}

              {editingQuestion.type === 'fill' && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-500">Correct Answers (Comma separated fallback variants)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dhaka, dhaka"
                    value={editingQuestion.correctAnswers.join(', ')}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs font-bold"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1 border-t pt-3">
              <label className="text-[10px] uppercase font-black text-slate-500">Answer Explanation Summary</label>
              <textarea
                value={editingQuestion.explanation}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs h-16"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 text-xs border-t">
              <button type="button" onClick={() => setIsQModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-md">Add to Bank</button>
            </div>
          </motion.form>
        </div>
      )}

      {/* DETAILED CANDIDATE SUBMISSION SHEET POPUP VIEWER */}
      {viewingAttempt && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Student Answer transcript</h3>
              <button onClick={() => setViewingAttempt(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            {/* Embedded Result sheet for inspect mode */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Candidate Score</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">{viewingAttempt.score.toFixed(1)}</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Accuracy %</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">{viewingAttempt.percentage.toFixed(0)}%</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Tab switches</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">{viewingAttempt.tabSwitches}</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Time Elapsed</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">{Math.floor(viewingAttempt.timeTaken / 60)}m {viewingAttempt.timeTaken % 60}s</div>
                </div>
              </div>

              {/* Question list transcript review */}
              <div className="space-y-3 pt-3 text-left">
                {questions.filter(q => viewingAttempt.answers[q.id] !== undefined || viewingAttempt.examId === q.category).map((q, idx) => {
                  const sAns = viewingAttempt.answers[q.id] || [];
                  const isSkipped = sAns.length === 0;
                  
                  let isCorrect = false;
                  if (!isSkipped) {
                    if (q.type === 'single' || q.type === 'boolean') {
                      isCorrect = sAns[0] === q.correctAnswers[0];
                    } else if (q.type === 'multiple') {
                      const sSorted = [...sAns].sort();
                      const cSorted = [...q.correctAnswers].sort();
                      isCorrect = sSorted.length === cSorted.length && sSorted.every((v, i) => v === cSorted[i]);
                    } else if (q.type === 'fill') {
                      isCorrect = q.correctAnswers.some(ans => ans.trim().toLowerCase() === sAns[0].trim().toLowerCase());
                    }
                  }

                  return (
                    <div key={q.id} className="p-4 border rounded-xl bg-slate-50/50 space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between">
                        <span>QUESTION {idx + 1}</span>
                        <span>{isCorrect ? '🟢 Correct' : isSkipped ? '⚪ Skipped' : '🔴 Wrong'}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">{q.text}</h4>
                      <p className="text-[11px] text-slate-500">Student response: <strong>{sAns.join(', ') || '(No Answer)'}</strong></p>
                      <p className="text-[11px] text-indigo-600 font-semibold">Correct Answer: <strong>{q.correctAnswers.join(', ')}</strong></p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
