"use client";

import type { FollowWithOrder, FollowingUser } from "@/lib/types";

type FollowListProps = {
  items: FollowWithOrder[];
  onSelect?: (user: FollowingUser) => void;
};

export function FollowList({ items, onSelect }: FollowListProps) {
  if (!items?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No follows for this degree.
      </div>
    );
  }

  return (
    <ul className="space-y-1 md:space-y-2 pr-1">
      {items.map((f) => {
        const u = f.followingUser;
        const raw = u.userLink ?? "";
        let handle = raw;
        try {
          if (/^https?:/i.test(raw)) {
            const url = new URL(raw);
            const parts = url.pathname.split("/").filter(Boolean);
            handle = parts[parts.length - 1] || raw;
          } else if (raw.includes("/")) {
            const parts = raw.split("/").filter(Boolean);
            handle = parts[parts.length - 1] || raw;
          }
        } catch {
          // fall back to raw
        }
        const handleNoAt = handle.replace(/^@/, "");
        const href = `https://curius.app/${handleNoAt}`;

        return (
          <li
            key={String(u.id)}
            className="flex items-center justify-between cursor-pointer rounded px-2 py-2 md:py-1 hover:bg-accent active:bg-accent/80"
            onClick={() => onSelect?.(u)}
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">
                {u.firstName} {u.lastName}
              </div>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline truncate block"
                onClick={(e) => e.stopPropagation()}
              >
                {`curius.app/${handleNoAt}`}
              </a>
            </div>
            <span className="text-xs text-muted-foreground ml-2 shrink-0">
              {String(f.order)}°
            </span>
          </li>
        );
      })}
    </ul>
  );
}
