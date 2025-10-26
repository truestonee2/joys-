export interface CutInfo {
  id: string;
  duration: number;
  description: string;
}

export type AiModel = 'gemini-2.5-pro' | 'gemini-2.5-flash';

export type Language = 'en' | 'ko';

export interface HistoryItem {
  id: string;
  timestamp: number;
  projectTitle: string;
  mainTheme: string;
  totalDuration: number;
  cutDuration: number;
  model: AiModel;
  language: Language;
  generatedJson: string;
}
