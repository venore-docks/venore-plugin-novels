"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@venore/plugin-sdk/ui";
import type {
  AchievementDef,
  AttributeDef,
  CombatActionDef,
  DerivedDef,
  GameSystem,
  ProfileFieldDef,
  QuestDef,
  ResourceDef,
  StatusEffectDef,
  VocationDef,
} from "../../contracts/game";
import { evaluateNumber } from "../../shared/engine/formula";
import { name, SELECT_CLASS, type GameCatalog } from "./catalog";
import { ColorPicker, DefinitionList, Field, KeyInput, ModifiersEditor, NameInput, NumberInput, Toggle, uniqueId } from "./fields";
import { FormulaInput } from "./formula-input";
import { ConditionsEditor, CostsEditor, EffectsEditor, ItemSelect, SceneSelect } from "./rules";

type SectionProps = { catalog: GameCatalog; system: GameSystem; set: (patch: Partial<GameSystem>) => void };

const t = (catalog: GameCatalog, text: string) => ({ [catalog.locale]: text });

// ------------------------------------------------------------------ recursos

export function ResourcesSection({ catalog, system, set }: SectionProps) {
  const create = (): ResourceDef => ({
    key: uniqueId("recurso", system.resources.map((resource) => resource.key)),
    name: t(catalog, "Novo recurso"),
    abbr: {},
    color: "chart-2",
    max: "10",
    initial: "max",
    regen: "",
    regenInCombat: false,
    onZero: null,
    onFull: null,
    showInHud: true,
    lowPercent: 25,
  });
  return (
    <DefinitionList
      items={system.resources}
      onChange={(resources) => set({ resources })}
      create={create}
      addLabel="Recurso"
      empty="Nenhum recurso. Ex: Vida, Mana, Fôlego, Sanidade."
      title={(resource) => `${name(catalog, resource.name, resource.key)} (${resource.key})`}
      render={(resource, update) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <NameInput catalog={catalog} label="Nome" value={resource.name} onChange={(value) => update({ name: value })} />
            <NameInput catalog={catalog} label="Sigla no HUD" value={resource.abbr} onChange={(value) => update({ abbr: value })} maxLength={8} />
            <KeyInput value={resource.key} onChange={(key) => update({ key })} />
            <ColorPicker value={resource.color} onChange={(color) => update({ color })} />
            <Field label="Máximo" hint="Número ou fórmula: 100 + 5 * nivel + 2 * vigor">
              <FormulaInput catalog={catalog} ariaLabel="Máximo" value={resource.max} onChange={(max) => update({ max })} />
            </Field>
            <Field label="Começa em" hint='"max" = cheio'>
              <Input value={resource.initial} maxLength={200} className="font-mono" onChange={(event) => update({ initial: event.target.value })} />
            </Field>
            <Field label="Regeneração por cena" hint="Vazio = não regenera">
              <FormulaInput catalog={catalog} ariaLabel="Regeneração" allowEmpty value={resource.regen} onChange={(regen) => update({ regen })} />
            </Field>
            <NumberInput label="Barra fica baixa abaixo de (%)" min={0} max={100} value={resource.lowPercent} onChange={(lowPercent) => update({ lowPercent: Math.max(0, Math.min(100, lowPercent)) })} />
          </div>
          <Toggle label="Regenera também em cena de luta" checked={resource.regenInCombat} onChange={(regenInCombat) => update({ regenInCombat })} />
          <Toggle label="Mostrar no HUD" checked={resource.showInHud} onChange={(showInHud) => update({ showInHud })} />
          {(["onZero", "onFull"] as const).map((field) => {
            const trigger = resource[field];
            const label = field === "onZero" ? "Ao zerar" : "Ao lotar";
            return (
              <div key={field} className="space-y-2 rounded-md border border-border/60 p-2">
                <Toggle label={label} checked={Boolean(trigger)} onChange={(checked) => update({ [field]: checked ? { sceneId: null, effects: [] } : null } as Partial<ResourceDef>)} hint={field === "onZero" ? "Dispara depois de todos os efeitos da escolha." : "Raro, mas útil (Corrupção que mata ao encher)."} />
                {trigger && (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-foreground">Vai para</span>
                      <SceneSelect scenes={catalog.allScenes} value={trigger.sceneId} label={`${label}: cena`} emptyLabel="fica na cena" onChange={(sceneId) => update({ [field]: { ...trigger, sceneId } } as Partial<ResourceDef>)} />
                    </div>
                    <EffectsEditor catalog={catalog} effects={trigger.effects} onChange={(effects) => update({ [field]: { ...trigger, effects } } as Partial<ResourceDef>)} />
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    />
  );
}

// ------------------------------------------------------------------ atributos

export function AttributesSection({ catalog, system, set }: SectionProps) {
  const create = (): AttributeDef => ({
    key: uniqueId("atributo", system.attributes.map((attribute) => attribute.key)),
    name: t(catalog, "Novo atributo"),
    abbr: {},
    kind: "stat",
    initial: 1,
    min: 0,
    cap: "",
    showInHud: false,
    training: { enabled: false, threshold: "50 * 1.1 ^ valor" },
  });
  const createDerived = (): DerivedDef => ({ key: uniqueId("derivado", system.derived.map((derived) => derived.key)), name: t(catalog, "Novo valor"), formula: "", show: true });
  return (
    <div className="space-y-4">
      <DefinitionList
        items={system.attributes}
        onChange={(attributes) => set({ attributes })}
        create={create}
        addLabel="Atributo ou habilidade"
        empty="Nenhum. Ex: Força, Destreza (atributos); Espada, Magia (habilidades)."
        title={(attribute) => `${name(catalog, attribute.name, attribute.key)} · ${attribute.kind === "skill" ? "habilidade" : "atributo"}`}
        render={(attribute, update) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <NameInput catalog={catalog} label="Nome" value={attribute.name} onChange={(value) => update({ name: value })} />
              <NameInput catalog={catalog} label="Sigla" value={attribute.abbr} onChange={(value) => update({ abbr: value })} maxLength={8} />
              <KeyInput value={attribute.key} onChange={(key) => update({ key })} />
              <Field label="Papel" hint="Atributo sobe por pontos de nível; habilidade sobe pelo uso ou por efeito.">
                <select className={SELECT_CLASS} value={attribute.kind} onChange={(event) => update({ kind: event.target.value as AttributeDef["kind"] })}>
                  <option value="stat">Atributo (stat)</option>
                  <option value="skill">Habilidade (skill)</option>
                </select>
              </Field>
              <NumberInput label="Valor inicial" value={attribute.initial} onChange={(initial) => update({ initial })} />
              <NumberInput label="Mínimo" value={attribute.min} onChange={(min) => update({ min })} />
              <Field label="Teto" hint="Vazio = sem teto próprio">
                <FormulaInput catalog={catalog} ariaLabel="Teto" allowEmpty value={attribute.cap} onChange={(cap) => update({ cap })} />
              </Field>
            </div>
            <Toggle label="Mostrar no HUD" checked={attribute.showInHud} onChange={(showInHud) => update({ showInHud })} />
            {attribute.kind === "skill" && (
              <div className="space-y-2 rounded-md border border-border/60 p-2">
                <Toggle label="Sobe com o uso" hint="Cada ação de combate que treina esta habilidade conta uma tentativa." checked={attribute.training.enabled} onChange={(enabled) => update({ training: { ...attribute.training, enabled } })} />
                {attribute.training.enabled && (
                  <Field label="Tentativas para subir" hint="valor = nível atual da habilidade. Ex: 50 * 1.1 ^ valor">
                    <FormulaInput catalog={catalog} ariaLabel="Limiar de treino" extraNames={["valor"]} value={attribute.training.threshold} onChange={(threshold) => update({ training: { ...attribute.training, threshold } })} />
                  </Field>
                )}
              </div>
            )}
          </>
        )}
      />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Valores derivados</p>
        <p className="text-xs text-muted-foreground">Calculados por fórmula (Ataque, Defesa total). Aparecem na ficha e servem em condições; nunca recebem efeito direto.</p>
        <DefinitionList
          items={system.derived}
          onChange={(derived) => set({ derived })}
          create={createDerived}
          addLabel="Valor derivado"
          title={(derived) => `${name(catalog, derived.name, derived.key)} = ${derived.formula || "…"}`}
          render={(derived, update) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <NameInput catalog={catalog} label="Nome" value={derived.name} onChange={(value) => update({ name: value })} />
              <KeyInput value={derived.key} onChange={(key) => update({ key })} />
              <Field label="Fórmula" className="sm:col-span-2">
                <FormulaInput catalog={catalog} ariaLabel="Fórmula do valor" value={derived.formula} onChange={(formula) => update({ formula })} />
              </Field>
              <Toggle label="Mostrar na ficha" checked={derived.show} onChange={(show) => update({ show })} />
            </div>
          )}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ progressão

export function ProgressionSection({ catalog, system, set }: SectionProps) {
  const progression = system.progression;
  const update = (patch: Partial<GameSystem["progression"]>) => set({ progression: { ...progression, ...patch } });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <NameInput catalog={catalog} label="Nome da experiência" value={progression.xpName} onChange={(xpName) => update({ xpName })} />
        <NameInput catalog={catalog} label="Nome do nível" value={progression.levelName} onChange={(levelName) => update({ levelName })} />
        <NameInput catalog={catalog} label="Nome dos pontos" value={progression.pointsName} onChange={(pointsName) => update({ pointsName })} />
        <KeyInput label="Chave da experiência" value={progression.xpKey} onChange={(xpKey) => update({ xpKey })} />
        <KeyInput label="Chave do nível" value={progression.levelKey} onChange={(levelKey) => update({ levelKey })} />
        <KeyInput label="Chave dos pontos" value={progression.pointsKey} onChange={(pointsKey) => update({ pointsKey })} />
      </div>
      <div className="space-y-2 rounded-md border border-border/60 p-2">
        <Field label="Curva de XP">
          <select className={SELECT_CLASS} value={progression.curve.kind} onChange={(event) => update({ curve: event.target.value === "table" ? { kind: "table", thresholds: [100, 300, 600, 1000] } : { kind: "formula", formula: "50 * (n - 1) * n" } })}>
            <option value="formula">Fórmula (n = nível)</option>
            <option value="table">Tabela manual</option>
          </select>
        </Field>
        {progression.curve.kind === "formula" ? (
          <Field label="XP total para chegar ao nível n" hint="Tibia: 50 / 3 * (n ^ 3 - 6 * n ^ 2 + 17 * n - 12)">
            <FormulaInput catalog={catalog} ariaLabel="Curva de XP" extraNames={["n"]} value={progression.curve.formula} onChange={(formula) => update({ curve: { kind: "formula", formula } })} />
          </Field>
        ) : (
          <Field label="XP para os níveis 2, 3, 4… (separado por vírgula)">
            <Input
              defaultValue={progression.curve.thresholds.join(", ")}
              onBlur={(event) => update({ curve: { kind: "table", thresholds: event.target.value.split(/[,;\s]+/).map(Number).filter((value) => Number.isFinite(value) && value > 0).slice(0, 200) } })}
            />
          </Field>
        )}
        <XpPreview catalog={catalog} system={system} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberInput label="Nível máximo" min={1} max={1000} value={progression.maxLevel} onChange={(maxLevel) => update({ maxLevel: Math.max(1, Math.min(1000, Math.trunc(maxLevel))) })} />
        <NumberInput label="Pontos por nível" min={0} max={100} value={progression.pointsPerLevel} onChange={(pointsPerLevel) => update({ pointsPerLevel: Math.max(0, Math.trunc(pointsPerLevel)) })} />
        <Field label="Teto dos atributos" hint="Fórmula, ex: nivel + 5. Vazio = sem teto.">
          <FormulaInput catalog={catalog} ariaLabel="Teto por nível" allowEmpty value={progression.attributeCap} onChange={(attributeCap) => update({ attributeCap })} />
        </Field>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Custo crescente dos pontos</p>
        <p className="text-xs text-muted-foreground">Quanto custa subir o atributo conforme o valor atual: evita builds puras.</p>
        {progression.pointCosts.map((tier, index) => (
          <div key={index} className="flex flex-wrap items-center gap-1 text-sm">
            <span className="text-muted-foreground">abaixo de</span>
            <Input
              aria-label="Até o valor"
              type="number"
              className="w-20"
              placeholder="∞"
              value={tier.upTo === null ? "" : String(tier.upTo)}
              onChange={(event) => update({ pointCosts: progression.pointCosts.map((current, position) => (position === index ? { ...current, upTo: event.target.value === "" ? null : Number(event.target.value) } : current)) })}
            />
            <span className="text-muted-foreground">custa</span>
            <Input aria-label="Custo" type="number" min={1} className="w-16" value={String(tier.cost)} onChange={(event) => update({ pointCosts: progression.pointCosts.map((current, position) => (position === index ? { ...current, cost: Math.max(1, Math.trunc(Number(event.target.value) || 1)) } : current)) })} />
            <span className="text-muted-foreground">ponto(s)</span>
            <Button type="button" size="icon" variant="ghost" aria-label="Remover faixa de custo" onClick={() => update({ pointCosts: progression.pointCosts.filter((_, position) => position !== index) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => update({ pointCosts: [...progression.pointCosts, { upTo: null, cost: 1 }] })}>
          <Plus className="size-4" />
          Faixa de custo
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Ao subir de nível</p>
        <EffectsEditor catalog={catalog} effects={progression.onLevelUp} onChange={(onLevelUp) => update({ onLevelUp })} />
      </div>
    </div>
  );
}

function XpPreview({ system }: { catalog: GameCatalog; system: GameSystem }) {
  const curve = system.progression.curve;
  const rows: string[] = [];
  for (let level = 2; level <= Math.min(8, system.progression.maxLevel); level += 1) {
    let xp: number;
    if (curve.kind === "table") xp = curve.thresholds[level - 2] ?? Number.NaN;
    else {
      xp = Math.round(evaluateNumber(curve.formula, { get: (key: string) => (key === "n" ? level : undefined) }, Number.NaN));
    }
    rows.push(`${level}: ${Number.isFinite(xp) ? xp : "—"}`);
  }
  return <p className="text-xs text-muted-foreground">Nível: XP · {rows.join(" · ")}</p>;
}

// ------------------------------------------------------------------ inventário e equipamento

export function InventorySection({ catalog, system, set }: SectionProps) {
  const inventory = system.inventory;
  const update = (patch: Partial<GameSystem["inventory"]>) => set({ inventory: { ...inventory, ...patch } });
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-border/60 p-2">
        <Toggle label="Peso" hint="Consigo carregar? (CAP)" checked={inventory.weight.enabled} onChange={(enabled) => update({ weight: { ...inventory.weight, enabled } })} />
        {inventory.weight.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NameInput catalog={catalog} label="Nome" value={inventory.weight.name} onChange={(value) => update({ weight: { ...inventory.weight, name: value } })} />
            <NameInput catalog={catalog} label="Unidade" value={inventory.weight.unit} onChange={(unit) => update({ weight: { ...inventory.weight, unit } })} maxLength={10} />
            <Field label="Peso máximo" hint="Ex: 400 + 25 * nivel">
              <FormulaInput catalog={catalog} ariaLabel="Peso máximo" value={inventory.weight.max} onChange={(max) => update({ weight: { ...inventory.weight, max } })} />
            </Field>
            <Field label="Ao passar do limite">
              <select className={SELECT_CLASS} value={inventory.weight.overLimit} onChange={(event) => update({ weight: { ...inventory.weight, overLimit: event.target.value as "block" | "penalty" } })}>
                <option value="block">não deixa pegar</option>
                <option value="penalty">deixa, com penalidade</option>
              </select>
            </Field>
            <Toggle label="Itens equipados contam no peso" checked={inventory.weight.countEquipped} onChange={(countEquipped) => update({ weight: { ...inventory.weight, countEquipped } })} />
            {inventory.weight.overLimit === "penalty" && (
              <ModifiersEditor catalog={catalog} label="Penalidade" value={inventory.weight.penalty} onChange={(penalty) => update({ weight: { ...inventory.weight, penalty } })} />
            )}
          </div>
        )}
      </div>
      <div className="space-y-2 rounded-md border border-border/60 p-2">
        <Toggle label="Espaço" hint="Cabe na bolsa? Itens ocupam espaços; recipientes equipados ampliam." checked={inventory.space.enabled} onChange={(enabled) => update({ space: { ...inventory.space, enabled } })} />
        {inventory.space.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NameInput catalog={catalog} label="Nome" value={inventory.space.name} onChange={(value) => update({ space: { ...inventory.space, name: value } })} />
            <NumberInput label="Espaços iniciais" min={0} max={200} value={inventory.space.base} onChange={(base) => update({ space: { ...inventory.space, base: Math.max(0, Math.trunc(base)) } })} />
          </div>
        )}
      </div>
      <div className="space-y-2 rounded-md border border-border/60 p-2">
        <Toggle label="Mãos" hint="Consigo segurar? Arma de duas mãos ocupa as duas." checked={inventory.hands.enabled} onChange={(enabled) => update({ hands: { ...inventory.hands, enabled } })} />
        {inventory.hands.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NameInput catalog={catalog} label="Nome" value={inventory.hands.name} onChange={(value) => update({ hands: { ...inventory.hands, name: value } })} />
            <NumberInput label="Quantidade" min={1} max={6} value={inventory.hands.count} onChange={(count) => update({ hands: { ...inventory.hands, count: Math.max(1, Math.min(6, Math.trunc(count))) } })} />
          </div>
        )}
      </div>
    </div>
  );
}

export function EquipmentSection({ catalog, system, set }: SectionProps) {
  return (
    <DefinitionList
      items={system.slots}
      onChange={(slots) => set({ slots })}
      create={() => ({ key: uniqueId("area", system.slots.map((slot) => slot.key)), name: t(catalog, "Nova área"), count: 1 })}
      addLabel="Área de equipar"
      empty="Nenhuma área. Ex: Cabeça, Corpo, Pernas, Pés, Anel (2), Amuleto, Costas."
      title={(slot) => `${name(catalog, slot.name, slot.key)}${slot.count > 1 ? ` ×${slot.count}` : ""}`}
      render={(slot, update) => (
        <div className="grid gap-3 sm:grid-cols-3">
          <NameInput catalog={catalog} label="Nome" value={slot.name} onChange={(value) => update({ name: value })} />
          <KeyInput value={slot.key} onChange={(key) => update({ key })} />
          <NumberInput label="Encaixes" min={1} max={10} value={slot.count} onChange={(count) => update({ count: Math.max(1, Math.min(10, Math.trunc(count))) })} />
        </div>
      )}
    />
  );
}

// ------------------------------------------------------------------ dados

export function DiceSection({ catalog, system, set }: SectionProps) {
  const dice = system.dice;
  const update = (patch: Partial<GameSystem["dice"]>) => set({ dice: { ...dice, ...patch } });
  return (
    <div className="space-y-4">
      <Field label="Mostrar a dificuldade ao leitor">
        <select className={SELECT_CLASS} value={dice.showDc} onChange={(event) => update({ showDc: event.target.value as GameSystem["dice"]["showDc"] })}>
          <option value="number">o número (DT 15)</option>
          <option value="words">em palavras (fácil, médio, difícil)</option>
          <option value="hidden">não mostrar</option>
        </select>
      </Field>
      {dice.showDc === "words" && (
        <div className="space-y-1">
          {dice.words.map((word, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <NumberInput label="Até a DT" value={word.upTo} onChange={(upTo) => update({ words: dice.words.map((current, position) => (position === index ? { ...current, upTo } : current)) })} />
              <NameInput catalog={catalog} label="Palavra" value={word.label} onChange={(label) => update({ words: dice.words.map((current, position) => (position === index ? { ...current, label } : current)) })} maxLength={20} />
              <Button type="button" size="icon" variant="ghost" aria-label="Remover palavra" onClick={() => update({ words: dice.words.filter((_, position) => position !== index) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => update({ words: [...dice.words, { upTo: 1000, label: t(catalog, "lendário") }] })}>
            <Plus className="size-4" />
            Palavra
          </Button>
        </div>
      )}
      <div className="space-y-2 rounded-md border border-border/60 p-2">
        <Toggle
          label="Rolar de novo como recurso de jogo"
          hint="A rolagem é travada por partida (voltar não muda o dado). Rolar de novo só pagando o custo."
          checked={dice.reroll.enabled}
          onChange={(enabled) => update({ reroll: { ...dice.reroll, enabled } })}
        />
        {dice.reroll.enabled && <CostsEditor catalog={catalog} costs={dice.reroll.cost} onChange={(cost) => update({ reroll: { ...dice.reroll, cost } })} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ combate

export function CombatSection({ catalog, system, set }: SectionProps) {
  const combat = system.combat;
  const update = (patch: Partial<GameSystem["combat"]>) => set({ combat: { ...combat, ...patch } });
  const skills = system.attributes.filter((attribute) => attribute.kind === "skill" && attribute.training.enabled);
  const createAction = (): CombatActionDef => ({
    key: uniqueId("atacar", combat.actions.map((action) => action.key)),
    name: t(catalog, "Atacar"),
    damage: "max(1, atacante.ataque - defensor.defesa)",
    reduction: "0",
    hit: "",
    cost: [],
    trains: null,
    requires: [],
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Recurso que é a vida">
          <select className={SELECT_CLASS} value={combat.hpResource} onChange={(event) => update({ hpResource: event.target.value })}>
            <option value="">Escolha</option>
            {system.resources.map((resource) => (
              <option key={resource.key} value={resource.key}>
                {name(catalog, resource.name, resource.key)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dado de combate (valor de dado)" hint="Ex: 1d10 / 10 (de 0,1 a 1), 1d6">
          <FormulaInput catalog={catalog} ariaLabel="Dado de combate" value={combat.die} onChange={(die) => update({ die })} />
        </Field>
        <NumberInput label="Dano mínimo" min={0} value={combat.minDamage} onChange={(minDamage) => update({ minDamage: Math.max(0, minDamage) })} />
        <NumberInput label="Redução máxima (0 a 1)" min={0} max={1} step={0.05} value={combat.maxReduction} onChange={(maxReduction) => update({ maxReduction: Math.max(0, Math.min(1, maxReduction)) })} hint="Teto da redução de dano: 0,75 = nunca reduz mais que 75%." />
      </div>
      <p className="text-xs text-muted-foreground">
        Nas fórmulas: <code>dado</code>, <code>atacante.chave</code> e <code>defensor.chave</code>. Redução com retorno decrescente: <code>defensor.defesa / (defensor.defesa + 50)</code>.
      </p>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Ações do leitor</p>
        <DefinitionList
          items={combat.actions}
          onChange={(actions) => update({ actions })}
          create={createAction}
          addLabel="Ação"
          empty="Sem ações: crie ao menos Atacar."
          title={(action) => name(catalog, action.name, action.key)}
          render={(action, change) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <NameInput catalog={catalog} label="Nome" value={action.name} onChange={(value) => change({ name: value })} />
                <KeyInput value={action.key} onChange={(key) => change({ key })} />
                <Field label="Dano">
                  <FormulaInput catalog={catalog} combat ariaLabel="Dano" value={action.damage} onChange={(damage) => change({ damage })} />
                </Field>
                <Field label="Redução (0 a 1)">
                  <FormulaInput catalog={catalog} combat ariaLabel="Redução" value={action.reduction} onChange={(reduction) => change({ reduction })} />
                </Field>
                <Field label="Acerta se" hint="Vazio = sempre acerta">
                  <FormulaInput catalog={catalog} combat allowEmpty ariaLabel="Acerto" value={action.hit} onChange={(hit) => change({ hit })} />
                </Field>
                <Field label="Treina a habilidade">
                  <select className={SELECT_CLASS} value={action.trains ?? ""} onChange={(event) => change({ trains: event.target.value || null })}>
                    <option value="">nenhuma</option>
                    {skills.map((skill) => (
                      <option key={skill.key} value={skill.key}>
                        {name(catalog, skill.name, skill.key)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Custo</p>
                <CostsEditor catalog={catalog} costs={action.cost} onChange={(cost) => change({ cost })} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Só aparece se</p>
                <ConditionsEditor catalog={catalog} conditions={action.requires} onChange={(requires) => change({ requires })} />
              </div>
            </>
          )}
        />
      </div>
      <div className="space-y-2 rounded-md border border-border/60 p-2">
        <p className="text-sm font-semibold text-foreground">Ataque dos inimigos</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Dano">
            <FormulaInput catalog={catalog} combat ariaLabel="Dano do inimigo" value={combat.enemy.damage} onChange={(damage) => update({ enemy: { ...combat.enemy, damage } })} />
          </Field>
          <Field label="Redução">
            <FormulaInput catalog={catalog} combat ariaLabel="Redução contra inimigo" value={combat.enemy.reduction} onChange={(reduction) => update({ enemy: { ...combat.enemy, reduction } })} />
          </Field>
          <Field label="Acerta se">
            <FormulaInput catalog={catalog} combat allowEmpty ariaLabel="Acerto do inimigo" value={combat.enemy.hit} onChange={(hit) => update({ enemy: { ...combat.enemy, hit } })} />
          </Field>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-md border border-border/60 p-2">
          <Toggle label="Defender" hint="Aumenta a redução nesta rodada." checked={combat.defend.enabled} onChange={(enabled) => update({ defend: { ...combat.defend, enabled } })} />
          {combat.defend.enabled && <NumberInput label="Redução extra (0 a 1)" step={0.05} min={0} max={1} value={combat.defend.reductionBonus} onChange={(reductionBonus) => update({ defend: { ...combat.defend, reductionBonus: Math.max(0, Math.min(1, reductionBonus)) } })} />}
        </div>
        <div className="space-y-2 rounded-md border border-border/60 p-2">
          <Toggle label="Fugir" hint="Teste; sucesso leva à cena de fuga do encontro." checked={combat.flee.enabled} onChange={(enabled) => update({ flee: { ...combat.flee, enabled } })} />
          {combat.flee.enabled && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Rolagem">
                <FormulaInput catalog={catalog} ariaLabel="Rolagem da fuga" value={combat.flee.roll} onChange={(roll) => update({ flee: { ...combat.flee, roll } })} />
              </Field>
              <Field label="Dificuldade">
                <FormulaInput catalog={catalog} ariaLabel="Dificuldade da fuga" value={combat.flee.dc} onChange={(dc) => update({ flee: { ...combat.flee, dc } })} />
              </Field>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ personagem

export function CharacterSection({ catalog, system, set }: SectionProps) {
  const character = system.character;
  const update = (patch: Partial<GameSystem["character"]>) => set({ character: { ...character, ...patch } });
  const createField = (): ProfileFieldDef => ({ key: uniqueId("campo", character.fields.map((field) => field.key)), name: t(catalog, "Novo campo"), kind: "text", options: [], fallback: "" });
  const createVocation = (): VocationDef => ({ id: uniqueId("vocacao", character.vocations.map((vocation) => vocation.id)), name: t(catalog, "Nova vocação"), description: {}, imageMediaId: null, values: {}, items: [] });
  const numbers = [...system.attributes.map((attribute) => ({ key: attribute.key, label: name(catalog, attribute.name, attribute.key) })), ...catalog.variables.filter((variable) => variable.type === "number").map((variable) => ({ key: variable.key, label: variable.label || variable.key }))];
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Antes da primeira cena o leitor preenche a ficha, escolhe a vocação e distribui pontos. No texto, <code>{"{nome}"}</code> põe o valor e{" "}
        <code>{"{sexo|feminino:cansada|masculino:cansado|cansade}"}</code> escolhe a palavra pelo valor (o último é o padrão).
      </p>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Ficha</p>
        <DefinitionList
          items={character.fields}
          onChange={(fields) => update({ fields })}
          create={createField}
          addLabel="Campo da ficha"
          empty="Ex: Nome (texto), Sexo (escolha: feminino, masculino, outro), Pronomes."
          title={(field) => `${name(catalog, field.name, field.key)} · ${field.kind === "choice" ? "escolha" : "texto"}`}
          render={(field, change) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <NameInput catalog={catalog} label="Nome" value={field.name} onChange={(value) => change({ name: value })} />
                <KeyInput value={field.key} onChange={(key) => change({ key })} />
                <Field label="Tipo">
                  <select className={SELECT_CLASS} value={field.kind} onChange={(event) => change({ kind: event.target.value as ProfileFieldDef["kind"] })}>
                    <option value="text">texto livre</option>
                    <option value="choice">escolha</option>
                  </select>
                </Field>
                <Field label="Valor padrão" hint="Usado na leitura em voz alta e para quem não preencher.">
                  <Input value={field.fallback} maxLength={40} onChange={(event) => change({ fallback: event.target.value })} />
                </Field>
              </div>
              {field.kind === "choice" && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Opções</p>
                  {field.options.map((option, index) => (
                    <div key={index} className="flex flex-wrap items-end gap-2">
                      <Field label="Valor" className="w-32">
                        <Input value={option.value} maxLength={40} className="font-mono" onChange={(event) => change({ options: field.options.map((current, position) => (position === index ? { ...current, value: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") } : current)) })} />
                      </Field>
                      <div className="min-w-40 flex-1">
                        <NameInput catalog={catalog} label="Texto" value={option.name} onChange={(value) => change({ options: field.options.map((current, position) => (position === index ? { ...current, name: value } : current)) })} />
                      </div>
                      <Button type="button" size="icon" variant="ghost" aria-label="Remover opção" onClick={() => change({ options: field.options.filter((_, position) => position !== index) })}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" onClick={() => change({ options: [...field.options, { value: uniqueId("opcao", field.options.map((option) => option.value)), name: {} }] })}>
                    <Plus className="size-4" />
                    Opção
                  </Button>
                </div>
              )}
            </>
          )}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Vocações</p>
        <DefinitionList
          items={character.vocations}
          onChange={(vocations) => update({ vocations })}
          create={createVocation}
          addLabel="Vocação"
          empty="Sem vocações: o leitor só preenche a ficha e distribui pontos."
          title={(vocation) => name(catalog, vocation.name, vocation.id)}
          render={(vocation, change) => (
            <>
              <NameInput catalog={catalog} label="Nome" value={vocation.name} onChange={(value) => change({ name: value })} />
              <NameInput catalog={catalog} label="Descrição" value={vocation.description} onChange={(description) => change({ description })} maxLength={300} multiline />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Valores iniciais</p>
                {Object.entries(vocation.values).map(([key, value]) => (
                  <div key={key} className="flex flex-wrap items-center gap-1">
                    <span className="min-w-28 text-sm text-foreground">{numbers.find((entry) => entry.key === key)?.label ?? key}</span>
                    <Input aria-label={`Valor de ${key}`} type="number" className="w-24" value={String(value)} onChange={(event) => change({ values: { ...vocation.values, [key]: Number(event.target.value) || 0 } })} />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remover ${key}`}
                      onClick={() => {
                        const values = { ...vocation.values };
                        delete values[key];
                        change({ values });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <select className={SELECT_CLASS} aria-label="Adicionar valor inicial" value="" onChange={(event) => event.target.value && change({ values: { ...vocation.values, [event.target.value]: 0 } })}>
                  <option value="">+ valor inicial…</option>
                  {numbers
                    .filter((entry) => !(entry.key in vocation.values))
                    .map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                </select>
              </div>
              {catalog.items.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Itens iniciais</p>
                  {vocation.items.map((entry, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-1">
                      <Input aria-label="Quantidade" type="number" min={1} className="w-16" value={String(entry.quantity)} onChange={(event) => change({ items: vocation.items.map((current, position) => (position === index ? { ...current, quantity: Math.max(1, Math.trunc(Number(event.target.value) || 1)) } : current)) })} />
                      <ItemSelect catalog={catalog} value={entry.itemId} onChange={(itemId) => change({ items: vocation.items.map((current, position) => (position === index ? { ...current, itemId } : current)) })} />
                      <Button type="button" size="icon" variant="ghost" aria-label="Remover item inicial" onClick={() => change({ items: vocation.items.filter((_, position) => position !== index) })}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" onClick={() => change({ items: [...vocation.items, { itemId: catalog.items[0].id, quantity: 1 }] })}>
                    <Plus className="size-4" />
                    Item inicial
                  </Button>
                </div>
              )}
            </>
          )}
        />
      </div>
      <NumberInput label="Pontos para distribuir na criação" min={0} max={100} value={character.startingPoints} onChange={(startingPoints) => update({ startingPoints: Math.max(0, Math.trunc(startingPoints)) })} />
    </div>
  );
}

// ------------------------------------------------------------------ extras

export function ShopsSection({ catalog, system, set }: SectionProps) {
  const currency = system.currency;
  const update = (patch: Partial<GameSystem["currency"]>) => set({ currency: { ...currency, ...patch } });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Moeda">
        <select className={SELECT_CLASS} value={currency.mode} onChange={(event) => update({ mode: event.target.value as "counter" | "item" })}>
          <option value="counter">contador, sem peso</option>
          <option value="item">item empilhável (tem peso)</option>
        </select>
      </Field>
      <NameInput catalog={catalog} label="Nome da moeda" value={currency.name} onChange={(value) => update({ name: value })} />
      {currency.mode === "counter" ? (
        <KeyInput value={currency.key} onChange={(key) => update({ key })} />
      ) : (
        <Field label="Item que é o dinheiro">
          <ItemSelect catalog={catalog} value={currency.itemId ?? ""} onChange={(itemId) => update({ itemId })} />
        </Field>
      )}
    </div>
  );
}

export function StatusEffectsSection({ catalog, system, set }: SectionProps) {
  const create = (): StatusEffectDef => ({ id: uniqueId("efeito", system.statusEffects.map((effect) => effect.id)), name: t(catalog, "Novo efeito"), color: "chart-5", duration: 3, perScene: [], modifiers: [] });
  return (
    <DefinitionList
      items={system.statusEffects}
      onChange={(statusEffects) => set({ statusEffects })}
      create={create}
      addLabel="Efeito com duração"
      empty="Ex: Envenenado (−2 de vida por cena, 3 cenas), Abençoado (+2 de defesa)."
      title={(effect) => `${name(catalog, effect.name, effect.id)}${effect.duration ? ` · ${effect.duration} cenas` : ""}`}
      render={(effect, update) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <NameInput catalog={catalog} label="Nome" value={effect.name} onChange={(value) => update({ name: value })} />
            <KeyInput label="Id" value={effect.id} onChange={(id) => update({ id })} />
            <Field label="Duração em cenas" hint="Vazio = até ser removido">
              <Input type="number" min={1} value={effect.duration === null ? "" : String(effect.duration)} onChange={(event) => update({ duration: event.target.value === "" ? null : Math.max(1, Math.trunc(Number(event.target.value) || 1)) })} />
            </Field>
            <ColorPicker value={effect.color} onChange={(color) => update({ color })} />
          </div>
          <ModifiersEditor catalog={catalog} value={effect.modifiers} onChange={(modifiers) => update({ modifiers })} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">A cada cena</p>
            <EffectsEditor catalog={catalog} effects={effect.perScene} onChange={(perScene) => update({ perScene })} />
          </div>
        </>
      )}
    />
  );
}

export function QuestsSection({ catalog, system, set }: SectionProps) {
  const create = (): QuestDef => ({ id: uniqueId("missao", system.quests.map((quest) => quest.id)), name: t(catalog, "Nova missão"), description: {}, steps: [{ id: "etapa_1", text: t(catalog, "Primeira etapa") }] });
  return (
    <DefinitionList
      items={system.quests}
      onChange={(quests) => set({ quests })}
      create={create}
      addLabel="Missão"
      empty="Missões com etapas, marcadas por efeito de cena; o leitor vê o diário no menu do personagem."
      title={(quest) => `${name(catalog, quest.name, quest.id)} · ${quest.steps.length} etapas`}
      render={(quest, update) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <NameInput catalog={catalog} label="Nome" value={quest.name} onChange={(value) => update({ name: value })} />
            <KeyInput label="Id" value={quest.id} onChange={(id) => update({ id })} />
          </div>
          <NameInput catalog={catalog} label="Descrição" value={quest.description} onChange={(description) => update({ description })} maxLength={400} multiline />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Etapas</p>
            {quest.steps.map((step, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <NameInput catalog={catalog} label={`Etapa ${index + 1}`} value={step.text} onChange={(text) => update({ steps: quest.steps.map((current, position) => (position === index ? { ...current, text } : current)) })} maxLength={200} />
                </div>
                <Button type="button" size="icon" variant="ghost" aria-label="Remover etapa" onClick={() => update({ steps: quest.steps.filter((_, position) => position !== index) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => update({ steps: [...quest.steps, { id: uniqueId("etapa", quest.steps.map((step) => step.id)), text: {} }] })}>
              <Plus className="size-4" />
              Etapa
            </Button>
          </div>
        </>
      )}
    />
  );
}

export function AchievementsSection({ catalog, system, set }: SectionProps) {
  const create = (): AchievementDef => ({ id: uniqueId("conquista", system.achievements.map((achievement) => achievement.id)), name: t(catalog, "Nova conquista"), description: {}, hidden: false });
  return (
    <DefinitionList
      items={system.achievements}
      onChange={(achievements) => set({ achievements })}
      create={create}
      addLabel="Conquista"
      empty='Ex: "Matou o rei rato sem poção". Valem entre partidas.'
      title={(achievement) => name(catalog, achievement.name, achievement.id)}
      render={(achievement, update) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <NameInput catalog={catalog} label="Nome" value={achievement.name} onChange={(value) => update({ name: value })} />
            <KeyInput label="Id" value={achievement.id} onChange={(id) => update({ id })} />
          </div>
          <NameInput catalog={catalog} label="Descrição" value={achievement.description} onChange={(description) => update({ description })} maxLength={300} multiline />
          <Toggle label="Secreta até ser conquistada" checked={achievement.hidden} onChange={(hidden) => update({ hidden })} />
        </>
      )}
    />
  );
}

export function SeriesSection({ catalog, system, set, works }: SectionProps & { works: { id: string; title: string }[] }) {
  const keys = [...catalog.variables.map((variable) => variable.key), ...system.attributes.map((attribute) => attribute.key), ...system.resources.map((resource) => resource.key), ...(system.modules.progression ? [system.progression.xpKey] : [])];
  return (
    <div className="space-y-3">
      <Field label="Continua a obra" hint="O estado final da partida da obra anterior pode iniciar esta.">
        <select className={SELECT_CLASS} value={system.series.previousWorkId ?? ""} onChange={(event) => set({ series: { ...system.series, previousWorkId: event.target.value || null } })}>
          <option value="">nenhuma</option>
          {works.map((work) => (
            <option key={work.id} value={work.id}>
              {work.title}
            </option>
          ))}
        </select>
      </Field>
      {system.series.previousWorkId && (
        <fieldset className="space-y-1 text-sm">
          <legend className="font-medium text-foreground">Valores que passam de uma obra para a outra</legend>
          <div className="flex flex-wrap gap-2">
            {keys.map((key) => (
              <label key={key} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
                <input
                  type="checkbox"
                  checked={system.series.carry.includes(key)}
                  onChange={(event) => set({ series: { ...system.series, carry: event.target.checked ? [...system.series.carry, key] : system.series.carry.filter((entry) => entry !== key) } })}
                />
                <span className="font-mono text-xs">{key}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
