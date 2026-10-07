import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied } from "@venore/plugin-sdk/ui";
import { getNewWorkForm } from "../../index";
import { NewWorkWizard } from "./new-work-wizard";

export default async function NewWorkPage() {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;
  const result = await getNewWorkForm();
  if (!result.success) return <AdminAccessDenied message="Você não tem permissão para criar obras." />;
  return <NewWorkWizard tagCatalog={result.data.tagCatalog} />;
}
