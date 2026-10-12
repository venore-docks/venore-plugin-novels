"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Switch } from "@venore/plugin-sdk/ui";
import type { ChoiceMechanics, ChoiceTest, TestOutcome } from "../../contracts/game";
import { LocalizedInput } from "../../components/localized-input";
import { SELECT_CLASS, type GameCatalog } from "./catalog";
import { FormulaInput } from "./formula-input";
import { CostsEditor, EffectsEditor, SceneSelect } from "./rules";

// Custo em recurso e teste de dados de uma escolha (seções 7.2 e 11 do documento).

function emptyTest(catalog: GameCatalog, targetSceneId: string): ChoiceTest {
  const first = catalog.system.attributes[0];
  return {
    roll: first ? `1d20 + ${first.key}` : "1d20",
    dc: "12",
    label: first ? first.name : { [catalog.locale]: "Teste" },
    successEffects: [],
    failure: { targetSceneId, effects: [] },
    critical: null,
    fumble: null,
    bands: [],
  };
}

function OutcomeEditor({
  catalog,
  title,
  outcome,
  onChange,
  onRemove,
  defaultLabel,
}: {
  catalog: GameCatalog;
  title: string;
  outcome: TestOutcome;
  onChange: (outcome: TestOutcome) => void;
  onRemove?: () => void;
  defaultLabel?: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">vai para</span>
        <SceneSelect scenes={catalog.scenes} value={outcome.targetSceneId || null} onChange={(id) => onChange({ ...outcome, targetSceneId: id ?? "" })} label={`${title}: cena`} emptyLabel={defaultLabel} />
        {onRemove && (
          <Button type="button" size="icon" variant="ghost" className="ms-auto" aria-label={`Remover ${title.toLowerCase()}`} onClick={onRemove}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <EffectsEditor catalog={catalog} effects={outcome.effects} onChange={(effects) => onChange({ ...outcome, effects })} />
    </div>
  );
}

export function ChoiceMechanicsEditor({
  catalog,
  mechanics,
  targetSceneId,
  onChange,
}: {
  catalog: GameCatalog;
  mechanics: ChoiceMechanics;
  targetSceneId: string;
  onChange: (mechanics: ChoiceMechanics) => void;
}) {
  const { system } = catalog;
  const test = mechanics.test;
  const setTest = (patch: Partial<ChoiceTest>) => test && onChange({ ...mechanics, test: { ...test, ...patch } });

  return (
    <div className="space-y-4">
      {system.modules.resources && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Custo</p>
          <CostsEditor catalog={catalog} costs={mechanics.cost} onChange={(cost) => onChange({ ...mechanics, cost })} />
        </div>
      )}

      <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-foreground">Sem condição ou recurso, a escolha</span>
        <select
          aria-label="Quando indisponível"
          className={SELECT_CLASS}
          value={mechanics.whenUnavailable}
          onChange={(event) => onChange({ ...mechanics, whenUnavailable: event.target.value as "hide" | "disable" })}
        >
          <option value="hide">some</option>
          <option value="disable">aparece desabilitada com o motivo</option>
        </select>
      </label>

      {system.modules.dice && (
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-foreground">Teste de dados</span>
            <Switch checked={Boolean(test)} onCheckedChange={(checked: boolean) => onChange({ ...mechanics, test: checked ? emptyTest(catalog, targetSceneId) : null })} />
          </label>
          {test && (
            <div className="space-y-3">
              <LocalizedInput label="Nome no botão" value={test.label} onChange={(label) => setTest({ label })} primaryLocale={catalog.locale} locales={catalog.locales} maxLength={60} placeholder="Destreza" />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-foreground">Rolagem</span>
                  <FormulaInput catalog={catalog} ariaLabel="Rolagem" value={test.roll} onChange={(roll) => setTest({ roll })} placeholder="1d20 + destreza" />
                </label>
                {test.bands.length === 0 && (
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-foreground">Dificuldade (DT)</span>
                    <FormulaInput catalog={catalog} ariaLabel="Dificuldade" value={test.dc} onChange={(dc) => setTest({ dc })} placeholder="15" />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Vantagem: <code>2d20k1</code> (rola dois, fica com o maior). Desvantagem: <code>2d20kl1</code>.
              </p>

              {test.bands.length === 0 ? (
                <>
                  <div className="space-y-2 rounded-md border border-border/60 p-2">
                    <p className="text-sm font-medium text-foreground">Sucesso: vai para a cena da seta</p>
                    <EffectsEditor catalog={catalog} effects={test.successEffects} onChange={(successEffects) => setTest({ successEffects })} />
                  </div>
                  <OutcomeEditor catalog={catalog} title="Falha" outcome={test.failure} onChange={(failure) => setTest({ failure })} defaultLabel="a mesma do sucesso" />
                  {test.critical ? (
                    <OutcomeEditor catalog={catalog} title="Crítico (dado no máximo)" outcome={test.critical} onChange={(critical) => setTest({ critical })} onRemove={() => setTest({ critical: null })} />
                  ) : null}
                  {test.fumble ? (
                    <OutcomeEditor catalog={catalog} title="Falha crítica (dado em 1)" outcome={test.fumble} onChange={(fumble) => setTest({ fumble })} onRemove={() => setTest({ fumble: null })} />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {!test.critical && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setTest({ critical: { targetSceneId, effects: [] } })}>
                        <Plus className="size-4" />
                        Crítico
                      </Button>
                    )}
                    {!test.fumble && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setTest({ fumble: { targetSceneId: test.failure.targetSceneId || targetSceneId, effects: [] } })}>
                        <Plus className="size-4" />
                        Falha crítica
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setTest({
                          bands: [
                            { min: -1000, max: 5, targetSceneId: test.failure.targetSceneId || targetSceneId, effects: [] },
                            { min: 6, max: 14, targetSceneId, effects: [] },
                            { min: 15, max: 1000, targetSceneId, effects: [] },
                          ],
                        })
                      }
                    >
                      Usar faixas no lugar de passa/falha
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Faixas do resultado</p>
                  {test.bands.map((band, index) => (
                    <div key={index} className="space-y-2 rounded-md border border-border/60 p-2">
                      <div className="flex flex-wrap items-center gap-1 text-sm">
                        <span className="text-muted-foreground">de</span>
                        <Input aria-label="Mínimo" type="number" className="w-20" value={String(band.min)} onChange={(event) => setTest({ bands: test.bands.map((current, position) => (position === index ? { ...current, min: Number(event.target.value) || 0 } : current)) })} />
                        <span className="text-muted-foreground">a</span>
                        <Input aria-label="Máximo" type="number" className="w-20" value={String(band.max)} onChange={(event) => setTest({ bands: test.bands.map((current, position) => (position === index ? { ...current, max: Number(event.target.value) || 0 } : current)) })} />
                        <span className="text-muted-foreground">vai para</span>
                        <SceneSelect scenes={catalog.scenes} value={band.targetSceneId || null} onChange={(id) => setTest({ bands: test.bands.map((current, position) => (position === index ? { ...current, targetSceneId: id ?? "" } : current)) })} label="Cena da faixa" />
                        <Button type="button" size="icon" variant="ghost" className="ms-auto" aria-label="Remover faixa" onClick={() => setTest({ bands: test.bands.filter((_, position) => position !== index) })}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <EffectsEditor catalog={catalog} effects={band.effects} onChange={(effects) => setTest({ bands: test.bands.map((current, position) => (position === index ? { ...current, effects } : current)) })} />
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setTest({ bands: [...test.bands, { min: 0, max: 0, targetSceneId, effects: [] }] })}>
                      <Plus className="size-4" />
                      Faixa
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setTest({ bands: [] })}>
                      Voltar para passa/falha
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
