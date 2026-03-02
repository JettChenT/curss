"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Rss } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { TopStoryItem } from "@/components/top-story-item";
import { Button } from "@/components/ui/button";
import { useTopStories } from "@/lib/hooks/use-top-stories";
import type { TopStoriesPeriod } from "@/lib/types";

const PERIODS: { value: TopStoriesPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shiftDate(
  dateStr: string,
  direction: number,
  period: TopStoriesPeriod,
): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  switch (period) {
    case "week":
      d.setUTCDate(d.getUTCDate() + direction * 7);
      break;
    case "month":
      d.setUTCMonth(d.getUTCMonth() + direction);
      break;
    case "year":
      d.setUTCFullYear(d.getUTCFullYear() + direction);
      break;
    default:
      d.setUTCDate(d.getUTCDate() + direction);
      break;
  }
  return d.toISOString().slice(0, 10);
}

function isCurrent(dateStr: string, period: TopStoriesPeriod): boolean {
  const today = new Date(`${todayUTC()}T00:00:00Z`);
  const anchor = new Date(`${dateStr}T00:00:00Z`);
  switch (period) {
    case "week": {
      const todayDow = today.getUTCDay();
      const todayMonday = new Date(today);
      todayMonday.setUTCDate(
        today.getUTCDate() - (todayDow === 0 ? 6 : todayDow - 1),
      );
      const anchorDow = anchor.getUTCDay();
      const anchorMonday = new Date(anchor);
      anchorMonday.setUTCDate(
        anchor.getUTCDate() - (anchorDow === 0 ? 6 : anchorDow - 1),
      );
      return (
        todayMonday.toISOString().slice(0, 10) ===
        anchorMonday.toISOString().slice(0, 10)
      );
    }
    case "month":
      return (
        today.getUTCFullYear() === anchor.getUTCFullYear() &&
        today.getUTCMonth() === anchor.getUTCMonth()
      );
    case "year":
      return today.getUTCFullYear() === anchor.getUTCFullYear();
    default:
      return dateStr === todayUTC();
  }
}

function formatDisplayDate(dateStr: string, period: TopStoriesPeriod): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  switch (period) {
    case "week": {
      const dow = d.getUTCDay();
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      const fmt = (dt: Date) =>
        dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const yearStr =
        monday.getUTCFullYear() !== new Date().getUTCFullYear()
          ? `, ${monday.getUTCFullYear()}`
          : "";
      return `${fmt(monday)} – ${fmt(sunday)}${yearStr}`;
    }
    case "month":
      return d.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    case "year":
      return String(d.getUTCFullYear());
    default:
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  }
}

function currentLabel(period: TopStoriesPeriod): string {
  switch (period) {
    case "week":
      return "This Week";
    case "month":
      return "This Month";
    case "year":
      return "This Year";
    default:
      return "Today";
  }
}

function emptyLabel(period: TopStoriesPeriod): string {
  switch (period) {
    case "week":
      return "No stories this week.";
    case "month":
      return "No stories this month.";
    case "year":
      return "No stories this year.";
    default:
      return "No stories for this day.";
  }
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
  const periodParam = (searchParams.get("period") as TopStoriesPeriod) ?? "day";
  const period: TopStoriesPeriod = PERIODS.some((p) => p.value === periodParam)
    ? periodParam
    : "day";

  const [limit] = useState(30);

  const { data, isLoading } = useTopStories(dateParam, period, limit);

  function buildUrl(date: string, p: TopStoriesPeriod) {
    const params = new URLSearchParams();
    if (date !== todayUTC()) params.set("date", date);
    if (p !== "day") params.set("period", p);
    const qs = params.toString();
    return `/top${qs ? `?${qs}` : ""}`;
  }

  function navigateDate(direction: number) {
    const newDate = shiftDate(dateParam, direction, period);
    if (newDate > todayUTC()) return;
    router.push(buildUrl(newDate, period));
  }

  function setPeriod(p: TopStoriesPeriod) {
    router.push(buildUrl(dateParam, p));
  }

  function goToCurrent() {
    router.push(buildUrl(todayUTC(), period));
  }

  const isCurrentPeriod = isCurrent(dateParam, period);
  const isFutureBlocked = shiftDate(dateParam, 1, period) > todayUTC();

  return (
    <div className="px-4 md:px-16 lg:px-24 py-4 h-dvh overflow-hidden flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 flex flex-col">
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

          {/* Period tabs + Date navigation */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Period selector */}
            <div className="flex rounded-lg border bg-muted p-0.5 gap-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    period === p.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate(-1)}
                className="h-8 px-2"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <button
                type="button"
                onClick={goToCurrent}
                className="min-w-[10rem] text-center text-sm font-medium tabular-nums hover:text-primary transition-colors"
              >
                {isCurrentPeriod
                  ? currentLabel(period)
                  : formatDisplayDate(dateParam, period)}
              </button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate(1)}
                disabled={isFutureBlocked}
                className="h-8 px-2"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
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
                {emptyLabel(period)}
              </p>
              {!isCurrentPeriod && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={goToCurrent}
                  className="mt-2"
                >
                  Go to {currentLabel(period).toLowerCase()}
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
