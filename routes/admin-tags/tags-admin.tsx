"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, GripVertical, PackagePlus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
} from "@venore/plugin-sdk/ui";
import type { CatalogBadges, LocalizedText, TagGroupRecord, TagRecord } from "../../contracts/types";
import type { TagCatalogAdminView } from "../../features/tags/get-tag-catalog/types";
import { LocalizedInput } from "../../components/localized-input";
import { useDragReorder } from "../../components/use-drag-reorder";
import { pickText } from "../../shared/localized-text";
import { slugify } from "../../shared/slug";
import {
  deleteTagAction,
  deleteTagGroupAction,
  installTagStarterPackAction,
  promoteTagAction,
  reorderTagGroupsAction,
  reorderTagsAction,
  saveTagAction,
  saveTagGroupAction,
  setTagArchivedAction,
  setTagGroupArchivedAction,
  updateTagBadgesAction,
  type DirectActionResult,
} from "../admin/actions";

const name = (text: LocalizedText) => pickText(text, "pt-BR", "pt-BR");

// Ordem otimista: mostra a ordem nova até o servidor devolver a lista já reordenada.
function useOptimisticOrder(serverIds: string[]) {
  const [optimistic, setOptimistic] = useState<{ base: string; order: string[] } | null>(null);
  const base = serverIds.join();
  const order = optimistic && optimistic.base === base ? optimistic.order : serverIds;
  return [order, (next: string[]) => setOptimistic({ base, order: next })] as const;
}

export function TagsAdmin({ catalog }: { catalog: TagCatalogAdminView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const groups = [...catalog.groups].sort((a, b) => a.position - b.position);
  const [selectedId, setSelectedId] = useState<string | null>(groups[0]?.id ?? null);
  const [groupOrder, setGroupOrder] = useOptimisticOrder(groups.map((group) => group.id));
  const [editingGroup, setEditingGroup] = useState<TagGroupRecord | "new" | null>(null);
  const selected = groups.find((group) => group.id === selectedId) ?? groups[0] ?? null;

  function run(action: () => Promise<DirectActionResult>, success?: string, after?: (result: DirectActionResult) => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      after?.(result);
      router.refresh();
    });
  }

  const reorder = useDragReorder(groupOrder, (orderedIds) => {
    setGroupOrder(orderedIds);
    run(() => reorderTagGroupsAction(orderedIds));
  });
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditingGroup("new")}>
          <Plus className="size-4" />
          Novo grupo
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(installTagStarterPackAction, undefined, () =>
              toast.success("Pacote inicial conferido: o que faltava foi instalado (grupos e tags apagados voltam)."),
            )
          }
        >
          <PackagePlus className="size-4" />
          Instalar pacote inicial
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum grupo de tags. Crie um grupo ou instale o pacote inicial (gênero, classificação, avisos e produção).
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Grupos de tags" className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Grupos</p>
            <ul className="space-y-1">
              {reorder.order.map((id, index) => {
                const group = groupsById.get(id);
                if (!group) return null;
                const count = catalog.tags.filter((tag) => tag.groupId === group.id && !tag.custom).length;
                return (
                  <li
                    key={group.id}
                    {...reorder.itemProps(group.id)}
                    className={cn(
                      "group flex items-center gap-1 rounded-lg border px-2 py-2 transition-colors",
                      selected?.id === group.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-ring",
                      reorder.dragging === group.id && "opacity-50",
                    )}
                  >
                    <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                    <button type="button" onClick={() => setSelectedId(group.id)} className="min-w-0 flex-1 text-left">
                      <span className={cn("block truncate text-sm font-medium", group.archivedAt ? "text-muted-foreground line-through" : "text-foreground")}>
                        {name(group.name)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {group.category === "production" ? "Produção" : "Informativa"} · {count} {count === 1 ? "tag" : "tags"}
                        {group.required ? " · obrigatório" : ""}
                      </span>
                    </button>
                    <div className="flex flex-col opacity-60 group-hover:opacity-100">
                      <button type="button" aria-label="Subir grupo" disabled={index === 0} onClick={() => reorder.moveBy(group.id, -1)} className="disabled:opacity-30">
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Descer grupo"
                        disabled={index === reorder.order.length - 1}
                        onClick={() => reorder.moveBy(group.id, 1)}
                        className="disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>

          {selected && (
            <GroupPanel
              key={selected.id}
              group={selected}
              tags={catalog.tags.filter((tag) => tag.groupId === selected.id)}
              usage={catalog.usage}
              pending={pending}
              run={run}
              onEdit={() => setEditingGroup(selected)}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </div>
      )}

      <BadgesEditor badges={catalog.badges} pending={pending} run={run} />

      {editingGroup && (
        <GroupDialog
          group={editingGroup === "new" ? null : editingGroup}
          pending={pending}
          onClose={() => setEditingGroup(null)}
          onSave={(input) =>
            run(() => saveTagGroupAction(input), "Grupo salvo.", (result) => {
              setEditingGroup(null);
              if (result.ok && result.id) setSelectedId(result.id);
            })
          }
        />
      )}
    </div>
  );
}

type Run = (action: () => Promise<DirectActionResult>, success?: string, after?: (result: DirectActionResult) => void) => void;

function GroupPanel({
  group,
  tags,
  usage,
  pending,
  run,
  onEdit,
  onDeleted,
}: {
  group: TagGroupRecord;
  tags: TagRecord[];
  usage: Record<string, number>;
  pending: boolean;
  run: Run;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const official = tags.filter((tag) => !tag.custom).sort((a, b) => a.position - b.position);
  const custom = tags.filter((tag) => tag.custom).sort((a, b) => name(a.name).localeCompare(name(b.name)));
  const [order, setOrder] = useOptimisticOrder(official.map((tag) => tag.id));
  const reorder = useDragReorder(order, (orderedIds) => {
    setOrder(orderedIds);
    run(() => reorderTagsAction(group.id, orderedIds));
  });
  const [editing, setEditing] = useState<TagRecord | "new" | null>(null);
  const byId = new Map(official.map((tag) => [tag.id, tag]));
  const worksInGroup = tags.reduce((sum, tag) => sum + (usage[tag.id] ?? 0), 0);

  return (
    <section className="min-w-0 space-y-5 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">{name(group.name)}</h2>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{group.category === "production" ? "Produção" : "Informativa"}</Badge>
            <Badge variant="outline">{group.selection === "single" ? "Uma opção" : "Várias opções"}</Badge>
            {group.required && <Badge variant="outline">Obrigatório</Badge>}
            {group.allowCustom && <Badge variant="outline">Aceita tag livre</Badge>}
            {group.showOnCard && <Badge variant="outline">No card do catálogo</Badge>}
            {group.archivedAt && <Badge variant="secondary">Arquivado</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Chave: {group.key}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" />
            Editar grupo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => setTagGroupArchivedAction(group.id, !group.archivedAt), group.archivedAt ? "Grupo reativado." : "Grupo arquivado.")}
          >
            {group.archivedAt ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {group.archivedAt ? "Reativar" : "Arquivar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label="Excluir grupo"
            onClick={() => {
              const message =
                worksInGroup > 0
                  ? `Excluir o grupo e as ${tags.length} tags dele? ${worksInGroup} uso(s) em obras somem. Arquivar esconde da seleção sem apagar.`
                  : "Excluir o grupo e as tags dele?";
              if (window.confirm(message)) run(() => deleteTagGroupAction(group.id), "Grupo excluído.", onDeleted);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Tags do catálogo</p>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Nova tag
          </Button>
        </div>
        {official.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tag neste grupo.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {reorder.order.map((id, index) => {
              const tag = byId.get(id);
              if (!tag) return null;
              return (
                <li
                  key={tag.id}
                  {...reorder.itemProps(tag.id)}
                  className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2", reorder.dragging === tag.id && "opacity-50")}
                >
                  <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className={cn("truncate text-sm", tag.archivedAt ? "text-muted-foreground line-through" : "text-foreground")}>
                      {name(tag.name)}
                      <span className="ms-2 text-xs text-muted-foreground">/{tag.slug}</span>
                    </p>
                    {name(tag.description) && <p className="truncate text-xs text-muted-foreground">{name(tag.description)}</p>}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="Obras que usam">
                    {usage[tag.id] ?? 0} {(usage[tag.id] ?? 0) === 1 ? "obra" : "obras"}
                  </span>
                  <div className="ms-auto flex shrink-0 items-center">
                    <Button size="icon" variant="ghost" aria-label="Subir tag" disabled={index === 0} onClick={() => reorder.moveBy(tag.id, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Descer tag"
                      disabled={index === reorder.order.length - 1}
                      onClick={() => reorder.moveBy(tag.id, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <TagRowActions tag={tag} usage={usage[tag.id] ?? 0} pending={pending} run={run} onEdit={() => setEditing(tag)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {custom.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Tags livres dos autores</p>
          <p className="text-xs text-muted-foreground">Só aparecem nas obras que usam. Promover coloca a tag no catálogo, para todas as obras.</p>
          <ul className="divide-y divide-border rounded-lg border border-dashed border-border">
            {custom.map((tag) => (
              <li key={tag.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                <p className="min-w-0 flex-1 basis-40 truncate text-sm text-foreground">
                  {name(tag.name)}
                  <span className="ms-2 text-xs text-muted-foreground">/{tag.slug}</span>
                </p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {usage[tag.id] ?? 0} {(usage[tag.id] ?? 0) === 1 ? "obra" : "obras"}
                </span>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => promoteTagAction(tag.id), "Tag promovida ao catálogo.")}>
                  <Sparkles className="size-4" />
                  Promover
                </Button>
                <TagRowActions tag={tag} usage={usage[tag.id] ?? 0} pending={pending} run={run} onEdit={() => setEditing(tag)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <TagDialog
          tag={editing === "new" ? null : editing}
          groupId={group.id}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) => run(() => saveTagAction(input), "Tag salva.", () => setEditing(null))}
        />
      )}
    </section>
  );
}

function TagRowActions({ tag, usage, pending, run, onEdit }: { tag: TagRecord; usage: number; pending: boolean; run: Run; onEdit: () => void }) {
  return (
    <>
      <Button size="icon" variant="ghost" aria-label="Editar tag" onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending}
        aria-label={tag.archivedAt ? "Reativar tag" : "Arquivar tag"}
        title={tag.archivedAt ? "Reativar" : "Arquivar: some da seleção, obras que usam continuam mostrando"}
        onClick={() => run(() => setTagArchivedAction(tag.id, !tag.archivedAt), tag.archivedAt ? "Tag reativada." : "Tag arquivada.")}
      >
        {tag.archivedAt ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending}
        aria-label="Excluir tag"
        onClick={() => {
          const message = usage > 0 ? `A tag está em ${usage} obra(s) e sai delas. Excluir mesmo assim?` : "Excluir a tag?";
          if (window.confirm(message)) run(() => deleteTagAction(tag.id), "Tag excluída.");
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </>
  );
}

type GroupInput = Parameters<typeof saveTagGroupAction>[0];

function GroupDialog({
  group,
  pending,
  onClose,
  onSave,
}: {
  group: TagGroupRecord | null;
  pending: boolean;
  onClose: () => void;
  onSave: (input: GroupInput) => void;
}) {
  const [form, setForm] = useState<GroupInput>({
    id: group?.id ?? null,
    key: group?.key ?? "",
    name: group?.name ?? {},
    category: group?.category ?? "info",
    selection: group?.selection ?? "multiple",
    required: group?.required ?? false,
    allowCustom: group?.allowCustom ?? false,
    showOnCard: group?.showOnCard ?? false,
  });
  const [keyTouched, setKeyTouched] = useState(Boolean(group));
  const patch = (next: Partial<GroupInput>) => setForm((current) => ({ ...current, ...next }));
  const toggles: { field: "required" | "allowCustom" | "showOnCard"; label: string; hint: string }[] = [
    { field: "required", label: "Obrigatório", hint: "A obra não publica sem escolher." },
    { field: "allowCustom", label: "Aceita tag livre", hint: "O autor pode criar uma tag nova ao escolher." },
    { field: "showOnCard", label: "No card do catálogo", hint: "Aparece resumido no card da obra." },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group ? "Editar grupo" : "Novo grupo de tags"}</DialogTitle>
          <DialogDescription>Ex: Gênero, Avisos de conteúdo, Imagens.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(form);
          }}
        >
          <LocalizedInput
            label="Nome"
            value={form.name}
            required
            maxLength={40}
            onChange={(value) => patch({ name: value, ...(keyTouched ? {} : { key: slugify(value["pt-BR"] ?? "") }) })}
          />
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Chave</span>
            <Input
              value={form.key}
              required
              maxLength={80}
              onChange={(event) => {
                setKeyTouched(true);
                patch({ key: event.target.value });
              }}
            />
            <span className="text-xs text-muted-foreground">Identificador estável (letras minúsculas, números e hífen).</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-foreground">Categoria</span>
              <select
                value={form.category}
                onChange={(event) => patch({ category: event.target.value as GroupInput["category"] })}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="info">Informativa</option>
                <option value="production">Produção</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-foreground">Seleção</span>
              <select
                value={form.selection}
                onChange={(event) => patch({ selection: event.target.value as GroupInput["selection"] })}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="multiple">Várias opções</option>
                <option value="single">Uma opção</option>
              </select>
            </label>
          </div>
          <div className="space-y-3">
            {toggles.map((toggle) => (
              <label key={toggle.field} className="flex items-start justify-between gap-3 text-sm">
                <span>
                  <span className="block font-medium text-foreground">{toggle.label}</span>
                  <span className="block text-xs text-muted-foreground">{toggle.hint}</span>
                </span>
                <Switch checked={form[toggle.field]} onCheckedChange={(checked: boolean) => patch({ [toggle.field]: checked })} />
              </label>
            ))}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            Salvar grupo
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type TagInput = Parameters<typeof saveTagAction>[0];

function TagDialog({
  tag,
  groupId,
  pending,
  onClose,
  onSave,
}: {
  tag: TagRecord | null;
  groupId: string;
  pending: boolean;
  onClose: () => void;
  onSave: (input: TagInput) => void;
}) {
  const [form, setForm] = useState<TagInput>({
    id: tag?.id ?? null,
    groupId: tag?.groupId ?? groupId,
    slug: tag?.slug ?? "",
    name: tag?.name ?? {},
    description: tag?.description ?? {},
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(tag));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tag ? "Editar tag" : "Nova tag"}</DialogTitle>
          <DialogDescription>O endereço é usado no filtro do catálogo (/novels?tag=…).</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(form);
          }}
        >
          <LocalizedInput
            label="Nome"
            value={form.name}
            required
            maxLength={40}
            onChange={(value) =>
              setForm((current) => ({ ...current, name: value, ...(slugTouched ? {} : { slug: slugify(value["pt-BR"] ?? "") }) }))
            }
          />
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Endereço</span>
            <Input
              value={form.slug}
              required
              maxLength={80}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((current) => ({ ...current, slug: event.target.value }));
              }}
            />
          </label>
          <LocalizedInput
            label="Descrição curta (opcional)"
            value={form.description}
            multiline
            maxLength={200}
            placeholder="Aparece ao passar o mouse na tag."
            onChange={(value) => setForm((current) => ({ ...current, description: value }))}
          />
          <Button type="submit" className="w-full" disabled={pending}>
            Salvar tag
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BadgesEditor({ badges, pending, run }: { badges: CatalogBadges; pending: boolean; run: Run }) {
  const [form, setForm] = useState<CatalogBadges>(badges);
  const fields: { field: keyof CatalogBadges; label: string; hint: string }[] = [
    { field: "interactive", label: "Obra interativa", hint: "Quando alguma cena tem mais de uma escolha." },
    { field: "textOnly", label: "Obra só texto", hint: "Quando nenhuma cena oferece escolha de verdade." },
    { field: "aiAudio", label: "Áudio gerado", hint: "Quando a obra tem leitura em voz alta pronta." },
  ];
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Selos automáticos</h2>
        <p className="text-sm text-muted-foreground">
          Calculados da obra, o autor não escolhe. Aqui só o texto que o leitor vê; vazio = o selo não aparece.
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => updateTagBadgesAction(form), "Textos dos selos salvos.");
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {fields.map((entry) => (
            <div key={entry.field} className="space-y-1">
              <LocalizedInput
                label={entry.label}
                value={form[entry.field]}
                maxLength={40}
                onChange={(value) => setForm((current) => ({ ...current, [entry.field]: value }))}
              />
              <p className="text-xs text-muted-foreground">{entry.hint}</p>
            </div>
          ))}
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          Salvar textos
        </Button>
      </form>
    </section>
  );
}
