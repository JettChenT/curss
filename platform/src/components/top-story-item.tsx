"use client";

import Image from "next/image";
import Link from "next/link";
import type { TopStory } from "@/lib/types";

function getFaviconUrl(feedUrl: string): string | undefined {
  try {
    const { hostname } = new URL(feedUrl);
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return undefined;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type TopStoryItemProps = {
  story: TopStory;
  rank: number;
};

export function TopStoryItem({ story, rank }: TopStoryItemProps) {
  const savedBy = story.savedBy ?? [];
  const faviconUrl = getFaviconUrl(story.link);

  return (
    <div className="flex gap-3 py-2.5 md:py-3 group">
      <span className="shrink-0 w-7 text-right text-sm tabular-nums text-muted-foreground/60 pt-0.5">
        {rank}.
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <a
            href={story.link}
            target="_blank"
            rel="noreferrer"
            className="text-sm md:text-base font-medium leading-snug hover:underline break-words"
          >
            {story.title}
          </a>
          <span className="hidden sm:inline-flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
            {faviconUrl && (
              <Image
                src={faviconUrl}
                alt=""
                width={14}
                height={14}
                className="size-3.5 rounded-sm"
                unoptimized
              />
            )}
            ({getDomain(story.link)})
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="font-medium">
            {story.saveCount} {story.saveCount === 1 ? "save" : "saves"}
          </span>

          {savedBy.length > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>
                by{" "}
                {savedBy.slice(0, 3).map((s, i) => (
                  <span key={s.followingUser.id}>
                    {i > 0 && ", "}
                    <Link
                      href={`/?user=${encodeURIComponent(s.followingUser.userLink)}&degree=0`}
                      className="hover:underline"
                    >
                      {s.followingUser.firstName}
                    </Link>
                  </span>
                ))}
                {savedBy.length > 3 && (
                  <span>, +{savedBy.length - 3} more</span>
                )}
              </span>
            </>
          )}

          <span className="sm:hidden text-muted-foreground/40">·</span>
          <span className="sm:hidden">{getDomain(story.link)}</span>
        </div>
      </div>
    </div>
  );
}
