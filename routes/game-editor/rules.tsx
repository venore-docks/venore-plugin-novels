"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@venore/plugin-sdk/ui";
import type { Condition, Cost, Effect, LootEntry } from "../../contracts/game";
import type { ChoiceCondition, ConditionOperator, EffectOperation, VariableDefinition, VariableEffect, VariableValue } from "../../contracts/types";
import { derivedVariables } from "../../shared/variables";
import { name, numberTargets, SELECT_CLASS, type GameCatalog } from "./catalog";
import { FormulaInput } from "./formula-input";

// Editores de efeito, condição e custo (0.10.0+): cada linha escolhe o tipo e mostra só os campos
// dele. Item, efeito, missão e conquista vêm de listas (sem digitar chave). Tipos de módulo
// desligado não aparecem para escolher.

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: "igual a",
  neq: "diferente de",
  gt: "maior que",
  gte: "maior ou igual a",
  lt: "menor que",
  lte: "menor ou igual a",
};
const OPERATION_LABELS: Record<EffectOperation, string> = { set: "definir como", add: "somar", toggle: "inverter" };

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" size="icon" variant="ghost" aria-label={label} onClick={onClick} className="shrink-0">
      <Trash2 className="size-4" />
    </Button>
  );
}

export function ItemSelect({ catalog, value, onChange, label = "Item" }: { catalog: GameCatalog; value: string; onChange: (id: string) => void; label?: string }) {
  return (
    <select aria-label={label} className={SELECT_CLASS} value={value} onChange={(event) => onChange(event.target.value)}>
      {!catalog.items.some((item) => item.id === value) && <option value={value}>{value ? "item apagado" : "Escolha o item"}</option>}
      {catalog.items.map((item) => (
        <option key={item.id} value={item.id}>
          {name(catalog, item.name, item.key)}
        </option>
      ))}
    </select>
  );
}

export function SceneSelect({
  scenes,
  value,
  onChange,
  label,
  emptyLabel,
}: {
  scenes: { id: string; label: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  emptyLabel?: string;
}) {
  return (
    <select aria-label={label} className={SELECT_CLASS} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
      {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : !value && <option value="">Escolha a cena</option>}
      {value && !scenes.some((scene) => scene.id === value) && <option value={value}>cena de outro capítulo ou apagada</option>}
      {scenes.map((scene) => (
        <option key={scene.id} value={scene.id}>
          {scene.label || "Cena sem nome"}
        </option>
      ))}
    </select>
  );
}

// ------------------------------------------------------------------ valores do formato antigo

function ValueInput({ variable, value, onChange }: { variable: VariableDefinition | undefined; value: VariableValue; onChange: (value: VariableValue) => void }) {
  if (variable?.type === "boolean") {
    return (
      <select aria-label="Valor" className={SELECT_CLASS} value={value ? "true" : "false"} onChange={(event) => onChange(event.target.value === "true")}>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  }
  return <Input aria-label="Valor" type="number" className="w-24" value={typeof value === "number" ? String(value) : "0"} onChange={(event) => onChange(Number(event.target.value) || 0)} />;
}

const defaultValueFor = (variable: VariableDefinition | undefined): VariableValue => (variable?.type === "boolean" ? true : 1);

// Variáveis + números do sistema (o formato antigo de condição/efeito também enxerga recurso e atributo).
function legacyVariables(catalog: GameCatalog, forConditions: boolean): VariableDefinition[] {
  const system = numberTargets(catalog).map((target) => ({ key: target.key, label: target.label, type: "number" as const, initial: 0 }));
  const own = forConditions ? [...catalog.variables, ...derivedVariables(catalog.variables)] : catalog.variables;
  const seen = new Set(own.map((variable) => variable.key));
  return [...own, ...system.filter((variable) => !seen.has(variable.key))];
}

// ------------------------------------------------------------------ efeitos

type EffectKind = "variable" | Extract<Effect, { kind: string }>["kind"];

const EFFECT_KINDS: { kind: EffectKind; label: string; available: (catalog: GameCatalog) => boolean }[] = [
  { kind: "variable", label: "Variável", available: (catalog) => legacyVariables(catalog, false).length > 0 },
  { kind: "formula", label: "Mudar número (fórmula)", available: (catalog) => numberTargets(catalog).length > 0 },
  { kind: "restore", label: "Encher recurso", available: (catalog) => catalog.system.modules.resources && catalog.system.resources.length > 0 },
  { kind: "item", label: "Dar ou tirar item", available: (catalog) => catalog.system.modules.inventory && catalog.items.length > 0 },
  { kind: "equip", label: "Equipar à força", available: (catalog) => catalog.system.modules.equipment && catalog.items.length > 0 },
  { kind: "unequip", label: "Desequipar à força", available: (catalog) => catalog.system.modules.equipment && catalog.items.length > 0 },
  { kind: "loot", label: "Item aleatório (saque)", available: (catalog) => catalog.system.modules.inventory && catalog.items.length > 0 },
  { kind: "xp", label: "Dar experiência", available: (catalog) => catalog.system.modules.progression },
  { kind: "status", label: "Efeito com duração", available: (catalog) => catalog.system.modules.effects && catalog.system.statusEffects.length > 0 },
  { kind: "quest", label: "Missão", available: (catalog) => catalog.system.modules.quests && catalog.system.quests.length > 0 },
  { kind: "achievement", label: "Conquista", available: (catalog) => catalog.system.modules.achievements && catalog.system.achievements.length > 0 },
];

function newEffect(kind: EffectKind, catalog: GameCatalog): Effect {
  const firstItem = catalog.items[0]?.id ?? "";
  switch (kind) {
    case "variable": {
      const variable = legacyVariables(catalog, false)[0];
      return { variable: variable?.key ?? "", operation: variable?.type === "boolean" ? "set" : "add", value: defaultValueFor(variable) };
    }
    case "formula":
      return { kind: "formula", target: numberTargets(catalog)[0]?.key ?? "", operation: "add", formula: "1" };
    case "restore":
      return { kind: "restore", target: catalog.system.resources[0]?.key ?? "" };
    case "item":
      return { kind: "item", operation: "give", itemId: firstItem, quantity: "1" };
    case "equip":
      return { kind: "equip", itemId: firstItem };
    case "unequip":
      return { kind: "unequip", itemId: firstItem };
    case "loot":
      return { kind: "loot", entries: [{ itemId: firstItem, chance: 50, quantity: "1" }] };
    case "xp":
      return { kind: "xp", amount: "10" };
    case "status":
      return { kind: "status", operation: "apply", effectId: catalog.system.statusEffects[0]?.id ?? "" };
    case "quest":
      return { kind: "quest", operation: "start", questId: catalog.system.quests[0]?.id ?? "" };
    case "achievement":
      return { kind: "achievement", achievementId: catalog.system.achievements[0]?.id ?? "" };
  }
}

function effectKind(effect: Effect): EffectKind {
  return "kind" in effect && effect.kind ? effect.kind : "variable";
}

function LootEditor({ catalog, entries, onChange }: { catalog: GameCatalog; entries: LootEntry[]; onChange: (entries: LootEntry[]) => void }) {
  return (
    <div className="w-full space-y-1">
      {entries.map((entry, index) => (
        <div key={index} className="flex flex-wrap items-start gap-1">
          <ItemSelect catalog={catalog} value={entry.itemId} onChange={(itemId) => onChange(entries.map((current, position) => (position === index ? { ...current, itemId } : current)))} />
          <Input
            aria-label="Chance (%)"
            type="number"
            min={0}
            max={100}
            className="w-20"
            value={String(entry.chance)}
            onChange={(event) => onChange(entries.map((current, position) => (position === index ? { ...current, chance: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } : current)))}
          />
          <span className="self-center text-xs text-muted-foreground">% ×</span>
          <FormulaInput
            catalog={catalog}
            ariaLabel="Quantidade"
            className="w-24"
            value={entry.quantity}
            onChange={(quantity) => onChange(entries.map((current, position) => (position === index ? { ...current, quantity } : current)))}
          />
          <RemoveButton label="Remover do saque" onClick={() => onChange(entries.filter((_, position) => position !== index))} />
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...entries, { itemId: catalog.items[0]?.id ?? "", chance: 50, quantity: "1" }])}>
        <Plus className="size-4" />
        Linha do saque
      </Button>
    </div>
  );
}

function EffectRow({ catalog, effect, onChange }: { catalog: GameCatalog; effect: Effect; onChange: (effect: Effect) => void }) {
  const kind = effectKind(effect);
  if (kind === "variable") {
    const legacy = effect as VariableEffect;
    const variables = legacyVariables(catalog, false);
    const variable = variables.find((candidate) => candidate.key === legacy.variable);
    const operations = (variable?.type === "boolean" ? ["set", "toggle"] : ["set", "add"]) as EffectOperation[];
    return (
      <>
        <select
          aria-label="Variável"
          className={SELECT_CLASS}
          value={legacy.variable}
          onChange={(event) => {
            const next = variables.find((candidate) => candidate.key === event.target.value);
            onChange({ variable: event.target.value, operation: next?.type === "boolean" ? "set" : "add", value: defaultValueFor(next) });
          }}
        >
          {!variable && <option value={legacy.variable}>{legacy.variable || "Escolha"}</option>}
          {variables.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label || option.key}
            </option>
          ))}
        </select>
        <select aria-label="Operação" className={SELECT_CLASS} value={legacy.operation} onChange={(event) => onChange({ ...legacy, operation: event.target.value as EffectOperation })}>
          {operations.map((operation) => (
            <option key={operation} value={operation}>
              {OPERATION_LABELS[operation]}
            </option>
          ))}
        </select>
        {legacy.operation !== "toggle" && <ValueInput variable={variable} value={legacy.value} onChange={(value) => onChange({ ...legacy, value })} />}
      </>
    );
  }
  const current = effect as Extract<Effect, { kind: string }>;
  switch (current.kind) {
    case "formula": {
      const targets = numberTargets(catalog);
      return (
        <>
          <select aria-label="O que muda" className={SELECT_CLASS} value={current.target} onChange={(event) => onChange({ ...current, target: event.target.value })}>
            {!targets.some((target) => target.key === current.target) && <option value={current.target}>{current.target || "Escolha"}</option>}
            {targets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.label} ({target.group.toLowerCase()})
              </option>
            ))}
          </select>
          <select aria-label="Operação" className={SELECT_CLASS} value={current.operation} onChange={(event) => onChange({ ...current, operation: event.target.value as "set" | "add" })}>
            <option value="add">somar</option>
            <option value="set">definir como</option>
          </select>
          <FormulaInput catalog={catalog} ariaLabel="Fórmula" className="w-full sm:w-48" value={current.formula} onChange={(formula) => onChange({ ...current, formula })} placeholder="-10 ou 1d6 + forca" />
        </>
      );
    }
    case "restore":
      return (
        <select aria-label="Recurso" className={SELECT_CLASS} value={current.target} onChange={(event) => onChange({ ...current, target: event.target.value })}>
          {catalog.system.resources.map((resource) => (
            <option key={resource.key} value={resource.key}>
              {name(catalog, resource.name, resource.key)} até o máximo
            </option>
          ))}
        </select>
      );
    case "item":
      return (
        <>
          <select aria-label="Dar ou tirar" className={SELECT_CLASS} value={current.operation} onChange={(event) => onChange({ ...current, operation: event.target.value as "give" | "take" })}>
            <option value="give">dar</option>
            <option value="take">tirar</option>
          </select>
          <FormulaInput catalog={catalog} ariaLabel="Quantidade" className="w-20" value={current.quantity} onChange={(quantity) => onChange({ ...current, quantity })} />
          <ItemSelect catalog={catalog} value={current.itemId} onChange={(itemId) => onChange({ ...current, itemId })} />
        </>
      );
    case "equip":
    case "unequip":
      return <ItemSelect catalog={catalog} value={current.itemId} onChange={(itemId) => onChange({ ...current, itemId })} />;
    case "loot":
      return <LootEditor catalog={catalog} entries={current.entries} onChange={(entries) => onChange({ ...current, entries })} />;
    case "xp":
      return <FormulaInput catalog={catalog} ariaLabel="Experiência" className="w-full sm:w-40" value={current.amount} onChange={(amount) => onChange({ ...current, amount })} />;
    case "status":
      return (
        <>
          <select aria-label="Aplicar ou tirar" className={SELECT_CLASS} value={current.operation} onChange={(event) => onChange({ ...current, operation: event.target.value as "apply" | "remove" })}>
            <option value="apply">aplicar</option>
            <option value="remove">tirar</option>
          </select>
          <select aria-label="Efeito" className={SELECT_CLASS} value={current.effectId} onChange={(event) => onChange({ ...current, effectId: event.target.value })}>
            {catalog.system.statusEffects.map((status) => (
              <option key={status.id} value={status.id}>
                {name(catalog, status.name, status.id)}
              </option>
            ))}
          </select>
        </>
      );
    case "quest":
      return (
        <>
          <select aria-label="O que acontece" className={SELECT_CLASS} value={current.operation} onChange={(event) => onChange({ ...current, operation: event.target.value as "start" })}>
            <option value="start">começar</option>
            <option value="advance">avançar etapa</option>
            <option value="complete">concluir</option>
            <option value="fail">falhar</option>
          </select>
          <select aria-label="Missão" className={SELECT_CLASS} value={current.questId} onChange={(event) => onChange({ ...current, questId: event.target.value })}>
            {catalog.system.quests.map((quest) => (
              <option key={quest.id} value={quest.id}>
                {name(catalog, quest.name, quest.id)}
              </option>
            ))}
          </select>
        </>
      );
    case "achievement":
      return (
        <select aria-label="Conquista" className={SELECT_CLASS} value={current.achievementId} onChange={(event) => onChange({ ...current, achievementId: event.target.value })}>
          {catalog.system.achievements.map((achievement) => (
            <option key={achievement.id} value={achievement.id}>
              {name(catalog, achievement.name, achievement.id)}
            </option>
          ))}
        </select>
      );
  }
}

export function EffectsEditor({
  catalog,
  effects,
  onChange,
  addLabel = "Efeito",
}: {
  catalog: GameCatalog;
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
  addLabel?: string;
}) {
  const kinds = EFFECT_KINDS.filter((entry) => entry.available(catalog));
  if (kinds.length === 0 && effects.length === 0) {
    return <p className="text-xs text-muted-foreground">Crie variáveis ou ligue módulos na aba Sistema da obra para usar efeitos.</p>;
  }
  return (
    <div className="space-y-2">
      {effects.map((effect, index) => (
        <div key={index} className="flex flex-wrap items-start gap-1 rounded-md border border-border/60 p-1.5">
          <span className="self-center px-1 text-xs font-medium text-muted-foreground">
            {EFFECT_KINDS.find((entry) => entry.kind === effectKind(effect))?.label}
          </span>
          <EffectRow catalog={catalog} effect={effect} onChange={(next) => onChange(effects.map((current, position) => (position === index ? next : current)))} />
          <span className="ms-auto">
            <RemoveButton label="Remover efeito" onClick={() => onChange(effects.filter((_, position) => position !== index))} />
          </span>
        </div>
      ))}
      {kinds.length > 0 && (
        <AddMenu
          label={addLabel}
          options={kinds.map((entry) => ({ value: entry.kind, label: entry.label }))}
          onAdd={(kind) => onChange([...effects, newEffect(kind as EffectKind, catalog)])}
        />
      )}
    </div>
  );
}

function AddMenu({ label, options, onAdd }: { label: string; options: { value: string; label: string }[]; onAdd: (value: string) => void }) {
  if (options.length === 1) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => onAdd(options[0].value)}>
        <Plus className="size-4" />
        {label}
      </Button>
    );
  }
  return (
    <label className="inline-flex items-center gap-1">
      <Plus className="size-4 text-muted-foreground" aria-hidden />
      <select
        aria-label={`Adicionar ${label.toLowerCase()}`}
        className={SELECT_CLASS}
        value=""
        onChange={(event) => {
          if (event.target.value) onAdd(event.target.value);
        }}
      >
        <option value="">{label}…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ------------------------------------------------------------------ condições

type ConditionKind = "variable" | Extract<Condition, { kind: string }>["kind"];

const CONDITION_KINDS: { kind: ConditionKind; label: string; available: (catalog: GameCatalog) => boolean }[] = [
  { kind: "variable", label: "Variável", available: (catalog) => legacyVariables(catalog, true).length > 0 },
  { kind: "formula", label: "Fórmula", available: () => true },
  { kind: "item", label: "Tem item", available: (catalog) => catalog.system.modules.inventory && catalog.items.length > 0 },
  { kind: "equipped", label: "Está equipado", available: (catalog) => catalog.system.modules.equipment && catalog.items.length > 0 },
  { kind: "fits", label: "Cabe na bolsa", available: (catalog) => catalog.system.modules.inventory && catalog.items.length > 0 },
  { kind: "quest", label: "Missão", available: (catalog) => catalog.system.modules.quests && catalog.system.quests.length > 0 },
  { kind: "profile", label: "Ficha do leitor", available: (catalog) => catalog.system.modules.character && catalog.system.character.fields.length > 0 },
  { kind: "achievement", label: "Conquista", available: (catalog) => catalog.system.modules.achievements && catalog.system.achievements.length > 0 },
  { kind: "status", label: "Efeito ativo", available: (catalog) => catalog.system.modules.effects && catalog.system.statusEffects.length > 0 },
];

function conditionKind(condition: Condition): ConditionKind {
  return "kind" in condition && condition.kind ? condition.kind : "variable";
}

function newCondition(kind: ConditionKind, catalog: GameCatalog): Condition {
  const firstItem = catalog.items[0]?.id ?? "";
  switch (kind) {
    case "variable": {
      const variable = legacyVariables(catalog, true)[0];
      return { variable: variable?.key ?? "", operator: variable?.type === "boolean" ? "eq" : "gte", value: defaultValueFor(variable) };
    }
    case "formula":
      return { kind: "formula", formula: "" };
    case "item":
      return { kind: "item", itemId: firstItem, min: 1 };
    case "equipped":
      return { kind: "equipped", itemId: firstItem };
    case "fits":
      return { kind: "fits", itemId: firstItem };
    case "quest":
      return { kind: "quest", questId: catalog.system.quests[0]?.id ?? "", state: "active" };
    case "profile": {
      const field = catalog.system.character.fields[0];
      return { kind: "profile", field: field?.key ?? "", value: field?.options[0]?.value ?? "" };
    }
    case "achievement":
      return { kind: "achievement", achievementId: catalog.system.achievements[0]?.id ?? "" };
    case "status":
      return { kind: "status", effectId: catalog.system.statusEffects[0]?.id ?? "" };
  }
}

function ConditionRow({ catalog, condition, onChange }: { catalog: GameCatalog; condition: Condition; onChange: (condition: Condition) => void }) {
  const kind = conditionKind(condition);
  if (kind === "variable") {
    const legacy = condition as ChoiceCondition;
    const variables = legacyVariables(catalog, true);
    const variable = variables.find((candidate) => candidate.key === legacy.variable);
    const operators = (variable?.type === "boolean" ? ["eq", "neq"] : Object.keys(OPERATOR_LABELS)) as ConditionOperator[];
    return (
      <>
        <select
          aria-label="Variável"
          className={SELECT_CLASS}
          value={legacy.variable}
          onChange={(event) => {
            const next = variables.find((candidate) => candidate.key === event.target.value);
            onChange({ variable: event.target.value, operator: "eq", value: defaultValueFor(next) });
          }}
        >
          {!variable && <option value={legacy.variable}>{legacy.variable || "Escolha"}</option>}
          {variables.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label || option.key}
            </option>
          ))}
        </select>
        <select aria-label="Operador" className={SELECT_CLASS} value={legacy.operator} onChange={(event) => onChange({ ...legacy, operator: event.target.value as ConditionOperator })}>
          {operators.map((operator) => (
            <option key={operator} value={operator}>
              {OPERATOR_LABELS[operator]}
            </option>
          ))}
        </select>
        <ValueInput variable={variable} value={legacy.value} onChange={(value) => onChange({ ...legacy, value })} />
      </>
    );
  }
  const current = condition as Extract<Condition, { kind: string }>;
  switch (current.kind) {
    case "formula":
      return <FormulaInput catalog={catalog} ariaLabel="Condição" className="w-full sm:w-64" value={current.formula} onChange={(formula) => onChange({ ...current, formula })} placeholder="forca >= 12 e nivel > 3" />;
    case "item":
      return (
        <>
          <Input aria-label="Quantidade mínima" type="number" min={1} className="w-20" value={String(current.min)} onChange={(event) => onChange({ ...current, min: Math.max(1, Math.trunc(Number(event.target.value) || 1)) })} />
          <ItemSelect catalog={catalog} value={current.itemId} onChange={(itemId) => onChange({ ...current, itemId })} />
        </>
      );
    case "equipped":
    case "fits":
      return <ItemSelect catalog={catalog} value={current.itemId} onChange={(itemId) => onChange({ ...current, itemId })} />;
    case "quest":
      return (
        <>
          <select aria-label="Missão" className={SELECT_CLASS} value={current.questId} onChange={(event) => onChange({ ...current, questId: event.target.value })}>
            {catalog.system.quests.map((quest) => (
              <option key={quest.id} value={quest.id}>
                {name(catalog, quest.name, quest.id)}
              </option>
            ))}
          </select>
          <select aria-label="Situação" className={SELECT_CLASS} value={current.state} onChange={(event) => onChange({ ...current, state: event.target.value as "active" })}>
            <option value="not_started">não começou</option>
            <option value="active">em andamento</option>
            <option value="done">concluída</option>
            <option value="failed">falhou</option>
          </select>
        </>
      );
    case "profile": {
      const field = catalog.system.character.fields.find((candidate) => candidate.key === current.field);
      return (
        <>
          <select
            aria-label="Campo da ficha"
            className={SELECT_CLASS}
            value={current.field}
            onChange={(event) => {
              const next = catalog.system.character.fields.find((candidate) => candidate.key === event.target.value);
              onChange({ ...current, field: event.target.value, value: next?.options[0]?.value ?? "" });
            }}
          >
            {catalog.system.character.fields.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {name(catalog, candidate.name, candidate.key)}
              </option>
            ))}
          </select>
          <span className="self-center text-xs text-muted-foreground">é</span>
          {field?.kind === "choice" ? (
            <select aria-label="Valor" className={SELECT_CLASS} value={current.value} onChange={(event) => onChange({ ...current, value: event.target.value })}>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {name(catalog, option.name, option.value)}
                </option>
              ))}
            </select>
          ) : (
            <Input aria-label="Valor" className="w-32" value={current.value} maxLength={40} onChange={(event) => onChange({ ...current, value: event.target.value })} />
          )}
        </>
      );
    }
    case "achievement":
      return (
        <select aria-label="Conquista" className={SELECT_CLASS} value={current.achievementId} onChange={(event) => onChange({ ...current, achievementId: event.target.value })}>
          {catalog.system.achievements.map((achievement) => (
            <option key={achievement.id} value={achievement.id}>
              {name(catalog, achievement.name, achievement.id)}
            </option>
          ))}
        </select>
      );
    case "status":
      return (
        <select aria-label="Efeito" className={SELECT_CLASS} value={current.effectId} onChange={(event) => onChange({ ...current, effectId: event.target.value })}>
          {catalog.system.statusEffects.map((status) => (
            <option key={status.id} value={status.id}>
              {name(catalog, status.name, status.id)}
            </option>
          ))}
        </select>
      );
  }
}

export function ConditionsEditor({ catalog, conditions, onChange }: { catalog: GameCatalog; conditions: Condition[]; onChange: (conditions: Condition[]) => void }) {
  const kinds = CONDITION_KINDS.filter((entry) => entry.available(catalog));
  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => (
        <div key={index} className="flex flex-wrap items-start gap-1 rounded-md border border-border/60 p-1.5">
          <span className="self-center px-1 text-xs font-medium text-muted-foreground">
            {CONDITION_KINDS.find((entry) => entry.kind === conditionKind(condition))?.label}
          </span>
          <ConditionRow catalog={catalog} condition={condition} onChange={(next) => onChange(conditions.map((current, position) => (position === index ? next : current)))} />
          <span className="ms-auto">
            <RemoveButton label="Remover condição" onClick={() => onChange(conditions.filter((_, position) => position !== index))} />
          </span>
        </div>
      ))}
      <AddMenu label="Condição" options={kinds.map((entry) => ({ value: entry.kind, label: entry.label }))} onAdd={(kind) => onChange([...conditions, newCondition(kind as ConditionKind, catalog)])} />
    </div>
  );
}

// ------------------------------------------------------------------ custo

export function CostsEditor({ catalog, costs, onChange }: { catalog: GameCatalog; costs: Cost[]; onChange: (costs: Cost[]) => void }) {
  const resources = catalog.system.modules.resources ? catalog.system.resources : [];
  if (resources.length === 0) return <p className="text-xs text-muted-foreground">Ligue o módulo Recursos e crie um recurso (ex: Mana) para cobrar custo.</p>;
  return (
    <div className="space-y-2">
      {costs.map((cost, index) => (
        <div key={index} className="flex flex-wrap items-start gap-1">
          <FormulaInput catalog={catalog} ariaLabel="Quanto custa" className="w-28" value={cost.amount} onChange={(amount) => onChange(costs.map((current, position) => (position === index ? { ...current, amount } : current)))} />
          <select aria-label="Recurso" className={SELECT_CLASS} value={cost.resource} onChange={(event) => onChange(costs.map((current, position) => (position === index ? { ...current, resource: event.target.value } : current)))}>
            {resources.map((resource) => (
              <option key={resource.key} value={resource.key}>
                {name(catalog, resource.name, resource.key)}
              </option>
            ))}
          </select>
          <RemoveButton label="Remover custo" onClick={() => onChange(costs.filter((_, position) => position !== index))} />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...costs, { resource: resources[0].key, amount: "1" }])}>
        <Plus className="size-4" />
        Custo
      </Button>
    </div>
  );
}
