import type { OperationResult } from "@venore/plugin-sdk";
import type { ReaderState } from "../../../contracts/types";

export type SaveReaderProgressInput = { workId: string; state: unknown };
export type SaveReaderProgressCommand = { workId: string; state: ReaderState; userId: string };
export type SaveReaderProgressResult = OperationResult<{ updatedAt: Date }>;
