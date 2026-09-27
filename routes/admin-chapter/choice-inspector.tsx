"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button, Input } from "@venore/plugin-sdk/ui";
import type { ChapterGraphChoice, ChapterGraphScene } from "../../contracts/types";
import type { ChapterGraphEditorView } from "../../features/graph/get-chapter-graph/types";
import { LocaleTabs } from "../../components/locale-tabs";
import { ConditionsEditor, EffectsEditor } from "./rule-editors";

export function ChoiceInspector({
  choice,
  work,
  scenes,
  siblingCount,
  onChange,
  onMove,
  onSelectScene,
  onDelete,
}: {
  choice: ChapterGraphChoice;
  work: ChapterGraphEditorView["work"];
  scenes: ChapterGraphScene[];
  siblingCount: number;
  onChange: (patch: Partial<ChapterGraphChoice>) => void;
  onMove: (direction: -1 | 1) => void;
  onSelectScene: (id: string) => void;
  onDelete: () => void;
}) {
  const [locale, setLocale] = useState(work.defaultLocale);
  const from = scenes.find((scene) => scene.id === choice.sceneId);
  const targets = scenes.filter((scene) => scene.id !== choice.sceneId);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Escolha</p>
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="ghost" aria-label="Subir escolha" disabled={choice.position === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Descer escolha"
            disabled={choice.position >= siblingCount - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Excluir escolha" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {from && (
        <p className="text-xs text-muted-foreground">
          Sai de{" "}
          <button type="button" className="text-primary hover:underline" onClick={() => onSelectScene(from.id)}>
            {from.label || "cena sem nome"}
          </button>
        </p>
      )}

      <LocaleTabs locales={work.locales} active={locale} defaultLocale={work.defaultLocale} onChange={setLocale} />
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Texto do botão</span>
        <Input
          value={choice.label[locale] ?? ""}
          maxLength={200}
          onChange={(event) => onChange({ label: { ...choice.label, [locale]: event.target.value } })}
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Leva para</span>
        <select
          value={choice.targetSceneId}
          onChange={(event) => onChange({ targetSceneId: event.target.value })}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          {targets.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.label || "Cena sem nome"}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Só aparece se</p>
        <ConditionsEditor variables={work.variables} conditions={choice.conditions} onChange={(conditions) => onChange({ conditions })} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Ao escolher</p>
        <EffectsEditor variables={work.variables} effects={choice.effects} onChange={(effects) => onChange({ effects })} />
      </div>
    </div>
  );
}
