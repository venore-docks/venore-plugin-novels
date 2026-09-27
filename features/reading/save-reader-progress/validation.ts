import { z } from "zod";
import type { ReaderState } from "../../../contracts/types";
import { MAX_PATH_LENGTH } from "../../../shared/story-engine";

const id = z.string().min(1).max(64);
const readerStateSchema = z.object({
  sceneId: id,
  vars: z.record(z.string().max(40), z.union([z.number().finite(), z.boolean()])).refine((vars) => Object.keys(vars).length <= 50),
  path: z.array(id).max(MAX_PATH_LENGTH),
  visitedEndings: z.array(id).max(300),
});

export function parseReaderState(raw: unknown): ReaderState | null {
  const parsed = readerStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
