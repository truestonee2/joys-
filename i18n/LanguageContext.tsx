
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { translations } from './translations';
import { Language } from '../types';

type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, placeholders?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ko'); // Default to Korean

  const t = (key: TranslationKey, placeholders: Record<string, string | number> = {}): string => {
    let translation = translations[language]?.[key] || translations['en'][key];
    
    Object.entries(placeholders).forEach(([placeholder, value]) => {
      translation = translation.replace(`{${placeholder}}`, String(value));
    });

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
