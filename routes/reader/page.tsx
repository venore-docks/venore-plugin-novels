import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { getCachedPublishedStory, getReaderProgress } from "../../index";
import { PLUGIN_KEY, publicWorkPath } from "../../shared/constants";
import { pickText } from "../../shared/localized-text";
import { absoluteUrl, resolveRequestOrigin } from "../../shared/request-origin";
import { StoryReader } from "./story-reader";

type Params = { params: Promise<{ workSlug: string }> };

export default async function StoryReaderPage({ params }: Params) {
  if (!(await isPluginActive(PLUGIN_KEY))) notFound();
  const { workSlug } = await params;
  const result = await getCachedPublishedStory(workSlug);
  if (!result.success) notFound();

  const story = result.data;
  const [user, progress] = await Promise.all([getCurrentUser(), getReaderProgress({ workId: story.work.id })]);
  const signedIn = user.success && user.data !== null;
  const serverProgress =
    progress.success && progress.data ? { state: progress.data.state, updatedAt: progress.data.updatedAt.toISOString() } : null;

  return <StoryReader story={story} signedIn={signedIn} serverProgress={serverProgress} />;
}

export async function generateStoryMetadata({ params }: Params): Promise<Metadata> {
  const { workSlug } = await params;
  const result = await getCachedPublishedStory(workSlug);
  if (!result.success) return {};
  const { work } = result.data;
  const title = pickText(work.title, work.defaultLocale, work.defaultLocale);
  const description = pickText(work.synopsis, work.defaultLocale, work.defaultLocale).slice(0, 200) || undefined;
  const origin = await resolveRequestOrigin();
  const image = work.coverUrl ? absoluteUrl(origin, work.coverUrl) : undefined;
  return {
    title,
    description,
    openGraph: {
      type: "book",
      title,
      description,
      url: `${origin}${publicWorkPath(work.slug)}`,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}
