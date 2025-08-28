import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Available languages with their country codes and names
export const LANGUAGES = [
  { code: 'en', countryCode: 'US', name: 'English' },
  { code: 'pt-BR', countryCode: 'BR', name: 'Português (Brasil)' },
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

// Helper function to detect browser language
function detectBrowserLanguage(): typeof LANGUAGES[0] {
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  
  // Check if we support the exact browser language
  let found = LANGUAGES.find(lang => lang.code === browserLang);
  if (found) return found;
  
  // Check if we support the language part (e.g., 'pt' from 'pt-BR')
  const langCode = browserLang.split('-')[0];
  found = LANGUAGES.find(lang => lang.code.startsWith(langCode));
  if (found) return found;
  
  // Default to English if no match
  return LANGUAGES[0];
}

export function LocalizationProvider({ children }: LocalizationProviderProps) {
  const queryClient = useQueryClient();
  const [initialized, setInitialized] = useState(false);
  
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // Try to get saved language from localStorage, then browser detection, default to English
    const saved = localStorage.getItem('repairbeam-language');
    if (saved) {
      const found = LANGUAGES.find(lang => lang.code === saved);
      if (found) return found;
    }
    return detectBrowserLanguage();
  });

  // Fetch user data to check authentication
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Fetch tenant data to get preferred language
  const { data: tenant } = useQuery({
    queryKey: ['/api/tenants/current'],
    enabled: !!user,
    retry: false,
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

  // Mutation to update tenant language preference
  const updateTenantLanguage = useMutation({
    mutationFn: async (language: string) => {
      const response = await fetch('/api/tenants/language', {
        method: 'PUT',
        body: JSON.stringify({ language }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to update language');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants/current'] });
    },
  });

  // Initialize language from tenant preference or browser detection
  useEffect(() => {
    if (tenant && !initialized) {
      const preferredLang = (tenant as any).preferredLanguage;
      if (preferredLang) {
        const found = LANGUAGES.find(lang => lang.code === preferredLang);
        if (found && found.code !== currentLanguage.code) {
          setCurrentLanguage(found);
        }
      }
      setInitialized(true);
    } else if (!user && !initialized) {
      // For non-authenticated users, use browser detection
      const browserLang = detectBrowserLanguage();
      if (browserLang.code !== currentLanguage.code) {
        setCurrentLanguage(browserLang);
      }
      setInitialized(true);
    }
  }, [tenant, user, initialized, currentLanguage.code]);

  // Convert localizations array to a key-value object for easy lookup
  const translations = localizations.reduce((acc: Record<string, string>, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  // Translation function
  const t = (key: string, fallback?: string): string => {
    return translations[key] || fallback || key;
  };

  // Enhanced setCurrentLanguage that saves to tenant if authenticated
  const setLanguage = async (language: typeof LANGUAGES[0]) => {
    setCurrentLanguage(language);
    localStorage.setItem('repairbeam-language', language.code);
    
    // If user is authenticated, also save to tenant preferences
    if (user && tenant) {
      try {
        await updateTenantLanguage.mutateAsync(language.code);
      } catch (error) {
        console.error('Failed to update tenant language:', error);
      }
    }
  };

  const value = {
    currentLanguage,
    setCurrentLanguage: setLanguage,
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