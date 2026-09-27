// Idiomas oferecidos no editor. Lista curta e fixa de propósito: o seletor do leitor mostra o
// nome humano, e um código solto digitado à mão viraria um idioma sem nome.
export const SUPPORTED_LOCALES: { code: string; label: string }[] = [
  { code: "pt-BR", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
];

export function isSupportedLocale(code: string): boolean {
  return SUPPORTED_LOCALES.some((locale) => locale.code === code);
}

export function localeLabel(code: string): string {
  return SUPPORTED_LOCALES.find((locale) => locale.code === code)?.label ?? code;
}
