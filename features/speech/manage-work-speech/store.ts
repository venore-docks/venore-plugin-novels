import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { works } from "../../../database/schema";

export { findStoryRecords, findWorkRowById as findWorkById } from "../../../database/queries/story-records";

// works.speech_enabled = o autor pediu áudio para a obra (Gerar) ou apagou (Apagar). Só registro:
// o leitor toca o que estiver pronto.
export async function setWorkSpeechEnabled(workId: string, enabled: boolean): Promise<void> {
  await db.update(works).set({ speechEnabled: enabled }).where(eq(works.id, workId));
}
