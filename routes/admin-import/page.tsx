import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied, AdminPageHeader } from "@venore/plugin-sdk/ui";
import { listWorkExamples } from "../../index";
import { builtInTemplate } from "../../shared/templates/built-in";
import { ImportWork } from "./import-work";

// Importar obra (0.15.0): histórias de exemplo, uma por tipo, ou um arquivo venore-novels-work.
export default async function AdminImportPage() {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;
  const result = await listWorkExamples();
  if (!result.success) return <AdminAccessDenied message="Você não tem permissão para criar obras." />;
  const examples = result.data.map((example) => ({
    ...example,
    kindLabel: example.kind === "narrative" ? "Só narrativa" : (builtInTemplate(example.kind)?.name["pt-BR"] ?? example.kind),
  }));
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Importar obra"
        description="Uma história inteira num arquivo (.json): capítulos, cenas, escolhas, elenco, sistema de jogo, itens e criaturas. Vira um rascunho novo; imagens não vêm no arquivo."
      />
      <ImportWork examples={examples} />
    </div>
  );
}
