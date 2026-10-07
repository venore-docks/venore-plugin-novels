import type { OperationResult } from "@venore/plugin-sdk";
import type { ParsedProgress } from "./validation";

export type SaveReaderProgressInput = { workId: string; state: unknown };
export type SaveReaderProgressCommand = { workId: string; progress: ParsedProgress; userId: string };
// `truncated`: parte do registro não vale mais na versão atual da obra; o servidor guardou só o
// trecho válido e o leitor deve recarregar a partida dele.
export type SaveReaderProgressResult = OperationResult<{ updatedAt: Date; truncated: boolean }>;
