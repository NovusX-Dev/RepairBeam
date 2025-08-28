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
  isChangingLanguage: boolean;
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
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  
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

  // Hide overlay when translations are loaded with a delay
  useEffect(() => {
    if (isChangingLanguage && !isLoading && localizations.length > 0) {
      const timer = setTimeout(() => {
        setIsChangingLanguage(false);
      }, 1000); // 1 second delay before hiding overlay
      
      return () => clearTimeout(timer);
    }
  }, [isChangingLanguage, isLoading, localizations.length]);

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
    // Don't show overlay if it's the same language
    if (currentLanguage.code === language.code) return;
    
    // Show overlay
    setIsChangingLanguage(true);
    
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
    isChangingLanguage,
  };

  return (
    <LocalizationContext.Provider value={value}>
      {children}
      {/* Language Change Overlay */}
      {isChangingLanguage && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-300"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div className="flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500">
            {/* Logo */}
            <div className="text-6xl font-bold text-cyan-400 animate-pulse">
              ⚡
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              Repair Beam
            </div>
            
            {/* Loading message */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-lg text-white/90">
                {currentLanguage.code === 'pt-BR' ? 'Alterando idioma para' : 'Changing language to'} <strong className="text-cyan-400">{currentLanguage.name}</strong>
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
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