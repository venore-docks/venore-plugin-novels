import type { OperationResult } from "@venore/plugin-sdk";
import type { Story } from "../../../contracts/types";

export type GetDraftStoryInput = { workId: string };
export type GetDraftStoryResult = OperationResult<Story>;
