import Image from "next/image";
import { Icon } from "@iconify/react";
import type { ProfileMetadata } from "@/lib/types";

export function ProfileLinks({
  userLink,
  metadata,
}: {
  userLink?: string;
  metadata: ProfileMetadata;
}) {
  const { website, twitter, github } = metadata ?? {};
  const hasLinks = userLink || website || twitter || github;

  if (!hasLinks) return null;

  // Format curius link
  const curiusHandle = userLink?.replace(/^@/, "");
  const curiusUrl = curiusHandle ? `https://curius.app/${curiusHandle}` : null;

  // Helper to format website display (remove protocol)
  const formatWebsite = (url: string) => {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  };

  // Helper to ensure URL has protocol
  const ensureProtocol = (url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  // Helper to format twitter handle for display
  const formatTwitter = (handle: string) => {
    if (handle.startsWith("@")) return handle;
    if (handle.includes("twitter.com/") || handle.includes("x.com/")) {
      const parts = handle.split("/");
      return `@${parts[parts.length - 1]}`;
    }
    return `@${handle}`;
  };

  // Helper to get twitter URL
  const getTwitterUrl = (handle: string) => {
    if (handle.startsWith("http")) return handle;
    const cleanHandle = handle.replace(/^@/, "");
    return `https://twitter.com/${cleanHandle}`;
  };

  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      {curiusUrl && (
        <a
          href={curiusUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <Image
            src="https://icons.duckduckgo.com/ip3/curius.app.ico"
            alt="Curius"
            width={16}
            height={16}
            className="w-4 h-4 shrink-0"
            unoptimized
          />
          <span>{curiusHandle}</span>
        </a>
      )}
      {website && (
        <a
          href={ensureProtocol(website)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <Icon icon="ph:link-bold" className="w-4 h-4 shrink-0" />
          <span>{formatWebsite(website)}</span>
        </a>
      )}
      {twitter && (
        <a
          href={getTwitterUrl(twitter)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <Icon icon="ri:twitter-x-fill" className="w-4 h-4 shrink-0" />
          <span>{formatTwitter(twitter)}</span>
        </a>
      )}
      {github && (
        <a
          href={github}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <Icon icon="mdi:github" className="w-4 h-4 shrink-0" />
          <span>{github.replace(/^https?:\/\/github\.com\//, "")}</span>
        </a>
      )}
    </div>
  );
}
