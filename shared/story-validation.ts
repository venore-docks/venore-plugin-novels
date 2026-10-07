import type {
  ChoiceCondition,
  ChoiceRecord,
  LocalizedText,
  SceneBlock,
  VariableDefinition,
  VariableEffect,
} from "../contracts/types";
import { CAPTION_MAX_CHARS, CONDITION_OPERATORS, EFFECT_OPERATIONS, VARIABLE_DISPLAYS } from "../contracts/types";
import { BLOCK_LABELS, blockTextFields } from "./scene-blocks";
import { derivedVariables } from "./variables";

// Validação do grafo da obra. "error" bloqueia a publicação; "warning" só avisa (tradução
// faltando, cena solta). Mesma função serve ao editor (mostra a lista ao salvar) e ao
// publish-work (recusa com a lista).

export type StoryIssueSeverity = "error" | "warning";

export type StoryIssue = {
  severity: StoryIssueSeverity;
  code: string;
  message: string;
  chapterId?: string;
  sceneId?: string;
  choiceId?: string;
};

type ValidatableScene = {
  id: string;
  chapterId: string;
  label: string;
  blocks: SceneBlock[];
  isEnding: boolean;
  endingTitle: LocalizedText;
  effects: VariableEffect[];
};

type ValidatableChapter = { id: string; position: number; title: LocalizedText; startSceneId: string | null };

export type ValidatableStory = {
  work: { title: LocalizedText; defaultLocale: string; locales: string[]; variables: VariableDefinition[] };
  chapters: ValidatableChapter[];
  scenes: ValidatableScene[];
  choices: ChoiceRecord[];
  // Elenco da obra: a fala precisa apontar para alguém que existe. Ausente = não confere.
  cast?: { id: string }[];
};

const VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function validateVariableDefinitions(variables: VariableDefinition[]): StoryIssue[] {
  const issues: StoryIssue[] = [];
  const seen = new Set<string>();
  for (const variable of variables) {
    if (!VARIABLE_KEY_PATTERN.test(variable.key)) {
      issues.push(error("invalid_variable_key", `Variável "${variable.key}": use letras minúsculas, números e _ (começando por letra).`));
    }
    if (seen.has(variable.key)) {
      issues.push(error("duplicate_variable", `Variável "${variable.key}" declarada mais de uma vez.`));
    }
    seen.add(variable.key);
    if (variable.type !== "number" && variable.type !== "boolean") {
      issues.push(error("invalid_variable_type", `Variável "${variable.key}": tipo inválido.`));
    } else if (typeof variable.initial !== variable.type) {
      issues.push(error("invalid_variable_initial", `Variável "${variable.key}": valor inicial não é do tipo ${variable.type}.`));
    }
    issues.push(...checkVariableDisplay(variable, variables));
  }
  if (variables.filter((variable) => variable.capacity).length > 1) {
    issues.push(error("multiple_capacity", "Só uma variável pode ser a capacidade do inventário."));
  }
  return issues;
}

// Campos de exibição e limites (0.7.0): opcionais, mas coerentes com o tipo.
function checkVariableDisplay(variable: VariableDefinition, all: VariableDefinition[]): StoryIssue[] {
  const issues: StoryIssue[] = [];
  const name = `Variável "${variable.key}"`;
  if (variable.display !== undefined && !VARIABLE_DISPLAYS.includes(variable.display)) {
    issues.push(error("invalid_variable_display", `${name}: exibição inválida.`));
  }
  const numeric = variable.type === "number";
  if (!numeric && (variable.min !== undefined || variable.max !== undefined || variable.maxVariable || variable.capacity)) {
    issues.push(error("invalid_variable_limits", `${name}: mínimo, máximo e capacidade só valem para número.`));
  }
  if ((variable.min !== undefined && !finite(variable.min)) || (variable.max !== undefined && !finite(variable.max))) {
    issues.push(error("invalid_variable_limits", `${name}: mínimo e máximo precisam ser números.`));
  } else if (finite(variable.min) && finite(variable.max) && variable.min > variable.max) {
    issues.push(error("invalid_variable_limits", `${name}: o mínimo é maior que o máximo.`));
  }
  if (variable.maxVariable) {
    const target = all.find((candidate) => candidate.key === variable.maxVariable);
    if (!target || target.type !== "number" || target.key === variable.key) {
      issues.push(error("invalid_variable_limits", `${name}: o máximo precisa ser outra variável numérica.`));
    }
  }
  if (variable.weight !== undefined && (!finite(variable.weight) || variable.weight < 0)) {
    issues.push(error("invalid_variable_weight", `${name}: o peso precisa ser um número maior ou igual a zero.`));
  }
  if (variable.capacity && variable.display === "inventory") {
    issues.push(error("invalid_variable_limits", `${name}: a capacidade não pode ser um item do inventário.`));
  }
  return issues;
}

function error(code: string, message: string, ref: Partial<StoryIssue> = {}): StoryIssue {
  return { severity: "error", code, message, ...ref };
}

function warning(code: string, message: string, ref: Partial<StoryIssue> = {}): StoryIssue {
  return { severity: "warning", code, message, ...ref };
}

function sceneName(scene: ValidatableScene): string {
  return scene.label.trim() || "sem nome";
}

function checkCondition(
  condition: ChoiceCondition,
  variables: Map<string, VariableDefinition>,
  ref: Partial<StoryIssue>,
  where: string,
): StoryIssue[] {
  const definition = variables.get(condition.variable);
  if (!definition) return [error("unknown_variable", `${where}: condição usa a variável "${condition.variable}", que não existe.`, ref)];
  if (!CONDITION_OPERATORS.includes(condition.operator)) return [error("invalid_operator", `${where}: operador inválido.`, ref)];
  if (typeof condition.value !== definition.type) {
    return [error("condition_type_mismatch", `${where}: "${condition.variable}" é ${definition.type}, mas a condição compara com outro tipo.`, ref)];
  }
  if (definition.type === "boolean" && !["eq", "neq"].includes(condition.operator)) {
    return [error("boolean_ordering", `${where}: variável sim/não só aceita "igual" ou "diferente".`, ref)];
  }
  return [];
}

function checkEffect(
  effect: VariableEffect,
  variables: Map<string, VariableDefinition>,
  ref: Partial<StoryIssue>,
  where: string,
): StoryIssue[] {
  const definition = variables.get(effect.variable);
  if (!definition) return [error("unknown_variable", `${where}: efeito altera a variável "${effect.variable}", que não existe.`, ref)];
  if (!EFFECT_OPERATIONS.includes(effect.operation)) return [error("invalid_effect", `${where}: operação inválida.`, ref)];
  if (effect.operation === "add" && definition.type !== "number") {
    return [error("effect_type_mismatch", `${where}: "somar" só vale pra variável numérica.`, ref)];
  }
  if (effect.operation === "toggle" && definition.type !== "boolean") {
    return [error("effect_type_mismatch", `${where}: "inverter" só vale pra variável sim/não.`, ref)];
  }
  if (effect.operation !== "toggle" && typeof effect.value !== definition.type) {
    return [error("effect_type_mismatch", `${where}: valor não é do tipo de "${effect.variable}".`, ref)];
  }
  return [];
}

function missingLocales(text: LocalizedText, locales: string[]): string[] {
  return locales.filter((locale) => !text[locale]?.trim());
}

// Blocos da cena (0.9.0): tradução de cada texto, legenda curta, imagem escolhida e fala com
// alguém do elenco. Bloco vazio é aviso (rascunho), nunca erro.
function checkBlocks(
  blocks: SceneBlock[],
  locales: string[],
  cast: { id: string }[] | undefined,
  ref: Partial<StoryIssue>,
  where: string,
): StoryIssue[] {
  const issues: StoryIssue[] = [];
  if (blocks.length === 0) issues.push(warning("empty_scene", `${where}: cena sem conteúdo.`, ref));
  const castIds = cast ? new Set(cast.map((member) => member.id)) : null;
  blocks.forEach((block, position) => {
    const name = `${where}, bloco ${position + 1} (${BLOCK_LABELS[block.type]})`;
    for (const field of blockTextFields(block)) {
      const written = Object.values(field).some((value) => value.trim());
      if (!written) {
        issues.push(warning("empty_block", `${name}: sem texto.`, ref));
        continue;
      }
      for (const locale of missingLocales(field, locales)) {
        issues.push(warning("missing_translation", `${name}: texto sem tradução (${locale}).`, ref));
      }
    }
    if (block.type === "caption" && Object.values(block.caption).some((value) => value.length > CAPTION_MAX_CHARS)) {
      issues.push(error("caption_too_long", `${name}: a legenda passa de ${CAPTION_MAX_CHARS} caracteres; use texto abaixo da imagem.`, ref));
    }
    if ((block.type === "image" || block.type === "caption" || block.type === "backdrop") && !block.mediaId) {
      issues.push(warning("empty_image", `${name}: sem imagem escolhida.`, ref));
    }
    if (block.type === "gallery" && block.images.length < 2) {
      issues.push(warning("small_gallery", `${name}: a galeria precisa de pelo menos duas imagens.`, ref));
    }
    if (block.type === "speech") {
      if (!block.castId) issues.push(warning("speech_without_cast", `${name}: escolha quem fala.`, ref));
      else if (castIds && !castIds.has(block.castId)) {
        issues.push(error("unknown_cast", `${name}: a fala é de alguém que saiu do elenco.`, ref));
      }
    }
  });
  return issues;
}

export function validateStory(story: ValidatableStory): StoryIssue[] {
  const issues: StoryIssue[] = [...validateVariableDefinitions(story.work.variables)];
  const variables = new Map(story.work.variables.map((variable) => [variable.key, variable]));
  // Condições também enxergam os valores calculados (carga, espaço livre); efeitos não.
  const conditionVariables = new Map(
    [...story.work.variables, ...derivedVariables(story.work.variables)].map((variable) => [variable.key, variable]),
  );
  const { locales, defaultLocale } = story.work;
  const scenesById = new Map(story.scenes.map((scene) => [scene.id, scene]));
  const choicesByScene = new Map<string, ChoiceRecord[]>();
  for (const choice of story.choices) {
    choicesByScene.set(choice.sceneId, [...(choicesByScene.get(choice.sceneId) ?? []), choice]);
  }

  if (!story.work.title[defaultLocale]?.trim()) {
    issues.push(error("missing_title", "A obra precisa de título no idioma principal."));
  }
  if (story.chapters.length === 0) {
    issues.push(error("no_chapters", "A obra precisa de pelo menos um capítulo."));
  }

  const ordered = [...story.chapters].sort((a, b) => a.position - b.position);
  ordered.forEach((chapter, chapterIndex) => {
    const chapterRef = { chapterId: chapter.id };
    const chapterName = `Capítulo ${chapterIndex + 1}`;
    const chapterScenes = story.scenes.filter((scene) => scene.chapterId === chapter.id);

    if (chapterScenes.length === 0) {
      issues.push(error("empty_chapter", `${chapterName} não tem cenas.`, chapterRef));
      return;
    }
    const start = chapter.startSceneId ? scenesById.get(chapter.startSceneId) : undefined;
    if (!start || start.chapterId !== chapter.id) {
      issues.push(error("missing_start", `${chapterName} não tem cena inicial definida.`, chapterRef));
    }
    for (const locale of missingLocales(chapter.title, locales)) {
      issues.push(warning("missing_translation", `${chapterName}: título sem tradução (${locale}).`, chapterRef));
    }

    // Alcançabilidade dentro do capítulo, a partir da cena inicial. Condições são ignoradas de
    // propósito (qualquer escolha pode ficar disponível dependendo do caminho): o objetivo é
    // achar cena que nenhuma seta alcança, não simular todas as partidas possíveis.
    const reachable = new Set<string>();
    if (start && start.chapterId === chapter.id) {
      const queue = [start.id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (reachable.has(current)) continue;
        reachable.add(current);
        for (const choice of choicesByScene.get(current) ?? []) queue.push(choice.targetSceneId);
      }
    }

    const isLastChapter = chapterIndex === ordered.length - 1;
    for (const scene of chapterScenes) {
      const ref = { chapterId: chapter.id, sceneId: scene.id };
      const where = `${chapterName}, cena "${sceneName(scene)}"`;
      const sceneChoices = choicesByScene.get(scene.id) ?? [];

      if (start && !reachable.has(scene.id)) {
        issues.push(warning("unreachable_scene", `${where}: nenhuma escolha leva até ela.`, ref));
      }
      issues.push(...checkBlocks(scene.blocks, locales, story.cast, ref, where));
      if (scene.isEnding && sceneChoices.length > 0) {
        issues.push(error("ending_with_choices", `${where}: é um final, mas tem escolhas saindo dela.`, ref));
      }
      if (!scene.isEnding && sceneChoices.length === 0 && isLastChapter) {
        issues.push(error("dead_end", `${where}: não tem escolhas nem é marcada como final (último capítulo).`, ref));
      }
      for (const effect of scene.effects) issues.push(...checkEffect(effect, variables, ref, where));

      for (const choice of sceneChoices) {
        const choiceRef = { ...ref, choiceId: choice.id };
        const target = scenesById.get(choice.targetSceneId);
        if (!target) {
          issues.push(error("missing_target", `${where}: uma escolha aponta para uma cena que não existe.`, choiceRef));
        } else if (target.chapterId !== scene.chapterId) {
          issues.push(error("cross_chapter_choice", `${where}: escolha leva para outro capítulo.`, choiceRef));
        }
        if (!choice.label[defaultLocale]?.trim()) {
          issues.push(error("missing_choice_label", `${where}: escolha sem texto no idioma principal.`, choiceRef));
        } else {
          for (const locale of missingLocales(choice.label, locales)) {
            issues.push(warning("missing_translation", `${where}: escolha sem tradução (${locale}).`, choiceRef));
          }
        }
        for (const condition of choice.conditions) issues.push(...checkCondition(condition, conditionVariables, choiceRef, where));
        for (const effect of choice.effects) issues.push(...checkEffect(effect, variables, choiceRef, where));
      }
      if (sceneChoices.length > 0 && sceneChoices.every((choice) => choice.conditions.length > 0)) {
        issues.push(
          warning("all_choices_conditional", `${where}: todas as escolhas têm condição; o leitor pode ficar sem saída.`, ref),
        );
      }
    }
  });

  if (story.scenes.length > 0 && !story.scenes.some((scene) => scene.isEnding)) {
    issues.push(warning("no_ending", "Nenhuma cena está marcada como final."));
  }

  return issues;
}

export function hasBlockingIssues(issues: StoryIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
