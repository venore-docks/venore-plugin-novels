import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { findWorkBySlug, insertWorkWithFirstChapter } from "./store";
import type { CreateWorkCommand, CreateWorkResult } from "./types";

export async function createWork(command: CreateWorkCommand): Promise<CreateWorkResult> {
  const handle = beginOperation({
    useCase: "novels.create-work",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  if (await findWorkBySlug(command.slug)) {
    const error = { code: "novels.slug_taken", message: "Já existe uma obra com esse endereço." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const work = await insertWorkWithFirstChapter({
    slug: command.slug,
    title: { [command.defaultLocale]: command.title.trim() },
    defaultLocale: command.defaultLocale,
    authorUserId: command.actorId,
    firstChapterTitle: { [command.defaultLocale]: "Capítulo 1" },
  });

  endOperation(handle, { success: true });
  return { success: true, data: work };
}
