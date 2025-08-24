import type { Content } from "@/lib/bindings/Content";

type FeedItemProps = {
  item: Content;
};

export function FeedItem({ item }: FeedItemProps) {
  const savedBy = item.savedBy ?? [];
  return (
    <div className="rounded-lg border p-4 hover:shadow-sm transition">
      {/* Meta: who/when */}
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        {savedBy.length > 0 ? (
          <div className="flex items-center gap-1">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
              {savedBy.length}
            </span>
            <span>
              {savedBy.slice(0, 1).map((s) => s.followingUser.firstName)[0]}
              {savedBy.length > 1 ? ", " + savedBy.slice(1, 2).map((s) => s.followingUser.firstName)[0] : ""}
              {savedBy.length > 2 ? `, and ${savedBy.length - 2} more` : ""}
            </span>
          </div>
        ) : (
          <span>From your network</span>
        )}
        <span className="mx-1">/</span>
        <span>
          {new Date(item.modifiedDate || item.createdDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
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
      <div className="mt-1 text-[13px] text-muted-foreground">
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


