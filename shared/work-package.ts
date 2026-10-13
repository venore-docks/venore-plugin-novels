import type { Creature, GameSystem, Item } from "../contracts/game";
import { ACCENT_COLORS, type AccentColor, type CastMember, type ChapterGraph, type LocalizedText, type SceneBlock, type VariableDefinition } from "../contracts/types";
import { WORK_PACKAGE_FORMAT, type PackageBlock, type WorkPackage } from "../contracts/work-package";
import type { StoryRecords } from "./build-story";
import { emptySystem, normalizeSystem } from "./engine/system";
import { encounterTargets, extraTargets } from "./engine/validate";
import { creatureFieldsError, isGameKey, itemFieldsError, sanitizeCreatureFields, sanitizeItemFields } from "./game-input";
import { parseChapterGraph } from "./graph-schema";
import { normalizeLocalizedText } from "./localized-text";
import { normalizeBlocks } from "./scene-blocks";
import { isValidSlug, slugify } from "./slug";
import { validateStory, validateVariableDefinitions, type StoryIssue } from "./story-validation";
import { sanitizeVariable } from "./variables";

// Leitura e escrita do pacote de obra (contracts/work-package.ts). Puro: o service gera os ids,
// confere o slug no banco e grava tudo numa transação.

export const WORK_PACKAGE_LIMITS = { chars: 3_000_000, chapters: 60, cast: 60 };

const SCENE_FIELDS = new Set(["sceneId", "targetSceneId", "victorySceneId", "defeatSceneId", "fleeSceneId"]);
const MEDIA_FIELDS = new Set(["mediaId", "imageMediaId", "portraitMediaId", "coverMediaId"]);
const SCENE_KEY = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const LOCALE = /^[a-z]{2}(-[A-Z]{2})?$/;
const VARIABLE_TYPES = new Set(["number", "boolean"]);

type RefMaps = { items: Map<string, string>; creatures: Map<string, string>; cast: Map<string, string>; scenes: Map<string, string> };
type Missing = (kind: "item" | "criatura" | "personagem" | "cena", ref: string, path: string) => void;

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function localized(value: unknown, max: number): LocalizedText {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && LOCALE.test(entry[0]))
      .map(([locale, content]) => [locale, content.trim().slice(0, max)])
      .filter(([, content]) => content),
  );
}

// Troca as referências pelo mapa (chave → id ao importar, id → chave ao exportar) e zera mídia.
// Galeria sai inteira: sem imagens ela não tem o que mostrar.
function remap<T>(value: T, maps: RefMaps, missing: Missing, path: string): T {
  const walk = (current: unknown, where: string): unknown => {
    if (Array.isArray(current)) {
      return current
        .filter((entry) => !(isObject(entry) && entry.type === "gallery"))
        .map((entry, index) => walk(entry, `${where}[${index}]`));
    }
    if (!isObject(current)) return current;
    const next: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(current)) {
      const at = `${where}.${key}`;
      if (MEDIA_FIELDS.has(key)) next[key] = null;
      else if (key === "previousWorkId") next[key] = null;
      else if (key === "itemId" && typeof field === "string") next[key] = lookup(maps.items, field, "item", at);
      else if (key === "creatureId" && typeof field === "string") next[key] = lookup(maps.creatures, field, "criatura", at);
      else if (key === "castId" && typeof field === "string") next[key] = lookup(maps.cast, field, "personagem", at);
      else if (SCENE_FIELDS.has(key) && typeof field === "string" && field) next[key] = lookup(maps.scenes, field, "cena", at);
      // Gatilho da cena: { recurso: cena } (o do recurso é { sceneId, effects }, tratado acima).
      else if (key === "onZero" && isObject(field) && !("effects" in field) && !("sceneId" in field)) {
        next[key] = Object.fromEntries(Object.entries(field).map(([resource, scene]) => [resource, typeof scene === "string" && scene ? lookup(maps.scenes, scene, "cena", `${at}.${resource}`) : null]));
      }
      else next[key] = walk(field, at);
    }
    return next;
  };
  const lookup = (map: Map<string, string>, ref: string, kind: Parameters<Missing>[0], at: string) => {
    const found = map.get(ref);
    if (found === undefined) missing(kind, ref, at);
    return found ?? ref;
  };
  return walk(value, path) as T;
}

// ------------------------------------------------------------------ layout

// Posição no grafo para cena sem x/y: camadas pela distância da cena inicial.
export function layoutChapter(graph: ChapterGraph, placed: Set<string>): ChapterGraph {
  if (graph.scenes.every((scene) => placed.has(scene.id))) return graph;
  const next = new Map<string, string[]>();
  for (const scene of graph.scenes) next.set(scene.id, encounterTargets(scene.mechanics));
  for (const choice of graph.choices) next.get(choice.sceneId)?.push(choice.targetSceneId, ...extraTargets(choice.mechanics));
  const depth = new Map<string, number>();
  const queue = graph.startSceneId ? [graph.startSceneId] : [];
  if (graph.startSceneId) depth.set(graph.startSceneId, 0);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const target of next.get(current) ?? []) {
      if (depth.has(target) || !next.has(target)) continue;
      depth.set(target, depth.get(current)! + 1);
      queue.push(target);
    }
  }
  const lost = Math.max(0, ...depth.values()) + 1;
  const rows = new Map<number, string[]>();
  for (const scene of graph.scenes) {
    const row = depth.get(scene.id) ?? lost;
    rows.set(row, [...(rows.get(row) ?? []), scene.id]);
  }
  const position = new Map<string, { x: number; y: number }>();
  for (const [row, ids] of rows) ids.forEach((id, index) => position.set(id, { x: Math.round((index - (ids.length - 1) / 2) * 260), y: row * 240 }));
  return {
    ...graph,
    scenes: graph.scenes.map((scene) => (placed.has(scene.id) ? scene : { ...scene, graphX: position.get(scene.id)!.x, graphY: position.get(scene.id)!.y })),
  };
}

// ------------------------------------------------------------------ importar

export type ImportedWork = {
  kind: string | null;
  work: {
    slug: string;
    title: LocalizedText;
    subtitle: LocalizedText;
    synopsis: LocalizedText;
    defaultLocale: string;
    locales: string[];
    variables: VariableDefinition[];
    gameSystem: GameSystem;
    tags: string[];
  };
  cast: CastMember[];
  items: Item[];
  creatures: Creature[];
  chapters: { id: string; position: number; title: LocalizedText; graph: ChapterGraph }[];
};

export type WorkImportPlan = { ok: true; value: ImportedWork; issues: StoryIssue[] } | { ok: false; errors: string[] };

export function planWorkImport(raw: unknown, newId: () => string): WorkImportPlan {
  let value = raw;
  if (typeof raw === "string") {
    if (raw.length > WORK_PACKAGE_LIMITS.chars) return { ok: false, errors: ["Arquivo grande demais para uma obra."] };
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, errors: ["O arquivo não é um JSON válido."] };
    }
  }
  if (!isObject(value) || value.format !== WORK_PACKAGE_FORMAT) return { ok: false, errors: ["Esse arquivo não é uma obra do Graphic Novels (format: venore-novels-work)."] };
  if (value.version !== 1) return { ok: false, errors: ["Versão de pacote que esta instalação ainda não conhece."] };

  const errors: string[] = [];
  const missing: Missing = (kind, ref, path) => errors.push(`${path}: ${kind} "${ref}" não existe no pacote.`);

  // Obra.
  const work = isObject(value.work) ? value.work : {};
  const defaultLocale = typeof work.defaultLocale === "string" && LOCALE.test(work.defaultLocale) ? work.defaultLocale : "pt-BR";
  const locales = [defaultLocale, ...list(work.locales).filter((locale): locale is string => typeof locale === "string" && LOCALE.test(locale) && locale !== defaultLocale)].slice(0, 6);
  const title = localized(work.title, 120);
  if (!title[defaultLocale]) errors.push(`work.title: falta o título em ${defaultLocale}.`);
  const slug = slugify(typeof work.slug === "string" && work.slug ? work.slug : (title[defaultLocale] ?? ""));
  if (!isValidSlug(slug)) errors.push("work.slug: endereço inválido.");

  // Variáveis.
  const variables: VariableDefinition[] = [];
  for (const [index, entry] of list(value.variables).slice(0, 50).entries()) {
    if (!isObject(entry) || typeof entry.key !== "string" || !VARIABLE_TYPES.has(String(entry.type))) {
      errors.push(`variables[${index}]: precisa de key e type (number ou boolean).`);
      continue;
    }
    variables.push(sanitizeVariable({ ...(entry as VariableDefinition), label: typeof entry.label === "string" ? entry.label : entry.key }));
  }
  for (const issue of validateVariableDefinitions(variables)) if (issue.severity === "error") errors.push(`variables: ${issue.message}`);

  // Chaves → ids novos.
  const maps: RefMaps = { items: new Map(), creatures: new Map(), cast: new Map(), scenes: new Map() };
  const register = (map: Map<string, string>, key: unknown, where: string, valid: (key: string) => boolean) => {
    if (typeof key !== "string" || !valid(key)) return errors.push(`${where}: chave inválida.`);
    if (map.has(key)) return errors.push(`${where}: chave "${key}" repetida.`);
    map.set(key, newId());
  };
  const rawItems = list(value.items);
  const rawCreatures = list(value.creatures);
  const rawCast = list(value.cast).slice(0, WORK_PACKAGE_LIMITS.cast);
  const rawChapters = list(value.chapters);
  if (rawChapters.length === 0) errors.push("chapters: a obra precisa de pelo menos um capítulo.");
  if (rawChapters.length > WORK_PACKAGE_LIMITS.chapters) errors.push("chapters: capítulos demais.");
  rawItems.forEach((entry, index) => register(maps.items, isObject(entry) ? entry.key : null, `items[${index}]`, isGameKey));
  rawCreatures.forEach((entry, index) => register(maps.creatures, isObject(entry) ? entry.key : null, `creatures[${index}]`, isGameKey));
  rawCast.forEach((entry, index) => register(maps.cast, isObject(entry) ? entry.key : null, `cast[${index}]`, isGameKey));
  rawChapters.forEach((chapter, chapterIndex) =>
    list(isObject(chapter) ? chapter.scenes : []).forEach((scene, index) =>
      register(maps.scenes, isObject(scene) ? scene.key : null, `chapters[${chapterIndex}].scenes[${index}]`, (key) => SCENE_KEY.test(key)),
    ),
  );
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 40) };

  // Elenco, catálogo e sistema.
  const cast: CastMember[] = rawCast.filter(isObject).map((entry, position) => ({
    id: maps.cast.get(String(entry.key))!,
    name: localized(entry.name, 80),
    color: ACCENT_COLORS.includes(entry.color as AccentColor) ? (entry.color as AccentColor) : "primary",
    portraitMediaId: null,
    position,
  }));
  cast.forEach((member, index) => !member.name[defaultLocale] && errors.push(`cast[${index}]: falta o nome em ${defaultLocale}.`));
  const items: Item[] = [];
  rawItems.forEach((entry, position) => {
    const fields = sanitizeItemFields(remap(entry, maps, missing, `items[${position}]`));
    const problem = itemFieldsError(fields, defaultLocale);
    if (problem) errors.push(`items[${position}] (${fields.key}): ${problem}`);
    items.push({ ...fields, imageMediaId: null, id: maps.items.get(fields.key)!, position });
  });
  const creatures: Creature[] = [];
  rawCreatures.forEach((entry, position) => {
    const fields = sanitizeCreatureFields(remap(entry, maps, missing, `creatures[${position}]`));
    const problem = creatureFieldsError(fields, defaultLocale);
    if (problem) errors.push(`creatures[${position}] (${fields.key}): ${problem}`);
    creatures.push({ ...fields, imageMediaId: null, id: maps.creatures.get(fields.key)!, position });
  });
  const gameSystem = value.system ? normalizeSystem(remap(value.system, maps, missing, "system")) : emptySystem();

  // Capítulos.
  const chapters: ImportedWork["chapters"] = [];
  rawChapters.forEach((rawChapter, chapterIndex) => {
    const where = `chapters[${chapterIndex}]`;
    const chapter = isObject(rawChapter) ? rawChapter : {};
    const sceneKeys = new Set(list(chapter.scenes).filter(isObject).map((scene) => String(scene.key)));
    const placed = new Set<string>();
    const scenes = list(chapter.scenes)
      .filter(isObject)
      .map((scene, index) => {
        const id = maps.scenes.get(String(scene.key))!;
        if (typeof scene.x === "number" && typeof scene.y === "number") placed.add(id);
        const blocks = [
          ...(scene.text ? [{ type: "text", text: scene.text } as PackageBlock] : []),
          ...(list(scene.blocks).filter(isObject) as PackageBlock[]),
        ].map((block) => ({ ...block, id: newId() }));
        return remap(
          {
            id,
            label: typeof scene.label === "string" ? scene.label.trim() : String(scene.key),
            blocks,
            isEnding: scene.isEnding === true,
            endingTitle: scene.endingTitle ?? {},
            effects: list(scene.effects),
            mechanics: scene.mechanics ?? {},
            graphX: typeof scene.x === "number" ? scene.x : 0,
            graphY: typeof scene.y === "number" ? scene.y : 0,
          },
          maps,
          missing,
          `${where}.scenes[${index}](${String(scene.key)})`,
        );
      });
    const positions = new Map<string, number>();
    const choices = list(chapter.choices)
      .filter(isObject)
      .map((choice, index) => {
        const at = `${where}.choices[${index}]`;
        for (const field of ["from", "to"] as const) {
          if (!sceneKeys.has(String(choice[field]))) errors.push(`${at}.${field}: cena "${String(choice[field])}" não é deste capítulo.`);
        }
        const sceneId = maps.scenes.get(String(choice.from)) ?? "";
        const position = positions.get(sceneId) ?? 0;
        positions.set(sceneId, position + 1);
        const rules = remap({ conditions: list(choice.conditions), effects: list(choice.effects), mechanics: choice.mechanics ?? {} }, maps, missing, at);
        return { id: newId(), sceneId, targetSceneId: maps.scenes.get(String(choice.to)) ?? "", position, label: choice.label ?? {}, ...rules };
      });
    const start = typeof chapter.start === "string" ? maps.scenes.get(chapter.start) : undefined;
    if (!start || !sceneKeys.has(String(chapter.start))) errors.push(`${where}.start: cena inicial "${String(chapter.start)}" não é deste capítulo.`);
    const parsed = parseChapterGraph({ startSceneId: start ?? null, scenes, choices });
    if (!parsed.ok) {
      errors.push(`${where}: ${parsed.message}`);
      return;
    }
    const graph: ChapterGraph = {
      startSceneId: parsed.graph.startSceneId,
      scenes: parsed.graph.scenes.map((scene) => ({
        ...scene,
        blocks: normalizeBlocks(scene.blocks as SceneBlock[], locales),
        endingTitle: scene.isEnding ? normalizeLocalizedText(scene.endingTitle, locales) : {},
      })),
      choices: parsed.graph.choices.map((choice) => ({ ...choice, label: normalizeLocalizedText(choice.label, locales) })),
    };
    const titleText = localized(chapter.title, 120);
    chapters.push({ id: newId(), position: chapterIndex + 1, title: Object.keys(titleText).length > 0 ? titleText : { [defaultLocale]: `Capítulo ${chapterIndex + 1}` }, graph: layoutChapter(graph, placed) });
  });
  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)].slice(0, 40) };

  const imported: ImportedWork = {
    kind: typeof value.kind === "string" ? value.kind.slice(0, 40) : null,
    work: {
      slug,
      title,
      subtitle: localized(work.subtitle, 160),
      synopsis: localized(work.synopsis, 2000),
      defaultLocale,
      locales,
      variables,
      gameSystem,
      tags: list(work.tags).filter((tag): tag is string => typeof tag === "string").slice(0, 30),
    },
    cast,
    items,
    creatures,
    chapters,
  };
  return { ok: true, value: imported, issues: validateImported(imported) };
}

// O que o validador de publicação diz da obra importada (rascunho pode ter aviso e até erro).
export function validateImported(imported: ImportedWork): StoryIssue[] {
  return validateStory({
    work: imported.work,
    chapters: imported.chapters.map((chapter) => ({ id: chapter.id, position: chapter.position, title: chapter.title, startSceneId: chapter.graph.startSceneId })),
    scenes: imported.chapters.flatMap((chapter) => chapter.graph.scenes.map((scene) => ({ ...scene, chapterId: chapter.id }))),
    choices: imported.chapters.flatMap((chapter) => chapter.graph.choices),
    cast: imported.cast,
    items: imported.items,
    creatures: imported.creatures,
  });
}

// Mesmo formato que os services leem do banco (simulador e script de conferência dos exemplos).
export function recordsFromImported(imported: ImportedWork, workId = "importada"): StoryRecords {
  const now = new Date(0);
  return {
    work: {
      id: workId,
      slug: imported.work.slug,
      title: imported.work.title,
      subtitle: imported.work.subtitle,
      synopsis: imported.work.synopsis,
      defaultLocale: imported.work.defaultLocale,
      locales: imported.work.locales,
      coverMediaId: null,
      coverFocus: null,
      variables: imported.work.variables,
      gameSystem: imported.work.gameSystem,
      status: "draft",
      authorUserId: null,
      speechEnabled: false,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    chapters: imported.chapters.map((chapter) => ({ id: chapter.id, workId, position: chapter.position, title: chapter.title, startSceneId: chapter.graph.startSceneId, createdAt: now, updatedAt: now })),
    scenes: imported.chapters.flatMap((chapter) => chapter.graph.scenes.map((scene) => ({ ...scene, workId, chapterId: chapter.id }))),
    choices: imported.chapters.flatMap((chapter) => chapter.graph.choices),
    cast: imported.cast.map((member) => ({ ...member, workId })),
    items: imported.items.map((item) => ({ ...item, workId })),
    creatures: imported.creatures.map((creature) => ({ ...creature, workId })),
  };
}

// ------------------------------------------------------------------ exportar

function readableKey(text: string, fallback: string, taken: Set<string>, pattern: RegExp, separator = "_"): string {
  const base =
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, separator)
      .replace(new RegExp(`^[^a-z]+|\\${separator}+$`, "g"), "")
      .slice(0, 36) || fallback;
  let key = pattern.test(base) ? base : fallback;
  for (let suffix = 2; taken.has(key); suffix += 1) key = `${base}${separator}${suffix}`;
  taken.add(key);
  return key;
}

export function packageFromRecords(records: StoryRecords, extras: { tags: string[]; kind?: string | null }): WorkPackage {
  const { work } = records;
  const locale = work.defaultLocale;
  const sceneKeys = new Set<string>();
  const castKeys = new Set<string>();
  const maps: RefMaps = {
    items: new Map(records.items.map((item) => [item.id, item.key])),
    creatures: new Map(records.creatures.map((creature) => [creature.id, creature.key])),
    cast: new Map(records.cast.map((member) => [member.id, readableKey(member.name[locale] ?? "", "personagem", castKeys, /^[a-z][a-z0-9_]{0,39}$/)])),
    scenes: new Map(),
  };
  const chapters = [...records.chapters].sort((a, b) => a.position - b.position);
  for (const chapter of chapters) {
    records.scenes
      .filter((scene) => scene.chapterId === chapter.id)
      .forEach((scene, index) => maps.scenes.set(scene.id, readableKey(scene.label, `c${chapter.position}_cena_${index + 1}`, sceneKeys, SCENE_KEY)));
  }
  // Referência quebrada (item apagado) sai como estava: o importador avisa.
  const keep: Missing = () => undefined;
  const strip = <T extends { id: string; workId: string; position: number }>(record: T) => {
    const { id: _id, workId: _workId, position: _position, ...rest } = record;
    void _id;
    void _workId;
    void _position;
    return rest;
  };

  return {
    format: WORK_PACKAGE_FORMAT,
    version: 1,
    ...(extras.kind ? { kind: extras.kind } : {}),
    work: {
      slug: work.slug,
      title: work.title,
      subtitle: work.subtitle,
      synopsis: work.synopsis,
      defaultLocale: work.defaultLocale,
      locales: work.locales,
      tags: extras.tags,
    },
    variables: work.variables,
    system: remap(work.gameSystem, maps, keep, "system"),
    cast: records.cast.map((member) => ({ key: maps.cast.get(member.id)!, name: member.name, color: member.color })),
    items: records.items.map((item) => remap({ ...strip(item), imageMediaId: null }, maps, keep, "items")),
    creatures: records.creatures.map((creature) => remap({ ...strip(creature), imageMediaId: null }, maps, keep, "creatures")),
    chapters: chapters.map((chapter) => {
      const scenes = records.scenes.filter((scene) => scene.chapterId === chapter.id);
      const ids = new Set(scenes.map((scene) => scene.id));
      return {
        key: `cap${chapter.position}`,
        title: chapter.title,
        start: chapter.startSceneId ? (maps.scenes.get(chapter.startSceneId) ?? "") : "",
        scenes: scenes.map((scene) => ({
          key: maps.scenes.get(scene.id)!,
          label: scene.label,
          blocks: remap(
            scene.blocks.map(({ id: _id, ...block }) => {
              void _id;
              return block as PackageBlock;
            }),
            maps,
            keep,
            "blocks",
          ),
          ...(scene.isEnding ? { isEnding: true, endingTitle: scene.endingTitle } : {}),
          effects: remap(scene.effects, maps, keep, "effects"),
          mechanics: remap(scene.mechanics, maps, keep, "mechanics"),
          x: scene.graphX,
          y: scene.graphY,
        })),
        choices: records.choices
          .filter((choice) => ids.has(choice.sceneId))
          .sort((a, b) => a.position - b.position)
          .map((choice) => ({
            from: maps.scenes.get(choice.sceneId)!,
            to: maps.scenes.get(choice.targetSceneId) ?? "",
            label: choice.label,
            conditions: remap(choice.conditions, maps, keep, "conditions"),
            effects: remap(choice.effects, maps, keep, "effects"),
            mechanics: remap(choice.mechanics, maps, keep, "mechanics"),
          })),
      };
    }),
  };
}
