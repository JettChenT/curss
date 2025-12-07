"use client";

import type { Content } from "@/lib/types";
import humanizeDuration from "humanize-duration";
import Image from "next/image";
import Link from "next/link";

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

  const handleCardClick = () => {
    window.open(item.link, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      className="w-full text-left rounded-lg border p-3 md:p-4 hover:shadow-sm transition cursor-pointer"
      data-item-id={item.id}
      onClick={handleCardClick}
    >
      <div className="mb-1.5 md:mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {savedBy.length > 0 ? (
          <div className="flex items-center gap-1">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
              {savedBy.length}
            </span>
            <span className="truncate">
              <Link
                href={`/?user=${encodeURIComponent(savedBy[0].followingUser.userLink)}&degree=0`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {savedBy[0].followingUser.firstName}
              </Link>
              {savedBy.length > 1 && (
                <>
                  {", "}
                  <Link
                    href={`/?user=${encodeURIComponent(savedBy[1].followingUser.userLink)}&degree=0`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {savedBy[1].followingUser.firstName}
                  </Link>
                </>
              )}
              {savedBy.length > 2 && `, +${savedBy.length - 2}`}
            </span>
          </div>
        ) : (
          <span>From your network</span>
        )}
        <span className="hidden sm:inline mx-1">/</span>
        <span>{formatDate(new Date(item.timestamp))}</span>
      </div>

      {/* Title */}
      <h3 className="text-base md:text-lg font-semibold leading-snug">
        {item.title}
      </h3>

      {/* Domain */}
      <div className="mt-1 flex items-center gap-1.5 text-xs md:text-[13px] text-muted-foreground">
        {(() => {
          const faviconUrl = getFaviconUrl(item.link);
          return faviconUrl ? (
            <Image
              src={faviconUrl}
              alt=""
              width={16}
              height={16}
              className="size-4 rounded-sm shrink-0"
              unoptimized
            />
          ) : null;
        })()}
        <span className="truncate">
          {(() => {
            try {
              const url = new URL(item.link);
              return url.hostname.replace(/^www\./, "");
            } catch {
              return item.link;
            }
          })()}
        </span>
      </div>

      {/* Snippet */}
      {item.snippet ? (
        <p className="mt-1.5 md:mt-2 text-sm text-muted-foreground/90 line-clamp-2 md:line-clamp-3">
          {item.snippet}
        </p>
      ) : null}
    </button>
  );
}
