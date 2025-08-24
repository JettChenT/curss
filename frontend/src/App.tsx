import './App.css'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useSearchUsers } from '@/lib/hooks/use-search-users'
import type { User } from '@/lib/bindings/User'
import { useFeed } from '@/lib/hooks/use-feed'
import { useFollowList } from '@/lib/hooks/use-follow-list'
import { FeedItem } from '@/components/FeedItem'
import { FollowList } from '@/components/FollowList'
import { Button } from '@/components/ui/button'
import { buildFeedUrl } from '@/lib/api'

function App() {
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [degree, setDegree] = useState<number>(1)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false)
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [feedLimit, setFeedLimit] = useState<number>(100)
  const feedContainerRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const { results: userResults, isLoading: usersLoading } = useSearchUsers(search, { limit: 8 })

  const suggestionListRef = useRef<HTMLUListElement | null>(null)

  const userHandle = selectedUser?.userLink

  const { data: feed, isLoading: feedLoading, isFetching: feedFetching, isStale } = useFeed({
    user_handle: userHandle,
    order: degree,
    limit: feedLimit,
  })
  // Reset feed limit when user or degree changes
  useEffect(() => {
    setFeedLimit(100)
  }, [userHandle, degree])

  const hasMore = Boolean(feed && feed.length >= feedLimit && feedLimit < 500)

  // Infinite scroll: bump limit when bottom sentinel enters view
  useEffect(() => {
    const root = feedContainerRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasMore && !feedFetching) {
          setFeedLimit((l) => Math.min(l + 100, 500))
        }
      },
      { root, rootMargin: '0px 0px 200px 0px', threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, feedFetching, selectedUser, degree])

  const { data: follows, isLoading: followsLoading } = useFollowList({
    user_handle: userHandle,
    order: degree,
  })

  const showSuggestions = useMemo(() => {
    if (selectedUser && (selectedUser.firstName + ' ' + selectedUser.lastName).toLowerCase() === search.trim().toLowerCase()) {
      return false
    }
    return true
  }, [search, selectedUser])

  const shouldShowSuggestions = showSuggestions && isSearchFocused

  useEffect(() => {
    if (activeIndex < 0) return
    const el = suggestionListRef.current?.children?.[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  function selectUser(u: User) {
    setSelectedUser(u)
    setSearch(`${u.firstName} ${u.lastName}`)
    setIsSearchFocused(false)
    setActiveIndex(-1)
  }

  return (
    <div className="p-4 h-full min-h-0">
      <div className="grid grid-cols-12 gap-4 h-full min-h-0">
        {/* Left: Feed (larger) */}
        <div className="col-span-12 md:col-span-8 h-full min-h-0 pr-1 flex flex-col">
          <div className="shrink-0">
            {!selectedUser ? (
              <div className="text-sm text-muted-foreground">Select a user to view their feed.</div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Feed for {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.userLink})</div>
                <div className="flex items-center gap-2">
                  {(feedLoading || feedFetching ) && (
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-yellow-400 animate-pulse"
                      title="Updating feed"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!userHandle) return
                      const url = buildFeedUrl({ user_handle: userHandle, order: degree, limit: feedLimit, format: 'rss' })
                      try {
                        await navigator.clipboard.writeText(url)
                      } catch {
                        const el = document.createElement('textarea')
                        el.value = url
                        document.body.appendChild(el)
                        el.select()
                        document.execCommand('copy')
                        document.body.removeChild(el)
                      }
                      setCopied(true)
                      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
                      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy RSS'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div ref={feedContainerRef} className="mt-3 flex-1 min-h-0 overflow-auto space-y-3">
            {selectedUser && (
              feedLoading ? (
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
                      {feedFetching ? 'Loading more…' : 'Scroll to load more'}
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>

        {/* Right: Controls + Follow list */}
        <div className="col-span-12 md:col-span-4 h-full min-h-0 space-y-4">
          <div className="space-y-3">
            <div className="relative w-full">
              <Input
                placeholder="Search users..."
                value={search}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setActiveIndex(-1)
                }}
                onKeyDown={(e) => {
                  if (!shouldShowSuggestions) return
                  const items = usersLoading ? [] : userResults
                  if (items.length === 0) return
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActiveIndex((idx) => (idx + 1) % items.length)
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveIndex((idx) => (idx <= 0 ? items.length - 1 : idx - 1))
                  } else if (e.key === 'Enter') {
                    if (activeIndex >= 0 && activeIndex < items.length) {
                      e.preventDefault()
                      selectUser(items[activeIndex]!)
                    }
                  } else if (e.key === 'Escape') {
                    setIsSearchFocused(false)
                  }
                }}
              />
              {shouldShowSuggestions && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-sm">
                  <ul ref={suggestionListRef} className="max-h-64 overflow-auto text-sm">
                    {usersLoading ? (
                      <li className="p-2 text-muted-foreground">Searching...</li>
                    ) : userResults.length === 0 ? (
                      <li className="p-2 text-muted-foreground">No results</li>
                    ) : (
                      userResults.map((u, idx) => (
                        <li
                          key={String(u.id)}
                          className={`cursor-pointer px-3 py-2 hover:bg-accent ${idx === activeIndex ? 'bg-accent' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            selectUser(u)
                          }}
                        >
                          <div className="font-medium">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.userLink}</div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground whitespace-nowrap">Degree</div>
              <div className="flex-1">
                <Slider
                  min={1}
                  max={2}
                  step={1}
                  value={[Math.min(2, Math.max(1, degree))]}
                  onValueChange={(v) => setDegree(Math.min(2, Math.max(1, v?.[0] ?? 1)))}
                />
              </div>
              <div className="text-sm tabular-nums w-6 text-center">{degree}</div>
            </div>
          </div>

          {selectedUser && (
            <div>
              <div className="mb-2 text-sm text-muted-foreground">{`Follow list (${degree}°${!followsLoading ? ` • ${follows?.length ?? 0}` : ''})`}</div>
              {followsLoading ? (
                <div className="text-sm text-muted-foreground">Loading follows…</div>
              ) : (
                <FollowList
                  items={follows ?? []}
                  onSelect={(u) => {
                    setSelectedUser(u)
                    setSearch(`${u.firstName} ${u.lastName}`)
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
