'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@hed-hog/next-app-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type LanguageSelectorProps = {
  onChange?: (code: string) => void | Promise<void>;
};

export function LanguageSelector({ onChange }: LanguageSelectorProps) {
  const { locales, currentLocaleCode, setCurrentLocaleCode } = useApp();
  const router = useRouter();

  function getCookie(name: string) {
    const match = document.cookie.match(
      new RegExp('(^| )' + name + '=([^;]+)')
    );
    return match ? match[2] : null;
  }

  function setCookie(name: string, value: string, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
  }

  useEffect(() => {
    const cookieLocale = getCookie('locale');
    setCurrentLocaleCode(cookieLocale || 'en');
  }, []);

  const handleSelect = async (code: string) => {
    const previousLocale = currentLocaleCode;

    setCurrentLocaleCode(code);
    setCookie('locale', code);

    if (typeof onChange === 'function') {
      try {
        await onChange(code);
      } catch (error) {
        setCurrentLocaleCode(previousLocale);
        setCookie('locale', previousLocale);
        return;
      }
    }

    router.refresh();
  };

  const currentLanguage = locales.find((l) => l.code === currentLocaleCode);

  if (locales.length <= 1) {
    return <></>;
  }

  return (
    <Select value={currentLocaleCode} onValueChange={handleSelect}>
      <SelectTrigger className="min-w-[180px] bg-background">
        <SelectValue placeholder={currentLanguage?.name || 'English'} />
      </SelectTrigger>
      <SelectContent>
        {locales.map((lang) => (
          <SelectItem
            key={lang.code}
            value={lang.code}
            disabled={currentLocaleCode === lang.code}
          >
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
