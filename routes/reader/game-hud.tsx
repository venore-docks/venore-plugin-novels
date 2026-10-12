"use client";

import { useState } from "react";
import { Plus, Trophy, UserRound } from "lucide-react";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@venore/plugin-sdk/ui";
import type { Item } from "../../contracts/game";
import type { LocalizedText } from "../../contracts/types";
import { ACCENT_CLASSES } from "../../shared/accent";
import type { CharacterSheetV2, SheetItem } from "../../shared/engine/sheet";
import type { Change, CombatLogLine, PlayAction } from "../../shared/engine/types";

// HUD fixo no rodapé (recursos, nível) e a ficha do personagem em abas. Tudo vem pronto da
// ficha calculada pelo motor (shared/engine/sheet.ts); daqui só sai a ação do leitor.

export type Text = (value: LocalizedText | undefined) => string;

const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
export const formatNumber = (value: number) => NUMBER.format(value);
const percent = (value: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0);

const RARITY_BORDER: Record<Item["rarity"], string> = { common: "border-border", rare: "border-chart-6", unique: "border-chart-4" };

function Bar({ value, max, label, className }: { value: number; max: number; label: string; className: string }) {
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full ui-motion-base", className)} style={{ width: `${percent(value, max)}%` }} />
    </div>
  );
}

export function GameHud({ sheet, text, onOpen, alert }: { sheet: CharacterSheetV2; text: Text; onOpen: () => void; alert: boolean }) {
  if (!sheet.hasHud && !sheet.hasPanel) return null;
  const resources = sheet.resources.filter((resource) => resource.showInHud);
  const attributes = [...sheet.stats, ...sheet.skills].filter((attribute) => attribute.showInHud);
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {resources.map((resource) => (
            <div key={resource.key} className="min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-1 text-xs">
                <span className="truncate text-muted-foreground">{text(resource.abbr) || text(resource.name)}</span>
                <span className={cn("font-semibold tabular-nums", resource.low ? "text-destructive" : "text-foreground")}>
                  {formatNumber(resource.value)}
                  <span className="font-normal text-muted-foreground">/{formatNumber(resource.max)}</span>
                </span>
              </div>
              <Bar value={resource.value} max={resource.max} label={text(resource.name)} className={resource.low ? "bg-destructive" : ACCENT_CLASSES[resource.color].solid} />
            </div>
          ))}
          {sheet.level && (
            <div className="min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-1 text-xs">
                <span className="truncate text-muted-foreground">{text(sheet.level.name)}</span>
                <span className="font-semibold tabular-nums text-foreground">{sheet.level.value}</span>
              </div>
              {sheet.level.to !== null && <Bar value={sheet.level.xp - sheet.level.from} max={sheet.level.to - sheet.level.from} label={text(sheet.level.xpName)} className="bg-primary" />}
            </div>
          )}
          {attributes.map((attribute) => (
            <div key={attribute.key} className="flex min-w-0 flex-col justify-center">
              <span className="truncate text-xs text-muted-foreground">{text(attribute.abbr) || text(attribute.name)}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{formatNumber(attribute.value)}</span>
            </div>
          ))}
          {sheet.legacy?.status.map((entry) => (
            <div key={entry.key} className="min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-1 text-xs">
                <span className="truncate text-muted-foreground">{entry.label}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {typeof entry.value === "boolean" ? (entry.value ? "Sim" : "Não") : formatNumber(entry.value)}
                  {entry.max !== null && <span className="font-normal text-muted-foreground">/{formatNumber(entry.max)}</span>}
                </span>
              </div>
              {typeof entry.value === "number" && entry.max !== null && <Bar value={entry.value} max={entry.max} label={entry.label} className={percent(entry.value, entry.max) <= 25 ? "bg-destructive" : "bg-primary"} />}
            </div>
          ))}
          {sheet.effects.length > 0 && (
            <div className="col-span-full flex flex-wrap gap-1">
              {sheet.effects.map((effect) => (
                <span key={effect.def.id} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ACCENT_CLASSES[effect.def.color].soft, ACCENT_CLASSES[effect.def.color].text)}>
                  {text(effect.def.name)}
                  {effect.remaining !== null && ` · ${effect.remaining}`}
                </span>
              ))}
            </div>
          )}
        </div>
        {sheet.hasPanel && (
          <Button size="sm" variant="outline" onClick={onOpen} className="relative shrink-0" aria-label="Abrir ficha do personagem">
            <UserRound className="size-4" />
            <span className="hidden sm:inline">Personagem</span>
            {alert && <span className="absolute -end-1 -top-1 size-2.5 rounded-full bg-primary" aria-label="Algo para resolver" />}
          </Button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ ficha

function ItemCard({
  entry,
  text,
  actions,
}: {
  entry: SheetItem;
  text: Text;
  actions: { label: string; onClick: () => void; disabled?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const { item, stack } = entry;
  return (
    <li className={cn("relative rounded-lg border-2 bg-muted p-1.5", RARITY_BORDER[item.rarity])}>
      <button type="button" className="flex aspect-square w-full flex-col items-center justify-center gap-1 text-center" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        {/* Imagem do catálogo (biblioteca de mídia) */}
        <span className="line-clamp-3 text-xs font-medium leading-tight text-foreground">{text(item.name)}</span>
        {stack.quantity > 1 && <span className="absolute bottom-1 end-1 rounded-sm bg-background px-1 text-xs font-semibold tabular-nums text-foreground">{stack.quantity}</span>}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 min-w-48 space-y-2 rounded-lg border border-border bg-popover p-3 text-start shadow-md sm:start-0 sm:end-auto sm:w-64">
          <p className="text-sm font-semibold text-foreground">{text(item.name)}</p>
          {text(item.description) && <p className="text-xs text-muted-foreground">{text(item.description)}</p>}
          <p className="text-xs text-muted-foreground">
            {[item.weight ? `peso ${formatNumber(entry.weight)}` : "", entry.space ? `${entry.space} espaço(s)` : ""].filter(Boolean).join(" · ")}
          </p>
          {item.modifiers.length > 0 && (
            <ul className="text-xs text-foreground">
              {item.modifiers.map((modifier) => (
                <li key={modifier.target}>
                  {modifier.target} {modifier.amount > 0 ? "+" : "−"}
                  {formatNumber(Math.abs(modifier.amount))}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-1">
            {actions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant="outline"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

export function SheetDialog({
  sheet,
  text,
  title,
  open,
  onOpenChange,
  act,
  canAct,
}: {
  sheet: CharacterSheetV2;
  text: Text;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  act: (action: PlayAction) => void;
  // Fora da luta e com a partida em andamento.
  canAct: boolean;
}) {
  const tabs = [
    { key: "ficha", label: "Ficha", show: sheet.stats.length + sheet.skills.length + sheet.derived.length + sheet.profile.length > 0 || Boolean(sheet.level) || Boolean(sheet.legacy?.skills.length) },
    { key: "mochila", label: "Mochila", show: Boolean(sheet.inventory) || Boolean(sheet.legacy?.hasInventory) },
    { key: "equipamento", label: "Equipamento", show: Boolean(sheet.equipment) },
    { key: "diario", label: "Diário", show: sheet.quests.length > 0 },
    { key: "conquistas", label: "Conquistas", show: sheet.achievements.length > 0 },
    { key: "bestiario", label: "Bestiário", show: sheet.bestiary.length > 0 },
  ].filter((tab) => tab.show);
  if (tabs.length === 0) return null;
  const equippable = (item: Item) => Boolean(item.slot) || item.hands > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{sheet.profile.find((entry) => entry.field.key === "nome")?.value || "Personagem"}</DialogTitle>
          <DialogDescription>
            {title}
            {sheet.vocation ? ` · ${text(sheet.vocation.name)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={tabs[0].key}>
          {tabs.length > 1 && (
            <TabsList className="flex h-auto w-full flex-wrap">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex-1">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          <TabsContent value="ficha" className="space-y-4 pt-3">
            {sheet.profile.length > 0 && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {sheet.profile.map((entry) => (
                  <div key={entry.field.key} className="rounded-lg border border-border p-2">
                    <dt className="text-xs text-muted-foreground">{text(entry.field.name)}</dt>
                    <dd className="font-medium text-foreground">{entry.label ? text(entry.label) : entry.value || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
            {sheet.level && (
              <div className="space-y-1 rounded-lg border border-border p-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {text(sheet.level.name)} {sheet.level.value}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatNumber(sheet.level.xp)} {text(sheet.level.xpName)}
                    {sheet.level.to !== null && ` / ${formatNumber(sheet.level.to)}`}
                  </span>
                </div>
                {sheet.level.to !== null && <Bar value={sheet.level.xp - sheet.level.from} max={sheet.level.to - sheet.level.from} label={text(sheet.level.xpName)} className="bg-primary" />}
                {sheet.level.points > 0 && (
                  <p className="text-sm font-medium text-primary">
                    {formatNumber(sheet.level.points)} {text(sheet.level.pointsName).toLowerCase()} para distribuir
                  </p>
                )}
              </div>
            )}
            {[
              { title: "Atributos", list: sheet.stats },
              { title: "Habilidades", list: sheet.skills },
            ]
              .filter((group) => group.list.length > 0)
              .map((group) => (
                <div key={group.title} className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{group.title}</p>
                  <ul className="grid grid-cols-2 gap-2">
                    {group.list.map((attribute) => (
                      <li key={attribute.key} className="space-y-1 rounded-lg border border-border bg-card p-2.5">
                        <div className="flex items-start justify-between gap-1">
                          <span className="truncate text-xs text-muted-foreground">{text(attribute.name)}</span>
                          {attribute.canRaise && canAct && (
                            <Button size="icon" variant="outline" className="size-6" aria-label={`Subir ${text(attribute.name)} (custa ${attribute.cost})`} title={`Custa ${attribute.cost}`} onClick={() => act({ t: "allocate", key: attribute.key })}>
                              <Plus className="size-3.5" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-foreground">
                          {formatNumber(attribute.value)}
                          {attribute.modifier !== 0 && (
                            <span className={cn("ms-1 text-xs font-normal", attribute.modifier > 0 ? "text-primary" : "text-destructive")}>
                              ({attribute.modifier > 0 ? "+" : "−"}
                              {formatNumber(Math.abs(attribute.modifier))})
                            </span>
                          )}
                        </p>
                        {attribute.training && <Bar value={attribute.training.progress} max={attribute.training.threshold} label={`Treino de ${text(attribute.name)}`} className="bg-chart-2" />}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            {sheet.derived.length > 0 && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {sheet.derived.map((entry) => (
                  <div key={entry.key} className="flex items-baseline justify-between rounded-lg border border-border px-2.5 py-1.5">
                    <dt className="text-muted-foreground">{text(entry.name)}</dt>
                    <dd className="font-semibold tabular-nums text-foreground">{formatNumber(entry.value)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {sheet.legacy && sheet.legacy.skills.length > 0 && (
              <ul className="grid grid-cols-2 gap-2">
                {sheet.legacy.skills.map((entry) => (
                  <li key={entry.key} className="rounded-lg border border-border bg-card p-2.5">
                    <p className="text-xs text-muted-foreground">{entry.label}</p>
                    <p className="text-xl font-semibold tabular-nums text-foreground">{typeof entry.value === "boolean" ? (entry.value ? "Sim" : "Não") : formatNumber(entry.value)}</p>
                  </li>
                ))}
              </ul>
            )}
            {sheet.currency && (
              <p className="text-sm text-foreground">
                {text(sheet.currency.name)}: <strong className="tabular-nums">{formatNumber(sheet.currency.value)}</strong>
              </p>
            )}
          </TabsContent>

          <TabsContent value="mochila" className="space-y-4 pt-3">
            {sheet.inventory && (
              <>
                {sheet.inventory.weight && (
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">{text(sheet.inventory.weight.name)}</span>
                      <span className={cn("font-semibold tabular-nums", sheet.inventory.weight.value > sheet.inventory.weight.max ? "text-destructive" : "text-foreground")}>
                        {formatNumber(sheet.inventory.weight.value)} <span className="font-normal text-muted-foreground">/ {Number.isFinite(sheet.inventory.weight.max) ? formatNumber(sheet.inventory.weight.max) : "∞"} {text(sheet.inventory.weight.unit)}</span>
                      </span>
                    </div>
                    {Number.isFinite(sheet.inventory.weight.max) && <Bar value={sheet.inventory.weight.value} max={sheet.inventory.weight.max} label={text(sheet.inventory.weight.name)} className={sheet.inventory.weight.value > sheet.inventory.weight.max ? "bg-destructive" : "bg-primary"} />}
                  </div>
                )}
                {sheet.inventory.space && (
                  <p className="text-sm text-muted-foreground">
                    {text(sheet.inventory.space.name)}: <span className="font-semibold tabular-nums text-foreground">{sheet.inventory.space.used}</span> de {sheet.inventory.space.total} espaços
                  </p>
                )}
                {sheet.inventory.overflow.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-destructive/40 p-2">
                    <p className="text-sm font-medium text-destructive">Sobrando (não coube)</p>
                    <ul className="grid grid-cols-4 gap-2">
                      {sheet.inventory.overflow.map((entry) => (
                        <ItemCard
                          key={entry.item.id}
                          entry={entry}
                          text={text}
                          actions={[
                            ...(entry.item.useEffects.length > 0 ? [{ label: "Usar", onClick: () => act({ t: "use", itemId: entry.item.id }), disabled: !canAct }] : []),
                            { label: "Largar", onClick: () => act({ t: "drop", itemId: entry.item.id, quantity: entry.stack.quantity }), disabled: !canAct || !entry.item.droppable },
                          ]}
                        />
                      ))}
                    </ul>
                  </div>
                )}
                <ul className="grid grid-cols-4 gap-2" aria-label="Itens na mochila">
                  {sheet.inventory.bag.map((entry) => (
                    <ItemCard
                      key={entry.item.id}
                      entry={entry}
                      text={text}
                      actions={[
                        ...(equippable(entry.item) && sheet.equipment ? [{ label: "Equipar", onClick: () => act({ t: "equip", itemId: entry.item.id }), disabled: !canAct }] : []),
                        ...(entry.item.useEffects.length > 0 ? [{ label: "Usar", onClick: () => act({ t: "use", itemId: entry.item.id }), disabled: !canAct }] : []),
                        ...(entry.item.droppable ? [{ label: "Largar", onClick: () => act({ t: "drop", itemId: entry.item.id, quantity: 1 }), disabled: !canAct }] : []),
                      ]}
                    />
                  ))}
                  {sheet.inventory.bag.length === 0 && <li className="col-span-4 text-sm text-muted-foreground">A mochila está vazia.</li>}
                </ul>
                {sheet.inventory.ground.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">No chão</p>
                    <ul className="grid grid-cols-4 gap-2">
                      {sheet.inventory.ground.map((entry) => (
                        <ItemCard key={entry.item.id} entry={entry} text={text} actions={[{ label: "Pegar", onClick: () => act({ t: "pickup", itemId: entry.item.id }), disabled: !canAct }]} />
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {sheet.legacy?.hasInventory && (
              <ul className="space-y-1 text-sm">
                {sheet.legacy.inventory.map((entry) => (
                  <li key={entry.key} className="flex justify-between rounded-md border border-border px-2 py-1">
                    <span className="text-foreground">{entry.label}</span>
                    {entry.quantity !== null && <span className="tabular-nums text-muted-foreground">×{formatNumber(entry.quantity)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {sheet.equipment && (
            <TabsContent value="equipamento" className="space-y-3 pt-3">
              {/* Silhueta gerada das áreas cadastradas: uma grade, não uma imagem fixa. */}
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[...(sheet.equipment.hands ? [{ key: "__hands", name: sheet.equipment.hands.name, capacity: sheet.equipment.hands.capacity, items: sheet.equipment.hands.items }] : []), ...sheet.equipment.slots].map((slot) => (
                  <li key={slot.key} className="space-y-1 rounded-lg border border-border p-2">
                    <p className="text-xs text-muted-foreground">
                      {text(slot.name)}
                      {slot.capacity > 1 && ` (${slot.items.length}/${slot.capacity})`}
                    </p>
                    {slot.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">vazio</p>
                    ) : (
                      slot.items.map((item, index) => (
                        <div key={`${item.id}-${index}`} className="flex items-center justify-between gap-1">
                          <span className="truncate text-sm font-medium text-foreground">{text(item.name)}</span>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!canAct} onClick={() => act({ t: "unequip", itemId: item.id })}>
                            Tirar
                          </Button>
                        </div>
                      ))
                    )}
                  </li>
                ))}
              </ul>
            </TabsContent>
          )}

          <TabsContent value="diario" className="space-y-2 pt-3">
            {sheet.quests.map((quest) => (
              <div key={quest.def.id} className="space-y-1 rounded-lg border border-border p-3">
                <p className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                  {text(quest.def.name)}
                  <span className={cn("text-xs font-normal", quest.state === "done" ? "text-primary" : quest.state === "failed" ? "text-destructive" : "text-muted-foreground")}>
                    {quest.state === "done" ? "concluída" : quest.state === "failed" ? "falhou" : "em andamento"}
                  </span>
                </p>
                {text(quest.def.description) && <p className="text-xs text-muted-foreground">{text(quest.def.description)}</p>}
                <ol className="space-y-0.5 text-sm">
                  {quest.def.steps.map((step, index) => (
                    <li key={step.id} className={index < quest.step || quest.state === "done" ? "text-muted-foreground line-through" : index === quest.step ? "text-foreground" : "text-muted-foreground/56"}>
                      {text(step.text)}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="conquistas" className="space-y-2 pt-3">
            <ul className="space-y-2">
              {sheet.achievements.map((achievement) => (
                <li key={achievement.def.id} className={cn("flex items-start gap-2 rounded-lg border p-2", achievement.unlocked ? "border-chart-4" : "border-border opacity-60")}>
                  <Trophy className={cn("mt-0.5 size-4 shrink-0", achievement.unlocked ? "text-chart-4" : "text-muted-foreground")} aria-hidden />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{text(achievement.def.name)}</span>
                    {text(achievement.def.description) && <span className="block text-xs text-muted-foreground">{text(achievement.def.description)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="bestiario" className="space-y-2 pt-3">
            <ul className="grid gap-2 sm:grid-cols-2">
              {sheet.bestiary.map((creature) => (
                <li key={creature.id} className="rounded-lg border border-border p-2">
                  <p className="text-sm font-semibold text-foreground">{text(creature.name)}</p>
                  <p className="text-xs text-muted-foreground">{creature.hp} de vida</p>
                  {text(creature.description) && <p className="text-xs text-muted-foreground">{text(creature.description)}</p>}
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ o que mudou

export function describeChange(change: Change, text: Text): { text: string; tone: "up" | "down" | "neutral" | "level" } {
  const label = text(change.label);
  switch (change.type) {
    case "value":
      return { text: `${label} ${change.delta > 0 ? "+" : "−"}${formatNumber(Math.abs(change.delta))}`, tone: change.delta > 0 ? "up" : "down" };
    case "flag":
      return { text: `${label}: ${change.value ? "sim" : "não"}`, tone: "neutral" };
    case "item":
      return { text: change.delta > 0 ? `+ ${label}${change.delta > 1 ? ` ×${change.delta}` : ""}` : `− ${label}${change.delta < -1 ? ` ×${-change.delta}` : ""}`, tone: change.delta > 0 ? "up" : "down" };
    case "level":
      return { text: `${label} ${change.value}!`, tone: "level" };
    case "status":
      return { text: change.on ? label : `${label} passou`, tone: change.on ? "down" : "neutral" };
    case "quest":
      return { text: change.state === "active" ? `Nova missão: ${label}` : change.state === "done" ? `Missão concluída: ${label}` : change.state === "failed" ? `Missão falhou: ${label}` : `Missão avançou: ${label}`, tone: change.state === "failed" ? "down" : "up" };
    case "achievement":
      return { text: `🏆 ${label}`, tone: "level" };
    case "overflow":
      return { text: `Não coube: ${label}`, tone: "down" };
  }
}

export function ChangeChips({ changes, text }: { changes: Change[]; text: Text }) {
  if (changes.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 px-4" aria-label="Mudanças no personagem">
      {changes.map((change, index) => {
        const view = describeChange(change, text);
        return (
          <li
            key={`${change.key}-${index}`}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
              view.tone === "up" && "border-primary/30 bg-primary/10 text-primary",
              view.tone === "down" && "border-destructive/30 bg-destructive/10 text-destructive",
              view.tone === "neutral" && "border-border bg-muted text-muted-foreground",
              view.tone === "level" && "border-chart-4 bg-chart-4/10 text-chart-4",
            )}
          >
            {view.text}
          </li>
        );
      })}
    </ul>
  );
}

export function describeCombatLine(line: CombatLogLine, text: Text): string {
  const actor = text(line.actor);
  const target = line.target ? text(line.target) : "";
  switch (line.kind) {
    case "attack":
      return `${actor}${line.action ? ` (${text(line.action)})` : ""} causa ${line.amount} de dano${target ? ` em ${target}` : ""}.`;
    case "miss":
      return `${actor} erra${target ? ` ${target}` : ""}.`;
    case "defend":
      return `${actor} se defende.`;
    case "flee":
      return `${actor} foge!`;
    case "flee-fail":
      return `${actor} tenta fugir, mas não consegue.`;
    case "item":
      return `${actor} usa ${line.action ? text(line.action) : "um item"}.`;
    case "heal":
      return `${actor} se recupera (+${line.amount}).`;
    case "enemy-flee":
      return `${actor} foge da luta.`;
    case "victory":
      return line.amount ? `Vitória! +${line.amount} de experiência.` : "Vitória!";
    case "defeat":
      return "Você foi derrotado.";
    case "single":
      return line.amount ? `${actor} te fere: −${line.amount}.` : `Você vence ${target}.`;
  }
}

export function CombatLog({ lines, text }: { lines: CombatLogLine[]; text: Text }) {
  if (lines.length === 0) return null;
  return (
    <ol className="mx-4 space-y-0.5 rounded-lg border border-border bg-muted/40 p-3 text-sm" aria-label="Registro da luta">
      {lines.map((line, index) => (
        <li key={index} className={cn(line.target?.["pt-BR"] === "Você" ? "text-destructive" : "text-foreground", line.kind === "victory" && "font-semibold text-primary")}>
          <span className="me-1 text-xs tabular-nums text-muted-foreground">{line.round}.</span>
          {describeCombatLine(line, text)}
        </li>
      ))}
    </ol>
  );
}
