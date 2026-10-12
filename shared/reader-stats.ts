import type { LocalizedText } from "../contracts/types";

// Desempenho do leitor com conta numa obra (0.14.0): quantas jornadas concluiu e quanto da
// história já viu somando todas elas. As conquistas do leitor saem daqui (calculadas, não
// gravadas), mais as conquistas que o autor definiu no sistema da obra.

export type ReaderStats = {
  completions: number;
  lastCompletedSeed: string | null;
  scenesSeen: string[];
  choicesSeen: string[];
  endingsSeen: string[];
  achievements: string[];
};

export const EMPTY_READER_STATS: ReaderStats = { completions: 0, lastCompletedSeed: null, scenesSeen: [], choicesSeen: [], endingsSeen: [], achievements: [] };

const MAX_IDS = 5000;
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])].slice(0, MAX_IDS);

// Junta o que a jornada atual mostrou. Chegar a um final conta uma jornada concluída, uma vez
// por jornada (semente).
export function mergeStats(
  current: ReaderStats,
  journey: { seed: string; scenes: string[]; choices: string[]; endings: string[]; achievements: string[]; finished: boolean },
): ReaderStats {
  const newCompletion = journey.finished && current.lastCompletedSeed !== journey.seed;
  return {
    completions: current.completions + (newCompletion ? 1 : 0),
    lastCompletedSeed: newCompletion ? journey.seed : current.lastCompletedSeed,
    scenesSeen: union(current.scenesSeen, journey.scenes),
    choicesSeen: union(current.choicesSeen, journey.choices),
    endingsSeen: union(current.endingsSeen, journey.endings),
    achievements: union(current.achievements, journey.achievements),
  };
}

export type StoryTotals = { sceneIds: string[]; choiceIds: string[]; endingIds: string[] };

// Quanto da história o leitor já viu: cenas e escolhas que existem hoje na obra.
export function exploredPercent(stats: ReaderStats, totals: StoryTotals): number {
  const total = totals.sceneIds.length + totals.choiceIds.length;
  if (total === 0) return 0;
  const scenes = new Set(stats.scenesSeen);
  const choices = new Set(stats.choicesSeen);
  const seen = totals.sceneIds.filter((id) => scenes.has(id)).length + totals.choiceIds.filter((id) => choices.has(id)).length;
  return Math.min(100, Math.floor((seen / total) * 100));
}

export type ReaderAchievement = { id: string; name: LocalizedText; description: LocalizedText; unlocked: boolean };

const t = (pt: string, en: string): LocalizedText => ({ "pt-BR": pt, en });

export function readerAchievements(stats: ReaderStats, totals: StoryTotals): ReaderAchievement[] {
  const explored = exploredPercent(stats, totals);
  const endings = new Set(stats.endingsSeen);
  const allEndings = totals.endingIds.length > 0 && totals.endingIds.every((id) => endings.has(id));
  return [
    { id: "primeira_jornada", name: t("Primeira jornada", "First journey"), description: t("Chegou a um final.", "Reached an ending."), unlocked: stats.completions >= 1 },
    { id: "veterano", name: t("Veterano", "Veteran"), description: t("Terminou a história 3 vezes.", "Finished the story 3 times."), unlocked: stats.completions >= 3 },
    { id: "lenda", name: t("Lenda", "Legend"), description: t("Terminou a história 10 vezes.", "Finished the story 10 times."), unlocked: stats.completions >= 10 },
    { id: "explorador", name: t("Explorador", "Explorer"), description: t("Viu metade da história.", "Saw half of the story."), unlocked: explored >= 50 },
    { id: "todos_finais", name: t("Todos os finais", "Every ending"), description: t("Descobriu todos os finais.", "Found every ending."), unlocked: allEndings },
    { id: "completista", name: t("Completista", "Completionist"), description: t("Viu todas as cenas e fez todas as escolhas.", "Saw every scene and made every choice."), unlocked: explored >= 100 },
  ];
}

export function totalsOf(story: { scenes: { id: string; isEnding: boolean }[]; choices: { id: string }[] }): StoryTotals {
  return {
    sceneIds: story.scenes.map((scene) => scene.id),
    choiceIds: story.choices.map((choice) => choice.id),
    endingIds: story.scenes.filter((scene) => scene.isEnding).map((scene) => scene.id),
  };
}

// O registro novo só pode continuar o salvo: ninguém volta na história para tentar outra
// escolha (outra escolha = nova jornada, com semente nova do servidor).
// Comparação sem depender da ordem das chaves (o jsonb do Postgres reordena) nem de campo undefined.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, field]) => field !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, field]) => `${JSON.stringify(key)}:${canonical(field)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function extendsLog<T>(stored: T[], incoming: T[]): boolean {
  if (incoming.length < stored.length) return false;
  return stored.every((action, index) => canonical(action) === canonical(incoming[index]));
}
