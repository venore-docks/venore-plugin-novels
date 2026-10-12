"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button, Input, Switch, cn } from "@venore/plugin-sdk/ui";
import type { GameContext } from "../../shared/engine/context";
import { num } from "../../shared/engine/formula";
import { newGame } from "../../shared/engine/play";
import { pointCost } from "../../shared/engine/rules";
import type { PlayAction } from "../../shared/engine/types";
import type { Text } from "./game-hud";

type StartAction = Extract<PlayAction, { t: "start" }>;

// Criação de personagem (seção 13; decisão 3 do documento): ficha (nome, sexo e o que o autor
// definir), vocação com valores e itens iniciais, pontos com o mesmo custo crescente do nível e,
// se a obra oferecer, o modo hardcore.
export function CharacterCreation({ ctx, text, onStart, busy }: { ctx: GameContext; text: Text; onStart: (start: StartAction) => void; busy: boolean }) {
  const character = ctx.system.character;
  const usesCharacter = ctx.on("character");
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [vocationId, setVocationId] = useState<string | null>(character.vocations[0]?.id ?? null);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [hardcore, setHardcore] = useState(false);
  const stats = [...ctx.attributes.values()].filter((attribute) => attribute.kind === "stat");

  // Prévia pelo próprio motor: mesmos custos e tetos da partida de verdade.
  const preview = useMemo(() => {
    const base = newGame(ctx, { seed: "preview", start: { t: "start", vocationId } });
    const full = newGame(ctx, { seed: "preview", start: { t: "start", vocationId, allocations } });
    if (!base.ok || !full.ok) return null;
    let spent = 0;
    for (const attribute of stats) {
      for (let value = num(base.state.vars[attribute.key]); value < num(full.state.vars[attribute.key]); value += 1) spent += pointCost(ctx, value);
    }
    return { base: base.state.vars, values: full.state.vars, spent };
  }, [ctx, vocationId, allocations, stats]);
  const left = character.startingPoints - (preview?.spent ?? 0);

  const fields = usesCharacter ? character.fields : [];
  const missingName = fields.some((field) => field.kind === "text" && field.key === "nome" && !profile.nome?.trim());

  return (
    <form
      className="space-y-5 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onStart({ t: "start", profile, vocationId, allocations, hardcore });
      }}
    >
      {usesCharacter && <h2 className="text-lg font-semibold text-foreground">Seu personagem</h2>}
      {fields.map((field) =>
        field.kind === "choice" ? (
          <fieldset key={field.key} className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">{text(field.name)}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {field.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={profile[field.key] === option.value}
                  onClick={() => setProfile({ ...profile, [field.key]: option.value })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    profile[field.key] === option.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  {text(option.name)}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <label key={field.key} className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">{text(field.name)}</span>
            <Input value={profile[field.key] ?? ""} maxLength={40} placeholder={field.fallback} onChange={(event) => setProfile({ ...profile, [field.key]: event.target.value })} />
          </label>
        ),
      )}

      {usesCharacter && character.vocations.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Vocação</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {character.vocations.map((vocation) => (
              <button
                key={vocation.id}
                type="button"
                aria-pressed={vocationId === vocation.id}
                onClick={() => {
                  setVocationId(vocation.id);
                  setAllocations({});
                }}
                className={cn("space-y-1 rounded-lg border p-3 text-start", vocationId === vocation.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}
              >
                <span className="block font-medium text-foreground">{text(vocation.name)}</span>
                {text(vocation.description) && <span className="block text-xs text-muted-foreground">{text(vocation.description)}</span>}
                {vocation.items.length > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    Começa com: {vocation.items.map((entry) => `${text(ctx.items.get(entry.itemId)?.name)}${entry.quantity > 1 ? ` ×${entry.quantity}` : ""}`).join(", ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {usesCharacter && character.startingPoints > 0 && stats.length > 0 && preview && (
        <fieldset className="space-y-2">
          <legend className="flex w-full items-baseline justify-between text-sm font-medium text-foreground">
            Distribua seus pontos
            <span className={cn("tabular-nums", left > 0 ? "text-primary" : "text-muted-foreground")}>{left} sobrando</span>
          </legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {stats.map((attribute) => {
              const value = num(preview.values[attribute.key]);
              const added = value - num(preview.base[attribute.key]);
              const cost = pointCost(ctx, value);
              return (
                <li key={attribute.key} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{text(attribute.name)}</span>
                    <span className="block text-xs text-muted-foreground">próximo ponto custa {cost}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="outline" className="size-7" aria-label={`Tirar ponto de ${text(attribute.name)}`} disabled={added <= 0} onClick={() => setAllocations({ ...allocations, [attribute.key]: Math.max(0, added - 1) })}>
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center font-semibold tabular-nums text-foreground">{value}</span>
                    <Button type="button" size="icon" variant="outline" className="size-7" aria-label={`Pôr ponto em ${text(attribute.name)}`} disabled={cost > left} onClick={() => setAllocations({ ...allocations, [attribute.key]: added + 1 })}>
                      <Plus className="size-3.5" />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {ctx.system.hardcore && (
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <Switch checked={hardcore} onCheckedChange={setHardcore} aria-label="Modo hardcore" />
          <span>
            <span className="block font-medium text-foreground">Modo hardcore</span>
            <span className="block text-xs text-muted-foreground">Sem voltar cena, sem rolar de novo e com um único salvamento.</span>
          </span>
        </label>
      )}

      <Button type="submit" className="w-full" disabled={busy || missingName}>
        Começar
      </Button>
    </form>
  );
}
