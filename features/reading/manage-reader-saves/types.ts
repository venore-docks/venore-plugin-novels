import type { OperationResult } from "@venore/plugin-sdk";
import type { LocalizedText } from "../../../contracts/types";
import type { SavedGame } from "../../../shared/engine/types";

export const MAX_SAVE_SLOTS = 3;

export type ReaderSaveSlot = { slot: number; name: string; chapterTitle: LocalizedText; state: SavedGame; updatedAt: Date };

export type ListReaderSavesInput = { workId: string };
export type SaveReaderSlotInput = { workId: string; slot: number; name: string; state: unknown };
export type DeleteReaderSlotInput = { workId: string; slot: number };
export type LoadReaderSlotInput = { workId: string; slot: number };
export type WithUser<T> = T & { userId: string };

export type ListReaderSavesResult = OperationResult<ReaderSaveSlot[]>;
export type SaveReaderSlotResult = OperationResult<ReaderSaveSlot>;
export type DeleteReaderSlotResult = OperationResult<null>;
export type LoadReaderSlotResult = OperationResult<SavedGame>;
