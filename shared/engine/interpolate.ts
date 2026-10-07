import type { ProfileFieldDef } from "../../contracts/game";

// Texto que muda com a ficha do leitor (0.13.0): {nome} põe o valor do campo; {sexo|feminino:
// cansada|masculino:cansado|cansade} escolhe pelo valor (o último sem ":" é o padrão). Sem ficha
// (leitura em voz alta, obra sem criação de personagem), vale o padrão de cada campo.

const TOKEN = /\{([a-z][a-z0-9_]{0,39})(\|[^{}]*)?\}/g;

export function interpolate(
  text: string,
  fields: ProfileFieldDef[],
  profile: Record<string, string>,
  locale: string,
): string {
  if (!text.includes("{") || fields.length === 0) return text;
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return text.replace(TOKEN, (token, key: string, alternatives: string | undefined) => {
    const field = byKey.get(key);
    if (!field) return token;
    const value = profile[key] ?? field.fallback;
    if (!alternatives) {
      if (field.kind === "choice") {
        const option = field.options.find((candidate) => candidate.value === value);
        return option?.name[locale] ?? Object.values(option?.name ?? {})[0] ?? value;
      }
      return value;
    }
    let fallback = "";
    for (const part of alternatives.slice(1).split("|")) {
      const separator = part.indexOf(":");
      if (separator < 0) {
        fallback = part;
        continue;
      }
      if (part.slice(0, separator).trim() === value) return part.slice(separator + 1);
    }
    return fallback;
  });
}
