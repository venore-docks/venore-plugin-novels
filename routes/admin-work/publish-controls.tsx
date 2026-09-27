"use client";

import { useActionState } from "react";
import { Button, useActionToast } from "@venore/plugin-sdk/ui";
import type { WorkStatus } from "../../contracts/types";
import { deleteWorkAction, publishWorkAction, type AdminActionState } from "../admin/actions";

const initialState: AdminActionState = { error: null };

export function PublishControls({ workId, status, blocked }: { workId: string; status: WorkStatus; blocked: boolean }) {
  const [publishState, publishAction, publishing] = useActionState(publishWorkAction, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteWorkAction, initialState);
  const published = status === "published";
  useActionToast({
    pending: publishing,
    error: publishState.error,
    successMessage: published ? "Obra publicada." : "Obra voltou para rascunho.",
  });
  useActionToast({ pending: deleting, error: deleteState.error });

  return (
    <>
      <form action={publishAction}>
        <input type="hidden" name="workId" value={workId} />
        <input type="hidden" name="intent" value={published ? "unpublish" : "publish"} />
        <Button type="submit" variant={published ? "outline" : "default"} disabled={publishing || (!published && blocked)}>
          {published ? "Despublicar" : "Publicar"}
        </Button>
      </form>
      <form
        action={deleteAction}
        onSubmit={(event) => {
          if (!window.confirm("Excluir a obra, todos os capítulos e o progresso dos leitores? Não dá para desfazer.")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="workId" value={workId} />
        <Button type="submit" variant="destructive" disabled={deleting}>
          Excluir
        </Button>
      </form>
    </>
  );
}
