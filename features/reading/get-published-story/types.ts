import type { OperationResult } from "@venore/plugin-sdk";
import type { Story } from "../../../contracts/types";

export type GetPublishedStoryInput = { slug: string };
export type GetPublishedStoryResult = OperationResult<Story>;
