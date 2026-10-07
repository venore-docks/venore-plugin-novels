import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { normalizeLocalizedText } from "../../../shared/localized-text";
import * as store from "./store";
import { MAX_CAST } from "./validation";
import type {
  CastVoidResult,
  DeleteCastMemberInput,
  ReorderCastInput,
  SaveCastMemberInput,
  SaveCastMemberResult,
  WithActor,
} from "./types";

function operation(useCase: string, actorId: string) {
  const handle = beginOperation({ useCase, actor: { id: actorId, type: "user" }, kind: "write" });
  return {
    fail: (code: string, message: string) => {
      const error = { code, message };
      endOperation(handle, { success: false, error });
      return { success: false as const, error };
    },
    done: () => endOperation(handle, { success: true }),
  };
}

export async function saveCastMember(input: WithActor<SaveCastMemberInput>): Promise<SaveCastMemberResult> {
  const op = operation("novels.save-cast-member", input.actorId);
  const work = await store.findWorkById(input.workId);
  if (!work) return op.fail("novels.work_not_found", "Obra não encontrada.");
  const values = { name: normalizeLocalizedText(input.name, work.locales), color: input.color, portraitMediaId: input.portraitMediaId || null };
  if (!values.name[work.defaultLocale]) return op.fail("novels.invalid_cast_name", "Dê um nome no idioma principal da obra.");
  if (input.id) {
    if (!(await store.updateCastMember(work.id, input.id, values))) return op.fail("novels.cast_not_found", "Personagem não encontrado.");
    op.done();
    return { success: true, data: { id: input.id } };
  }
  if ((await store.countCast(work.id)) >= MAX_CAST) return op.fail("novels.too_many_cast", `No máximo ${MAX_CAST} personagens por obra.`);
  const id = await store.insertCastMember(work.id, values);
  op.done();
  return { success: true, data: { id } };
}

// Personagem que ainda fala em alguma cena não sai: a fala ficaria sem dono.
export async function deleteCastMember(input: WithActor<DeleteCastMemberInput>): Promise<CastVoidResult> {
  const op = operation("novels.delete-cast-member", input.actorId);
  const speaking = await store.countScenesWithSpeaker(input.workId, input.id);
  if (speaking > 0) {
    return op.fail("novels.cast_in_use", `Esse personagem fala em ${speaking} ${speaking === 1 ? "cena" : "cenas"}. Troque as falas antes de remover.`);
  }
  if (!(await store.deleteCastMember(input.workId, input.id))) return op.fail("novels.cast_not_found", "Personagem não encontrado.");
  op.done();
  return { success: true, data: null };
}

export async function reorderCast(input: WithActor<ReorderCastInput>): Promise<CastVoidResult> {
  const op = operation("novels.reorder-cast", input.actorId);
  await store.reorderCast(input.workId, [...new Set(input.orderedIds)]);
  op.done();
  return { success: true, data: null };
}
