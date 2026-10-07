"use client";

import { Input } from "@venore/plugin-sdk/ui";
import type { VariableDefinition, VariableDisplay } from "../../contracts/types";

const SELECT_CLASS = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";

const DISPLAY_LABELS: Record<VariableDisplay, string> = {
  hidden: "Não mostrar ao leitor",
  status: "Status (HP, mana, nível)",
  skill: "Habilidade",
  inventory: "Item do inventário",
};

const numberOrUndefined = (raw: string) => (raw.trim() === "" || !Number.isFinite(Number(raw)) ? undefined : Number(raw));

// Segunda linha de cada variável: onde ela aparece para o leitor e os limites. Número com máximo
// vira barra no painel (HP 80/100); o máximo pode ser outra variável (hp_max, que sobe de nível).
// Item do inventário tem peso por unidade; uma variável numérica pode ser a capacidade (cap).
export function VariableDisplayFields({
  variable,
  others,
  onChange,
}: {
  variable: VariableDefinition;
  others: VariableDefinition[];
  onChange: (patch: Partial<VariableDefinition>) => void;
}) {
  const display = variable.display ?? "hidden";
  const numeric = variable.type === "number";
  return (
    <div className="space-y-2">
      <select
        aria-label="Mostrar ao leitor"
        value={display}
        onChange={(event) => onChange({ display: event.target.value as VariableDisplay })}
        className={`${SELECT_CLASS} w-full`}
      >
        {(Object.keys(DISPLAY_LABELS) as VariableDisplay[]).map((option) => (
          <option key={option} value={option}>
            {DISPLAY_LABELS[option]}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {numeric && (
          <>
            <span>mín</span>
            <Input
              aria-label="Mínimo"
              type="number"
              className="w-20"
              value={variable.min ?? ""}
              placeholder="—"
              onChange={(event) => onChange({ min: numberOrUndefined(event.target.value) })}
            />
            <span>máx</span>
            {variable.maxVariable ? null : (
              <Input
                aria-label="Máximo"
                type="number"
                className="w-20"
                value={variable.max ?? ""}
                placeholder="—"
                onChange={(event) => onChange({ max: numberOrUndefined(event.target.value) })}
              />
            )}
            {others.length > 0 && (
              <select
                aria-label="Máximo vindo de outra variável"
                value={variable.maxVariable ?? ""}
                onChange={(event) => onChange({ maxVariable: event.target.value || undefined, max: undefined })}
                className={SELECT_CLASS}
              >
                <option value="">{variable.maxVariable ? "valor fixo" : "ou variável…"}</option>
                {others.map((other) => (
                  <option key={other.key} value={other.key}>
                    {other.label || other.key}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        {display === "inventory" && (
          <>
            <span>peso</span>
            <Input
              aria-label="Peso por unidade"
              type="number"
              step="0.01"
              min={0}
              className="w-20"
              value={variable.weight ?? ""}
              placeholder="1"
              onChange={(event) => onChange({ weight: numberOrUndefined(event.target.value) })}
            />
          </>
        )}
        {numeric && display !== "inventory" && (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={variable.capacity === true}
              onChange={(event) => onChange({ capacity: event.target.checked || undefined })}
            />
            é a capacidade do inventário (cap)
          </label>
        )}
      </div>
    </div>
  );
}
