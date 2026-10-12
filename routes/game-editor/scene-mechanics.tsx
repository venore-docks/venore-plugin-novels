"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Switch } from "@venore/plugin-sdk/ui";
import { COMBAT_EVENTS, type CombatEvent, type EncounterDef, type SceneMechanics, type ShopDef } from "../../contracts/game";
import { name, SELECT_CLASS, type GameCatalog } from "./catalog";
import { NameInput } from "./fields";
import { FormulaInput } from "./formula-input";
import { ItemSelect, SceneSelect } from "./rules";

// Tipo da cena (texto, encontro, loja) e regras de jogo dela (seções 7.1, 12 e 13).

function emptyEncounter(catalog: GameCatalog): EncounterDef {
  return {
    creatures: catalog.creatures[0] ? [{ creatureId: catalog.creatures[0].id, count: 1 }] : [],
    mode: "rounds",
    victorySceneId: null,
    defeatSceneId: null,
    fleeSceneId: null,
    single: { roll: "1d20", dc: "12", hpLoss: "1d6" },
    messages: {},
  };
}

const emptyShop = (): ShopDef => ({ items: [], sellRate: 0.5 });

const COMBAT_EVENT_LABELS: Record<CombatEvent, string> = {
  playerHit: "Você acerta",
  playerMiss: "Você erra",
  enemyHit: "A criatura acerta",
  enemyMiss: "A criatura erra",
  critical: "Golpe crítico",
  victory: "Vitória",
  defeat: "Derrota",
  flee: "Fuga",
};

export function SceneMechanicsEditor({
  catalog,
  mechanics,
  onChange,
}: {
  catalog: GameCatalog;
  mechanics: SceneMechanics;
  onChange: (mechanics: SceneMechanics) => void;
}) {
  const { system } = catalog;
  const kinds = [
    { value: "text", label: "Texto" },
    ...(system.modules.combat ? [{ value: "encounter", label: "Encontro (luta)" }] : []),
    ...(system.modules.shops ? [{ value: "shop", label: "Loja" }] : []),
  ];
  const encounter = mechanics.encounter ?? emptyEncounter(catalog);
  const shop = mechanics.shop ?? emptyShop();
  const setEncounter = (patch: Partial<EncounterDef>) => onChange({ ...mechanics, encounter: { ...encounter, ...patch } });
  const setShop = (patch: Partial<ShopDef>) => onChange({ ...mechanics, shop: { ...shop, ...patch } });
  const resources = system.modules.resources ? system.resources : [];

  if (kinds.length === 1 && resources.length === 0) return null;

  return (
    <div className="space-y-3">
      {kinds.length > 1 && (
        <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">Tipo da cena</span>
          <select
            aria-label="Tipo da cena"
            className={SELECT_CLASS}
            value={mechanics.kind}
            onChange={(event) => {
              const kind = event.target.value as SceneMechanics["kind"];
              onChange({
                ...mechanics,
                kind,
                encounter: kind === "encounter" ? encounter : mechanics.encounter,
                shop: kind === "shop" ? shop : mechanics.shop,
              });
            }}
          >
            {kinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {mechanics.kind === "encounter" && (
        <div className="space-y-3 rounded-md border border-border/60 p-2">
          {catalog.creatures.length === 0 ? (
            <p className="text-xs text-muted-foreground">Cadastre criaturas na aba Bestiário da obra.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Inimigos</p>
              {encounter.creatures.map((entry, index) => (
                <div key={index} className="flex flex-wrap items-center gap-1">
                  <Input
                    aria-label="Quantidade"
                    type="number"
                    min={1}
                    max={10}
                    className="w-16"
                    value={String(entry.count)}
                    onChange={(event) =>
                      setEncounter({ creatures: encounter.creatures.map((current, position) => (position === index ? { ...current, count: Math.max(1, Math.min(10, Math.trunc(Number(event.target.value) || 1))) } : current)) })
                    }
                  />
                  <select
                    aria-label="Criatura"
                    className={SELECT_CLASS}
                    value={entry.creatureId}
                    onChange={(event) => setEncounter({ creatures: encounter.creatures.map((current, position) => (position === index ? { ...current, creatureId: event.target.value } : current)) })}
                  >
                    {!catalog.creatures.some((creature) => creature.id === entry.creatureId) && <option value={entry.creatureId}>criatura apagada</option>}
                    {catalog.creatures.map((creature) => (
                      <option key={creature.id} value={creature.id}>
                        {name(catalog, creature.name, creature.key)} ({creature.hp} de vida)
                      </option>
                    ))}
                  </select>
                  <Button type="button" size="icon" variant="ghost" aria-label="Remover inimigo" onClick={() => setEncounter({ creatures: encounter.creatures.filter((_, position) => position !== index) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setEncounter({ creatures: [...encounter.creatures, { creatureId: catalog.creatures[0].id, count: 1 }] })}>
                <Plus className="size-4" />
                Inimigo
              </Button>
            </div>
          )}
          <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-foreground">Como a luta se resolve</span>
            <select aria-label="Modo da luta" className={SELECT_CLASS} value={encounter.mode} onChange={(event) => setEncounter({ mode: event.target.value as EncounterDef["mode"] })}>
              <option value="rounds">em rodadas</option>
              <option value="single">num único teste</option>
            </select>
          </label>
          {encounter.mode === "single" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                Rolagem
                <FormulaInput catalog={catalog} ariaLabel="Rolagem da luta" value={encounter.single.roll} onChange={(roll) => setEncounter({ single: { ...encounter.single, roll } })} />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Dificuldade
                <FormulaInput catalog={catalog} ariaLabel="Dificuldade da luta" value={encounter.single.dc} onChange={(dc) => setEncounter({ single: { ...encounter.single, dc } })} />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Vida perdida na derrota
                <FormulaInput catalog={catalog} ariaLabel="Perda de vida" value={encounter.single.hpLoss} onChange={(hpLoss) => setEncounter({ single: { ...encounter.single, hpLoss } })} />
              </label>
            </div>
          )}
          <div className="grid gap-2 text-sm">
            {(
              [
                ["victorySceneId", "Vitória leva a"],
                ["defeatSceneId", "Derrota leva a"],
                ["fleeSceneId", "Fuga leva a"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-foreground">{label}</span>
                <SceneSelect
                  scenes={catalog.scenes}
                  value={encounter[field]}
                  label={label}
                  emptyLabel={field === "defeatSceneId" ? "gatilho ao zerar a vida" : field === "fleeSceneId" ? "fuga desligada" : "escolher"}
                  onChange={(id) => setEncounter({ [field]: id } as Partial<EncounterDef>)}
                />
              </label>
            ))}
          </div>
          {encounter.mode === "rounds" && (
            <details className="rounded-md border border-border/60 p-2">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Frases do combate (opcional)</summary>
              <p className="mt-1 text-xs text-muted-foreground">
                Use <code>{"{atacante}"}</code>, <code>{"{alvo}"}</code> e <code>{"{dano}"}</code>. Vazio = frase padrão.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {COMBAT_EVENTS.map((event) => (
                  <NameInput
                    key={event}
                    catalog={catalog}
                    label={COMBAT_EVENT_LABELS[event]}
                    value={encounter.messages[event] ?? {}}
                    maxLength={200}
                    onChange={(value) => setEncounter({ messages: { ...encounter.messages, [event]: value } })}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {mechanics.kind === "shop" && (
        <div className="space-y-2 rounded-md border border-border/60 p-2">
          {catalog.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Cadastre itens na aba Itens da obra.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">À venda</p>
              {shop.items.map((entry, index) => (
                <div key={index} className="flex flex-wrap items-center gap-1">
                  <ItemSelect catalog={catalog} value={entry.itemId} onChange={(itemId) => setShop({ items: shop.items.map((current, position) => (position === index ? { ...current, itemId } : current)) })} />
                  <Input aria-label="Preço" type="number" min={0} className="w-24" value={String(entry.price)} onChange={(event) => setShop({ items: shop.items.map((current, position) => (position === index ? { ...current, price: Math.max(0, Math.trunc(Number(event.target.value) || 0)) } : current)) })} />
                  <Input
                    aria-label="Estoque (vazio = sem limite)"
                    type="number"
                    min={0}
                    placeholder="∞"
                    className="w-20"
                    value={entry.stock === null ? "" : String(entry.stock)}
                    onChange={(event) => setShop({ items: shop.items.map((current, position) => (position === index ? { ...current, stock: event.target.value === "" ? null : Math.max(0, Math.trunc(Number(event.target.value) || 0)) } : current)) })}
                  />
                  <Button type="button" size="icon" variant="ghost" aria-label="Remover da loja" onClick={() => setShop({ items: shop.items.filter((_, position) => position !== index) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const item = catalog.items[0];
                  setShop({ items: [...shop.items, { itemId: item.id, price: Math.max(1, item.value), stock: null }] });
                }}
              >
                <Plus className="size-4" />
                Item à venda
              </Button>
              <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-foreground">Compra do leitor por (% do valor)</span>
                <Input aria-label="Porcentagem de venda" type="number" min={0} max={100} className="w-20" value={String(Math.round(shop.sellRate * 100))} onChange={(event) => setShop({ sellRate: Math.max(0, Math.min(100, Number(event.target.value) || 0)) / 100 })} />
              </label>
            </>
          )}
        </div>
      )}

      {resources.length > 0 && (
        <div className="space-y-2">
          {resources.map((resource) => {
            const overridden = resource.key in mechanics.onZero;
            return (
              <div key={resource.key} className="flex flex-wrap items-center gap-2 text-sm">
                <Switch
                  aria-label={`Ao zerar ${name(catalog, resource.name, resource.key)} nesta cena`}
                  checked={overridden}
                  onCheckedChange={(checked: boolean) => {
                    const onZero = { ...mechanics.onZero };
                    if (checked) onZero[resource.key] = null;
                    else delete onZero[resource.key];
                    onChange({ ...mechanics, onZero });
                  }}
                />
                <span className="text-foreground">Aqui, zerar {name(catalog, resource.name, resource.key)} leva a</span>
                {overridden && (
                  <SceneSelect
                    scenes={catalog.allScenes}
                    value={mechanics.onZero[resource.key]}
                    label={`Cena ao zerar ${resource.key}`}
                    emptyLabel="fica nesta cena"
                    onChange={(id) => onChange({ ...mechanics, onZero: { ...mechanics.onZero, [resource.key]: id } })}
                  />
                )}
              </div>
            );
          })}
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={mechanics.noRegen} onCheckedChange={(checked: boolean) => onChange({ ...mechanics, noRegen: checked })} />
            <span className="text-foreground">Sem regeneração ao entrar nesta cena</span>
          </label>
        </div>
      )}
    </div>
  );
}
