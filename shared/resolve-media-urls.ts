import { getMediaAssetUrls } from "@venore/plugin-sdk/media";

const BATCH = 200;

// getMediaAssetUrls aceita no máximo 200 ids por chamada e aplica a regra de visibilidade da
// sessão atual (sem sessão, só mídia "public"). Uma obra longa passa disso, então fatia.
export async function resolveMediaUrls(ids: string[]): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (let start = 0; start < ids.length; start += BATCH) {
    const result = await getMediaAssetUrls({ ids: ids.slice(start, start + BATCH) });
    if (result.success) Object.assign(urls, result.data);
  }
  return urls;
}
