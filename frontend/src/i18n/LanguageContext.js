import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import translations from './translations';
import axios from 'axios';

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'kz', name: 'Қазақша', flag: '🇰🇿' },
  { code: 'en', name: 'English', flag: '🇬🇧' }
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstan Tenge' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USDT', symbol: '₮', name: 'Tether USDT' }
];

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('altyn_language');
    return saved || 'ru';
  });
  
  const [currency, setCurrency] = useState(() => {
    const saved = localStorage.getItem('altyn_currency');
    return saved || 'USD';
  });
  
  // Exchange rates cache
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, EUR: 0.92, KZT: 450, USDT: 1 });
  const ratesFetchedRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('altyn_language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('altyn_currency', currency);
  }, [currency]);
  
  // Fetch exchange rates on mount
  useEffect(() => {
    if (!ratesFetchedRef.current) {
      ratesFetchedRef.current = true;
      const apiUrl = process.env.REACT_APP_BACKEND_URL || '';
      axios.get(`${apiUrl}/api/exchange-rates`)
        .then(res => {
          if (res.data?.rates) {
            setExchangeRates(res.data.rates);
          }
        })
        .catch(err => console.log('Exchange rates fetch failed, using defaults'));
    }
  }, []);

  const t = useCallback((key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  }, [language]);
  
  // Convert amount from one currency to another
  const convertCurrency = useCallback((amount, fromCurrency, toCurrency = currency) => {
    if (fromCurrency === toCurrency) return amount;
    
    // Convert to USD first, then to target currency
    const usdAmount = fromCurrency === 'USD' ? amount : amount / (exchangeRates[fromCurrency] || 1);
    const converted = toCurrency === 'USD' ? usdAmount : usdAmount * (exchangeRates[toCurrency] || 1);
    
    return converted;
  }, [currency, exchangeRates]);

  const formatCurrency = useCallback((amount, currencyCode = currency, convertFrom = null) => {
    // If convertFrom is specified, convert the amount first
    let displayAmount = amount;
    let displayCurrency = currencyCode;
    
    if (convertFrom && convertFrom !== currency) {
      displayAmount = convertCurrency(amount, convertFrom, currency);
      displayCurrency = currency;
    }
    
    const curr = CURRENCIES.find(c => c.code === displayCurrency) || CURRENCIES[0];
    const formatted = new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : language === 'kz' ? 'kk-KZ' : 'en-US', {
      minimumFractionDigits: displayCurrency === 'KZT' ? 0 : 2,
      maximumFractionDigits: displayCurrency === 'KZT' ? 0 : 2
    }).format(displayAmount);
    return `${curr.symbol}${formatted}`;
  }, [language, currency, convertCurrency]);
  
  // Format USD amount with equivalent in user's preferred currency (if different)
  const formatUsdWithEquivalent = useCallback((amount) => {
    const usdFormatted = new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : language === 'kz' ? 'kk-KZ' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    
    // If user's currency is USD, just return USD amount
    if (currency === 'USD' || currency === 'USDT') {
      return `$${usdFormatted}`;
    }
    
    // Convert to user's currency and show equivalent
    const converted = convertCurrency(amount, 'USD', currency);
    const curr = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    const convertedFormatted = new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : language === 'kz' ? 'kk-KZ' : 'en-US', {
      minimumFractionDigits: currency === 'KZT' ? 0 : 2,
      maximumFractionDigits: currency === 'KZT' ? 0 : 2
    }).format(converted);
    
    return `$${usdFormatted} (~${curr.symbol}${convertedFormatted})`;
  }, [language, currency, convertCurrency]);

  const formatDate = useCallback((date) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : language === 'kz' ? 'kk-KZ' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  }, [language]);

  const formatDateTime = useCallback((date) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : language === 'kz' ? 'kk-KZ' : 'en-US', {
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
    return textObj[language] || textObj['en'] || textObj['ru'] || Object.values(textObj)[0] || '';
  }, [language]);

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      currency,
      setCurrency,
      t,
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
