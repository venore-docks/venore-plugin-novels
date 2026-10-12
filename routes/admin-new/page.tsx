import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied } from "@venore/plugin-sdk/ui";
import { getNewWorkForm, listSystemTemplates } from "../../index";
import { describePackage } from "../../shared/templates/package";
import { NewWorkWizard } from "./new-work-wizard";

export default async function NewWorkPage() {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;
  const [result, templates] = await Promise.all([getNewWorkForm(), listSystemTemplates()]);
  if (!result.success) return <AdminAccessDenied message="Você não tem permissão para criar obras." />;
  const summaries = (templates.success ? templates.data : []).map((template) => ({
    key: template.key,
    name: template.name,
    description: template.description,
    modules: describePackage(template.package),
  }));
  return <NewWorkWizard tagCatalog={result.data.tagCatalog} templates={summaries} />;
}
