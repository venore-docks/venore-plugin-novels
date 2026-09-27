import { notFound } from "next/navigation";
import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied } from "@venore/plugin-sdk/ui";
import { getCachedChapterGraph } from "../../index";
import { ChapterGraphEditor } from "./chapter-graph-editor";

export default async function ChapterGraphPage({ params }: { params: Promise<{ workId: string; chapterId: string }> }) {
  const gate = await getPluginAdminPageData("graphic-novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;

  const { workId, chapterId } = await params;
  const result = await getCachedChapterGraph(workId, chapterId);
  if (!result.success) notFound();

  // key: recarregar a página depois de salvar (revalidatePath) remonta o editor com o estado do
  // banco, sem misturar com o estado local antigo.
  return <ChapterGraphEditor key={result.data.chapter.updatedAt.toISOString()} view={result.data} />;
}
