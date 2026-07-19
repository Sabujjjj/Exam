import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { Question, Exam, ExamAttempt } from './types';

const QUESTIONS_COL = 'questions';
const EXAMS_COL = 'exams';
const ATTEMPTS_COL = 'attempts';
const SETTINGS_COL = 'settings';

// Questions Service
export async function getQuestions(): Promise<Question[]> {
  try {
    const snap = await getDocs(collection(db, QUESTIONS_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
  } catch (error) {
    console.error('Error fetching questions:', error);
    return [];
  }
}

export async function saveQuestion(question: Question): Promise<void> {
  try {
    const docRef = doc(db, QUESTIONS_COL, question.id);
    await setDoc(docRef, question);
  } catch (error) {
    console.error('Error saving question:', error);
    throw error;
  }
}

export async function deleteQuestion(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, QUESTIONS_COL, id));
  } catch (error) {
    console.error('Error deleting question:', error);
    throw error;
  }
}

// Exams Service
export async function getExams(): Promise<Exam[]> {
  try {
    const snap = await getDocs(collection(db, EXAMS_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam));
  } catch (error) {
    console.error('Error fetching exams:', error);
    return [];
  }
}

export async function getExam(id: string): Promise<Exam | null> {
  try {
    const d = await getDoc(doc(db, EXAMS_COL, id));
    if (d.exists()) {
      return { id: d.id, ...d.data() } as Exam;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching exam ${id}:`, error);
    return null;
  }
}

export async function saveExam(exam: Exam): Promise<void> {
  try {
    const docRef = doc(db, EXAMS_COL, exam.id);
    await setDoc(docRef, exam);
  } catch (error) {
    console.error('Error saving exam:', error);
    throw error;
  }
}

export async function deleteExam(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, EXAMS_COL, id));
  } catch (error) {
    console.error('Error deleting exam:', error);
    throw error;
  }
}

// Exam Attempts Service
export async function createAttempt(attempt: ExamAttempt): Promise<void> {
  try {
    await setDoc(doc(db, ATTEMPTS_COL, attempt.id), attempt);
  } catch (error) {
    console.error('Error creating attempt:', error);
    throw error;
  }
}

export async function updateAttempt(id: string, updates: Partial<ExamAttempt>): Promise<void> {
  try {
    await updateDoc(doc(db, ATTEMPTS_COL, id), updates);
  } catch (error) {
    console.error('Error updating attempt:', error);
    throw error;
  }
}

export async function getAttempt(id: string): Promise<ExamAttempt | null> {
  try {
    const d = await getDoc(doc(db, ATTEMPTS_COL, id));
    if (d.exists()) {
      return { id: d.id, ...d.data() } as ExamAttempt;
    }
    return null;
  } catch (error) {
    console.error(`Error getting attempt ${id}:`, error);
    return null;
  }
}

export async function getExamAttempts(examId: string): Promise<ExamAttempt[]> {
  try {
    const q = query(collection(db, ATTEMPTS_COL), where('examId', '==', examId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt));
  } catch (error) {
    console.error(`Error getting attempts for exam ${examId}:`, error);
    return [];
  }
}

export async function getAllAttempts(): Promise<ExamAttempt[]> {
  try {
    const snap = await getDocs(collection(db, ATTEMPTS_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt));
  } catch (error) {
    console.error('Error getting all attempts:', error);
    return [];
  }
}

// Update Question Statistics after student submission
export async function updateQuestionStats(
  answers: { [qId: string]: string[] },
  questions: Question[],
  correctIds: Set<string>,
  skippedIds: Set<string>,
  timePerQuestion: { [qId: string]: number }
): Promise<void> {
  try {
    // We update stats for each question in a transaction or individually.
    // Individually is fine and simple.
    for (const q of questions) {
      const qId = q.id;
      const wasCorrect = correctIds.has(qId);
      const wasSkipped = skippedIds.has(qId);
      const wasIncorrect = !wasCorrect && !wasSkipped;
      const timeSpent = timePerQuestion[qId] || 0;

      const docRef = doc(db, QUESTIONS_COL, qId);
      
      // Let's use runTransaction to be safe and accurate
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (docSnap.exists()) {
          const currentData = docSnap.data();
          const currentCorrect = currentData.correctCount || 0;
          const currentIncorrect = currentData.incorrectCount || 0;
          const currentSkipped = currentData.skippedCount || 0;
          const currentTotalAttempts = currentData.totalAttempts || 0;
          const currentTimeSpent = currentData.totalTimeSpent || 0;

          transaction.update(docRef, {
            correctCount: currentCorrect + (wasCorrect ? 1 : 0),
            incorrectCount: currentIncorrect + (wasIncorrect ? 1 : 0),
            skippedCount: currentSkipped + (wasSkipped ? 1 : 0),
            totalAttempts: currentTotalAttempts + 1,
            totalTimeSpent: currentTimeSpent + timeSpent
          });
        }
      }).catch(err => {
        console.warn(`Could not update stats for question ${qId}:`, err);
      });
    }
  } catch (error) {
    console.error('Error in updateQuestionStats:', error);
  }
}

// App Settings (e.g. admin password passcode)
export async function getAdminPassword(): Promise<string> {
  try {
    const d = await getDoc(doc(db, SETTINGS_COL, 'admin'));
    if (d.exists()) {
      return d.data().password || 'admin123';
    }
    // Set default password on first get
    await setDoc(doc(db, SETTINGS_COL, 'admin'), { password: 'admin123' });
    return 'admin123';
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return 'admin123';
  }
}

export async function setAdminPassword(password: string): Promise<void> {
  try {
    await setDoc(doc(db, SETTINGS_COL, 'admin'), { password });
  } catch (error) {
    console.error('Error saving admin password:', error);
    throw error;
  }
}

// Backup & Restore Database
export interface DbBackup {
  questions: Question[];
  exams: Exam[];
  attempts: ExamAttempt[];
}

export async function backupDatabase(): Promise<DbBackup> {
  const [qs, ex, att] = await Promise.all([
    getQuestions(),
    getExams(),
    getAllAttempts()
  ]);
  return { questions: qs, exams: ex, attempts: att };
}

export async function restoreDatabase(backup: DbBackup): Promise<void> {
  try {
    // Save all questions
    for (const q of backup.questions) {
      await setDoc(doc(db, QUESTIONS_COL, q.id), q);
    }
    // Save all exams
    for (const e of backup.exams) {
      await setDoc(doc(db, EXAMS_COL, e.id), e);
    }
    // Save all attempts
    for (const a of backup.attempts) {
      await setDoc(doc(db, ATTEMPTS_COL, a.id), a);
    }
  } catch (error) {
    console.error('Error restoring database:', error);
    throw error;
  }
}
