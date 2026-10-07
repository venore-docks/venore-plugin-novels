"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, useActionToast } from "@venore/plugin-sdk/ui";
import type { VariableDefinition, WorkRecord } from "../../contracts/types";
import { updateWorkVariablesAction, type AdminActionState } from "../admin/actions";
import { VariableDisplayFields } from "./variable-display-fields";

const initialState: AdminActionState = { error: null };

// Aba "Sistema": variáveis da obra (o estado que as escolhas leem e alteram).
export function VariablesForm({ work }: { work: WorkRecord }) {
  const [state, formAction, pending] = useActionState(updateWorkVariablesAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Variáveis salvas." });
  const [variables, setVariables] = useState<VariableDefinition[]>(work.variables);

  function updateVariable(index: number, patch: Partial<VariableDefinition>) {
    setVariables((current) =>
      current.map((variable, position) => {
        if (position !== index) return variable;
        const next = { ...variable, ...patch };
        if (patch.type && patch.type !== variable.type) {
          next.initial = patch.type === "number" ? 0 : false;
          // Limites e capacidade só valem para número.
          if (patch.type === "boolean") {
            delete next.min;
            delete next.max;
            delete next.maxVariable;
            delete next.capacity;
          }
        }
        return next;
      }),
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <input type="hidden" name="payload" value={JSON.stringify({ workId: work.id, variables })} />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Variáveis</h2>
        <p className="text-sm text-muted-foreground">
          Guardam o estado da história (ex: hp, club_fighting, tem_clava). Escolhas podem exigir ou alterar esses valores. Em
          &quot;Mostrar ao leitor&quot;, a variável entra no painel do personagem: status (com barra quando tem máximo), habilidade ou
          item do inventário.
        </p>
      </div>
      {variables.map((variable, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              aria-label="Chave"
              placeholder="chave"
              value={variable.key}
              onChange={(event) => updateVariable(index, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              maxLength={40}
            />
            <Input aria-label="Nome" placeholder="Nome" value={variable.label} onChange={(event) => updateVariable(index, { label: event.target.value })} maxLength={80} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Tipo"
              value={variable.type}
              onChange={(event) => updateVariable(index, { type: event.target.value as VariableDefinition["type"] })}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              <option value="number">Número</option>
              <option value="boolean">Sim/não</option>
            </select>
            <span className="text-xs text-muted-foreground">começa em</span>
            {variable.type === "number" ? (
              <Input
                aria-label="Valor inicial"
                type="number"
                value={String(variable.initial)}
                onChange={(event) => updateVariable(index, { initial: Number(event.target.value) || 0 })}
                className="w-24"
              />
            ) : (
              <select
                aria-label="Valor inicial"
                value={variable.initial ? "true" : "false"}
                onChange={(event) => updateVariable(index, { initial: event.target.value === "true" })}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="ms-auto"
              aria-label="Remover variável"
              onClick={() => setVariables(variables.filter((_, position) => position !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <VariableDisplayFields
            variable={variable}
            others={variables.filter((other, position) => position !== index && other.type === "number" && other.key)}
            onChange={(patch) => updateVariable(index, patch)}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setVariables([...variables, { key: "", label: "", type: "number", initial: 0 }])}>
          <Plus className="size-4" />
          Variável
        </Button>
        <Button type="submit" size="sm" disabled={pending} className="ms-auto">
          Salvar variáveis
        </Button>
      </div>
    </form>
  );
}
