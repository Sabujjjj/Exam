export type QuestionType = 'single' | 'multiple' | 'boolean' | 'fill';
export type DifficultyType = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[]; // Options for choice questions (e.g., ["Dhaka", "Khulna", "Rajshahi", "Sylhet"])
  correctAnswers: string[]; // e.g., ["A"] or ["A", "C"] or ["True"] or ["Dhaka"]
  explanation: string;
  imageUrl?: string;
  difficulty: DifficultyType;
  topic: string;
  category: string; // "English", "Math", "Bangla", "Science", "ICT", "Current Affairs", etc.
  tags: string[];
  
  // Statistics
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  totalTimeSpent: number; // in seconds
  totalAttempts: number;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  description: string;
  duration: number; // in minutes, 0 for untimed
  totalMarks: number;
  passingMarks: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  showAnswersImmediately: boolean;
  negativeMarking: number; // weight of negative marking, e.g. 0.25
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  examPassword?: string;
  
  // Question configuration
  mode: 'static' | 'dynamic'; // static = selected question IDs, dynamic = category rules
  questionIds?: string[]; // for static exams
  categoryRules?: { [category: string]: number }; // for dynamic exams, e.g. { "English": 20, "Math": 10 }
  
  createdAt: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle: string;
  candidateName: string;
  candidateId?: string;
  startedAt: string;
  submittedAt?: string;
  timeTaken: number; // in seconds
  score: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  answers: { [questionId: string]: string[] }; // questionId -> selected options
  bookmarkedQuestions?: string[]; // List of questionIds bookmarked
  
  // Anti-cheating logs
  tabSwitches: number;
  rightClicks: number;
  copyPasteAttempts: number;
  
  isCompleted: boolean;
}

export interface QuestionStats {
  questionId: string;
  correctPct: number;
  wrongPct: number;
  skippedPct: number;
  avgTime: number;
}
