"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Save, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Switch, cn } from "@venore/plugin-sdk/ui";
import { GAME_MODULES, type Creature, type GameModule, type GameSystem, type Item, type SystemTemplateRecord } from "../../contracts/game";
import type { LocalizedText, VariableDefinition } from "../../contracts/types";
import { validateGameSystem } from "../../shared/engine/validate";
import { pickText } from "../../shared/localized-text";
import { describePackage, packageFromWork } from "../../shared/templates/package";
import { applySystemTemplateAction, saveWorkAsTemplateAction, updateGameSystemAction } from "../admin/actions";
import type { GameCatalog } from "./catalog";
import { SELECT_CLASS } from "./catalog";
import {
  AchievementsSection,
  AttributesSection,
  CharacterSection,
  CombatSection,
  DiceSection,
  EncyclopediaSection,
  EquipmentSection,
  InventorySection,
  ProgressionSection,
  QuestsSection,
  ResourcesSection,
  SeriesSection,
  ShopsSection,
  StatusEffectsSection,
} from "./system-sections";

// Aba "Sistema" da obra (seção 6 do documento): cada parte do RPG é um módulo que liga e desliga.
// Desligar não apaga a configuração; só a esconde. Os nomes (HP, Mana, Mochila) são do autor.

export const MODULE_INFO: Record<GameModule, { label: string; description: string; needs: GameModule[] }> = {
  resources: { label: "Recursos", description: "Barras como Vida e Mana: máximo, regeneração e gatilho ao zerar.", needs: [] },
  attributes: { label: "Atributos", description: "Stats e habilidades, valores derivados por fórmula.", needs: [] },
  dice: { label: "Dados", description: "Testes com rolagem nas escolhas, com o dado rolando na tela.", needs: [] },
  inventory: { label: "Inventário", description: "Itens do catálogo, com peso, espaço na bolsa e mãos.", needs: [] },
  equipment: { label: "Equipamento", description: "Áreas de equipar e modificadores dos itens.", needs: ["inventory"] },
  progression: { label: "Nível e XP", description: "Experiência, curva de nível e pontos para distribuir.", needs: ["attributes"] },
  combat: { label: "Combate", description: "Cenas de encontro em rodadas ou num único teste.", needs: ["resources"] },
  effects: { label: "Efeitos com duração", description: "Envenenado, abençoado: agem por algumas cenas.", needs: [] },
  shops: { label: "Lojas", description: "Cenas de loja, moeda, compra e venda.", needs: ["inventory"] },
  quests: { label: "Missões", description: "Diário com etapas marcadas por efeito de cena.", needs: [] },
  achievements: { label: "Conquistas", description: "Definidas por você; valem entre partidas.", needs: [] },
  character: { label: "Criação de personagem", description: "Ficha (nome, sexo...), vocação e pontos antes da primeira cena.", needs: [] },
  bestiary: { label: "Bestiário", description: "O leitor vê as criaturas que já encontrou.", needs: ["combat"] },
};

type Props = {
  workId: string;
  media?: Record<string, string>;
  locale: string;
  locales: string[];
  system: GameSystem;
  variables: VariableDefinition[];
  items: Item[];
  creatures: Creature[];
  scenes: { id: string; label: string }[];
  templates: SystemTemplateRecord[];
  canManageTemplates: boolean;
  works: { id: string; title: string }[];
  workTitle: LocalizedText;
};

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SystemEditor(props: Props) {
  const router = useRouter();
  const [system, setSystem] = useState<GameSystem>(props.system);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [applying, startApplying] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState(props.templates[0]?.key ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const catalog = useMemo<GameCatalog>(
    () => ({ locale: props.locale, locales: props.locales, variables: props.variables, system, items: props.items, creatures: props.creatures, scenes: props.scenes, allScenes: props.scenes, media: props.media }),
    [props.locale, props.locales, props.variables, system, props.items, props.creatures, props.scenes, props.media],
  );
  const issues = useMemo(
    () => validateGameSystem({ system, variables: props.variables, items: props.items, creatures: props.creatures, sceneIds: new Set(props.scenes.map((scene) => scene.id)) }),
    [system, props.variables, props.items, props.creatures, props.scenes],
  );

  const set = (patch: Partial<GameSystem>) => {
    setSystem((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  function toggleModule(module: GameModule, enabled: boolean) {
    const modules = { ...system.modules, [module]: enabled };
    // Ligar um módulo liga o que ele precisa.
    if (enabled) for (const need of MODULE_INFO[module].needs) modules[need] = true;
    set({ modules });
    if (enabled) setOpen(module);
  }

  function save() {
    startSaving(async () => {
      const result = await updateGameSystemAction(props.workId, system);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success("Sistema salvo.");
      router.refresh();
    });
  }

  function apply(input: { templateKey?: string; package?: unknown }) {
    if (dirty && !window.confirm("Aplicar o modelo descarta as mudanças não salvas do sistema. Continuar?")) return;
    if (!window.confirm("O sistema da obra vira o do modelo; itens e criaturas do modelo entram no catálogo (os de mesma chave são atualizados). Continuar?")) return;
    startApplying(async () => {
      const result = await applySystemTemplateAction(props.workId, input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Modelo aplicado.");
      router.refresh();
    });
  }

  function exportPackage() {
    const title = pickText(props.workTitle, props.locale, props.locale) || "obra";
    const pkg = packageFromWork(
      { system, variables: props.variables, items: props.items, creatures: props.creatures },
      { key: title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "sistema", name: { [props.locale]: `Sistema de ${title}` }, description: {} },
    );
    download(`sistema-${pkg.key}.json`, JSON.stringify(pkg, null, 2));
  }

  async function importFile(file: File) {
    if (file.size > 400_000) {
      toast.error("Arquivo grande demais para um modelo.");
      return;
    }
    apply({ package: await file.text() });
  }

  function saveAsTemplate() {
    const label = window.prompt("Nome do modelo");
    if (!label?.trim()) return;
    const key = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^[^a-z]+|_+$/g, "")
      .slice(0, 40);
    startApplying(async () => {
      const result = await saveWorkAsTemplateAction({ workId: props.workId, key: key || "modelo", name: { [props.locale]: label.trim() }, description: {} });
      if (!result.ok) toast.error(result.error);
      else toast.success("Modelo salvo na lista de modelos da instância.");
    });
  }

  const selectedTemplate = props.templates.find((template) => template.key === templateKey);
  const sections: { key: string; title: string; on: boolean; body: ReactNode }[] = [
    { key: "resources", title: "Recursos", on: system.modules.resources, body: <ResourcesSection catalog={catalog} system={system} set={set} /> },
    { key: "attributes", title: "Atributos e habilidades", on: system.modules.attributes, body: <AttributesSection catalog={catalog} system={system} set={set} /> },
    { key: "progression", title: "Nível e XP", on: system.modules.progression, body: <ProgressionSection catalog={catalog} system={system} set={set} /> },
    { key: "dice", title: "Dados", on: system.modules.dice, body: <DiceSection catalog={catalog} system={system} set={set} /> },
    { key: "inventory", title: "Inventário", on: system.modules.inventory, body: <InventorySection catalog={catalog} system={system} set={set} /> },
    { key: "equipment", title: "Áreas de equipamento", on: system.modules.equipment, body: <EquipmentSection catalog={catalog} system={system} set={set} /> },
    { key: "combat", title: "Combate", on: system.modules.combat, body: <CombatSection catalog={catalog} system={system} set={set} /> },
    { key: "character", title: "Criação de personagem", on: system.modules.character, body: <CharacterSection catalog={catalog} system={system} set={set} /> },
    { key: "shops", title: "Lojas e moeda", on: system.modules.shops, body: <ShopsSection catalog={catalog} system={system} set={set} /> },
    { key: "effects", title: "Efeitos com duração", on: system.modules.effects, body: <StatusEffectsSection catalog={catalog} system={system} set={set} /> },
    { key: "quests", title: "Missões", on: system.modules.quests, body: <QuestsSection catalog={catalog} system={system} set={set} /> },
    { key: "achievements", title: "Conquistas", on: system.modules.achievements, body: <AchievementsSection catalog={catalog} system={system} set={set} /> },
    { key: "encyclopedia", title: "Enciclopédia (lugares, personagens, história)", on: true, body: <EncyclopediaSection catalog={catalog} system={system} set={set} /> },
    { key: "series", title: "Série (continuação de outra obra)", on: true, body: <SeriesSection catalog={catalog} system={system} set={set} works={props.works} /> },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Modelo de sistema</h2>
          <p className="text-sm text-muted-foreground">Parta de um modelo pronto ou do sistema de outra obra (arquivo JSON). Aplicar copia: mudar o modelo depois não mexe nesta obra.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select aria-label="Modelo" className={cn(SELECT_CLASS, "sm:min-w-64")} value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>
            {props.templates.map((template) => (
              <option key={template.id} value={template.key}>
                {pickText(template.name, props.locale, props.locale)}
                {template.builtIn ? "" : " (da instância)"}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" disabled={!templateKey || applying} onClick={() => apply({ templateKey })}>
            <Wand2 className="size-4" />
            Aplicar modelo
          </Button>
        </div>
        {selectedTemplate && (
          <p className="text-xs text-muted-foreground">
            {pickText(selectedTemplate.description, props.locale, props.locale)} Liga: {describePackage(selectedTemplate.package).join(", ") || "nada"}.
          </p>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="ghost" onClick={exportPackage}>
            <Download className="size-4" />
            Exportar sistema (JSON)
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={applying} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Importar de arquivo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importFile(file);
            }}
          />
          {props.canManageTemplates && (
            <Button type="button" size="sm" variant="ghost" disabled={applying || dirty} onClick={saveAsTemplate} title={dirty ? "Salve o sistema antes" : undefined}>
              <Save className="size-4" />
              Salvar como modelo
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Módulos</h2>
          <p className="text-sm text-muted-foreground">Nada aparece para o leitor (nem no editor) enquanto o módulo está desligado. Desligar não apaga a configuração.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {GAME_MODULES.map((module) => (
            <label key={module} className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm", system.modules[module] ? "border-primary bg-primary/5" : "border-border")}>
              <Switch checked={system.modules[module]} onCheckedChange={(checked: boolean) => toggleModule(module, checked)} aria-label={MODULE_INFO[module].label} />
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{MODULE_INFO[module].label}</span>
                <span className="block text-xs text-muted-foreground">{MODULE_INFO[module].description}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <Switch checked={system.hardcore} onCheckedChange={(hardcore: boolean) => set({ hardcore })} aria-label="Modo hardcore" />
          <span>
            <span className="block font-medium text-foreground">Oferecer modo hardcore</span>
            <span className="block text-xs text-muted-foreground">O leitor pode escolher jogar sem voltar cena, sem rolar de novo e com um único salvamento.</span>
          </span>
        </label>
      </section>

      {sections
        .filter((section) => section.on)
        .map((section) => (
          <section key={section.key} className="rounded-xl border border-border bg-card">
            <button type="button" aria-expanded={open === section.key} onClick={() => setOpen(open === section.key ? null : section.key)} className="flex w-full items-center justify-between gap-2 p-4 text-left sm:px-6">
              <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
              <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", open === section.key && "rotate-180")} aria-hidden />
            </button>
            {open === section.key && <div className="border-t border-border p-4 sm:p-6">{section.body}</div>}
          </section>
        ))}

      {issues.length > 0 && (
        <section className="space-y-1 rounded-xl border border-destructive/40 bg-card p-4">
          <p className="text-sm font-medium text-foreground">Problemas no sistema</p>
          <ul className="list-disc space-y-0.5 ps-5 text-sm text-destructive">
            {issues.slice(0, 15).map((issue, index) => (
              <li key={index}>{issue.message}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <span className="text-xs text-muted-foreground">{dirty ? "Mudanças não salvas" : "Tudo salvo"}</span>
        <Button type="button" onClick={save} disabled={!dirty || saving}>
          <Save className="size-4" />
          {saving ? "Salvando..." : "Salvar sistema"}
        </Button>
      </div>
    </div>
  );
}
