import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  Clock, 
  TrendingUp, 
  Award, 
  FileText, 
  ArrowLeft, 
  Printer, 
  BookOpen, 
  Search, 
  Eye,
  Bookmark,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Exam, Question, ExamAttempt } from '../types';
import { getExamAttempts } from '../firebaseService';

interface ResultSheetProps {
  attempt: ExamAttempt;
  exam: Exam;
  questions: Question[];
  onExit: () => void;
}

export const ResultSheet: React.FC<ResultSheetProps> = ({
  attempt,
  exam,
  questions,
  onExit
}) => {
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'unanswered'>('all');
  const [leaderboard, setLeaderboard] = useState<ExamAttempt[]>([]);
  const [studentRank, setStudentRank] = useState<number | null>(null);

  useEffect(() => {
    // Load and calculate rank
    async function loadLeaderboard() {
      const allAttempts = await getExamAttempts(attempt.examId);
      // Sort attempts by score descending, then by timeTaken ascending
      const sorted = [...allAttempts].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeTaken - b.timeTaken;
      });
      setLeaderboard(sorted);

      // Find current attempt index
      const rankIdx = sorted.findIndex(a => a.id === attempt.id);
      if (rankIdx !== -1) {
        setStudentRank(rankIdx + 1);
      }
    }
    loadLeaderboard();
  }, [attempt.examId, attempt.id]);

  const getFilteredQuestions = () => {
    return questions.filter(q => {
      const studentAnswers = attempt.answers[q.id] || [];
      const isSkipped = studentAnswers.length === 0;
      
      let isCorrect = false;
      if (!isSkipped) {
        if (q.type === 'single' || q.type === 'boolean') {
          isCorrect = studentAnswers[0] === q.correctAnswers[0];
        } else if (q.type === 'multiple') {
          const sortedStudent = [...studentAnswers].sort();
          const sortedCorrect = [...q.correctAnswers].sort();
          isCorrect = sortedStudent.length === sortedCorrect.length && sortedStudent.every((val, idx) => val === sortedCorrect[idx]);
        } else if (q.type === 'fill') {
          isCorrect = q.correctAnswers.some(ans => ans.trim().toLowerCase() === studentAnswers[0].trim().toLowerCase());
        }
      }

      if (filter === 'correct') return isCorrect;
      if (filter === 'wrong') return !isCorrect && !isSkipped;
      if (filter === 'unanswered') return isSkipped;
      return true;
    });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredQs = getFilteredQuestions();

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 px-3">
      
      {/* Header and Back Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="text-left">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white mb-2 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Lobby
          </button>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Performance Summary
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Exam Paper: <strong className="text-slate-800 dark:text-slate-200">{exam.title}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print Results
          </button>
        </div>
      </div>

      {/* Main Scorecards Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Score Ring / Text */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Your Score</span>
          <div className="my-2.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{attempt.score.toFixed(1)}</span>
            <span className="text-sm text-slate-400 font-bold"> / {questions.length}</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            Passing: {exam.passingMarks} Marks
          </span>
        </div>

        {/* Percentage Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Accuracy %</span>
          <div className="my-2.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{attempt.percentage.toFixed(1)}%</span>
          </div>
          <span className={`text-[10px] font-black uppercase ${attempt.score >= exam.passingMarks ? 'text-emerald-600' : 'text-rose-600'}`}>
            {attempt.score >= exam.passingMarks ? '🏆 Passed' : '⚠️ Failed'}
          </span>
        </div>

        {/* Time taken */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Time Taken</span>
          <div className="my-2.5">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatTime(attempt.timeTaken)}</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            Limit: {exam.duration > 0 ? `${exam.duration} mins` : 'Untimed'}
          </span>
        </div>

        {/* Dynamic Rank Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Global Rank</span>
          <div className="my-2.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {studentRank ? `#${studentRank}` : '-'}
            </span>
            <span className="text-sm text-slate-400 font-bold"> / {leaderboard.length}</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            Based on completed attempts
          </span>
        </div>

      </div>

      {/* Answer Split Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-left">
        <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3">Breakdown of Answers</h3>
        <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          <div 
            style={{ width: `${(attempt.correctCount / questions.length) * 100}%` }}
            className="h-full bg-emerald-500" 
            title="Correct Answers"
          />
          <div 
            style={{ width: `${(attempt.incorrectCount / questions.length) * 100}%` }}
            className="h-full bg-rose-500" 
            title="Wrong Answers"
          />
          <div 
            style={{ width: `${(attempt.skippedCount / questions.length) * 100}%` }}
            className="h-full bg-amber-400" 
            title="Skipped/Unanswered"
          />
        </div>
        <div className="flex justify-between items-center mt-3 text-[11px] font-bold text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" /> {attempt.correctCount} Correct</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block" /> {attempt.incorrectCount} Incorrect</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block" /> {attempt.skippedCount} Skipped</span>
        </div>
      </div>

      {/* Proctoring Warning details if cheating flag was triggered */}
      {(attempt.tabSwitches > 0 || attempt.copyPasteAttempts > 0) && (
        <div className="p-4 border border-rose-100 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/10 rounded-2xl text-left text-rose-700 dark:text-rose-400 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-bold">Proctoring Flag Logs Detected</div>
            <p className="text-[10px] opacity-90 leading-relaxed">
              Our live monitoring flagged {attempt.tabSwitches} tab state changes, {attempt.copyPasteAttempts} keyboard shortcuts / copy paste violations, and {attempt.rightClicks || 0} right click operations during the course of the exam.
            </p>
          </div>
        </div>
      )}

      {/* Leaderboard Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 text-left">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <Award className="w-5 h-5 text-indigo-500" /> Leaderboard (Top Performances)
        </h3>

        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {leaderboard.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-4">No other attempts yet.</div>
          ) : (
            leaderboard.slice(0, 10).map((cand, idx) => {
              const isCurrent = cand.id === attempt.id;
              return (
                <div 
                  key={cand.id} 
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                    isCurrent 
                      ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-500 font-extrabold text-indigo-950 dark:text-white' 
                      : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' :
                      idx === 1 ? 'bg-slate-200 text-slate-700' :
                      idx === 2 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-40">{cand.candidateName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>{cand.score.toFixed(1)} / {questions.length} Marks</span>
                    <span className="text-[10px] text-slate-400">{formatTime(cand.timeTaken)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Answer Sheet with Filter Buttons */}
      <div className="space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" /> Answer sheet review
          </h3>

          {/* Filter options */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {(['all', 'correct', 'wrong', 'unanswered'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all shrink-0 uppercase tracking-wider ${
                  filter === f
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {f} ({
                  f === 'all' ? questions.length :
                  f === 'correct' ? attempt.correctCount :
                  f === 'wrong' ? attempt.incorrectCount :
                  attempt.skippedCount
                })
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Question Reviews */}
        <div className="space-y-5">
          {filteredQs.length === 0 ? (
            <div className="text-center py-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
              <CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No questions fit this filter criteria.</p>
            </div>
          ) : (
            filteredQs.map((q, idx) => {
              const studentAnswers = attempt.answers[q.id] || [];
              const isSkipped = studentAnswers.length === 0;

              // Correct calculation
              let isCorrect = false;
              if (!isSkipped) {
                if (q.type === 'single' || q.type === 'boolean') {
                  isCorrect = studentAnswers[0] === q.correctAnswers[0];
                } else if (q.type === 'multiple') {
                  const sortedStudent = [...studentAnswers].sort();
                  const sortedCorrect = [...q.correctAnswers].sort();
                  isCorrect = sortedStudent.length === sortedCorrect.length && sortedStudent.every((val, idx) => val === sortedCorrect[idx]);
                } else if (q.type === 'fill') {
                  isCorrect = q.correctAnswers.some(ans => ans.trim().toLowerCase() === studentAnswers[0].trim().toLowerCase());
                }
              }

              return (
                <div 
                  key={q.id}
                  className={`p-5 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm space-y-4 ${
                    isCorrect ? 'border-l-4 border-l-emerald-500' :
                    isSkipped ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-rose-500'
                  }`}
                >
                  {/* Title Bar */}
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span className="uppercase tracking-wider">Question {idx + 1} ({q.category})</span>
                    <div className="flex items-center gap-1.5">
                      {isCorrect ? (
                        <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full text-[10px]">
                          <CheckCircle className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : isSkipped ? (
                        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full text-[10px]">
                          <HelpCircle className="w-3.5 h-3.5" /> Unanswered
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full text-[10px]">
                          <XCircle className="w-3.5 h-3.5" /> Wrong
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Text */}
                  <h4 className="font-bold text-slate-900 dark:text-white leading-relaxed">{q.text}</h4>

                  {/* Question image */}
                  {q.imageUrl && (
                    <div className="max-h-60 overflow-hidden flex justify-start">
                      <img src={q.imageUrl} alt="Exam attachment" referrerPolicy="no-referrer" className="max-h-52 object-contain border rounded-xl p-1" />
                    </div>
                  )}

                  {/* Options review */}
                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt, oIdx) => {
                        const isChosen = studentAnswers.includes(opt);
                        const isAnswerRight = q.correctAnswers.includes(opt);

                        let optStyle = 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950';
                        if (isAnswerRight) {
                          optStyle = 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-800 dark:text-emerald-400 font-bold';
                        } else if (isChosen) {
                          optStyle = 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-800 dark:text-rose-400 font-bold';
                        }

                        return (
                          <div key={oIdx} className={`p-3 border rounded-xl text-xs flex items-center justify-between ${optStyle}`}>
                            <span>{opt}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {isAnswerRight && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                              {isChosen && !isAnswerRight && <span className="text-rose-600 font-black">✕</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Fill review value */}
                  {q.type === 'fill' && (
                    <div className="space-y-1 text-xs">
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl">
                        Your answer: <strong className={isCorrect ? 'text-emerald-600' : 'text-rose-600'}>{studentAnswers[0] || '(Skipped)'}</strong>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                        Correct Option(s): {q.correctAnswers.join(' or ')}
                      </div>
                    </div>
                  )}

                  {/* Explanations summary */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-xs space-y-2 text-slate-600 dark:text-slate-400 leading-normal border border-slate-100 dark:border-slate-800">
                    <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-indigo-500" /> Explanation Details
                    </div>
                    <p className="opacity-95 leading-relaxed">{q.explanation || 'No description or explanation provided for this solution.'}</p>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};
