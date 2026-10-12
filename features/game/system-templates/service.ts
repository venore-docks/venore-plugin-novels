import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import type { SystemTemplatePackage, SystemTemplateRecord } from "../../../contracts/game";
import { withoutWork } from "../../../shared/game-records";
import { isGameKey } from "../../../shared/game-input";
import { normalizeLocalizedText } from "../../../shared/localized-text";
import { hasBlockingIssues, validateStory } from "../../../shared/story-validation";
import { BUILT_IN_TEMPLATES, builtInTemplate } from "../../../shared/templates/built-in";
import { packageFromWork, parsePackage, planApply } from "../../../shared/templates/package";
import * as store from "./store";
import type {
  ApplySystemTemplateInput,
  ApplySystemTemplateResult,
  DeleteSystemTemplateInput,
  ImportSystemTemplateInput,
  ListSystemTemplatesResult,
  SaveWorkAsTemplateInput,
  TemplateSavedResult,
  TemplateVoidResult,
  WithActor,
} from "./types";

function operation(useCase: string, actorId: string) {
  const handle = beginOperation({ useCase, actor: { id: actorId, type: "user" }, kind: "write" });
  return {
    fail: (code: string, message: string) => {
      const error = { code, message };
      endOperation(handle, { success: false, error });
      return { success: false as const, error };
    },
    done: () => endOperation(handle, { success: true }),
  };
}

const BUILT_IN_DATE = new Date("2026-10-07T00:00:00Z");

export async function listSystemTemplates(): Promise<ListSystemTemplatesResult> {
  const custom = await store.findTemplates();
  const builtIn: SystemTemplateRecord[] = BUILT_IN_TEMPLATES.map((template) => ({
    id: `builtin:${template.key}`,
    key: template.key,
    name: template.name,
    description: template.description,
    package: template,
    builtIn: true,
    updatedAt: BUILT_IN_DATE,
  }));
  return { success: true, data: [...builtIn, ...custom] };
}

async function storePackage(pkg: SystemTemplatePackage, op: ReturnType<typeof operation>): Promise<TemplateSavedResult> {
  if (builtInTemplate(pkg.key)) return op.fail("novels.template_key_reserved", `"${pkg.key}" é a chave de um modelo que vem com o plugin; use outra.`);
  const id = await store.upsertTemplate(pkg);
  op.done();
  return { success: true, data: { id, key: pkg.key } };
}

export async function importSystemTemplate(input: WithActor<ImportSystemTemplateInput>): Promise<TemplateSavedResult> {
  const op = operation("novels.import-system-template", input.actorId);
  const parsed = parsePackage(input.package);
  if (!parsed.ok) return op.fail("novels.invalid_template", parsed.message);
  return storePackage(parsed.value, op);
}

export async function saveWorkAsTemplate(input: WithActor<SaveWorkAsTemplateInput>): Promise<TemplateSavedResult> {
  const op = operation("novels.save-work-as-template", input.actorId);
  const key = input.key.trim();
  if (!isGameKey(key)) return op.fail("novels.invalid_template_key", "Chave do modelo: letras minúsculas, números e _ (começando por letra).");
  const work = await store.findWorkById(input.workId);
  if (!work) return op.fail("novels.work_not_found", "Obra não encontrada.");
  const name = normalizeLocalizedText(input.name, work.locales);
  if (!name[work.defaultLocale]) return op.fail("novels.invalid_template_name", "Dê um nome ao modelo.");
  const records = await store.findStoryRecords(work);
  const pkg = packageFromWork(
    { system: work.gameSystem, variables: work.variables, items: records.items.map(withoutWork), creatures: records.creatures.map(withoutWork) },
    { key, name, description: normalizeLocalizedText(input.description, work.locales) },
  );
  // Passa pelo mesmo leitor da importação: o que se salva é o que se importaria.
  const parsed = parsePackage(JSON.parse(JSON.stringify(pkg)));
  if (!parsed.ok) return op.fail("novels.invalid_template", parsed.message);
  return storePackage(parsed.value, op);
}

export async function deleteSystemTemplate(input: WithActor<DeleteSystemTemplateInput>): Promise<TemplateVoidResult> {
  const op = operation("novels.delete-system-template", input.actorId);
  if (!(await store.deleteTemplate(input.id))) return op.fail("novels.template_not_found", "Modelo não encontrado.");
  op.done();
  return { success: true, data: null };
}

// Aplicar copia: o sistema da obra vira o do modelo, variáveis que faltam entram, itens e
// criaturas são casados pela chave. Mudar o modelo depois não mexe na obra.
export async function applySystemTemplate(input: WithActor<ApplySystemTemplateInput>): Promise<ApplySystemTemplateResult> {
  const op = operation("novels.apply-system-template", input.actorId);
  const work = await store.findWorkById(input.workId);
  if (!work) return op.fail("novels.work_not_found", "Obra não encontrada.");

  let pkg: SystemTemplatePackage | null = null;
  if (input.templateKey) {
    pkg = builtInTemplate(input.templateKey) ?? (await store.findTemplateByKey(input.templateKey));
    if (!pkg) return op.fail("novels.template_not_found", "Modelo não encontrado.");
  } else {
    const parsed = parsePackage(input.package);
    if (!parsed.ok) return op.fail("novels.invalid_template", parsed.message);
    pkg = parsed.value;
  }

  const records = await store.findStoryRecords(work);
  const plan = planApply(pkg, { system: work.gameSystem, variables: work.variables, items: records.items, creatures: records.creatures }, () => crypto.randomUUID());
  if (records.items.length + plan.items.filter((entry) => entry.isNew).length > 300) return op.fail("novels.too_many_items", "A obra passaria do limite de itens.");

  if (work.status === "published") {
    const items = [
      ...records.items.filter((item) => !plan.items.some((entry) => entry.id === item.id)),
      ...plan.items.map((entry) => ({ ...entry.fields, id: entry.id, workId: work.id })),
    ];
    const creatures = [
      ...records.creatures.filter((creature) => !plan.creatures.some((entry) => entry.id === creature.id)),
      ...plan.creatures.map((entry) => ({ ...entry.fields, id: entry.id, workId: work.id })),
    ];
    const issues = validateStory({ ...records, work: { ...work, gameSystem: plan.system, variables: plan.variables }, items, creatures });
    if (hasBlockingIssues(issues)) {
      return op.fail("novels.would_break_published", `O modelo deixaria a obra publicada com erro: ${issues.find((issue) => issue.severity === "error")?.message}`);
    }
  }

  await store.applyPlan(work.id, plan);
  op.done();
  return { success: true, data: { items: plan.items.length, creatures: plan.creatures.length } };
}
