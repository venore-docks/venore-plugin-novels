"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Backpack, Copy, GripVertical, Pencil, Plus, Search, Skull, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  MediaPickerField,
  type PickableMedia,
} from "@venore/plugin-sdk/ui";
import { ITEM_RARITIES, ITEM_TYPES, type Creature, type CreatureRecord, type Item, type ItemRecord } from "../../contracts/game";
import { useDragReorder } from "../../components/use-drag-reorder";
import { toGameKey } from "../../shared/game-input";
import { pickText } from "../../shared/localized-text";
import { deleteCreatureAction, deleteItemAction, reorderCreaturesAction, reorderItemsAction, saveCreatureAction, saveItemAction } from "../admin/actions";
import { name, SELECT_CLASS, type GameCatalog } from "../game-editor/catalog";
import { Field, KeyInput, ModifiersEditor, NameInput, NumberInput, Toggle } from "../game-editor/fields";
import { EffectsEditor, ItemSelect } from "../game-editor/rules";
import { FormulaInput } from "../game-editor/formula-input";

// Abas "Itens" e "Bestiário" (seções 10 e 12): cada item/criatura é um registro da obra,
// cadastrado uma vez e escolhido de uma lista nas cenas.

export const ITEM_TYPE_LABELS: Record<Item["type"], string> = {
  equipment: "Equipamento",
  consumable: "Consumível",
  container: "Recipiente",
  quest: "Item de missão",
  material: "Material",
  currency: "Moeda",
};
export const RARITY_LABELS: Record<Item["rarity"], string> = { common: "Comum", rare: "Raro", unique: "Único" };
export const RARITY_BORDER: Record<Item["rarity"], string> = { common: "border-border", rare: "border-chart-6", unique: "border-chart-4" };

type Entry = { id: string; key: string; name: Item["name"]; imageMediaId: string | null };

function CatalogList<T extends Entry>({
  title,
  description,
  icon,
  records,
  media,
  locale,
  addLabel,
  emptyText,
  details,
  onEdit,
  onDuplicate,
  onDelete,
  onReorder,
  pending,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  records: T[];
  media: Record<string, string>;
  locale: string;
  addLabel: string;
  emptyText: string;
  details: (record: T) => string;
  onEdit: (record: T | null) => void;
  onDuplicate: (record: T) => void;
  onDelete: (record: T) => void;
  onReorder: (orderedIds: string[]) => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState("");
  const reorder = useDragReorder(
    records.map((record) => record.id),
    onReorder,
  );
  const byId = new Map(records.map((record) => [record.id, record]));
  const normalized = query.trim().toLowerCase();
  const visible = reorder.order.filter((id) => {
    const record = byId.get(id);
    if (!record) return false;
    return !normalized || record.key.includes(normalized) || pickText(record.name, locale, locale).toLowerCase().includes(normalized);
  });
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={() => onEdit(null)}>
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </div>
      {records.length > 8 && (
        <label className="relative block">
          <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" aria-label="Buscar" className="ps-8" />
        </label>
      )}
      {records.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((id) => {
            const record = byId.get(id)!;
            const image = record.imageMediaId ? media[record.imageMediaId] : null;
            const rarity = (record as unknown as Partial<Item>).rarity;
            return (
              <li
                key={record.id}
                {...(normalized ? {} : reorder.itemProps(record.id))}
                className={cn("flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2", rarity ? RARITY_BORDER[rarity] : "border-border", reorder.dragging === record.id && "opacity-50")}
              >
                {!normalized && <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />}
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="size-10 shrink-0 rounded-md border border-border object-contain" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">{icon}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{pickText(record.name, locale, locale) || record.key}</span>
                  <span className="block truncate text-xs text-muted-foreground">{details(record)}</span>
                </span>
                <Button size="icon" variant="ghost" aria-label={`Editar ${record.key}`} onClick={() => onEdit(record)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Duplicar ${record.key}`} disabled={pending} onClick={() => onDuplicate(record)}>
                  <Copy className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Remover ${record.key}`} disabled={pending} onClick={() => onDelete(record)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function uniqueKey(base: string, taken: string[]): string {
  let key = toGameKey(base);
  for (let index = 2; taken.includes(key); index += 1) key = `${toGameKey(base)}_${index}`.slice(0, 40);
  return key;
}

// ------------------------------------------------------------------ itens

function emptyItem(): Omit<Item, "id" | "position"> {
  return {
    key: "",
    name: {},
    description: {},
    imageMediaId: null,
    type: "material",
    slot: null,
    hands: 0,
    size: 1,
    weight: 0,
    stackable: false,
    maxStack: 1,
    modifiers: [],
    useEffects: [],
    consumable: false,
    requirements: [],
    containerSlots: 0,
    value: 0,
    rarity: "common",
    droppable: true,
  };
}

export function ItemCatalog({ workId, catalog, records, media }: { workId: string; catalog: GameCatalog; records: ItemRecord[]; media: Record<string, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ id: string | null; item: Omit<Item, "id" | "position"> } | null>(null);
  const run = (task: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível salvar.");
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });
  const { system } = catalog;
  return (
    <>
      <CatalogList
        title="Itens"
        description="Cadastre uma vez e use nas cenas (dar, tirar, equipar, saque), nas lojas e nas vocações."
        icon={<Backpack className="size-5" aria-hidden />}
        records={records}
        media={media}
        locale={catalog.locale}
        addLabel="Item"
        emptyText="Nenhum item ainda. Ligue o Inventário na aba Sistema e crie o primeiro item."
        details={(item) =>
          [ITEM_TYPE_LABELS[item.type], item.weight ? `${item.weight} ${name(catalog, system.inventory.weight.unit)}`.trim() : "", item.stackable ? `pilha de ${item.maxStack}` : "", item.value ? `valor ${item.value}` : ""]
            .filter(Boolean)
            .join(" · ")
        }
        onEdit={(item) => setEditing(item ? { id: item.id, item } : { id: null, item: emptyItem() })}
        onDuplicate={(item) => setEditing({ id: null, item: { ...item, key: uniqueKey(item.key, records.map((record) => record.key)) } })}
        onDelete={(item) => {
          if (!window.confirm(`Remover "${pickText(item.name, catalog.locale, catalog.locale)}"? Cenas que usam o item vão aparecer com problema.`)) return;
          run(() => deleteItemAction(workId, item.id), "Item removido.");
        }}
        onReorder={(orderedIds) => run(() => reorderItemsAction(workId, orderedIds), "Ordem salva.")}
        pending={pending}
      />
      {editing && (
        <ItemDialog
          catalog={catalog}
          initial={editing.item}
          imageUrl={editing.item.imageMediaId ? (media[editing.item.imageMediaId] ?? null) : null}
          isNew={!editing.id}
          pending={pending}
          takenKeys={records.filter((record) => record.id !== editing.id).map((record) => record.key)}
          onClose={() => setEditing(null)}
          onSave={(item) => run(() => saveItemAction(workId, editing.id, item), "Item salvo.", () => setEditing(null))}
        />
      )}
    </>
  );
}

function ItemDialog({
  catalog,
  initial,
  imageUrl,
  isNew,
  pending,
  takenKeys,
  onClose,
  onSave,
}: {
  catalog: GameCatalog;
  initial: Omit<Item, "id" | "position">;
  imageUrl: string | null;
  isNew: boolean;
  pending: boolean;
  takenKeys: string[];
  onClose: () => void;
  onSave: (item: Omit<Item, "id" | "position">) => void;
}) {
  const [item, setItem] = useState(initial);
  const [keyTouched, setKeyTouched] = useState(!isNew);
  const [image, setImage] = useState<PickableMedia | null>(initial.imageMediaId && imageUrl ? { id: initial.imageMediaId, url: imageUrl, filename: "imagem", contentType: "image/*" } : null);
  const update = (patch: Partial<typeof item>) => setItem((current) => ({ ...current, ...patch }));
  const { system } = catalog;
  const requirementKeys = useMemo(() => [...system.attributes.map((attribute) => ({ key: attribute.key, label: name(catalog, attribute.name, attribute.key) })), ...(system.modules.progression ? [{ key: system.progression.levelKey, label: name(catalog, system.progression.levelName, "Nível") }] : [])], [catalog, system]);
  const equipable = item.type === "equipment" || item.type === "container";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo item" : "Editar item"}</DialogTitle>
          <DialogDescription>Os campos que não se aplicam ao tipo ficam escondidos.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ ...item, imageMediaId: image?.id ?? null });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <NameInput
              catalog={catalog}
              label="Nome"
              value={item.name}
              onChange={(value) => update({ name: value, ...(keyTouched ? {} : { key: uniqueKey(value[catalog.locale] ?? "", takenKeys) }) })}
            />
            <KeyInput
              value={item.key}
              onChange={(key) => {
                setKeyTouched(true);
                update({ key });
              }}
            />
            <Field label="Tipo">
              <select className={SELECT_CLASS} value={item.type} onChange={(event) => update({ type: event.target.value as Item["type"] })}>
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ITEM_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Raridade" hint="A cor da borda vem do tema.">
              <select className={SELECT_CLASS} value={item.rarity} onChange={(event) => update({ rarity: event.target.value as Item["rarity"] })}>
                {ITEM_RARITIES.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {RARITY_LABELS[rarity]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <NameInput catalog={catalog} label="Descrição" value={item.description} onChange={(description) => update({ description })} maxLength={600} multiline />
          <MediaPickerField name="imageMediaId" label="Imagem (opcional)" initialMedia={image} onSelect={setImage} />

          <div className="grid gap-3 sm:grid-cols-3">
            <NumberInput label="Espaços na bolsa" min={0} max={4} value={item.size} onChange={(size) => update({ size: Math.max(0, Math.min(4, Math.trunc(size))) })} />
            <NumberInput label={`Peso${system.inventory.weight.enabled ? ` (${name(catalog, system.inventory.weight.unit)})` : ""}`} min={0} step={0.1} value={item.weight} onChange={(weight) => update({ weight: Math.max(0, weight) })} />
            <NumberInput label="Valor (lojas)" min={0} value={item.value} onChange={(value) => update({ value: Math.max(0, Math.trunc(value)) })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label="Empilhável" checked={item.stackable} onChange={(stackable) => update({ stackable, maxStack: stackable ? Math.max(item.maxStack, 100) : 1 })} />
            {item.stackable && <NumberInput label="Máximo da pilha" min={1} max={10000} value={item.maxStack} onChange={(maxStack) => update({ maxStack: Math.max(1, Math.trunc(maxStack)) })} />}
            <Toggle label="Pode ser largado ou vendido" hint="Itens de missão costumam não poder." checked={item.droppable} onChange={(droppable) => update({ droppable })} />
          </div>

          {equipable && system.modules.equipment && (
            <div className="space-y-3 rounded-md border border-border/60 p-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Onde equipa">
                  <select className={SELECT_CLASS} value={item.slot ?? (item.hands > 0 ? "__hands" : "")} onChange={(event) => update(event.target.value === "__hands" ? { slot: null, hands: Math.max(1, item.hands) } : { slot: event.target.value || null, hands: 0 })}>
                    <option value="">não equipa</option>
                    {system.inventory.hands.enabled && <option value="__hands">{name(catalog, system.inventory.hands.name, "Mãos")}</option>}
                    {system.slots.map((slot) => (
                      <option key={slot.key} value={slot.key}>
                        {name(catalog, slot.name, slot.key)}
                      </option>
                    ))}
                  </select>
                </Field>
                {!item.slot && item.hands > 0 && <NumberInput label="Mãos que usa" min={1} max={system.inventory.hands.count} value={item.hands} onChange={(hands) => update({ hands: Math.max(1, Math.min(system.inventory.hands.count, Math.trunc(hands))) })} />}
                {item.type === "container" && <NumberInput label="Espaços que acrescenta" min={0} max={60} value={item.containerSlots} onChange={(containerSlots) => update({ containerSlots: Math.max(0, Math.trunc(containerSlots)) })} />}
              </div>
              <ModifiersEditor catalog={catalog} label="Modificadores (enquanto equipado)" value={item.modifiers} onChange={(modifiers) => update({ modifiers })} />
              {requirementKeys.length > 0 && (
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">Requisitos</p>
                  <p className="text-xs text-muted-foreground">Sem eles, não equipa (e os modificadores não valem).</p>
                  {item.requirements.map((requirement, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-1">
                      <select aria-label="Requisito" className={SELECT_CLASS} value={requirement.key} onChange={(event) => update({ requirements: item.requirements.map((current, position) => (position === index ? { ...current, key: event.target.value } : current)) })}>
                        {requirementKeys.map((entry) => (
                          <option key={entry.key} value={entry.key}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">mínimo</span>
                      <Input aria-label="Mínimo" type="number" className="w-20" value={String(requirement.min)} onChange={(event) => update({ requirements: item.requirements.map((current, position) => (position === index ? { ...current, min: Number(event.target.value) || 0 } : current)) })} />
                      <Button type="button" size="icon" variant="ghost" aria-label="Remover requisito" onClick={() => update({ requirements: item.requirements.filter((_, position) => position !== index) })}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" onClick={() => update({ requirements: [...item.requirements, { key: requirementKeys[0].key, min: 1 }] })}>
                    <Plus className="size-4" />
                    Requisito
                  </Button>
                </div>
              )}
            </div>
          )}

          {(item.type === "consumable" || item.useEffects.length > 0) && (
            <div className="space-y-2 rounded-md border border-border/60 p-2">
              <p className="text-sm font-medium text-foreground">Ao usar</p>
              <EffectsEditor catalog={catalog} effects={item.useEffects} onChange={(useEffects) => update({ useEffects })} />
              <Toggle label="Gasta uma unidade ao usar" checked={item.consumable} onChange={(consumable) => update({ consumable })} />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            Salvar item
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ bestiário

function emptyCreature(): Omit<Creature, "id" | "position"> {
  return { key: "", name: {}, description: {}, imageMediaId: null, stats: {}, hp: 10, behavior: "attack", xp: 0, loot: [] };
}

const BEHAVIOR_LABELS: Record<Creature["behavior"], string> = { attack: "sempre ataca", flee_low: "foge com pouca vida", heal_once: "se cura uma vez" };

export function CreatureCatalog({ workId, catalog, records, media }: { workId: string; catalog: GameCatalog; records: CreatureRecord[]; media: Record<string, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ id: string | null; creature: Omit<Creature, "id" | "position"> } | null>(null);
  const run = (task: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível salvar.");
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });
  return (
    <>
      <CatalogList
        title="Bestiário"
        description="Inimigos dos encontros. Os valores da ficha de cada um entram nas fórmulas de combate como atacante.chave e defensor.chave."
        icon={<Skull className="size-5" aria-hidden />}
        records={records}
        media={media}
        locale={catalog.locale}
        addLabel="Criatura"
        emptyText="Nenhuma criatura ainda. Ligue o Combate na aba Sistema e crie a primeira (o rato)."
        details={(creature) => [`${creature.hp} de vida`, creature.xp ? `${creature.xp} XP` : "", BEHAVIOR_LABELS[creature.behavior]].filter(Boolean).join(" · ")}
        onEdit={(creature) => setEditing(creature ? { id: creature.id, creature } : { id: null, creature: emptyCreature() })}
        onDuplicate={(creature) => setEditing({ id: null, creature: { ...creature, key: uniqueKey(creature.key, records.map((record) => record.key)) } })}
        onDelete={(creature) => {
          if (!window.confirm(`Remover "${pickText(creature.name, catalog.locale, catalog.locale)}"?`)) return;
          run(() => deleteCreatureAction(workId, creature.id), "Criatura removida.");
        }}
        onReorder={(orderedIds) => run(() => reorderCreaturesAction(workId, orderedIds), "Ordem salva.")}
        pending={pending}
      />
      {editing && (
        <CreatureDialog
          catalog={catalog}
          initial={editing.creature}
          imageUrl={editing.creature.imageMediaId ? (media[editing.creature.imageMediaId] ?? null) : null}
          isNew={!editing.id}
          pending={pending}
          takenKeys={records.filter((record) => record.id !== editing.id).map((record) => record.key)}
          onClose={() => setEditing(null)}
          onSave={(creature) => run(() => saveCreatureAction(workId, editing.id, creature), "Criatura salva.", () => setEditing(null))}
        />
      )}
    </>
  );
}

function CreatureDialog({
  catalog,
  initial,
  imageUrl,
  isNew,
  pending,
  takenKeys,
  onClose,
  onSave,
}: {
  catalog: GameCatalog;
  initial: Omit<Creature, "id" | "position">;
  imageUrl: string | null;
  isNew: boolean;
  pending: boolean;
  takenKeys: string[];
  onClose: () => void;
  onSave: (creature: Omit<Creature, "id" | "position">) => void;
}) {
  const [creature, setCreature] = useState(initial);
  const [keyTouched, setKeyTouched] = useState(!isNew);
  const [image, setImage] = useState<PickableMedia | null>(initial.imageMediaId && imageUrl ? { id: initial.imageMediaId, url: imageUrl, filename: "imagem", contentType: "image/*" } : null);
  const update = (patch: Partial<typeof creature>) => setCreature((current) => ({ ...current, ...patch }));
  const { system } = catalog;
  // Chaves que as fórmulas de combate costumam ler do defensor/atacante.
  const suggested = [...system.attributes.map((attribute) => attribute.key), ...system.derived.map((derived) => derived.key), system.progression.levelKey].filter((key) => key && !(key in creature.stats));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova criatura" : "Editar criatura"}</DialogTitle>
          <DialogDescription>Vida, comportamento, ficha para as fórmulas, XP e saque.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ ...creature, imageMediaId: image?.id ?? null });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <NameInput catalog={catalog} label="Nome" value={creature.name} onChange={(value) => update({ name: value, ...(keyTouched ? {} : { key: uniqueKey(value[catalog.locale] ?? "", takenKeys) }) })} />
            <KeyInput
              value={creature.key}
              onChange={(key) => {
                setKeyTouched(true);
                update({ key });
              }}
            />
            <NumberInput label="Vida" min={1} value={creature.hp} onChange={(hp) => update({ hp: Math.max(1, Math.trunc(hp)) })} />
            <NumberInput label="XP ao vencer" min={0} value={creature.xp} onChange={(xp) => update({ xp: Math.max(0, Math.trunc(xp)) })} />
            <Field label="Comportamento">
              <select className={SELECT_CLASS} value={creature.behavior} onChange={(event) => update({ behavior: event.target.value as Creature["behavior"] })}>
                {Object.entries(BEHAVIOR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <NameInput catalog={catalog} label="Descrição (bestiário do leitor)" value={creature.description} onChange={(description) => update({ description })} maxLength={600} multiline />
          <MediaPickerField name="imageMediaId" label="Imagem (opcional)" initialMedia={image} onSelect={setImage} />

          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Ficha</p>
            {Object.entries(creature.stats).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1">
                <span className="w-40 truncate font-mono text-xs text-foreground">{key}</span>
                <Input aria-label={`Valor de ${key}`} type="number" step="any" className="w-24" value={String(value)} onChange={(event) => update({ stats: { ...creature.stats, [key]: Number(event.target.value) || 0 } })} />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover ${key}`}
                  onClick={() => {
                    const stats = { ...creature.stats };
                    delete stats[key];
                    update({ stats });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1">
              {suggested.map((key) => (
                <Button key={key} type="button" size="sm" variant="outline" onClick={() => update({ stats: { ...creature.stats, [key]: 0 } })}>
                  <Plus className="size-3.5" />
                  {key}
                </Button>
              ))}
              <Input
                aria-label="Outra chave"
                placeholder="outra chave + Enter"
                className="w-44 font-mono"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const key = toGameKey(event.currentTarget.value);
                  if (key) update({ stats: { ...creature.stats, [key]: 0 } });
                  event.currentTarget.value = "";
                }}
              />
            </div>
          </div>

          {catalog.items.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">Saque ao vencer</p>
              {creature.loot.map((entry, index) => (
                <div key={index} className="flex flex-wrap items-start gap-1">
                  <ItemSelect catalog={catalog} value={entry.itemId} onChange={(itemId) => update({ loot: creature.loot.map((current, position) => (position === index ? { ...current, itemId } : current)) })} />
                  <Input aria-label="Chance (%)" type="number" min={0} max={100} className="w-20" value={String(entry.chance)} onChange={(event) => update({ loot: creature.loot.map((current, position) => (position === index ? { ...current, chance: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } : current)) })} />
                  <span className="self-center text-xs text-muted-foreground">% ×</span>
                  <FormulaInput catalog={catalog} ariaLabel="Quantidade" className="w-24" value={entry.quantity} onChange={(quantity) => update({ loot: creature.loot.map((current, position) => (position === index ? { ...current, quantity } : current)) })} />
                  <Button type="button" size="icon" variant="ghost" aria-label="Remover do saque" onClick={() => update({ loot: creature.loot.filter((_, position) => position !== index) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={() => update({ loot: [...creature.loot, { itemId: catalog.items[0].id, chance: 50, quantity: "1" }] })}>
                <Plus className="size-4" />
                Linha do saque
              </Button>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            Salvar criatura
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
