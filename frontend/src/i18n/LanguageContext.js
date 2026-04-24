import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import translations from './translations';
import UI_DICT from './uiDictionary';
import axios from 'axios';

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' }
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USDT', symbol: '₮', name: 'Tether USDT' }
];

const STORAGE_LANG_KEY = 'pci_language';
const STORAGE_CURR_KEY = 'pci_currency';
const LEGACY_LANG_KEYS = ['altyn_language'];
const LEGACY_CURR_KEYS = ['altyn_currency'];

const SUPPORTED_LANGS = LANGUAGES.map((l) => l.code);
const SUPPORTED_CURRS = CURRENCIES.map((c) => c.code);

function detectInitialLanguage() {
  try {
    // 1. Saved (new key) — user's explicit choice always wins
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;

    // 2. Legacy keys (migrate from previous versions / drop kz)
    for (const k of LEGACY_LANG_KEYS) {
      const legacy = localStorage.getItem(k);
      if (legacy && SUPPORTED_LANGS.includes(legacy)) {
        localStorage.setItem(STORAGE_LANG_KEY, legacy);
        return legacy;
      }
    }
  } catch (_) {
    // ignore
  }
  // 3. Default — Turkish always (regardless of browser language, IP or geo)
  return 'tr';
}

function detectInitialCurrency() {
  try {
    const saved = localStorage.getItem(STORAGE_CURR_KEY);
    if (saved && SUPPORTED_CURRS.includes(saved)) return saved;

    for (const k of LEGACY_CURR_KEYS) {
      const legacy = localStorage.getItem(k);
      if (legacy && SUPPORTED_CURRS.includes(legacy)) {
        localStorage.setItem(STORAGE_CURR_KEY, legacy);
        return legacy;
      }
    }
  } catch (_) {
    // ignore
  }
  return 'USD';
}

function localeFor(lang) {
  switch (lang) {
    case 'tr': return 'tr-TR';
    case 'ru': return 'ru-RU';
    default: return 'en-US';
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage);
  const [currency, setCurrencyState] = useState(detectInitialCurrency);

  // Exchange rates cache (USD base)
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, EUR: 0.92, TRY: 33.5, USDT: 1 });
  const ratesFetchedRef = useRef(false);

  // Persist to localStorage + sync with backend profile if user authenticated
  const persistToBackend = useCallback(async (fields) => {
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL || '';
      const token =
        localStorage.getItem('session_token') ||
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('session_token');
      if (!token) return;
      await axios.put(`${apiUrl}/api/user/settings`, fields, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      // silent — user may not be authenticated
    }
  }, []);

  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    setLanguageState(lang);
    try { localStorage.setItem(STORAGE_LANG_KEY, lang); } catch (_) { /* ignore */ }
    try { document.documentElement.lang = lang; } catch (_) { /* ignore */ }
    persistToBackend({ preferred_language: lang });
  }, [persistToBackend]);

  const setCurrency = useCallback((curr) => {
    if (!SUPPORTED_CURRS.includes(curr)) return;
    setCurrencyState(curr);
    try { localStorage.setItem(STORAGE_CURR_KEY, curr); } catch (_) { /* ignore */ }
    persistToBackend({ preferred_currency: curr });
  }, [persistToBackend]);

  useEffect(() => {
    try { document.documentElement.lang = language; } catch (_) { /* ignore */ }
  }, [language]);

  // Fetch exchange rates on mount
  useEffect(() => {
    if (!ratesFetchedRef.current) {
      ratesFetchedRef.current = true;
      const apiUrl = process.env.REACT_APP_BACKEND_URL || '';
      axios.get(`${apiUrl}/api/exchange-rates`)
        .then(res => {
          if (res.data?.rates) {
            setExchangeRates((prev) => ({ ...prev, ...res.data.rates }));
          }
        })
        .catch(() => { /* fallback to defaults */ });
    }
  }, []);

  const t = useCallback((key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  }, [language]);

  // `gt` (general-translate) — dictionary-based runtime translation of hardcoded
  // Russian UI strings. Looks up the original Russian text in UI_DICT and returns
  // the corresponding translation for the active language. Falls back to the
  // original Russian string when the language is `ru` or when no entry exists.
  const gt = useCallback((ruText) => {
    if (typeof ruText !== 'string') return ruText;
    if (language === 'ru') return ruText;
    const entry = UI_DICT[ruText];
    if (!entry) return ruText;
    return entry[language] || entry.en || ruText;
  }, [language]);

  const convertCurrency = useCallback((amount, fromCurrency, toCurrency = currency) => {
    if (fromCurrency === toCurrency) return amount;
    const usdAmount = fromCurrency === 'USD' ? amount : amount / (exchangeRates[fromCurrency] || 1);
    const converted = toCurrency === 'USD' ? usdAmount : usdAmount * (exchangeRates[toCurrency] || 1);
    return converted;
  }, [currency, exchangeRates]);

  const formatCurrency = useCallback((amount, currencyCode = currency, convertFrom = null) => {
    let displayAmount = amount;
    let displayCurrency = currencyCode;

    if (convertFrom && convertFrom !== currency) {
      displayAmount = convertCurrency(amount, convertFrom, currency);
      displayCurrency = currency;
    }

    const curr = CURRENCIES.find(c => c.code === displayCurrency) || CURRENCIES[0];
    const formatted = new Intl.NumberFormat(localeFor(language), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(displayAmount);
    return `${curr.symbol}${formatted}`;
  }, [language, currency, convertCurrency]);

  const formatUsdWithEquivalent = useCallback((amount) => {
    const usdFormatted = new Intl.NumberFormat(localeFor(language), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);

    if (currency === 'USD' || currency === 'USDT') {
      return `$${usdFormatted}`;
    }

    const converted = convertCurrency(amount, 'USD', currency);
    const curr = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    const convertedFormatted = new Intl.NumberFormat(localeFor(language), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(converted);

    return `$${usdFormatted} (~${curr.symbol}${convertedFormatted})`;
  }, [language, currency, convertCurrency]);

  const formatDate = useCallback((date) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat(localeFor(language), {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  }, [language]);

  const formatDateTime = useCallback((date) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat(localeFor(language), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }, [language]);

  const getLocalizedText = useCallback((textObj) => {
    if (!textObj) return '';
    if (typeof textObj === 'string') return textObj;
    return textObj[language] || textObj['en'] || textObj['ru'] || textObj['tr'] || Object.values(textObj)[0] || '';
  }, [language]);

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      currency,
      setCurrency,
      t,
      gt,
      formatCurrency,
      formatUsdWithEquivalent,
      convertCurrency,
      formatDate,
      formatDateTime,
      getLocalizedText,
      exchangeRates,
      LANGUAGES,
      CURRENCIES
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
