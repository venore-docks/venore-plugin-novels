import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { AdminAccessDenied, AdminPageHeader } from "@venore/plugin-sdk/ui";
import { listSystemTemplates } from "../../index";
import { SYSTEMS_PERMISSION } from "../../shared/constants";
import { SystemsAdmin } from "./systems-admin";

// Graphic Novels → Modelos de jogo: os modelos que vêm com o plugin e os importados (pacotes JSON,
// como os plugins). Permissão própria (novels.systems.manage).
export default async function NovelsSystemsPage() {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;
  const authz = await authorizeActor(SYSTEMS_PERMISSION);
  if (!authz.authorized) return <AdminAccessDenied message="Você não tem permissão para gerenciar os modelos de jogo." />;
  const result = await listSystemTemplates();
  if (!result.success) return <AdminAccessDenied message={result.error.message} />;
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Modelos de jogo"
        description="Sistemas prontos (módulos, fórmulas, itens e criaturas) para aplicar nas obras. Aplicar copia: mudar o modelo depois não mexe nas obras."
      />
      <SystemsAdmin templates={result.data} />
    </div>
  );
}
