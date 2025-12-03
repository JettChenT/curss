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
    <ul className="space-y-2 max-h-[calc(100vh-150px)] overflow-auto pr-1">
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
            className="flex items-center justify-between cursor-pointer rounded px-2 py-1 hover:bg-accent"
            onClick={() => onSelect?.(u)}
          >
            <div>
              <div className="font-medium">
                {u.firstName} {u.lastName}
              </div>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {`curius.app/${handleNoAt}`}
              </a>
            </div>
            <span className="text-xs text-muted-foreground">
              {String(f.order)}°
            </span>
          </li>
        );
      })}
    </ul>
  );
}
