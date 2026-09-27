"use client";

import { Button } from "@venore/plugin-sdk/ui";
import { localeLabel } from "../shared/locales";

export function LocaleTabs({
  locales,
  active,
  defaultLocale,
  onChange,
}: {
  locales: string[];
  active: string;
  defaultLocale: string;
  onChange: (locale: string) => void;
}) {
  if (locales.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Idioma do texto">
      {locales.map((locale) => (
        <Button
          key={locale}
          type="button"
          role="tab"
          aria-selected={locale === active}
          size="sm"
          variant={locale === active ? "secondary" : "ghost"}
          onClick={() => onChange(locale)}
        >
          {localeLabel(locale)}
          {locale === defaultLocale ? " *" : ""}
        </Button>
      ))}
    </div>
  );
}
