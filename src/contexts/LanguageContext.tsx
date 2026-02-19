import { createContext, useContext, useCallback, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { translations, type Language, SUPPORTED_LANGUAGES, LANG_CODES } from '@/lib/translations';

interface LanguageContextType {
  lang: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  localePath: (path: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
  localePath: (path: string) => path,
});

const LANG_REGEX = /^\/(es|hi)(\/|$)/;

export function detectLangFromPath(pathname: string): Language {
  const match = pathname.match(LANG_REGEX);
  return match ? (match[1] as Language) : 'en';
}

export function stripLangPrefix(pathname: string): string {
  const stripped = pathname.replace(LANG_REGEX, '/');
  return stripped || '/';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const urlLang = detectLangFromPath(location.pathname);
  const storedLang = typeof window !== 'undefined'
    ? localStorage.getItem('preferred_language') as Language | null
    : null;

  // If URL has a language prefix, that takes priority. Otherwise fall back to stored preference.
  const lang: Language = urlLang !== 'en' ? urlLang : (storedLang && LANG_CODES.includes(storedLang as any) ? storedLang : 'en');

  // Enforce language prefix on every route change.
  // If user has a non-English preference but the URL lacks the prefix, redirect.
  useEffect(() => {
    if (lang !== 'en' && urlLang === 'en') {
      const path = location.pathname === '/' ? '' : location.pathname;
      navigate(`/${lang}${path}${location.search}${location.hash}`, { replace: true });
    }
  }, [location.pathname, lang, urlLang, navigate, location.search, location.hash]);

  const setLanguage = useCallback((newLang: Language) => {
    if (newLang === 'en') {
      localStorage.removeItem('preferred_language');
    } else {
      localStorage.setItem('preferred_language', newLang);
    }
    const strippedPath = stripLangPrefix(location.pathname);
    const suffix = location.search + location.hash;

    let newPath: string;
    if (newLang === 'en') {
      newPath = strippedPath;
    } else {
      newPath = strippedPath === '/'
        ? `/${newLang}`
        : `/${newLang}${strippedPath}`;
    }

    navigate(newPath + suffix, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  const t = useCallback((key: string): string => {
    return translations[lang]?.[key] || translations.en[key] || key;
  }, [lang]);

  const localePath = useCallback((path: string): string => {
    if (lang === 'en') return path;
    if (path === '/') return `/${lang}`;
    return `/${lang}${path}`;
  }, [lang]);

  const value = useMemo(() => ({
    lang, setLanguage, t, localePath,
  }), [lang, setLanguage, t, localePath]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
export { SUPPORTED_LANGUAGES };
export type { Language };
