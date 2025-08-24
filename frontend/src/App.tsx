import './App.css'
import { useState, useMemo } from 'react'
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

  const { results: userResults, isLoading: usersLoading } = useSearchUsers(search, { limit: 8 })

  const userHandle = selectedUser?.userLink

  const { data: feed, isLoading: feedLoading } = useFeed({
    user_handle: userHandle,
    order: degree,
    limit: 50,
  })

  const { data: follows, isLoading: followsLoading } = useFollowList({
    user_handle: userHandle,
    order: degree,
  })

  const showSuggestions = useMemo(() => {
    if (!search.trim()) return false
    if (selectedUser && (selectedUser.firstName + ' ' + selectedUser.lastName).toLowerCase() === search.trim().toLowerCase()) {
      return false
    }
    return true
  }, [search, selectedUser])

  return (
    <div className="p-4">
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-2rem)]">
        {/* Left: Feed (larger) */}
        <div className="col-span-12 md:col-span-8 space-y-3 h-full overflow-auto pr-1">
          {!selectedUser ? (
            <div className="text-sm text-muted-foreground">Select a user to view their feed.</div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Feed for {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.userLink})</div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!userHandle) return
                  const url = buildFeedUrl({ user_handle: userHandle, order: degree, limit: 50, format: 'rss' })
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
                }}
              >
                Copy RSS
              </Button>
            </div>
          )}

          {selectedUser && (
            feedLoading ? (
              <div className="text-sm text-muted-foreground">Loading feed…</div>
            ) : !feed || feed.length === 0 ? (
              <div className="text-sm text-muted-foreground">No items.</div>
            ) : (
              feed.map((item) => (
                <FeedItem key={String(item.id)} item={item} />
              ))
            )
          )}
        </div>

        {/* Right: Controls + Follow list */}
        <div className="col-span-12 md:col-span-4 space-y-4">
          <div className="space-y-3">
            <div className="relative w-full">
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {showSuggestions && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-sm">
                  <ul className="max-h-64 overflow-auto text-sm">
                    {usersLoading ? (
                      <li className="p-2 text-muted-foreground">Searching...</li>
                    ) : userResults.length === 0 ? (
                      <li className="p-2 text-muted-foreground">No results</li>
                    ) : (
                      userResults.map((u) => (
                        <li
                          key={String(u.id)}
                          className="cursor-pointer px-3 py-2 hover:bg-accent"
                          onClick={() => {
                            setSelectedUser(u)
                            setSearch(`${u.firstName} ${u.lastName}`)
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
                  max={3}
                  step={1}
                  value={[degree]}
                  onValueChange={(v) => setDegree(v?.[0] ?? 1)}
                />
              </div>
              <div className="text-sm tabular-nums w-6 text-center">{degree}</div>
            </div>
          </div>

          {selectedUser && (
            <div>
              <div className="mb-2 text-sm text-muted-foreground">{`Follow list (${degree}°)`}</div>
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
