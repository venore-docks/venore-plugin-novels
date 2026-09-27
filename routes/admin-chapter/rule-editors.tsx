"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@venore/plugin-sdk/ui";
import type {
  ChoiceCondition,
  ConditionOperator,
  EffectOperation,
  VariableDefinition,
  VariableEffect,
  VariableValue,
} from "../../contracts/types";

const SELECT_CLASS = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: "igual a",
  neq: "diferente de",
  gt: "maior que",
  gte: "maior ou igual a",
  lt: "menor que",
  lte: "menor ou igual a",
};

const OPERATION_LABELS: Record<EffectOperation, string> = { set: "definir como", add: "somar", toggle: "inverter" };

function ValueInput({
  variable,
  value,
  onChange,
}: {
  variable: VariableDefinition | undefined;
  value: VariableValue;
  onChange: (value: VariableValue) => void;
}) {
  if (variable?.type === "boolean") {
    return (
      <select aria-label="Valor" className={SELECT_CLASS} value={value ? "true" : "false"} onChange={(e) => onChange(e.target.value === "true")}>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  }
  return (
    <Input
      aria-label="Valor"
      type="number"
      className="w-24"
      value={typeof value === "number" ? String(value) : "0"}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}

function defaultValueFor(variable: VariableDefinition | undefined): VariableValue {
  return variable?.type === "boolean" ? true : 1;
}

export function ConditionsEditor({
  variables,
  conditions,
  onChange,
}: {
  variables: VariableDefinition[];
  conditions: ChoiceCondition[];
  onChange: (conditions: ChoiceCondition[]) => void;
}) {
  if (variables.length === 0) {
    return <p className="text-xs text-muted-foreground">Crie variáveis na página da obra para usar condições.</p>;
  }
  const byKey = new Map(variables.map((variable) => [variable.key, variable]));
  const update = (index: number, patch: Partial<ChoiceCondition>) =>
    onChange(conditions.map((condition, position) => (position === index ? { ...condition, ...patch } : condition)));

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => {
        const variable = byKey.get(condition.variable);
        const operators = (variable?.type === "boolean" ? ["eq", "neq"] : Object.keys(OPERATOR_LABELS)) as ConditionOperator[];
        return (
          <div key={index} className="flex flex-wrap items-center gap-1">
            <select
              aria-label="Variável"
              className={SELECT_CLASS}
              value={condition.variable}
              onChange={(e) => {
                const next = byKey.get(e.target.value);
                update(index, { variable: e.target.value, operator: "eq", value: defaultValueFor(next) });
              }}
            >
              {variables.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label || option.key}
                </option>
              ))}
            </select>
            <select
              aria-label="Operador"
              className={SELECT_CLASS}
              value={condition.operator}
              onChange={(e) => update(index, { operator: e.target.value as ConditionOperator })}
            >
              {operators.map((operator) => (
                <option key={operator} value={operator}>
                  {OPERATOR_LABELS[operator]}
                </option>
              ))}
            </select>
            <ValueInput variable={variable} value={condition.value} onChange={(value) => update(index, { value })} />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remover condição"
              onClick={() => onChange(conditions.filter((_, position) => position !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([...conditions, { variable: variables[0].key, operator: "eq", value: defaultValueFor(variables[0]) }])
        }
      >
        <Plus className="size-4" />
        Condição
      </Button>
    </div>
  );
}

export function EffectsEditor({
  variables,
  effects,
  onChange,
}: {
  variables: VariableDefinition[];
  effects: VariableEffect[];
  onChange: (effects: VariableEffect[]) => void;
}) {
  if (variables.length === 0) {
    return <p className="text-xs text-muted-foreground">Crie variáveis na página da obra para usar efeitos.</p>;
  }
  const byKey = new Map(variables.map((variable) => [variable.key, variable]));
  const update = (index: number, patch: Partial<VariableEffect>) =>
    onChange(effects.map((effect, position) => (position === index ? { ...effect, ...patch } : effect)));

  return (
    <div className="space-y-2">
      {effects.map((effect, index) => {
        const variable = byKey.get(effect.variable);
        const operations = (variable?.type === "boolean" ? ["set", "toggle"] : ["set", "add"]) as EffectOperation[];
        return (
          <div key={index} className="flex flex-wrap items-center gap-1">
            <select
              aria-label="Variável"
              className={SELECT_CLASS}
              value={effect.variable}
              onChange={(e) => {
                const next = byKey.get(e.target.value);
                update(index, { variable: e.target.value, operation: "set", value: defaultValueFor(next) });
              }}
            >
              {variables.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label || option.key}
                </option>
              ))}
            </select>
            <select
              aria-label="Operação"
              className={SELECT_CLASS}
              value={effect.operation}
              onChange={(e) => update(index, { operation: e.target.value as EffectOperation })}
            >
              {operations.map((operation) => (
                <option key={operation} value={operation}>
                  {OPERATION_LABELS[operation]}
                </option>
              ))}
            </select>
            {effect.operation !== "toggle" && (
              <ValueInput variable={variable} value={effect.value} onChange={(value) => update(index, { value })} />
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remover efeito"
              onClick={() => onChange(effects.filter((_, position) => position !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...effects, { variable: variables[0].key, operation: "set", value: defaultValueFor(variables[0]) }])}
      >
        <Plus className="size-4" />
        Efeito
      </Button>
    </div>
  );
}
