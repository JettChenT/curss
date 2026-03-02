"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Rss } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { TopStoryItem } from "@/components/top-story-item";
import { Button } from "@/components/ui/button";
import { useTopStories } from "@/lib/hooks/use-top-stories";

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isToday(dateStr: string): boolean {
  return dateStr === todayUTC();
}

export default function TopStoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 md:px-16 lg:px-24 py-4">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <TopStoriesContent />
    </Suspense>
  );
}

function TopStoriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date") ?? todayUTC();

  const [limit] = useState(30);

  const { data, isLoading } = useTopStories(dateParam, limit);

  function navigateDate(days: number) {
    const newDate = shiftDate(dateParam, days);
    if (newDate > todayUTC()) return;
    router.push(`/top?date=${newDate}`);
  }

  function goToToday() {
    router.push("/top");
  }

  const isFutureBlocked = dateParam >= todayUTC();

  return (
    <div className="px-4 md:px-16 lg:px-24 py-4 h-dvh overflow-hidden flex flex-col">
      <div className="max-w-3xl mx-auto w-full flex-1 min-h-0 flex flex-col">
        {/* Header */}
        <header className="shrink-0 mb-4 md:mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Flame className="size-5 text-orange-500" />
              <h1 className="text-lg md:text-xl font-semibold">Top Stories</h1>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Feed
            </Link>
          </div>

          {/* Date navigation */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDate(-1)}
              className="h-8 px-2"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline ml-1">Prev</span>
            </Button>

            <button
              type="button"
              onClick={goToToday}
              className="text-sm font-medium tabular-nums hover:text-primary transition-colors"
            >
              {isToday(dateParam) ? "Today" : formatDisplayDate(dateParam)}
            </button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDate(1)}
              disabled={isFutureBlocked}
              className="h-8 px-2"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </header>

        {/* Stories list */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"].map((id) => (
                <div key={id} className="flex gap-3 py-2.5 animate-pulse">
                  <div className="w-7 h-4 bg-muted rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data || data.stories.length === 0 ? (
            <div className="text-center py-16">
              <Rss className="size-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No stories for this day.
              </p>
              {!isToday(dateParam) && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={goToToday}
                  className="mt-2"
                >
                  Go to today
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {data.stories.map((story, i) => (
                <TopStoryItem key={story.id} story={story} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
