import { z } from "zod";
import type { ReaderState } from "../../../contracts/types";
import { MAX_LOG_LENGTH, MAX_PATH_LENGTH } from "../../../shared/engine/play";
import type { PlayAction, SavedGame } from "../../../shared/engine/types";

const id = z.string().min(1).max(64);
const key = z.string().min(1).max(40);
const scalar = z.union([z.number().finite(), z.boolean()]);

const legacySchema = z.object({
  sceneId: id,
  vars: z.record(z.string().max(40), scalar).refine((vars) => Object.keys(vars).length <= 50),
  path: z.array(id).max(MAX_PATH_LENGTH),
  visitedEndings: z.array(id).max(300),
});

// Registro de ações da partida (0.10.0): cada ação tem só os campos que o motor lê.
const actionSchema: z.ZodType<PlayAction> = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("start"),
    profile: z.record(key, z.string().max(40)).refine((value) => Object.keys(value).length <= 20).optional(),
    vocationId: id.nullable().optional(),
    allocations: z.record(key, z.number().int().min(0).max(1000)).refine((value) => Object.keys(value).length <= 60).optional(),
    hardcore: z.boolean().optional(),
    carry: z.record(key, scalar).refine((value) => Object.keys(value).length <= 60).optional(),
  }),
  z.object({ t: z.literal("choose"), choiceId: id }),
  z.object({ t: z.literal("continue") }),
  z.object({ t: z.literal("reroll") }),
  z.object({ t: z.literal("equip"), itemId: id }),
  z.object({ t: z.literal("unequip"), itemId: id }),
  z.object({ t: z.literal("use"), itemId: id }),
  z.object({ t: z.literal("drop"), itemId: id, quantity: z.number().int().min(1).max(100000) }),
  z.object({ t: z.literal("pickup"), itemId: id }),
  z.object({ t: z.literal("discard") }),
  z.object({ t: z.literal("allocate"), key }),
  z.object({ t: z.literal("combat"), action: key, target: z.number().int().min(0).max(50).optional(), itemId: id.optional() }),
  z.object({ t: z.literal("buy"), itemId: id }),
  z.object({ t: z.literal("sell"), itemId: id }),
]);

const savedSchema = z.object({
  v: z.literal(2),
  seed: z.string().min(1).max(64),
  log: z.array(actionSchema).min(1).max(MAX_LOG_LENGTH),
  visitedEndings: z.array(id).max(300),
  achievements: z.array(id).max(300),
});

export type ParsedProgress = { kind: "saved"; saved: SavedGame } | { kind: "legacy"; state: ReaderState };

export function parseProgress(raw: unknown): ParsedProgress | null {
  const saved = savedSchema.safeParse(raw);
  if (saved.success) return saved.data.log[0].t === "start" ? { kind: "saved", saved: saved.data } : null;
  const legacy = legacySchema.safeParse(raw);
  return legacy.success ? { kind: "legacy", state: legacy.data } : null;
}

export function parseReaderState(raw: unknown): ReaderState | null {
  const parsed = legacySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseStartAction(raw: unknown): Extract<PlayAction, { t: "start" }> | null {
  const parsed = actionSchema.safeParse(raw);
  return parsed.success && parsed.data.t === "start" ? parsed.data : null;
}
