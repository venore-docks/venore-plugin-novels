import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { parseProgress } from "../save-reader-progress/validation";
import * as service from "./service";
import {
  MAX_SAVE_SLOTS,
  type DeleteReaderSlotInput,
  type DeleteReaderSlotResult,
  type ListReaderSavesInput,
  type ListReaderSavesResult,
  type LoadReaderSlotInput,
  type LoadReaderSlotResult,
  type SaveReaderSlotInput,
  type SaveReaderSlotResult,
} from "./types";

const invalid = (message: string) => ({ success: false as const, error: { code: "novels.invalid_input", message } });
const validSlot = (slot: unknown): slot is number => Number.isInteger(slot) && (slot as number) >= 1 && (slot as number) <= MAX_SAVE_SLOTS;

async function currentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user.success && user.data ? user.data.id : null;
}

const unauthenticated = { success: false as const, error: { code: "novels.unauthenticated", message: "Entre na sua conta para usar os salvamentos." } };

export async function listReaderSavesHandler(input: ListReaderSavesInput): Promise<ListReaderSavesResult> {
  if (typeof input.workId !== "string" || !input.workId) return invalid("Obra não informada.");
  const userId = await currentUserId();
  if (!userId) return { success: true, data: [] };
  return service.listReaderSaves({ ...input, userId });
}

export async function saveReaderSlotHandler(input: SaveReaderSlotInput): Promise<SaveReaderSlotResult> {
  const progress = parseProgress(input.state);
  if (typeof input.workId !== "string" || !input.workId || !validSlot(input.slot) || progress?.kind !== "saved") return invalid("Salvamento inválido.");
  const userId = await currentUserId();
  if (!userId) return unauthenticated;
  return service.saveReaderSlot({ workId: input.workId, slot: input.slot, name: String(input.name ?? "").trim().slice(0, 60), saved: progress.saved, userId });
}

export async function deleteReaderSlotHandler(input: DeleteReaderSlotInput): Promise<DeleteReaderSlotResult> {
  if (typeof input.workId !== "string" || !input.workId || !validSlot(input.slot)) return invalid("Salvamento inválido.");
  const userId = await currentUserId();
  if (!userId) return unauthenticated;
  return service.deleteReaderSlot({ ...input, userId });
}

// Carregar um salvamento vira a partida em andamento da conta (inclusive a semente dela).
export async function loadReaderSlotHandler(input: LoadReaderSlotInput): Promise<LoadReaderSlotResult> {
  if (typeof input.workId !== "string" || !input.workId || !validSlot(input.slot)) return invalid("Salvamento inválido.");
  const userId = await currentUserId();
  if (!userId) return unauthenticated;
  return service.loadReaderSlot({ ...input, userId });
}
