import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { normalizeWorkTagInput } from "../../../shared/tag-catalog";
import { findTagCatalog, findWorkBySlug, insertWorkWithFirstChapter } from "./store";
import type { CreateWorkCommand, CreateWorkResult } from "./types";

const localized = (locale: string, value: string | undefined) => (value?.trim() ? { [locale]: value.trim() } : {});

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

  const locale = command.defaultLocale;
  const tags = command.tags ? normalizeWorkTagInput(await findTagCatalog(), command.tags, []) : { tagIds: [], newTags: [] };
  const work = await insertWorkWithFirstChapter({
    slug: command.slug,
    title: { [locale]: command.title.trim() },
    subtitle: localized(locale, command.subtitle),
    synopsis: localized(locale, command.synopsis),
    defaultLocale: locale,
    locales: command.locales?.length ? command.locales : [locale],
    coverMediaId: command.coverMediaId || null,
    coverFocus: command.coverFocus ?? null,
    authorUserId: command.actorId,
    firstChapterTitle: { [locale]: "Capítulo 1" },
    firstSceneLabel: "Cena 1",
    firstSceneBlocks: [{ id: crypto.randomUUID(), type: "text", text: {} }],
    tags,
  });

  endOperation(handle, { success: true });
  return { success: true, data: work };
}
