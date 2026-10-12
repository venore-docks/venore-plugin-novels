"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@venore/plugin-sdk/ui";
import type { LocalizedText } from "../../contracts/types";
import type { RollView } from "../../shared/engine/types";
import type { ReaderStrings } from "./strings";

// Dados (seção 11.2 do documento, pedido do autor: "um dado rolando na tela"). Ao rolar, os dados
// são lançados por cima da página, quicam girando em 3D e param mostrando o resultado (estilo D&D
// Beyond); depois fica o cartão com o detalhamento "14 (d20) + 3 (Destreza) = 17 contra 15 →
// Sucesso". Com movimento reduzido no sistema, só o cartão.

const THROW_MS = 1500;
const HOLD_MS = 900;

const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const format = (value: number) => NUMBER.format(value);

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

type Die = { sides: number; value: number; kept: boolean };

function diceOf(roll: RollView): Die[] {
  return roll.dice.flatMap((group) => {
    const remaining = [...group.kept];
    return group.rolls.map((value) => {
      const at = remaining.indexOf(value);
      if (at >= 0) remaining.splice(at, 1);
      return { sides: group.sides, value, kept: at >= 0 };
    });
  });
}

function outcomeText(roll: RollView, strings: ReaderStrings): string {
  switch (roll.outcome) {
    case "success":
      return strings.success;
    case "failure":
      return strings.failure;
    case "critical":
      return strings.critical;
    case "fumble":
      return strings.fumble;
    default:
      return "";
  }
}

// ------------------------------------------------------------------ peças 3D

const CUBE_FACES: { value: number; transform: string }[] = [
  { value: 1, transform: "rotateY(0deg)" },
  { value: 6, transform: "rotateY(180deg)" },
  { value: 3, transform: "rotateY(90deg)" },
  { value: 4, transform: "rotateY(-90deg)" },
  { value: 5, transform: "rotateX(90deg)" },
  { value: 2, transform: "rotateX(-90deg)" },
];

function Cube({ value, size }: { value: number; size: number }) {
  const half = size / 2;
  return (
    <span className="relative block" style={{ width: size, height: size, transformStyle: "preserve-3d" }} data-die-body>
      {CUBE_FACES.map((face) => (
        <span
          key={face.value}
          className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-primary-foreground/30 bg-primary text-2xl font-bold text-primary-foreground shadow-inner"
          style={{ transform: `${face.transform} translateZ(${half}px)`, backfaceVisibility: "hidden" }}
        >
          {face.value === 1 ? value : ((value + face.value) % 6) + 1}
        </span>
      ))}
    </span>
  );
}

// Poliedro visto de frente: polígono externo com facetas sombreadas e, no d20, o triângulo central.
const POLY: Record<number, number> = { 4: 3, 8: 4, 10: 5, 12: 5, 20: 6, 100: 5 };

function Gem({ sides, label, size }: { sides: number; label: string; size: number }) {
  const n = POLY[sides] ?? 6;
  const r = 46;
  const offset = n === 4 ? 0 : -Math.PI / 2;
  const points = Array.from({ length: n }, (_, index) => {
    const angle = offset + (index * 2 * Math.PI) / n;
    return [50 + r * Math.cos(angle), 50 + r * Math.sin(angle)] as const;
  });
  const inner = sides === 20 ? [0, 1, 2].map((index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 3;
    return [50 + 24 * Math.cos(angle), 52 + 24 * Math.sin(angle)] as const;
  }) : null;
  const shades = ["opacity-100", "opacity-80", "opacity-90", "opacity-70", "opacity-95", "opacity-75"];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} data-die-body className="drop-shadow-lg">
      {points.map((point, index) => {
        const next = points[(index + 1) % n];
        return <polygon key={index} points={`50,52 ${point[0]},${point[1]} ${next[0]},${next[1]}`} className={cn("fill-primary stroke-primary-foreground/40", shades[index % shades.length])} strokeWidth={1} />;
      })}
      {inner && <polygon points={inner.map((point) => point.join(",")).join(" ")} className="fill-primary stroke-primary-foreground/60" strokeWidth={1.2} />}
      <text x="50" y="58" textAnchor="middle" className="fill-primary-foreground text-[22px] font-bold" style={{ fontSize: label.length > 2 ? 18 : 24 }}>
        {label}
      </text>
    </svg>
  );
}

function ThrownDie({ die, index, count, onLanded }: { die: Die; index: number; count: number; onLanded: () => void }) {
  const wrapper = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const [face, setFace] = useState(die.value);
  const [landed, setLanded] = useState(false);
  const size = count > 3 ? 56 : 76;
  const spread = (index - (count - 1) / 2) * (size + 20);

  useEffect(() => {
    const delay = index * 90;
    const travel = wrapper.current?.animate(
      [
        { transform: `translate(${-55 + spread / 10}vw, 45vh) scale(0.7)`, opacity: 0 },
        { transform: `translate(${-18 + spread / 20}vw, -14vh) scale(1.05)`, opacity: 1, offset: 0.32 },
        { transform: `translate(${spread / 2 + 40}px, 8vh) scale(0.95)`, offset: 0.55 },
        { transform: `translate(${spread - 12}px, -3vh) scale(1.02)`, offset: 0.75 },
        { transform: `translate(${spread}px, 0) scale(1)`, opacity: 1 },
      ],
      { duration: THROW_MS, delay, easing: "cubic-bezier(.25,.8,.35,1)", fill: "both" },
    );
    // A face da frente mostra o resultado: o giro sempre termina de frente.
    const [finalX, finalY] = [0, 0];
    const spin = (body.current?.firstElementChild as HTMLElement | null)?.animate(
      [
        { transform: `rotateX(${720 + index * 90}deg) rotateY(${540 - index * 60}deg) rotateZ(${200}deg)` },
        { transform: `rotateX(${finalX + 25}deg) rotateY(${finalY - 20}deg) rotateZ(-8deg)`, offset: 0.8 },
        { transform: `rotateX(${finalX}deg) rotateY(${finalY}deg) rotateZ(0deg)` },
      ],
      { duration: THROW_MS, delay, easing: "cubic-bezier(.2,.75,.3,1)", fill: "both" },
    );
    // Número trocando enquanto gira (no cubo, só a face da frente muda no fim).
    const flicker = die.sides === 6 ? null : setInterval(() => setFace(1 + Math.floor(Math.random() * die.sides)), 80);
    const stop = setTimeout(() => {
      if (flicker) clearInterval(flicker);
      setFace(die.value);
      setLanded(true);
      onLanded();
    }, THROW_MS + delay);
    return () => {
      travel?.cancel();
      spin?.cancel();
      if (flicker) clearInterval(flicker);
      clearTimeout(stop);
    };
    // Só na montagem: cada lançamento é um componente novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span ref={wrapper} className="absolute flex flex-col items-center" style={{ opacity: 0 }}>
      <span ref={body} className={cn("block transition-transform", landed && !die.kept && "opacity-50")} style={{ perspective: 600 }}>
        {die.sides === 6 ? <Cube value={die.value} size={size} /> : <Gem sides={die.sides} label={String(face)} size={size} />}
      </span>
      <span className="mt-3 h-2 w-12 rounded-full bg-foreground/15 blur-sm" aria-hidden />
    </span>
  );
}

// Lançamento por cima da página: só visual (aria-hidden); o cartão abaixo é o que se lê.
export function DiceThrow({ roll, text, strings, onDone }: { roll: RollView; text: (value: LocalizedText) => string; strings: ReaderStrings; onDone: () => void }) {
  const dice = diceOf(roll).slice(0, 8);
  const [landed, setLanded] = useState(0);
  const done = landed >= dice.length;

  useEffect(() => {
    if (dice.length === 0 || prefersReducedMotion()) {
      onDone();
      return;
    }
    if (!done) return;
    const timer = setTimeout(onDone, HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (dice.length === 0) return null;
  const good = roll.outcome === "success" || roll.outcome === "critical";
  return (
    // Bloqueia a página durante o lançamento; um toque pula a animação.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm" aria-hidden onClick={onDone}>
      <div className="relative flex h-40 w-full items-center justify-center">
        {dice.map((die, index) => (
          <ThrownDie key={index} die={die} index={index} count={dice.length} onLanded={() => setLanded((current) => current + 1)} />
        ))}
      </div>
      {done && (
        <div className="absolute top-[58%] flex flex-col items-center gap-1 rounded-xl bg-card/95 px-5 py-3 shadow-lg">
          <span className="text-3xl font-bold tabular-nums text-foreground">{format(roll.total)}</span>
          <span className="text-sm text-muted-foreground">
            {text(roll.label)}
            {roll.dc !== null ? ` · ${strings.against} ${format(roll.dc)}` : ""}
          </span>
          {outcomeText(roll, strings) && <span className={cn("text-base font-semibold", good ? "text-primary" : "text-destructive")}>{outcomeText(roll, strings)}</span>}
        </div>
      )}
    </div>
  );
}

// Cartão com o resultado e o detalhamento, que fica na cena.
export function DiceRoll({ roll, text, strings }: { roll: RollView; text: (value: LocalizedText) => string; strings: ReaderStrings }) {
  const dice = diceOf(roll);
  const keptSum = roll.dice.reduce((sum, group) => sum + group.kept.reduce((total, value) => total + value, 0), 0);
  const bonus = Math.round((roll.total - keptSum) * 100) / 100;
  const label = text(roll.label);
  const detail = [
    roll.dice.map((group) => `${group.kept.join(" + ")} (${group.rolls.length > 1 ? `${group.rolls.length}d${group.sides}` : `d${group.sides}`})`).join(" + "),
    bonus !== 0 ? `${bonus > 0 ? "+" : "−"} ${format(Math.abs(bonus))}${label ? ` (${label})` : ""}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const good = roll.outcome === "success" || roll.outcome === "critical";
  const outcome = outcomeText(roll, strings);
  return (
    <div className="mx-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3" role="status">
      <span className="flex gap-1.5" aria-hidden>
        {dice.map((die, index) =>
          die.sides === 6 ? (
            <span key={index} className={cn("flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground", !die.kept && "opacity-40")}>
              {die.value}
            </span>
          ) : (
            <span key={index} className={cn(!die.kept && "opacity-40")}>
              <Gem sides={die.sides} label={String(die.value)} size={40} />
            </span>
          ),
        )}
      </span>
      <p className="min-w-0 flex-1 text-sm text-foreground">
        {detail ? `${detail} = ` : ""}
        <strong className="tabular-nums">{format(roll.total)}</strong>
        {roll.dc !== null && (
          <span className="text-muted-foreground">
            {" "}
            {strings.against} {format(roll.dc)}
          </span>
        )}
        {outcome && (
          <>
            {" → "}
            <strong className={good ? "text-primary" : "text-destructive"}>{outcome}</strong>
          </>
        )}
      </p>
    </div>
  );
}
