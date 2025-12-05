"use client";

import type { Content } from "@/lib/types";
import humanizeDuration from "humanize-duration";
import Image from "next/image";

function getFaviconUrl(feedUrl: string): string | undefined {
  try {
    const { hostname } = new URL(feedUrl);
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return undefined;
  }
}

type FeedItemProps = {
  item: Content;
};

const shortEnglish = humanizeDuration.humanizer({
  language: "shortEn",
  languages: {
    shortEn: {
      y: () => "y",
      mo: () => "mo",
      w: () => "w",
      d: () => "d",
      h: () => "h",
      m: () => "m",
      s: () => "s",
      ms: () => "ms",
    },
  },
  round: true,
  largest: 1,
  spacer: "",
});

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 24 * 60 * 60 * 1000 && diffMs >= 0) {
    if (diffMs < 60 * 1000) return "now";
    return shortEnglish(diffMs);
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FeedItem({ item }: FeedItemProps) {
  const savedBy = item.savedBy ?? [];
  return (
    <div
      className="rounded-lg border p-4 hover:shadow-sm transition"
      data-item-id={item.id}
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        {savedBy.length > 0 ? (
          <div className="flex items-center gap-1">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
              {savedBy.length}
            </span>
            <span>
              <a
                href={`/?user=${encodeURIComponent(savedBy[0].followingUser.userLink)}&degree=0`}
                className="hover:underline"
              >
                {savedBy[0].followingUser.firstName}
              </a>
              {savedBy.length > 1 && (
                <>
                  {", "}
                  <a
                    href={`/?user=${encodeURIComponent(savedBy[1].followingUser.userLink)}&degree=0`}
                    className="hover:underline"
                  >
                    {savedBy[1].followingUser.firstName}
                  </a>
                </>
              )}
              {savedBy.length > 2 && `, and ${savedBy.length - 2} more`}
            </span>
          </div>
        ) : (
          <span>From your network</span>
        )}
        <span className="mx-1">/</span>
        <span>{formatDate(new Date(item.timestamp))}</span>
      </div>

      {/* Title */}
      <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        className="text-lg font-semibold leading-snug hover:underline"
      >
        {item.title}
      </a>

      {/* Domain */}
      <div className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {(() => {
          const faviconUrl = getFaviconUrl(item.link);
          return faviconUrl ? (
            <Image
              src={faviconUrl}
              alt=""
              width={16}
              height={16}
              className="size-4 rounded-sm"
              unoptimized
            />
          ) : null;
        })()}
        {(() => {
          try {
            const url = new URL(item.link);
            return url.hostname.replace(/^www\./, "");
          } catch {
            return item.link;
          }
        })()}
      </div>

      {/* Snippet */}
      {item.snippet ? (
        <p className="mt-2 text-sm text-muted-foreground/90 line-clamp-3">
          {item.snippet}
        </p>
      ) : null}
    </div>
  );
}
