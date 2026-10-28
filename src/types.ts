export type Verdict = 'Likely Fake' | 'Suspicious' | 'Looks Safe';

export interface RedFlag {
  title: string;
  reason: string;
  quote: string;
}

export interface CaseReport {
  id: string;
  caseNumber: number;
  timestamp: number;
  score: number;
  verdict: Verdict;
  summary: string;
  redFlags: RedFlag[];
  verifySteps: string[];
  extractedText: string;
  category: string;
  imagePreviewUrl?: string;
  originalInputPreview?: string;
}

export interface CaseLogItem {
  id: string;
  caseNumber: number;
  timestamp: number;
  score: number;
  verdict: Verdict;
  previewText: string;
  category: string;
  report: CaseReport;
}
