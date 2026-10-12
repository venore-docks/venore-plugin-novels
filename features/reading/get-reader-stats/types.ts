import type { OperationResult } from "@venore/plugin-sdk";
import type { ReaderStats } from "../../../shared/reader-stats";

export type GetReaderStatsInput = { workId: string };
// null = leitor sem conta ou que ainda não jogou a obra.
export type GetReaderStatsResult = OperationResult<ReaderStats | null>;
