import { z } from "zod";
import { DIVIDER_STYLES, IMAGE_ASPECTS, type ChapterGraph } from "../contracts/types";
import { normalizeChoiceMechanics, normalizeSceneMechanics } from "./engine/system";
import { sanitizeConditions, sanitizeEffects } from "./engine/sanitize";
import { blocksFromLegacy } from "./scene-blocks";

// O grafo chega do editor (client) como JSON: nada nele é confiável. Limites generosos pra uma
// obra real, mas que impedem um payload gigante de travar a transação.
export const GRAPH_LIMITS = {
  scenesPerChapter: 300,
  choicesPerChapter: 1200,
  bodyChars: 20000,
  labelChars: 200,
  rulesPerItem: 20,
  blocksPerScene: 60,
  imagesPerGallery: 3,
};

const id = z.string().min(1).max(64);
const localized = (max: number) => z.record(z.string().min(2).max(10), z.string().max(max));
// Efeitos e condições têm vários formatos (0.10.0): aqui só o tamanho; os campos de cada tipo
// passam por shared/engine/sanitize.ts depois do parse.
const rule = z.record(z.string(), z.unknown());
const mechanics = z.record(z.string(), z.unknown()).optional();

const text = localized(GRAPH_LIMITS.bodyChars);
const short = localized(GRAPH_LIMITS.labelChars);

const block = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("text"), text }),
  z.object({ id, type: z.literal("image"), mediaId: id.nullable(), alt: short, aspect: z.enum(IMAGE_ASPECTS), bleed: z.boolean() }),
  z.object({
    id,
    type: z.literal("caption"),
    mediaId: id.nullable(),
    alt: short,
    // Limite real (180) é do validador de publicação; aqui só barra payload absurdo.
    caption: localized(2000),
    position: z.enum(["top", "bottom"]),
  }),
  z.object({ id, type: z.literal("speech"), castId: id.nullable(), text }),
  z.object({
    id,
    type: z.literal("gallery"),
    images: z.array(z.object({ mediaId: id, alt: short })).max(GRAPH_LIMITS.imagesPerGallery),
  }),
  z.object({ id, type: z.literal("divider"), style: z.enum(DIVIDER_STYLES) }),
  z.object({ id, type: z.literal("backdrop"), mediaId: id.nullable(), alt: short, text }),
]);

// Cena no formato antigo (texto + lâmina, de um editor aberto antes da 0.9.0) vira blocos aqui.
const scene = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || "blocks" in raw) return raw;
    const legacy = raw as { id?: unknown; body?: Record<string, string>; imageMediaId?: string | null };
    let counter = 0;
    const blocks = blocksFromLegacy(legacy, () => `${String(legacy.id)}-b${(counter += 1)}`);
    return { ...raw, blocks };
  },
  z.object({
    id,
    label: z.string().max(GRAPH_LIMITS.labelChars),
    blocks: z.array(block).max(GRAPH_LIMITS.blocksPerScene),
    isEnding: z.boolean(),
    endingTitle: short,
    effects: z.array(rule).max(GRAPH_LIMITS.rulesPerItem),
    mechanics,
    graphX: z.number().finite(),
    graphY: z.number().finite(),
  }),
);

const choice = z.object({
  id,
  sceneId: id,
  targetSceneId: id,
  position: z.number().int().min(0).max(1000),
  label: short,
  conditions: z.array(rule).max(GRAPH_LIMITS.rulesPerItem),
  effects: z.array(rule).max(GRAPH_LIMITS.rulesPerItem),
  mechanics,
});

const chapterGraph = z.object({
  startSceneId: id.nullable(),
  scenes: z.array(scene).max(GRAPH_LIMITS.scenesPerChapter),
  choices: z.array(choice).max(GRAPH_LIMITS.choicesPerChapter),
});

export type GraphParseResult = { ok: true; graph: ChapterGraph } | { ok: false; message: string };

// Além do formato, confere a coerência interna: ids únicos, escolhas ligando cenas deste mesmo
// grafo e cena inicial existente. Regras de história (final, beco sem saída) ficam no
// validador de publicação, porque rascunho pode estar incompleto.
export function parseChapterGraph(raw: unknown): GraphParseResult {
  const parsed = chapterGraph.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Grafo inválido: formato não reconhecido." };
  const graph: ChapterGraph = {
    startSceneId: parsed.data.startSceneId,
    scenes: parsed.data.scenes.map((item) => ({
      ...(item as Omit<ChapterGraph["scenes"][number], "effects" | "mechanics">),
      effects: sanitizeEffects(item.effects, GRAPH_LIMITS.rulesPerItem),
      mechanics: normalizeSceneMechanics(item.mechanics),
    })),
    choices: parsed.data.choices.map((item) => ({
      ...item,
      conditions: sanitizeConditions(item.conditions, GRAPH_LIMITS.rulesPerItem),
      effects: sanitizeEffects(item.effects, GRAPH_LIMITS.rulesPerItem),
      mechanics: normalizeChoiceMechanics(item.mechanics),
    })),
  };

  const sceneIds = new Set(graph.scenes.map((item) => item.id));
  if (sceneIds.size !== graph.scenes.length) return { ok: false, message: "Grafo inválido: cena repetida." };
  const choiceIds = new Set(graph.choices.map((item) => item.id));
  if (choiceIds.size !== graph.choices.length) return { ok: false, message: "Grafo inválido: escolha repetida." };
  for (const item of graph.scenes) {
    const blockIds = new Set(item.blocks.map((entry) => entry.id));
    if (blockIds.size !== item.blocks.length) return { ok: false, message: "Grafo inválido: bloco repetido numa cena." };
  }
  if (graph.choices.some((item) => !sceneIds.has(item.sceneId) || !sceneIds.has(item.targetSceneId))) {
    return { ok: false, message: "Grafo inválido: escolha ligada a uma cena que não está no capítulo." };
  }
  if (graph.startSceneId && !sceneIds.has(graph.startSceneId)) {
    return { ok: false, message: "Grafo inválido: cena inicial não está no capítulo." };
  }
  return { ok: true, graph };
}
