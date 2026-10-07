"use client";

import { Backpack } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Progress } from "@venore/plugin-sdk/ui";
import { formatNumber, type CharacterSheet, type StatusEntry, type VariableChange } from "../../shared/variables";

const showValue = (value: number | boolean) => (typeof value === "boolean" ? (value ? "Sim" : "Não") : formatNumber(value));
const percent = (value: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0);

function StatusLine({ entry }: { entry: StatusEntry }) {
  const bar = typeof entry.value === "number" && entry.max !== null;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{entry.label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {showValue(entry.value)}
          {bar && <span className="text-muted-foreground">/{formatNumber(entry.max!)}</span>}
        </span>
      </div>
      {bar && <Progress value={percent(entry.value as number, entry.max!)} aria-label={entry.label} />}
    </div>
  );
}

// Faixa curta sob o cabeçalho do leitor: os status (HP com barra, nível) sempre à vista, e o botão
// que abre a ficha completa.
export function StatusStrip({ sheet, onOpen }: { sheet: CharacterSheet; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {sheet.status.map((entry) => (
          <StatusLine key={entry.key} entry={entry} />
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={onOpen} className="shrink-0">
        <Backpack className="size-4" />
        Personagem
      </Button>
    </div>
  );
}

// Ficha completa: status, habilidades e inventário com a carga.
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personagem</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {sheet.status.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Status</h3>
              {sheet.status.map((entry) => (
                <StatusLine key={entry.key} entry={entry} />
              ))}
            </section>
          )}
          {sheet.skills.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Habilidades</h3>
              {sheet.skills.map((entry) => (
                <StatusLine key={entry.key} entry={entry} />
              ))}
            </section>
          )}
          {sheet.hasInventory && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Inventário</h3>
              {sheet.capacity !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Carga</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatNumber(sheet.load)}
                      <span className="text-muted-foreground">/{formatNumber(sheet.capacity)}</span>
                    </span>
                  </div>
                  <Progress value={percent(sheet.load, sheet.capacity)} aria-label="Carga" />
                </div>
              )}
              {sheet.inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada na mochila.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {sheet.inventory.map((item) => (
                    <li key={item.key} className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
                      <span className="text-foreground">
                        {item.label}
                        {item.quantity !== null && item.quantity !== 1 && <span className="text-muted-foreground"> ×{formatNumber(item.quantity)}</span>}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{formatNumber(item.weight)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {sheet.capacity === null && sheet.inventory.length > 0 && (
                <p className="text-xs text-muted-foreground">Carga total: {formatNumber(sheet.load)}</p>
              )}
            </section>
          )}
        </div>
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

// Botão fixo no canto: a faixa de status fica lá no topo, e a história rola para baixo. Mostra o
// primeiro status com teto (o HP) para dar para acompanhar sem abrir a ficha.
export function FloatingSheetButton({ sheet, onOpen }: { sheet: CharacterSheet; onOpen: () => void }) {
  const main = sheet.status.find((entry) => typeof entry.value === "number" && entry.max !== null);
  return (
    <Button
      onClick={onOpen}
      className="fixed bottom-4 end-4 z-20 rounded-full shadow-lg"
      aria-label={main ? `Personagem: ${main.label} ${showValue(main.value)} de ${formatNumber(main.max!)}` : "Personagem"}
    >
      <Backpack className="size-4" />
      {main ? (
        <span className="tabular-nums">
          {main.label} {showValue(main.value)}/{formatNumber(main.max!)}
        </span>
      ) : (
        "Personagem"
      )}
    </Button>
  );
}
