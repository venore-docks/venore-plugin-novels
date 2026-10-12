"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button, Input, MediaPickerField, Switch, cn, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { Modifier } from "../../contracts/game";
import { ACCENT_COLORS, type AccentColor, type LocalizedText } from "../../contracts/types";
import { LocalizedInput } from "../../components/localized-input";
import { ACCENT_CLASSES } from "../../shared/accent";
import { toGameKey } from "../../shared/game-input";
import { name, SELECT_CLASS, type GameCatalog } from "./catalog";

// Peças pequenas dos formulários do sistema: lista editável, chave, nome traduzível, cor da
// paleta do tema, número e modificadores.

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0 space-y-1 text-sm", className)}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function KeyInput({ value, onChange, label = "Chave" }: { value: string; onChange: (value: string) => void; label?: string }) {
  return (
    <Field label={label} hint="Usada nas fórmulas. Letras minúsculas, números e _.">
      <Input value={value} maxLength={40} className="font-mono" onChange={(event) => onChange(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} />
    </Field>
  );
}

export function NameInput({ catalog, label, value, onChange, maxLength = 60, multiline = false }: { catalog: GameCatalog; label: string; value: LocalizedText; onChange: (value: LocalizedText) => void; maxLength?: number; multiline?: boolean }) {
  return <LocalizedInput label={label} value={value} onChange={onChange} primaryLocale={catalog.locale} locales={catalog.locales} maxLength={maxLength} multiline={multiline} />;
}

export function NumberInput({ label, value, onChange, min, max, step, hint }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        value={Number.isFinite(value) ? String(value) : ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
      />
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start justify-between gap-3 text-sm">
      <span className="min-w-0">
        <span className="block text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function ColorPicker({ value, onChange, label = "Cor" }: { value: AccentColor; onChange: (value: AccentColor) => void; label?: string }) {
  return (
    <fieldset className="space-y-1 text-sm">
      <legend className="font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {ACCENT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={ACCENT_CLASSES[color].label}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            className={cn("size-7 rounded-full border-2", ACCENT_CLASSES[color].solid, value === color ? "border-foreground" : "border-transparent")}
          />
        ))}
      </div>
    </fieldset>
  );
}

// Lista de definições (recursos, atributos, missões...): cada uma num cartão que abre e fecha.
export function DefinitionList<T>({
  items,
  onChange,
  create,
  title,
  addLabel,
  render,
  empty,
  max = 40,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  title: (item: T) => string;
  addLabel: string;
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  empty?: string;
  max?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    setOpen(target);
  };
  return (
    <div className="space-y-2">
      {items.length === 0 && empty && <p className="text-sm text-muted-foreground">{empty}</p>}
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-border">
          <div className="flex items-center gap-1 p-1 ps-3">
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm font-medium text-foreground" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", open === index && "rotate-180")} aria-hidden />
              <span className="truncate">{title(item) || "Sem nome"}</span>
            </button>
            <Button type="button" size="icon" variant="ghost" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
              <ArrowUp className="size-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Descer" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remover"
              onClick={() => {
                onChange(items.filter((_, position) => position !== index));
                setOpen(null);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          {open === index && (
            <div className="space-y-3 border-t border-border p-3">
              {render(item, (patch) => onChange(items.map((current, position) => (position === index ? { ...current, ...patch } : current))))}
            </div>
          )}
        </div>
      ))}
      {items.length < max && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            onChange([...items, create()]);
            setOpen(items.length);
          }}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}

// Alvos de modificador: atributos, derivados e máximo de recurso.
export function modifierTargets(catalog: GameCatalog): { key: string; label: string }[] {
  const { system } = catalog;
  return [
    ...system.attributes.map((attribute) => ({ key: attribute.key, label: name(catalog, attribute.name, attribute.key) })),
    ...system.derived.map((derived) => ({ key: derived.key, label: name(catalog, derived.name, derived.key) })),
    ...system.resources.map((resource) => ({ key: `${resource.key}.max`, label: `${name(catalog, resource.name, resource.key)} máximo` })),
  ].filter((target) => target.key);
}

export function ModifiersEditor({ catalog, value, onChange, label = "Modificadores" }: { catalog: GameCatalog; value: Modifier[]; onChange: (value: Modifier[]) => void; label?: string }) {
  const targets = modifierTargets(catalog);
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-foreground">{label}</p>
      {targets.length === 0 ? (
        <p className="text-xs text-muted-foreground">Crie atributos ou recursos no sistema para usar modificadores.</p>
      ) : (
        <>
          {value.map((modifier, index) => (
            <div key={index} className="flex flex-wrap items-center gap-1">
              <select aria-label="Alvo" className={SELECT_CLASS} value={modifier.target} onChange={(event) => onChange(value.map((current, position) => (position === index ? { ...current, target: event.target.value } : current)))}>
                {!targets.some((target) => target.key === modifier.target) && <option value={modifier.target}>{modifier.target || "Escolha"}</option>}
                {targets.map((target) => (
                  <option key={target.key} value={target.key}>
                    {target.label}
                  </option>
                ))}
              </select>
              <Input aria-label="Quanto" type="number" step="any" className="w-24" value={String(modifier.amount)} onChange={(event) => onChange(value.map((current, position) => (position === index ? { ...current, amount: Number(event.target.value) || 0 } : current)))} />
              <Button type="button" size="icon" variant="ghost" aria-label="Remover modificador" onClick={() => onChange(value.filter((_, position) => position !== index))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...value, { target: targets[0].key, amount: 1 }])}>
            <Plus className="size-4" />
            Modificador
          </Button>
        </>
      )}
    </div>
  );
}

// Id a partir do nome, sem repetir os que já existem.
export function uniqueId(base: string, taken: string[]): string {
  const root = toGameKey(base) || "item";
  let candidate = root;
  for (let index = 2; taken.includes(candidate); index += 1) candidate = `${root}_${index}`.slice(0, 40);
  return candidate;
}

// Imagem opcional (vocação, verbete): sem imagem, o leitor vê o cartão com o nome.
export function ImageField({ catalog, value, onChange, label = "Imagem (opcional)" }: { catalog: GameCatalog; value: string | null; onChange: (id: string | null) => void; label?: string }) {
  const url = value ? catalog.media?.[value] : undefined;
  const [initial] = useState<PickableMedia | null>(value && url ? { id: value, url, filename: "imagem", contentType: "image/*" } : null);
  return <MediaPickerField name="imageMediaId" label={label} initialMedia={initial} onSelect={(media) => onChange(media?.id ?? null)} />;
}
