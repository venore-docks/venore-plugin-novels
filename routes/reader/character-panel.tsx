"use client";

import { Backpack } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@venore/plugin-sdk/ui";
import { formatNumber, type CharacterSheet, type StatusEntry, type VariableChange } from "../../shared/variables";

const showValue = (value: number | boolean) => (typeof value === "boolean" ? (value ? "Sim" : "Não") : formatNumber(value));
const percent = (value: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0);
const MIN_SLOTS = 8;

function Bar({ value, max, label, tone = "primary" }: { value: number; max: number; label: string; tone?: "primary" | "warning" }) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={tone === "warning" ? "h-full bg-destructive ui-motion-base" : "h-full bg-primary ui-motion-base"}
        style={{ width: `${percent(value, max)}%` }}
      />
    </div>
  );
}

function HudStatus({ entry }: { entry: StatusEntry }) {
  const bar = typeof entry.value === "number" && entry.max !== null;
  if (!bar) {
    return (
      <div className="flex min-w-0 flex-col justify-center">
        <span className="truncate text-xs text-muted-foreground">{entry.label}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">{showValue(entry.value)}</span>
      </div>
    );
  }
  const value = entry.value as number;
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-baseline justify-between gap-1 text-xs">
        <span className="truncate text-muted-foreground">{entry.label}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {formatNumber(value)}
          <span className="font-normal text-muted-foreground">/{formatNumber(entry.max!)}</span>
        </span>
      </div>
      <Bar value={value} max={entry.max!} label={entry.label} tone={percent(value, entry.max!) <= 25 ? "warning" : "primary"} />
    </div>
  );
}

// HUD fixo no rodapé do leitor: acompanha o texto, então HP, level e o resto dos status ficam
// sempre à vista. O botão abre habilidades e mochila.
export function ReaderHud({ sheet, onOpen }: { sheet: CharacterSheet; onOpen: () => void }) {
  const hasPanel = sheet.skills.length > 0 || sheet.hasInventory;
  if (sheet.status.length === 0 && !hasPanel) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {sheet.status.map((entry) => (
            <HudStatus key={entry.key} entry={entry} />
          ))}
        </div>
        {hasPanel && (
          <Button size="sm" variant="outline" onClick={onOpen} className="shrink-0" aria-label="Abrir habilidades e mochila">
            <Backpack className="size-4" />
            <span className="hidden sm:inline">{sheet.hasInventory ? "Mochila" : "Habilidades"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

function SkillCard({ entry }: { entry: StatusEntry }) {
  const bar = typeof entry.value === "number" && entry.max !== null;
  return (
    <div className="space-y-1 rounded-lg border border-border bg-card p-3">
      <p className="truncate text-xs text-muted-foreground">{entry.label}</p>
      <p className="text-2xl font-semibold tabular-nums text-foreground">
        {showValue(entry.value)}
        {bar && <span className="text-sm font-normal text-muted-foreground">/{formatNumber(entry.max!)}</span>}
      </p>
      {bar && <Bar value={entry.value as number} max={entry.max!} label={entry.label} />}
    </div>
  );
}

function BackpackGrid({ sheet }: { sheet: CharacterSheet }) {
  const empty = Math.max(MIN_SLOTS - sheet.inventory.length, (4 - (sheet.inventory.length % 4)) % 4);
  const heavy = sheet.capacity !== null && sheet.load > sheet.capacity;
  return (
    <div className="space-y-3">
      {sheet.capacity !== null ? (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Peso na mochila</span>
            <span className={heavy ? "font-semibold tabular-nums text-destructive" : "font-semibold tabular-nums text-foreground"}>
              {formatNumber(sheet.load)} <span className="font-normal text-muted-foreground">de {formatNumber(sheet.capacity)}</span>
            </span>
          </div>
          <Bar value={sheet.load} max={sheet.capacity} label="Peso na mochila" tone={heavy || percent(sheet.load, sheet.capacity) >= 90 ? "warning" : "primary"} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Peso na mochila: {formatNumber(sheet.load)}</p>
      )}
      <ul className="grid grid-cols-4 gap-2" aria-label="Itens na mochila">
        {sheet.inventory.map((item) => (
          <li
            key={item.key}
            className="relative flex aspect-square flex-col items-center justify-center rounded-lg border border-border bg-muted p-1.5 text-center"
            title={`${item.label} — peso ${formatNumber(item.weight)}`}
          >
            <span className="line-clamp-3 text-xs font-medium leading-tight text-foreground">{item.label}</span>
            {item.quantity !== null && item.quantity !== 1 && (
              <span className="absolute bottom-1 end-1 rounded-sm bg-background px-1 text-xs font-semibold tabular-nums text-foreground">
                {formatNumber(item.quantity)}
              </span>
            )}
            <span className="absolute start-1 top-1 text-xs tabular-nums text-muted-foreground">{formatNumber(item.weight)}</span>
          </li>
        ))}
        {Array.from({ length: empty }, (_, slot) => (
          <li key={`vazio-${slot}`} aria-hidden className="aspect-square rounded-lg border border-dashed border-border" />
        ))}
      </ul>
      {sheet.inventory.length === 0 && <p className="text-sm text-muted-foreground">A mochila está vazia.</p>}
    </div>
  );
}

// Habilidades e mochila em abas (os status ficam no HUD).
export function CharacterDialog({
  sheet,
  title,
  open,
  onOpenChange,
}: {
  sheet: CharacterSheet;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tabs = [sheet.skills.length > 0 && "skills", sheet.hasInventory && "backpack"].filter(Boolean) as string[];
  if (tabs.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personagem</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={tabs[0]}>
          {tabs.length > 1 && (
            <TabsList className="w-full">
              <TabsTrigger value="skills" className="flex-1">
                Habilidades
              </TabsTrigger>
              <TabsTrigger value="backpack" className="flex-1">
                Mochila
              </TabsTrigger>
            </TabsList>
          )}
          {sheet.skills.length > 0 && (
            <TabsContent value="skills" className="pt-3">
              <div className="grid grid-cols-2 gap-2">
                {sheet.skills.map((entry) => (
                  <SkillCard key={entry.key} entry={entry} />
                ))}
              </div>
            </TabsContent>
          )}
          {sheet.hasInventory && (
            <TabsContent value="backpack" className="pt-3">
              <BackpackGrid sheet={sheet} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// O que mudou ao chegar nesta cena (escolha + efeitos da cena).
export function ChangeChips({ changes }: { changes: VariableChange[] }) {
  if (changes.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 px-4" aria-label="Mudanças no personagem">
      {changes.map((change) => (
        <li
          key={change.key}
          className={
            change.tone === "up"
              ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              : change.tone === "down"
                ? "rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
                : "rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          {change.text}
        </li>
      ))}
    </ul>
  );
}
