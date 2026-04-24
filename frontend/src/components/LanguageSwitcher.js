import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';

/**
 * Language switcher dropdown.
 * Shows current language code (e.g. "TR") and opens a list of supported languages.
 * Use `compact` for mobile headers.
 */
export function LanguageSwitcher({ compact = false, align = 'end' }) {
  const { language, setLanguage, LANGUAGES } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`flex items-center gap-1.5 ${compact ? 'px-2' : 'px-3'} font-medium`}
          data-testid="language-switcher-trigger"
          aria-label="Change language"
        >
          <Globe className="w-4 h-4 opacity-70" />
          <span className="uppercase text-xs tracking-wider">{current.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="cursor-pointer flex items-center justify-between"
            data-testid={`language-option-${lang.code}`}
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{lang.flag}</span>
              <span className="text-sm">{lang.name}</span>
            </span>
            {language === lang.code && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;
