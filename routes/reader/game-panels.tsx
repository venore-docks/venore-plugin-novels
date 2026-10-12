"use client";

import { useEffect, useState, useTransition } from "react";
import { Coins, Flag, Shield, Swords } from "lucide-react";
import { toast } from "sonner";
import { Button, cn, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input } from "@venore/plugin-sdk/ui";
import type { ShopDef } from "../../contracts/game";
import type { ReaderSaveSlot } from "../../features/reading/manage-reader-saves/types";
import { ACCENT_CLASSES } from "../../shared/accent";
import type { GameContext } from "../../shared/engine/context";
import { evaluateNumber, num } from "../../shared/engine/formula";
import { currency, toSaved } from "../../shared/engine/play";
import { conditionsMet, playerScope } from "../../shared/engine/rules";
import { sceneExcerpt } from "../../shared/scene-blocks";
import type { GameState, PlayAction, SavedGame, Stack } from "../../shared/engine/types";
import { deleteReaderSlotAction, listReaderSavesAction, loadReaderSlotAction, saveReaderSlotAction } from "./actions";
import { describeChange, formatNumber, type Text } from "./game-hud";

// Painéis do passo atual da partida: luta, loja, itens sobrando; e os diálogos de histórico e
// salvamentos.

export function CombatPanel({ ctx, state, mode, text, act, busy }: { ctx: GameContext; state: GameState; mode: "rounds" | "single"; text: Text; act: (action: PlayAction) => void; busy: boolean }) {
  const combat = state.combat!;
  const scene = ctx.scenes.get(state.sceneId);
  const encounter = scene?.mechanics.encounter;
  const scope = playerScope(ctx, state);
  const consumables = state.bag.map((stack) => ctx.items.get(stack.itemId)).filter((item) => item && item.useEffects.length > 0);
  const [target, setTarget] = useState(0);
  const alive = combat.creatures.map((creature, index) => ({ creature, index })).filter(({ creature }) => creature.hp > 0 && !creature.fled);
  const selected = alive.some((entry) => entry.index === target) ? target : (alive[0]?.index ?? 0);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Swords className="size-4" aria-hidden />
        {mode === "single" ? "Luta" : `Rodada ${combat.round}`}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {combat.creatures.map((creatureState, index) => {
          const creature = ctx.creatures.get(creatureState.creatureId);
          const down = creatureState.hp <= 0 || creatureState.fled;
          const image = creature?.imageMediaId ? ctx.story.media[creature.imageMediaId] : null;
          return (
            <li key={index}>
              <button
                type="button"
                disabled={down || alive.length < 2}
                aria-pressed={selected === index}
                onClick={() => setTarget(index)}
                className={cn("flex w-full items-center gap-2 rounded-lg border p-2 text-start", selected === index && alive.length > 1 ? "border-primary" : "border-border", down && "opacity-50")}
              >
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="size-10 rounded-md object-cover" />
                )}
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-baseline justify-between gap-1 text-sm">
                    <span className="truncate font-medium text-foreground">{text(creature?.name)}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {creatureState.fled ? "fugiu" : `${Math.max(0, creatureState.hp)}/${creatureState.maxHp}`}
                    </span>
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full bg-destructive ui-motion-base" style={{ width: `${Math.max(0, Math.min(100, (creatureState.hp / creatureState.maxHp) * 100))}%` }} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {mode === "single" ? (
        <Button className="w-full" disabled={busy} onClick={() => act({ t: "combat", action: "single" })}>
          <Swords className="size-4" />
          Lutar
        </Button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {ctx.system.combat.actions
            .filter((action) => conditionsMet(ctx, state, action.requires))
            .map((action) => {
              const costs = action.cost.map((cost) => ({ resource: ctx.resources.get(cost.resource), amount: evaluateNumber(cost.amount, scope, 0) }));
              const short = costs.some((cost) => cost.resource && num(state.vars[cost.resource.key]) < cost.amount);
              return (
                <Button key={action.key} variant="outline" className="h-auto justify-between whitespace-normal py-2" disabled={busy || short} onClick={() => act({ t: "combat", action: action.key, target: selected })}>
                  <span>{text(action.name)}</span>
                  {costs.map((cost) =>
                    cost.resource ? (
                      <span key={cost.resource.key} className={cn("text-xs", ACCENT_CLASSES[cost.resource.color].text)}>
                        {formatNumber(cost.amount)} {text(cost.resource.abbr) || text(cost.resource.name)}
                      </span>
                    ) : null,
                  )}
                </Button>
              );
            })}
          {ctx.system.combat.defend.enabled && (
            <Button variant="outline" disabled={busy} onClick={() => act({ t: "combat", action: "defend" })}>
              <Shield className="size-4" />
              Defender
            </Button>
          )}
          {ctx.system.combat.flee.enabled && encounter?.fleeSceneId && (
            <Button variant="outline" disabled={busy} onClick={() => act({ t: "combat", action: "flee" })}>
              <Flag className="size-4" />
              Fugir
            </Button>
          )}
          {consumables.map((item) => (
            <Button key={item!.id} variant="ghost" disabled={busy} onClick={() => act({ t: "combat", action: "item", itemId: item!.id })}>
              Usar {text(item!.name)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ShopPanel({ ctx, state, shop, text, act, busy }: { ctx: GameContext; state: GameState; shop: ShopDef; text: Text; act: (action: PlayAction) => void; busy: boolean }) {
  const money = currency(ctx, state);
  const stockOf = (itemId: string, initial: number | null) => state.shopStock[state.sceneId]?.[itemId] ?? initial;
  const sellable = state.bag.map((stack) => ctx.items.get(stack.itemId)).filter((item) => item && item.value > 0 && item.droppable);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <p className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
        <span className="flex items-center gap-2">
          <Coins className="size-4" aria-hidden />
          Loja
        </span>
        <span className="tabular-nums text-muted-foreground">
          {text(ctx.system.currency.name)}: {formatNumber(money)}
        </span>
      </p>
      <ul className="space-y-1">
        {shop.items.map((entry) => {
          const item = ctx.items.get(entry.itemId);
          if (!item) return null;
          const stock = stockOf(item.id, entry.stock);
          return (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{text(item.name)}</span>
                {text(item.description) && <span className="block truncate text-xs text-muted-foreground">{text(item.description)}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {stock !== null && <span className="text-xs text-muted-foreground">{stock} no estoque</span>}
                <Button size="sm" variant="outline" disabled={busy || money < entry.price || stock === 0} onClick={() => act({ t: "buy", itemId: item.id })}>
                  Comprar · {formatNumber(entry.price)}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      {sellable.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Vender</summary>
          <ul className="mt-2 space-y-1">
            {sellable.map((item) => (
              <li key={item!.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground">{text(item!.name)}</span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ t: "sell", itemId: item!.id })}>
                  Vender · {formatNumber(Math.floor(item!.value * shop.sellRate))}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function OverflowPanel({ ctx, stacks, text, act, openBag, busy }: { ctx: GameContext; stacks: Stack[]; text: Text; act: (action: PlayAction) => void; openBag: () => void; busy: boolean }) {
  return (
    <div className="space-y-3 rounded-xl border border-destructive/40 bg-card p-3">
      <p className="text-sm font-semibold text-foreground">A bolsa está cheia</p>
      <p className="text-sm text-muted-foreground">
        Não coube: {stacks.map((stack) => `${text(ctx.items.get(stack.itemId)?.name)}${stack.quantity > 1 ? ` ×${stack.quantity}` : ""}`).join(", ")}. Largue, use ou equipe algo para abrir espaço, ou deixe para trás.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={openBag}>Abrir a mochila</Button>
        <Button variant="outline" disabled={busy} onClick={() => act({ t: "discard" })}>
          Deixar para trás
        </Button>
      </div>
    </div>
  );
}

export function HistoryDialog({ ctx, state, text, locale, open, onOpenChange }: { ctx: GameContext; state: GameState; text: Text; locale: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico da partida</DialogTitle>
          <DialogDescription>Escolhas, rolagens e mudanças, da mais recente para a primeira.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {[...state.entries].reverse().map((entry, index) => {
            const scene = ctx.scenes.get(entry.sceneId);
            const excerpt = scene ? sceneExcerpt(scene.blocks, locale, ctx.story.work.defaultLocale, 90) : "";
            return (
              <li key={index} className="space-y-1 border-s-2 border-border ps-3">
                <p className="text-sm text-foreground">{excerpt || "…"}</p>
                {entry.rolls.map((roll, rollIndex) => (
                  <p key={rollIndex} className="text-xs text-muted-foreground">
                    🎲 {text(roll.label)}: {formatNumber(roll.total)}
                    {roll.dc !== null ? ` contra ${formatNumber(roll.dc)}` : ""}
                  </p>
                ))}
                {entry.changes.length > 0 && <p className="text-xs text-muted-foreground">{entry.changes.map((change) => describeChange(change, text).text).join(" · ")}</p>}
              </li>
            );
          })}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

export function SavesDialog({
  workId,
  state,
  open,
  onOpenChange,
  onLoad,
  text,
}: {
  workId: string;
  state: GameState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (saved: SavedGame) => void;
  text: Text;
}) {
  const [slots, setSlots] = useState<ReaderSaveSlot[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [names, setNames] = useState<Record<number, string>>({});
  const refresh = () => startTransition(async () => setSlots(await listReaderSavesAction(workId)));
  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvamentos</DialogTitle>
          <DialogDescription>Até 3 por obra, na sua conta, além da partida em andamento (salva sozinha).</DialogDescription>
        </DialogHeader>
        {state.hardcore ? (
          <p className="text-sm text-muted-foreground">No modo hardcore a partida tem um salvamento só, o automático.</p>
        ) : (
          <ul className="space-y-2">
            {[1, 2, 3].map((slot) => {
              const current = slots?.find((entry) => entry.slot === slot);
              return (
                <li key={slot} className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground">
                    {current ? current.name || `Espaço ${slot}` : `Espaço ${slot} — vazio`}
                    {current && <span className="ms-2 text-xs font-normal text-muted-foreground">{text(current.chapterTitle)} · {new Date(current.updatedAt).toLocaleString("pt-BR")}</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Input className="h-8 w-40" placeholder="Nome (opcional)" value={names[slot] ?? ""} maxLength={60} onChange={(event) => setNames({ ...names, [slot]: event.target.value })} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          if (current && !window.confirm("Substituir este salvamento?")) return;
                          const result = await saveReaderSlotAction(workId, slot, names[slot] ?? current?.name ?? "", toSaved(state));
                          if (!result.ok) toast.error(result.error ?? "Não foi possível salvar.");
                          else toast.success("Partida salva.");
                          setSlots(await listReaderSavesAction(workId));
                        })
                      }
                    >
                      Salvar aqui
                    </Button>
                    {current && (
                      <>
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              if (!window.confirm("Carregar este salvamento? A partida atual é substituída.")) return;
                              const result = await loadReaderSlotAction(workId, slot);
                              if (!result.ok) toast.error(result.error);
                              else {
                                onLoad(result.saved);
                                onOpenChange(false);
                              }
                            })
                          }
                        >
                          Carregar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              if (!window.confirm("Apagar este salvamento?")) return;
                              await deleteReaderSlotAction(workId, slot);
                              setSlots(await listReaderSavesAction(workId));
                            })
                          }
                        >
                          Apagar
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
