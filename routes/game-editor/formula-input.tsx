"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Input, cn } from "@venore/plugin-sdk/ui";
import { contextFromParts } from "../../shared/engine/context";
import { evaluateFormula } from "../../shared/engine/formula";
import { sampleState } from "../../shared/engine/play";
import { playerScope } from "../../shared/engine/rules";
import { formulaChecker } from "../../shared/engine/validate";
import { COMBAT_EXTRA, combatNames, formulaNames, FUNCTION_HINTS, type GameCatalog } from "./catalog";

const WORD = /[\p{L}\p{N}_.]+$/u;

function formatPreview(value: number | boolean | string): string {
  if (typeof value === "boolean") return value ? "verdadeiro" : "falso";
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  return `"${value}"`;
}

// Campo de fórmula (seção 8.2 do documento): erro na hora ("forsa não existe"), autocompletar das
// chaves e funções e o resultado com o estado inicial da partida (dado vale a média).
export function FormulaInput({
  value,
  onChange,
  catalog,
  combat = false,
  extraNames = [],
  allowEmpty = false,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  catalog: GameCatalog;
  // Fórmula de combate: aceita dado, atacante.<chave> e defensor.<chave>.
  combat?: boolean;
  extraNames?: string[];
  allowEmpty?: boolean;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);

  const check = useMemo(() => formulaChecker({ system: catalog.system, variables: catalog.variables }), [catalog.system, catalog.variables]);
  const preview = useMemo(() => {
    const ctx = contextFromParts({ system: catalog.system, variables: catalog.variables, items: catalog.items, locale: catalog.locale });
    return { ctx, state: sampleState(ctx) };
  }, [catalog.system, catalog.variables, catalog.items, catalog.locale]);
  const extra = useMemo(() => [...extraNames, ...(combat ? COMBAT_EXTRA : [])], [extraNames, combat]);
  const vocabulary = useMemo(
    () => [...formulaNames(catalog), ...(combat ? combatNames(catalog) : []), ...extraNames.filter((name) => !name.endsWith(".")).map((name) => ({ name, hint: "" })), ...FUNCTION_HINTS],
    [catalog, combat, extraNames],
  );

  const problem = value.trim() || !allowEmpty ? check(value, extra, allowEmpty) : null;
  let result: string | null = null;
  if (!problem && value.trim() && !/(atacante|defensor|alvo)\.|\bdado\b|\bvalor\b|\bn\b/.test(value)) {
    try {
      result = formatPreview(evaluateFormula(value, playerScope(preview.ctx, preview.state)));
    } catch {
      result = null;
    }
  }

  const word = focused ? (WORD.exec(value.slice(0, caret))?.[0] ?? "") : "";
  const suggestions =
    word.length > 0 && !/^\d/.test(word)
      ? vocabulary.filter((entry) => entry.name.startsWith(word) && entry.name !== word).slice(0, 8)
      : [];

  function accept(index: number) {
    const entry = suggestions[index];
    if (!entry) return;
    const isFunction = FUNCTION_HINTS.some((fn) => fn.name === entry.name);
    const before = value.slice(0, caret - word.length);
    const insert = isFunction ? `${entry.name}(` : entry.name;
    const next = before + insert + value.slice(caret);
    onChange(next);
    const position = before.length + insert.length;
    setCaret(position);
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(position, position));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current + (event.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      accept(Math.min(active, suggestions.length - 1));
    } else if (event.key === "Escape") {
      setFocused(false);
    }
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        ref={inputRef}
        value={value}
        aria-label={ariaLabel}
        aria-invalid={problem ? true : undefined}
        aria-autocomplete="list"
        aria-controls={suggestions.length > 0 ? listId : undefined}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        maxLength={500}
        className={cn("font-mono text-sm", problem && "border-destructive")}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart ?? event.target.value.length);
          setActive(0);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={onKeyDown}
      />
      {suggestions.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {suggestions.map((entry, index) => (
            <li key={entry.name} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  accept(index);
                }}
                className={cn(
                  "flex w-full items-baseline justify-between gap-2 rounded px-2 py-1 text-left text-sm",
                  index === active ? "bg-accent/14 text-foreground" : "text-foreground hover:bg-muted",
                )}
              >
                <span className="font-mono">{entry.name}</span>
                <span className="truncate text-xs text-muted-foreground">{entry.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem ? (
        <p className="mt-1 text-xs text-destructive">{problem}</p>
      ) : result !== null ? (
        <p className="mt-1 text-xs text-muted-foreground">= {result} no início da partida</p>
      ) : null}
    </div>
  );
}
