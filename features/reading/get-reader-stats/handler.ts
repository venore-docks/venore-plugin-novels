import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { getReaderStats } from "./service";
import type { GetReaderStatsInput, GetReaderStatsResult } from "./types";

export async function getReaderStatsHandler(input: GetReaderStatsInput): Promise<GetReaderStatsResult> {
  const user = await getCurrentUser();
  if (!user.success || !user.data || typeof input.workId !== "string") return { success: true, data: null };
  return getReaderStats({ workId: input.workId, userId: user.data.id });
}
