// Idiomas oferecidos no editor. Lista curta e fixa de propósito: o seletor do leitor mostra o
// nome humano, e um código solto digitado à mão viraria um idioma sem nome.
export const SUPPORTED_LOCALES: { code: string; label: string; flag: string }[] = [
  { code: "pt-BR", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
];

export function isSupportedLocale(code: string): boolean {
  return SUPPORTED_LOCALES.some((locale) => locale.code === code);
}

export function localeLabel(code: string): string {
  return SUPPORTED_LOCALES.find((locale) => locale.code === code)?.label ?? code;
}
