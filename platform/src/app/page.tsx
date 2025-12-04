"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useSearchUsers } from "@/lib/hooks/use-search-users";
import { useFeed } from "@/lib/hooks/use-feed";
import { useFollowList } from "@/lib/hooks/use-follow-list";
import { FeedItem } from "@/components/feed-item";
import { FollowList } from "@/components/follow-list";
import { useAllUsers } from "@/lib/hooks/use-all-users";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="px-8 md:px-16 lg:px-24 py-4 h-full min-h-0">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state
  const userHandle = searchParams.get("user") || null;
  const degree = Number(searchParams.get("degree") ?? 0);

  // Local UI state
  const [userSearch, setUserSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedLimit, setFeedLimit] = useState<number>(100);
  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [debouncedLinkSearch, setDebouncedLinkSearch] = useState("");

  // Get all users for lookup and display
  const { data: allUsersData, isLoading: allUsersLoading } = useAllUsers();
  const allUsersList = allUsersData?.users ?? [];

  // Get users for search in right panel
  const { results: searchedUsers, isLoading: usersLoading } = useSearchUsers(
    userSearch,
    { limit: 100 },
  );

  // Find selected user from URL param
  const selectedUser = useMemo(() => {
    if (!userHandle) return null;
    return allUsersList.find((u) => u.userLink === userHandle) ?? null;
  }, [userHandle, allUsersList]);

  // Debounce link search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLinkSearch(linkSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [linkSearch]);

  const {
    data: feed,
    isLoading: feedLoading,
    isFetching: feedFetching,
    isPending: feedPending,
  } = useFeed({
    user_handle: userHandle ?? undefined,
    order: degree,
    limit: feedLimit,
    search: debouncedLinkSearch || undefined,
  });

  // Reset feed limit and link search when user or degree changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset on userHandle/degree change
  useEffect(() => {
    setFeedLimit(100);
    setLinkSearch("");
    setDebouncedLinkSearch("");
  }, [userHandle, degree]);

  const hasMore = Boolean(feed && feed.length >= feedLimit && feedLimit < 500);

  // Infinite scroll: bump limit when bottom sentinel enters view
  useEffect(() => {
    const root = feedContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !feedFetching) {
          setFeedLimit((l) => Math.min(l + 100, 500));
        }
      },
      { root, rootMargin: "0px 0px 200px 0px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, feedFetching]);

  const { data: follows, isLoading: followsLoading } = useFollowList({
    user_handle: userHandle ?? undefined,
    order: degree,
  });

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  // URL navigation helpers
  function selectUser(userLink: string) {
    router.push(`/?user=${encodeURIComponent(userLink)}&degree=0`);
    setUserSearch("");
  }

  function setDegreeParam(newDegree: number) {
    if (!userHandle) return;
    router.push(`/?user=${encodeURIComponent(userHandle)}&degree=${newDegree}`);
  }

  function goBackToGlobal() {
    router.push("/");
    setUserSearch("");
  }

  const handleCopyRss = async () => {
    if (!userHandle) return;
    const url = `${window.location.origin}/api/feed?user_handle=${encodeURIComponent(userHandle)}&order=${degree}&limit=${feedLimit}&format=rss`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  // Show loading state while fetching user data for URL param
  const isLoadingSelectedUser = userHandle && allUsersLoading;

  return (
    <div className="px-8 md:px-16 lg:px-24 py-4 h-full min-h-0">
      <div className="grid grid-cols-12 gap-8 h-full min-h-0 max-w-7xl mx-auto">
        {/* Left: Article Search + Feed */}
        <div className="col-span-12 md:col-span-7 lg:col-span-8 h-full min-h-0 flex flex-col">
          {/* Article Search */}
          <div className="shrink-0 mb-4">
            <div className="relative">
              <Input
                placeholder="Search articles..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="pr-8"
              />
              {linkSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setLinkSearch("");
                    setDebouncedLinkSearch("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Feed */}
          <div
            ref={feedContainerRef}
            className="flex-1 min-h-0 overflow-auto space-y-3 pr-2"
          >
            {feedLoading ? (
              <div className="text-sm text-muted-foreground">Loading feed…</div>
            ) : !feed || feed.length === 0 ? (
              <div className="text-sm text-muted-foreground">No items.</div>
            ) : (
              <>
                {feed.map((item) => (
                  <FeedItem key={String(item.id)} item={item} />
                ))}
                <div ref={sentinelRef} />
                {hasMore && (
                  <div className="py-2 text-center text-sm text-muted-foreground">
                    {feedFetching ? "Loading more…" : "Scroll to load more"}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Loading indicator */}
          {feedPending && (
            <div className="shrink-0 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
              Updating feed...
            </div>
          )}
        </div>

        {/* Right: User Selector Panel */}
        <div className="col-span-12 md:col-span-5 lg:col-span-4 h-full min-h-0 flex flex-col">
          {/* Panel Header */}
          <div className="shrink-0 mb-4">
            {userHandle ? (
              /* User's Feed Mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {isLoadingSelectedUser
                      ? "Loading..."
                      : selectedUser
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : userHandle}
                  </h2>
                  <Button variant="outline" size="sm" onClick={goBackToGlobal}>
                    ← Back
                  </Button>
                </div>

                {/* Degree Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Degree</span>
                    <span className="tabular-nums font-medium">{degree}</span>
                  </div>
                  <Slider
                    min={0}
                    max={2}
                    step={1}
                    value={[Math.min(2, Math.max(0, degree))]}
                    onValueChange={(v) => {
                      const newDegree = Math.min(2, Math.max(0, v?.[0] ?? 0));
                      setDegreeParam(newDegree);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {degree === 0 &&
                      `Only ${selectedUser?.firstName ?? "this user"}'s saved articles`}
                    {degree === 1 &&
                      `Articles from ${selectedUser?.firstName ?? "this user"} + people they follow`}
                    {degree === 2 &&
                      `Articles from ${selectedUser?.firstName ?? "this user"} + 2 degrees of follows`}
                  </p>
                </div>

                {/* RSS Copy Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyRss}
                  className="w-full"
                >
                  {copied ? "Copied!" : "Copy RSS Feed"}
                </Button>
              </div>
            ) : (
              /* Global Feed Mode */
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Global Feed</h2>
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* User List */}
          <div className="flex-1 min-h-0 flex flex-col">
            {userHandle ? (
              /* Follow List for selected user */
              degree > 0 ? (
                <>
                  <div className="mb-2 text-sm text-muted-foreground shrink-0">
                    {`Follow list (${degree}°${!followsLoading ? ` • ${follows?.length ?? 0}` : ""})`}
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto">
                    {followsLoading ? (
                      <div className="text-sm text-muted-foreground">
                        Loading follows…
                      </div>
                    ) : (
                      <FollowList
                        items={follows ?? []}
                        onSelect={(u) => selectUser(u.userLink)}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Set degree &gt; 0 to see followed users
                </div>
              )
            ) : (
              /* All Users List (Global Feed mode) */
              <div className="space-y-1">
                {usersLoading || allUsersLoading ? (
                  <div className="text-sm text-muted-foreground">
                    Loading users…
                  </div>
                ) : searchedUsers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No users found.
                  </div>
                ) : (
                  searchedUsers.map((u) => {
                    const handleNoAt = u.userLink.replace(/^@/, "");
                    const href = `https://curius.app/${handleNoAt}`;

                    return (
                      <button
                        type="button"
                        key={String(u.id)}
                        className="w-full flex items-center justify-between cursor-pointer rounded-lg px-3 py-2 hover:bg-accent transition-colors text-left"
                        onClick={() => selectUser(u.userLink)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {u.firstName} {u.lastName}
                          </div>
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            curius.app/{handleNoAt}
                          </a>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">
                          {u.numFollowers} followers
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
