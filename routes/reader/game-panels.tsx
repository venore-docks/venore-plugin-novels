"use client";

import { useState } from "react";
import { Coins, Flag, Shield, Swords, Trophy } from "lucide-react";
import { Button, cn, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@venore/plugin-sdk/ui";
import type { ShopDef } from "../../contracts/game";
import type { LocalizedText } from "../../contracts/types";
import { ACCENT_CLASSES } from "../../shared/accent";
import type { GameContext } from "../../shared/engine/context";
import { evaluateNumber, num } from "../../shared/engine/formula";
import { currency } from "../../shared/engine/play";
import { conditionsMet, playerScope } from "../../shared/engine/rules";
import { sceneExcerpt } from "../../shared/scene-blocks";
import type { GameState, PlayAction, Stack } from "../../shared/engine/types";
import { GameImage } from "../../components/game-image";
import { exploredPercent, readerAchievements, totalsOf, type ReaderStats } from "../../shared/reader-stats";
import type { ReaderStrings } from "./strings";
import { describeChange, formatNumber, type Text } from "./game-hud";

// Painéis do passo atual da partida: luta, loja, itens sobrando; e os diálogos de histórico e
// salvamentos.

export function CombatPanel({ ctx, state, mode, text, act, busy, strings }: { ctx: GameContext; state: GameState; mode: "rounds" | "single"; text: Text; act: (action: PlayAction) => void; busy: boolean; strings: ReaderStrings }) {
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
        {mode === "single" ? strings.fight : `${strings.round} ${combat.round}`}
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
                <GameImage url={image} name={text(creature?.name)} className="size-12 shrink-0" compact />
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
          {strings.fight}
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
              {strings.defend}
            </Button>
          )}
          {ctx.system.combat.flee.enabled && encounter?.fleeSceneId && (
            <Button variant="outline" disabled={busy} onClick={() => act({ t: "combat", action: "flee" })}>
              <Flag className="size-4" />
              {strings.flee}
            </Button>
          )}
          {consumables.map((item) => (
            <Button key={item!.id} variant="ghost" disabled={busy} onClick={() => act({ t: "combat", action: "item", itemId: item!.id })}>
              {strings.use} {text(item!.name)}
            </Button>
          ))}
          {ctx.system.combat.equipInCombat &&
            state.bag
              .map((stack) => ctx.items.get(stack.itemId))
              .filter((item) => item && (item.slot || item.hands > 0))
              .map((item) => (
                <Button key={`equip-${item!.id}`} variant="ghost" disabled={busy} onClick={() => act({ t: "equip", itemId: item!.id })}>
                  {strings.equip} {text(item!.name)}
                </Button>
              ))}
        </div>
      )}
    </div>
  );
}

export function ShopPanel({ ctx, state, shop, text, act, busy, strings }: { ctx: GameContext; state: GameState; shop: ShopDef; text: Text; act: (action: PlayAction) => void; busy: boolean; strings: ReaderStrings }) {
  const money = currency(ctx, state);
  const stockOf = (itemId: string, initial: number | null) => state.shopStock[state.sceneId]?.[itemId] ?? initial;
  const sellable = state.bag.map((stack) => ctx.items.get(stack.itemId)).filter((item) => item && item.value > 0 && item.droppable);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <p className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
        <span className="flex items-center gap-2">
          <Coins className="size-4" aria-hidden />
          {strings.shop}
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
              <GameImage url={item.imageMediaId ? ctx.story.media[item.imageMediaId] : null} name={text(item.name)} className="size-12 shrink-0" compact />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{text(item.name)}</span>
                {text(item.description) && <span className="block truncate text-xs text-muted-foreground">{text(item.description)}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {stock !== null && <span className="text-xs text-muted-foreground">{stock} {strings.inStock}</span>}
                <Button size="sm" variant="outline" disabled={busy || money < entry.price || stock === 0} onClick={() => act({ t: "buy", itemId: item.id })}>
                  {strings.buy} · {formatNumber(entry.price)}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      {sellable.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{strings.sell}</summary>
          <ul className="mt-2 space-y-1">
            {sellable.map((item) => (
              <li key={item!.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground">{text(item!.name)}</span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ t: "sell", itemId: item!.id })}>
                  {strings.sell} · {formatNumber(Math.floor(item!.value * shop.sellRate))}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function OverflowPanel({ ctx, stacks, text, act, openBag, busy, strings }: { ctx: GameContext; stacks: Stack[]; text: Text; act: (action: PlayAction) => void; openBag: () => void; busy: boolean; strings: ReaderStrings }) {
  return (
    <div className="space-y-3 rounded-xl border border-destructive/40 bg-card p-3">
      <p className="text-sm font-semibold text-foreground">{strings.overflowTitle}</p>
      <p className="text-sm text-muted-foreground">
        Não coube: {stacks.map((stack) => `${text(ctx.items.get(stack.itemId)?.name)}${stack.quantity > 1 ? ` ×${stack.quantity}` : ""}`).join(", ")}. Largue, use ou equipe algo para abrir espaço, ou deixe para trás.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={openBag}>{strings.openBag}</Button>
        <Button variant="outline" disabled={busy} onClick={() => act({ t: "discard" })}>
          {strings.leaveBehind}
        </Button>
      </div>
    </div>
  );
}

export function HistoryDialog({ ctx, state, text, locale, open, onOpenChange, strings }: { ctx: GameContext; state: GameState; text: Text; locale: string; open: boolean; onOpenChange: (open: boolean) => void; strings: ReaderStrings }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{strings.history}</DialogTitle>
          <DialogDescription>{strings.historyHint}</DialogDescription>
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

// Desempenho do leitor com conta na obra: jornadas concluídas, quanto explorou, finais e as
// conquistas (as do Graphic Novels e as que o autor definiu).
export function ReaderAchievementsPanel({ ctx, stats, text, strings }: { ctx: GameContext; stats: ReaderStats; text: Text; strings: ReaderStrings }) {
  const story = ctx.story;
  const totals = totalsOf(story);
  const explored = exploredPercent(stats, totals);
  const endings = totals.endingIds.filter((id) => stats.endingsSeen.includes(id)).length;
  const badges = [
    ...readerAchievements(stats, totals),
    ...[...ctx.achievements.values()]
      .map((def) => ({ id: `obra:${def.id}`, name: def.name, description: def.description, unlocked: stats.achievements.includes(def.id), hidden: def.hidden }))
      .filter((entry) => entry.unlocked || !entry.hidden),
  ];
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={strings.achievementsLabel}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{stats.completions}</p>
          <p className="text-xs text-muted-foreground">{strings.journeys}</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{explored}%</p>
          <p className="text-xs text-muted-foreground">{strings.explored}</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {endings}/{totals.endingIds.length}
          </p>
          <p className="text-xs text-muted-foreground">{strings.endings}</p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-label={strings.explored} aria-valuemin={0} aria-valuemax={100} aria-valuenow={explored}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${explored}%` }} />
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {badges.map((badge) => (
          <li
            key={badge.id}
            title={text(badge.description)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              badge.unlocked ? "border-chart-4 bg-chart-4/10 text-chart-4" : "border-border text-muted-foreground/56",
            )}
          >
            <Trophy className="size-3.5" aria-hidden />
            {text(badge.name)}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Tela de subir de nível (opcional, texto do autor com {nivel}).
export function LevelUpDialog({ level, message, text, strings, onClose, onDistribute }: { level: number; message: LocalizedText; text: Text; strings: ReaderStrings; onClose: () => void; onDistribute: (() => void) | null }) {
  const body = text(message).replaceAll("{nivel}", String(level)).replaceAll("{level}", String(level));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="text-center">
        <DialogHeader>
          <DialogTitle className="text-3xl">
            {strings.levelUp} {level}!
          </DialogTitle>
          <DialogDescription className="whitespace-pre-line text-base">{body}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-2">
          {onDistribute && <Button onClick={onDistribute}>{strings.distribute}</Button>}
          <Button variant="outline" onClick={onClose}>
            {strings.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
