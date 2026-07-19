import { Question, QuestionType, DifficultyType, ExamAttempt } from '../types';

// Simple, robust, quote-aware CSV Parser
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'; // Double quote inside quote means a literal double quote
        i++;
      } else {
        inQuotes = !inQuotes; // Toggle quotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(cell.trim());
      if (row.some(c => c !== '')) {
        lines.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) {
      lines.push(row);
    }
  }

  return lines;
}

export function importQuestionsFromCSV(csvText: string, defaultCategory: string): Question[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase());
  
  // Find column indices
  const qIdx = headers.findIndex(h => h.includes('question') || h === 'q');
  
  // Option indices
  const optAIdx = headers.findIndex(h => h === 'a' || h === 'option a' || h === 'option_a');
  const optBIdx = headers.findIndex(h => h === 'b' || h === 'option b' || h === 'option_b');
  const optCIdx = headers.findIndex(h => h === 'c' || h === 'option c' || h === 'option_c');
  const optDIdx = headers.findIndex(h => h === 'd' || h === 'option d' || h === 'option_d');
  
  const ansIdx = headers.findIndex(h => h.includes('answer') || h === 'correct' || h === 'correct_answer');
  const expIdx = headers.findIndex(h => h.includes('explanation') || h === 'exp');
  const topicIdx = headers.findIndex(h => h === 'topic' || h === 'subject');
  const diffIdx = headers.findIndex(h => h === 'difficulty' || h === 'level');
  const catIdx = headers.findIndex(h => h === 'category' || h === 'type_category');
  const tagsIdx = headers.findIndex(h => h === 'tags' || h === 'tag');
  const imgIdx = headers.findIndex(h => h === 'image' || h === 'image url' || h === 'image_url');

  const questions: Question[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || !row[qIdx]) continue;

    // Build options
    const options: string[] = [];
    if (optAIdx !== -1 && row[optAIdx]) options.push(row[optAIdx]);
    if (optBIdx !== -1 && row[optBIdx]) options.push(row[optBIdx]);
    if (optCIdx !== -1 && row[optCIdx]) options.push(row[optCIdx]);
    if (optDIdx !== -1 && row[optDIdx]) options.push(row[optDIdx]);

    // If options are missing, default them for boolean or fill questions
    const qText = row[qIdx];
    const rawAnswer = row[ansIdx] || '';
    
    // Determine question type
    let type: QuestionType = 'single';
    let correctAnswers: string[] = [];

    // Parse correct answers (could be comma separated for multiple choice, e.g. "A,B")
    const parsedAnswers = rawAnswer.split(/[,;|]/).map(s => s.trim().toUpperCase());
    
    if (options.length === 0) {
      if (rawAnswer.toLowerCase() === 'true' || rawAnswer.toLowerCase() === 'false') {
        type = 'boolean';
        options.push('True', 'False');
        correctAnswers = [rawAnswer.toLowerCase() === 'true' ? 'True' : 'False'];
      } else {
        type = 'fill';
        correctAnswers = [rawAnswer];
      }
    } else {
      // It's choice. Is it single or multiple?
      if (parsedAnswers.length > 1) {
        type = 'multiple';
      } else {
        type = 'single';
      }

      // Convert option labels (A, B, C, D) or direct values to correct list
      correctAnswers = parsedAnswers.map(ans => {
        if (ans === 'A' || ans === '1') return options[0] || ans;
        if (ans === 'B' || ans === '2') return options[1] || ans;
        if (ans === 'C' || ans === '3') return options[2] || ans;
        if (ans === 'D' || ans === '4') return options[3] || ans;
        return ans; // fallback is raw text
      });
    }

    // Parse difficulty
    let difficulty: DifficultyType = 'medium';
    const rawDiff = (row[diffIdx] || '').toLowerCase();
    if (rawDiff.includes('easy')) difficulty = 'easy';
    else if (rawDiff.includes('hard') || rawDiff.includes('difficult')) difficulty = 'hard';

    // Parse tags
    const tags = tagsIdx !== -1 && row[tagsIdx] 
      ? row[tagsIdx].split(/[,;|]/).map(s => s.trim()).filter(Boolean) 
      : [];

    const question: Question = {
      id: 'q_' + Math.random().toString(36).substr(2, 9),
      text: qText,
      type,
      options,
      correctAnswers,
      explanation: expIdx !== -1 ? row[expIdx] : 'No explanation provided.',
      difficulty,
      topic: topicIdx !== -1 && row[topicIdx] ? row[topicIdx] : 'General',
      category: catIdx !== -1 && row[catIdx] ? row[catIdx] : defaultCategory,
      tags,
      imageUrl: imgIdx !== -1 ? row[imgIdx] : undefined,
      
      // Initialize stats
      correctCount: 0,
      incorrectCount: 0,
      skippedCount: 0,
      totalTimeSpent: 0,
      totalAttempts: 0
    };

    questions.push(question);
  }

  return questions;
}

export function exportQuestionsToCSV(questions: Question[]): string {
  const headers = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Explanation', 'Category', 'Topic', 'Difficulty', 'Tags', 'ImageUrl'];
  
  const rows = questions.map(q => {
    // Determine Option A, B, C, D representation
    const optA = q.options[0] || '';
    const optB = q.options[1] || '';
    const optC = q.options[2] || '';
    const optD = q.options[3] || '';

    // Convert correctAnswers back to option indexes (A, B, C, D) if they match option values
    const answerLabel = q.correctAnswers.map(ans => {
      const idx = q.options.indexOf(ans);
      if (idx === 0) return 'A';
      if (idx === 1) return 'B';
      if (idx === 2) return 'C';
      if (idx === 3) return 'D';
      return ans; // fallback
    }).join(',');

    return [
      q.text,
      optA,
      optB,
      optC,
      optD,
      answerLabel,
      q.explanation,
      q.category,
      q.topic,
      q.difficulty,
      q.tags.join(','),
      q.imageUrl || ''
    ];
  });

  const allRows = [headers, ...rows];

  return allRows.map(row => 
    row.map(cell => {
      // Escape double quotes and wrap in quotes if contains comma, newline, or quotes
      const str = String(cell);
      if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');
}

export function exportAttemptsToCSV(attempts: ExamAttempt[]): string {
  const headers = ['Attempt ID', 'Candidate Name', 'Candidate ID', 'Score', 'Percentage', 'Correct', 'Wrong', 'Skipped', 'Time Taken (sec)', 'Date'];
  const rows = attempts.map(a => [
    a.id,
    a.candidateName,
    a.candidateId || '',
    a.score,
    a.percentage.toFixed(1) + '%',
    a.correctCount,
    a.incorrectCount,
    a.skippedCount,
    a.timeTaken,
    new Date(a.startedAt).toLocaleString()
  ]);

  const allRows = [headers, ...rows];

  return allRows.map(row => 
    row.map(cell => {
      const str = String(cell);
      if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');
}
