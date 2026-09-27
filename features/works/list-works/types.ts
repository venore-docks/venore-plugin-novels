import type { OperationResult } from "@venore/plugin-sdk";
import type { WorkRecord } from "../../../contracts/types";

export type WorkAdminListItem = WorkRecord & { coverUrl: string | null; chapterCount: number; sceneCount: number };
export type ListWorksResult = OperationResult<WorkAdminListItem[]>;
