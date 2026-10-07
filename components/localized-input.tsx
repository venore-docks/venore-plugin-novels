"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { Input, Textarea } from "@venore/plugin-sdk/ui";
import type { LocalizedText } from "../contracts/types";
import { SUPPORTED_LOCALES } from "../shared/locales";

// Campo traduzível do catálogo (nome de tag, de grupo, textos dos selos): o idioma principal
// sempre à vista e as traduções num painel que abre sob demanda.
export function LocalizedInput({
  label,
  value,
  onChange,
  primaryLocale = "pt-BR",
  maxLength,
  multiline = false,
  placeholder,
  required = false,
}: {
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  primaryLocale?: string;
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  const others = SUPPORTED_LOCALES.filter((locale) => locale.code !== primaryLocale);
  const translated = others.filter((locale) => value[locale.code]?.trim()).length;
  const [open, setOpen] = useState(false);
  const Field = multiline ? Textarea : Input;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Languages className="size-3.5" aria-hidden />
          Traduções{translated > 0 ? ` (${translated})` : ""}
        </button>
      </div>
      <Field
        value={value[primaryLocale] ?? ""}
        onChange={(event) => onChange({ ...value, [primaryLocale]: event.target.value })}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        aria-label={label}
        rows={multiline ? 2 : undefined}
      />
      {open && (
        <div className="grid gap-2 rounded-md border border-border bg-muted/40 p-2 sm:grid-cols-2">
          {others.map((locale) => (
            <label key={locale.code} className="block space-y-1 text-xs text-muted-foreground">
              {locale.label}
              <Field
                value={value[locale.code] ?? ""}
                onChange={(event) => onChange({ ...value, [locale.code]: event.target.value })}
                maxLength={maxLength}
                rows={multiline ? 2 : undefined}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
