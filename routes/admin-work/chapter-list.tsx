"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Waypoints } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  useActionToast,
} from "@venore/plugin-sdk/ui";
import type { WorkRecord } from "../../contracts/types";
import type { WorkEditorChapter } from "../../features/works/get-work/types";
import { adminChapterPath } from "../../shared/constants";
import { pickText } from "../../shared/localized-text";
import { localeLabel } from "../../shared/locales";
import {
  createChapterAction,
  deleteChapterAction,
  moveChapterAction,
  updateChapterAction,
  type AdminActionState,
} from "../admin/actions";

const initialState: AdminActionState = { error: null };

export function ChapterList({ work, chapters }: { work: WorkRecord; chapters: WorkEditorChapter[] }) {
  const [createState, createAction, creating] = useActionState(createChapterAction, initialState);
  const [moveState, moveAction, moving] = useActionState(moveChapterAction, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteChapterAction, initialState);
  useActionToast({ pending: creating, error: createState.error, successMessage: "Capítulo criado." });
  useActionToast({ pending: moving, error: moveState.error });
  useActionToast({ pending: deleting, error: deleteState.error, successMessage: "Capítulo excluído." });

  return (
    <div className="space-y-3">
      <ol className="divide-y divide-border rounded-lg border border-border bg-card">
        {chapters.map((chapter, index) => (
          <li key={chapter.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Capítulo {index + 1}</p>
              <p className="truncate font-medium text-foreground">{pickText(chapter.title, work.defaultLocale, work.defaultLocale)}</p>
              <p className="text-xs text-muted-foreground">
                {chapter.sceneCount} {chapter.sceneCount === 1 ? "cena" : "cenas"}
                {chapter.startSceneId ? "" : " · sem cena inicial"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" asChild>
                <Link href={adminChapterPath(work.id, chapter.id)}>
                  <Waypoints className="size-4" />
                  Editar história
                </Link>
              </Button>
              <RenameChapterDialog work={work} chapter={chapter} />
              <form action={moveAction}>
                <input type="hidden" name="chapterId" value={chapter.id} />
                <input type="hidden" name="direction" value="up" />
                <Button type="submit" size="icon" variant="ghost" disabled={moving || index === 0} aria-label="Subir capítulo">
                  <ArrowUp className="size-4" />
                </Button>
              </form>
              <form action={moveAction}>
                <input type="hidden" name="chapterId" value={chapter.id} />
                <input type="hidden" name="direction" value="down" />
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  disabled={moving || index === chapters.length - 1}
                  aria-label="Descer capítulo"
                >
                  <ArrowDown className="size-4" />
                </Button>
              </form>
              <form
                action={deleteAction}
                onSubmit={(event) => {
                  if (!window.confirm("Excluir o capítulo e todas as cenas dele?")) event.preventDefault();
                }}
              >
                <input type="hidden" name="chapterId" value={chapter.id} />
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  disabled={deleting || chapters.length <= 1}
                  aria-label="Excluir capítulo"
                >
                  <Trash2 className="size-4" />
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ol>
      <form action={createAction} className="flex gap-2">
        <input type="hidden" name="workId" value={work.id} />
        <Input name="title" placeholder="Título do novo capítulo" required maxLength={160} />
        <Button type="submit" variant="outline" disabled={creating}>
          <Plus className="size-4" />
          Adicionar
        </Button>
      </form>
    </div>
  );
}

function RenameChapterDialog({ work, chapter }: { work: WorkRecord; chapter: WorkEditorChapter }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateChapterAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Capítulo atualizado.", onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Renomear capítulo">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Título do capítulo</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="workId" value={work.id} />
          <input type="hidden" name="chapterId" value={chapter.id} />
          {work.locales.map((locale) => (
            <label key={locale} className="block space-y-1 text-sm">
              <span className="font-medium text-foreground">
                {localeLabel(locale)}
                {locale === work.defaultLocale ? " (principal)" : ""}
              </span>
              <Input
                name={`title.${locale}`}
                defaultValue={chapter.title[locale] ?? ""}
                required={locale === work.defaultLocale}
                maxLength={160}
              />
            </label>
          ))}
          <Button type="submit" disabled={pending} className="w-full">
            Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
