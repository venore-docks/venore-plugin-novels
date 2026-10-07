import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied, AdminPageHeader } from "@venore/plugin-sdk/ui";
import { getTagCatalog } from "../../index";
import { TagsAdmin } from "./tags-admin";

// Graphic Novels → Tags: o catálogo inteiro (grupos, tags, tags livres dos autores e os textos dos
// selos calculados). Permissão própria (novels.tags.manage), conferida pelo handler.
export default async function NovelsTagsPage() {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;
  const result = await getTagCatalog();
  if (!result.success) return <AdminAccessDenied message="Você não tem permissão para gerenciar o catálogo de tags." />;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Tags"
        description="Catálogo de tags das obras, em grupos. Informativas descrevem a obra; de produção contam como ela foi feita."
      />
      <TagsAdmin catalog={result.data} />
    </div>
  );
}
