import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION, SYSTEMS_PERMISSION } from "../../../shared/constants";
import * as service from "./service";
import type {
  ApplySystemTemplateInput,
  ApplySystemTemplateResult,
  DeleteSystemTemplateInput,
  ImportSystemTemplateInput,
  ListSystemTemplatesResult,
  SaveWorkAsTemplateInput,
  TemplateSavedResult,
  TemplateVoidResult,
} from "./types";

const invalid = (message: string) => ({ success: false as const, error: { code: "novels.invalid_input", message } });
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;

// Quem escreve obra precisa ver a lista (assistente, aba Sistema); só quem gerencia modelos muda ela.
export async function listSystemTemplatesHandler(): Promise<ListSystemTemplatesResult> {
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) {
    const systems = await authorizeActor(SYSTEMS_PERMISSION);
    if (!systems.authorized) return { success: false, error: authz.error };
  }
  return service.listSystemTemplates();
}

export async function importSystemTemplateHandler(input: ImportSystemTemplateInput): Promise<TemplateSavedResult> {
  if (input.package == null) return invalid("Escolha um arquivo de modelo.");
  const authz = await authorizeActor(SYSTEMS_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.importSystemTemplate({ ...input, actorId: authz.actorId });
}

export async function saveWorkAsTemplateHandler(input: SaveWorkAsTemplateInput): Promise<TemplateSavedResult> {
  if (!isId(input.workId) || typeof input.key !== "string") return invalid("Modelo inválido.");
  const authz = await authorizeActor(SYSTEMS_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.saveWorkAsTemplate({ ...input, actorId: authz.actorId });
}

export async function deleteSystemTemplateHandler(input: DeleteSystemTemplateInput): Promise<TemplateVoidResult> {
  if (!isId(input.id)) return invalid("Modelo não informado.");
  const authz = await authorizeActor(SYSTEMS_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.deleteSystemTemplate({ ...input, actorId: authz.actorId });
}

export async function applySystemTemplateHandler(input: ApplySystemTemplateInput): Promise<ApplySystemTemplateResult> {
  if (!isId(input.workId) || (!input.templateKey && input.package == null)) return invalid("Escolha um modelo.");
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.applySystemTemplate({ ...input, actorId: authz.actorId });
}
