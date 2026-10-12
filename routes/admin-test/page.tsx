import { notFound } from "next/navigation";
import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied } from "@venore/plugin-sdk/ui";
import { getDraftStory } from "../../index";
import { TestMode } from "./test-mode";

export default async function WorkTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;
  const [{ workId }, query] = await Promise.all([params, searchParams]);
  const result = await getDraftStory({ workId });
  if (!result.success) notFound();
  const scene = typeof query.scene === "string" && result.data.scenes.some((candidate) => candidate.id === query.scene) ? query.scene : null;
  return <TestMode story={result.data} initialSceneId={scene} />;
}
