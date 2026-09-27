import { z } from "zod";
import { CONDITION_OPERATORS, EFFECT_OPERATIONS, type ChapterGraph } from "../contracts/types";

// O grafo chega do editor (client) como JSON: nada nele é confiável. Limites generosos pra uma
// obra real, mas que impedem um payload gigante de travar a transação.
export const GRAPH_LIMITS = {
  scenesPerChapter: 300,
  choicesPerChapter: 1200,
  bodyChars: 20000,
  labelChars: 200,
  rulesPerItem: 20,
};

const id = z.string().min(1).max(64);
const localized = (max: number) => z.record(z.string().min(2).max(10), z.string().max(max));
const variableValue = z.union([z.number().finite(), z.boolean()]);
const condition = z.object({ variable: z.string().min(1).max(40), operator: z.enum(CONDITION_OPERATORS), value: variableValue });
const effect = z.object({ variable: z.string().min(1).max(40), operation: z.enum(EFFECT_OPERATIONS), value: variableValue });

const scene = z.object({
  id,
  label: z.string().max(GRAPH_LIMITS.labelChars),
  imageMediaId: id.nullable(),
  body: localized(GRAPH_LIMITS.bodyChars),
  isEnding: z.boolean(),
  endingTitle: localized(GRAPH_LIMITS.labelChars),
  effects: z.array(effect).max(GRAPH_LIMITS.rulesPerItem),
  graphX: z.number().finite(),
  graphY: z.number().finite(),
});

const choice = z.object({
  id,
  sceneId: id,
  targetSceneId: id,
  position: z.number().int().min(0).max(1000),
  label: localized(GRAPH_LIMITS.labelChars),
  conditions: z.array(condition).max(GRAPH_LIMITS.rulesPerItem),
  effects: z.array(effect).max(GRAPH_LIMITS.rulesPerItem),
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
  const graph = parsed.data;

  const sceneIds = new Set(graph.scenes.map((item) => item.id));
  if (sceneIds.size !== graph.scenes.length) return { ok: false, message: "Grafo inválido: cena repetida." };
  const choiceIds = new Set(graph.choices.map((item) => item.id));
  if (choiceIds.size !== graph.choices.length) return { ok: false, message: "Grafo inválido: escolha repetida." };
  if (graph.choices.some((item) => !sceneIds.has(item.sceneId) || !sceneIds.has(item.targetSceneId))) {
    return { ok: false, message: "Grafo inválido: escolha ligada a uma cena que não está no capítulo." };
  }
  if (graph.startSceneId && !sceneIds.has(graph.startSceneId)) {
    return { ok: false, message: "Grafo inválido: cena inicial não está no capítulo." };
  }
  return { ok: true, graph };
}
