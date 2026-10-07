"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  MediaPickerField,
  type PickableMedia,
} from "@venore/plugin-sdk/ui";
import { ACCENT_COLORS, type AccentColor, type CastMemberRecord, type LocalizedText, type WorkRecord } from "../../contracts/types";
import { LocalizedInput } from "../../components/localized-input";
import { useDragReorder } from "../../components/use-drag-reorder";
import { ACCENT_CLASSES, accentOf } from "../../shared/accent";
import { pickText } from "../../shared/localized-text";
import { deleteCastMemberAction, reorderCastAction, saveCastMemberAction } from "../admin/actions";

// Aba "Elenco": quem fala nos blocos "Fala" das cenas (nome, cor de destaque do tema e retrato).
export function CastManager({ work, cast, media }: { work: WorkRecord; cast: CastMemberRecord[]; media: Record<string, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CastMemberRecord | "new" | null>(null);
  const [optimistic, setOptimistic] = useState<{ base: string; order: string[] } | null>(null);
  const serverIds = cast.map((member) => member.id);
  const base = serverIds.join();
  const order = optimistic && optimistic.base === base ? optimistic.order : serverIds;
  const reorder = useDragReorder(order, (orderedIds) => {
    setOptimistic({ base, order: orderedIds });
    startTransition(async () => {
      const result = await reorderCastAction(work.id, orderedIds);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  });
  const byId = new Map(cast.map((member) => [member.id, member]));
  const name = (text: LocalizedText) => pickText(text, work.defaultLocale, work.defaultLocale);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Elenco</h2>
          <p className="text-sm text-muted-foreground">Personagens que falam nos blocos &quot;Fala&quot;. A cor vem do tema do site.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Personagem
        </Button>
      </div>

      {cast.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Ninguém no elenco ainda. Crie um personagem para usar o bloco &quot;Fala&quot; nas cenas.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {reorder.order.map((id) => {
            const member = byId.get(id);
            if (!member) return null;
            const accent = accentOf(member.color);
            const portrait = member.portraitMediaId ? media[member.portraitMediaId] : null;
            return (
              <li
                key={member.id}
                {...reorder.itemProps(member.id)}
                className={cn("flex items-center gap-3 rounded-lg border border-border bg-background p-2", reorder.dragging === member.id && "opacity-50")}
              >
                <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                {portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={portrait} alt="" className={cn("size-10 rounded-full border-2 object-cover", accent.border)} />
                ) : (
                  <span className={cn("flex size-10 items-center justify-center rounded-full", accent.soft, accent.text)}>
                    <UserRound className="size-5" aria-hidden />
                  </span>
                )}
                <p className={cn("min-w-0 flex-1 truncate font-medium", accent.text)}>{name(member.name)}</p>
                <Button size="icon" variant="ghost" aria-label={`Editar ${name(member.name)}`} onClick={() => setEditing(member)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover ${name(member.name)}`}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Remover ${name(member.name)} do elenco?`)) return;
                    startTransition(async () => {
                      const result = await deleteCastMemberAction(work.id, member.id);
                      if (!result.ok) toast.error(result.error);
                      else toast.success("Personagem removido.");
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <CastDialog
          work={work}
          member={editing === "new" ? null : editing}
          portraitUrl={editing !== "new" && editing.portraitMediaId ? (media[editing.portraitMediaId] ?? null) : null}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            startTransition(async () => {
              const result = await saveCastMemberAction({ workId: work.id, ...input });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Personagem salvo.");
              setEditing(null);
              router.refresh();
            })
          }
        />
      )}
    </section>
  );
}

function CastDialog({
  work,
  member,
  portraitUrl,
  pending,
  onClose,
  onSave,
}: {
  work: WorkRecord;
  member: CastMemberRecord | null;
  portraitUrl: string | null;
  pending: boolean;
  onClose: () => void;
  onSave: (input: { id: string | null; name: LocalizedText; color: AccentColor; portraitMediaId: string | null }) => void;
}) {
  const [name, setName] = useState<LocalizedText>(member?.name ?? {});
  const [color, setColor] = useState<AccentColor>(member?.color ?? "primary");
  const [portrait, setPortrait] = useState<PickableMedia | null>(
    member?.portraitMediaId && portraitUrl ? { id: member.portraitMediaId, url: portraitUrl, filename: "retrato", contentType: "image/*" } : null,
  );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Editar personagem" : "Novo personagem"}</DialogTitle>
          <DialogDescription>Aparece no bloco &quot;Fala&quot; das cenas e na leitura em voz alta.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ id: member?.id ?? null, name, color, portraitMediaId: portrait?.id ?? null });
          }}
        >
          <LocalizedInput label="Nome" value={name} onChange={setName} primaryLocale={work.defaultLocale} maxLength={60} required />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Cor de destaque</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {ACCENT_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={color === option}
                  aria-label={ACCENT_CLASSES[option].label}
                  onClick={() => setColor(option)}
                  className={cn(
                    "size-9 rounded-full border-2 transition-transform",
                    ACCENT_CLASSES[option].solid,
                    color === option ? "scale-110 border-foreground" : "border-transparent",
                  )}
                />
              ))}
            </div>
          </fieldset>
          <MediaPickerField name="portraitMediaId" label="Retrato (opcional)" initialMedia={portrait} onSelect={setPortrait} />
          <Button type="submit" className="w-full" disabled={pending}>
            Salvar personagem
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
