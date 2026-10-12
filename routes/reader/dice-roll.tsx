"use client";

import { useEffect, useState } from "react";
import { cn } from "@venore/plugin-sdk/ui";
import type { LocalizedText } from "../../contracts/types";
import type { RollView } from "../../shared/engine/types";

// Dado animado (seção 11.2 do documento): ~1 s girando com números trocando, depois o
// detalhamento "14 (d20) + 3 (Destreza) = 17 contra 15 → Sucesso". Com movimento reduzido no
// sistema, mostra o resultado direto.

const ROLL_MS = 1000;
const TICK_MS = 70;

const OUTCOME_TEXT: Record<NonNullable<RollView["outcome"]>, string> = {
  success: "Sucesso",
  failure: "Falha",
  critical: "Crítico!",
  fumble: "Falha crítica",
  band: "",
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

// Forma do dado pelo número de lados: d6 quadrado, d4 triângulo, d20/d12/d10/d8 poliedros.
const SHAPES: Record<number, string> = {
  4: "[clip-path:polygon(50%_4%,96%_92%,4%_92%)]",
  8: "[clip-path:polygon(50%_2%,98%_50%,50%_98%,2%_50%)]",
  10: "[clip-path:polygon(50%_2%,96%_38%,80%_96%,20%_96%,4%_38%)]",
  12: "[clip-path:polygon(50%_2%,94%_30%,94%_70%,50%_98%,6%_70%,6%_30%)]",
  20: "[clip-path:polygon(50%_2%,96%_26%,96%_74%,50%_98%,4%_74%,4%_26%)]",
};

function Die({ sides, value, rolling, kept }: { sides: number; value: number; rolling: boolean; kept: boolean }) {
  const shape = SHAPES[sides] ?? "rounded-xl";
  return (
    <span className={cn("relative inline-flex size-14 shrink-0 items-center justify-center", rolling && "motion-safe:animate-spin")} style={rolling ? { animationDuration: "450ms" } : undefined}>
      <span className={cn("absolute inset-0", kept ? "bg-primary" : "bg-muted", shape === "rounded-xl" ? "rounded-xl" : shape)} aria-hidden />
      <span className={cn("relative text-lg font-bold tabular-nums", kept ? "text-primary-foreground" : "text-muted-foreground line-through")}>{value}</span>
      <span className="absolute -bottom-4 text-[0.65rem] text-muted-foreground">d{sides}</span>
    </span>
  );
}

export function DiceRoll({ roll, animate, text }: { roll: RollView; animate: boolean; text: (value: LocalizedText) => string }) {
  const dice = roll.dice.flatMap((group) => {
    const remaining = [...group.kept];
    return group.rolls.map((value) => {
      const at = remaining.indexOf(value);
      if (at >= 0) remaining.splice(at, 1);
      return { sides: group.sides, value, kept: at >= 0 };
    });
  });
  const [rolling, setRolling] = useState(() => animate && !prefersReducedMotion() && dice.length > 0);
  const [faces, setFaces] = useState<number[]>(() => dice.map((die) => die.value));

  useEffect(() => {
    if (!rolling) return;
    const sides = dice.map((die) => die.sides);
    const timer = setInterval(() => setFaces(sides.map((count) => 1 + Math.floor(Math.random() * count))), TICK_MS);
    const stop = setTimeout(() => {
      clearInterval(timer);
      setFaces(dice.map((die) => die.value));
      setRolling(false);
    }, ROLL_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
    // Só na montagem: cada rolagem nova é um componente novo (key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keptSum = roll.dice.reduce((sum, group) => sum + group.kept.reduce((total, value) => total + value, 0), 0);
  const bonus = Math.round((roll.total - keptSum) * 100) / 100;
  const label = text(roll.label);
  const detail = [
    roll.dice.map((group) => `${group.kept.join(" + ")} (${group.rolls.length > 1 ? `${group.rolls.length}d${group.sides}` : `d${group.sides}`})`).join(" + "),
    bonus !== 0 ? `${bonus > 0 ? "+" : "−"} ${formatNumber(Math.abs(bonus))}${label ? ` (${label})` : ""}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const good = roll.outcome === "success" || roll.outcome === "critical";

  return (
    <div className="mx-4 space-y-3 rounded-xl border border-border bg-card p-3" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3 pb-3">
        {faces.map((value, index) => (
          <Die key={index} sides={dice[index]?.sides ?? 6} value={value} rolling={rolling} kept={rolling || (dice[index]?.kept ?? true)} />
        ))}
        {!rolling && <span className="text-2xl font-bold tabular-nums text-foreground">= {formatNumber(roll.total)}</span>}
      </div>
      {rolling ? (
        <p className="text-sm text-muted-foreground">Rolando{label ? ` ${label}` : ""}…</p>
      ) : (
        <p className="text-sm text-foreground">
          {detail ? `${detail} = ` : ""}
          <strong className="tabular-nums">{formatNumber(roll.total)}</strong>
          {roll.dc !== null && <span className="text-muted-foreground"> contra {formatNumber(roll.dc)}</span>}
          {roll.outcome && OUTCOME_TEXT[roll.outcome] && (
            <>
              {" → "}
              <strong className={good ? "text-primary" : "text-destructive"}>{OUTCOME_TEXT[roll.outcome]}</strong>
            </>
          )}
        </p>
      )}
    </div>
  );
}
