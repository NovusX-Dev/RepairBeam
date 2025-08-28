import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

// Available languages with their country codes and names
export const LANGUAGES = [
  { code: 'en', countryCode: 'US', name: 'English' },
  { code: 'es', countryCode: 'ES', name: 'Español' },
  { code: 'fr', countryCode: 'FR', name: 'Français' },
  { code: 'de', countryCode: 'DE', name: 'Deutsch' },
  { code: 'it', countryCode: 'IT', name: 'Italiano' },
  { code: 'pt', countryCode: 'PT', name: 'Português' },
];

interface LocalizationContextType {
  currentLanguage: typeof LANGUAGES[0];
  setCurrentLanguage: (language: typeof LANGUAGES[0]) => void;
  translations: Record<string, string>;
  t: (key: string, fallback?: string) => string;
  isLoading: boolean;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

interface LocalizationProviderProps {
  children: ReactNode;
}

export function LocalizationProvider({ children }: LocalizationProviderProps) {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // Try to get saved language from localStorage, default to English
    const saved = localStorage.getItem('repairbeam-language');
    if (saved) {
      const found = LANGUAGES.find(lang => lang.code === saved);
      if (found) return found;
    }
    return LANGUAGES[0]; // Default to English
  });

  // Fetch translations for current language
  const { data: localizations = [], isLoading } = useQuery({
    queryKey: ['/api/localizations', currentLanguage.code],
    queryFn: async () => {
      const response = await fetch(`/api/localizations?language=${currentLanguage.code}`);
      if (!response.ok) throw new Error('Failed to fetch localizations');
      return response.json();
    },
  });

  // Convert localizations array to a key-value object for easy lookup
  const translations = localizations.reduce((acc: Record<string, string>, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  // Translation function
  const t = (key: string, fallback?: string): string => {
    return translations[key] || fallback || key;
  };

  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('repairbeam-language', currentLanguage.code);
  }, [currentLanguage]);

  const value = {
    currentLanguage,
    setCurrentLanguage,
    translations,
    t,
    isLoading,
  };

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}