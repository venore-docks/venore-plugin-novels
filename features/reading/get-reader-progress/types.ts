import type { OperationResult } from "@venore/plugin-sdk";
import type { ReaderState } from "../../../contracts/types";

export type GetReaderProgressInput = { workId: string };
export type GetReaderProgressQuery = GetReaderProgressInput & { userId: string };
// null = leitor sem sessão ou sem progresso salvo; o client usa o localStorage.
export type GetReaderProgressResult = OperationResult<{ state: ReaderState; updatedAt: Date } | null>;
