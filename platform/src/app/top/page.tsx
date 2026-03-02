"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Rss } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { FeedItem } from "@/components/feed-item";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useTopStories } from "@/lib/hooks/use-top-stories";
import type { TopStoriesPeriod } from "@/lib/types";
import { topStoryToContent } from "@/lib/types";

const PERIODS: { value: TopStoriesPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    case "custom":
      return "No stories in this range.";
    default:
      return "No stories for this day.";
  }
}

function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TopStoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 md:px-16 lg:px-24 py-4 h-dvh">
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

  const customStartParam = searchParams.get("start") ?? todayUTC();
  const customEndParam = searchParams.get("end") ?? todayUTC();

  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => ({
    from: new Date(`${customStartParam}T12:00:00`),
    to: new Date(`${customEndParam}T12:00:00`),
  }));

  useEffect(() => {
    if (period === "custom") {
      setCustomRange({
        from: new Date(`${customStartParam}T12:00:00`),
        to: new Date(`${customEndParam}T12:00:00`),
      });
    }
  }, [period, customStartParam, customEndParam]);

  const [limit] = useState(30);

  const { data, isLoading } = useTopStories({
    date: dateParam,
    period,
    limit,
    customStart: period === "custom" ? customStartParam : undefined,
    customEnd: period === "custom" ? customEndParam : undefined,
  });

  const isCustom = period === "custom";

  const navigateDate = useCallback(
    (direction: number) => {
      if (isCustom) return;
      const newDate = shiftDate(dateParam, direction, period);
      if (newDate > todayUTC()) return;
      const params = new URLSearchParams();
      if (newDate !== todayUTC()) params.set("date", newDate);
      if (period !== "day") params.set("period", period);
      const qs = params.toString();
      router.push(`/top${qs ? `?${qs}` : ""}`);
    },
    [dateParam, period, router, isCustom],
  );

  function buildUrl(date: string, p: TopStoriesPeriod) {
    const params = new URLSearchParams();
    if (date !== todayUTC()) params.set("date", date);
    if (p !== "day") params.set("period", p);
    const qs = params.toString();
    return `/top${qs ? `?${qs}` : ""}`;
  }

  function setPeriod(p: TopStoriesPeriod) {
    if (p === "custom") {
      const start = customRange?.from
        ? toDateStr(customRange.from)
        : todayUTC();
      const end = customRange?.to ? toDateStr(customRange.to) : start;
      const params = new URLSearchParams({
        period: "custom",
        start,
        end,
      });
      router.push(`/top?${params}`);
    } else {
      router.push(buildUrl(dateParam, p));
    }
  }

  function handleCustomRangeSelect(range: DateRange | undefined) {
    setCustomRange(range);
    if (range?.from) {
      const start = toDateStr(range.from);
      const end = range.to ? toDateStr(range.to) : start;
      const params = new URLSearchParams({
        period: "custom",
        start,
        end,
      });
      router.push(`/top?${params}`);
    }
  }

  function goToCurrent() {
    if (isCustom) return;
    router.push(buildUrl(todayUTC(), period));
  }

  const isCurrentPeriod = !isCustom && isCurrent(dateParam, period);
  const isFutureBlocked =
    !isCustom && shiftDate(dateParam, 1, period) > todayUTC();

  const handleKeyNav = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (isCustom) return;
      if (e.key === "ArrowLeft" || e.key === "h") navigateDate(-1);
      if (e.key === "ArrowRight" || e.key === "l") navigateDate(1);
    },
    [navigateDate, isCustom],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [handleKeyNav]);

  const customDateLabel =
    customStartParam === customEndParam
      ? formatShortDate(customStartParam)
      : `${formatShortDate(customStartParam)} – ${formatShortDate(customEndParam)}`;

  const storiesColumn = (
    <div className="flex-1 min-h-0 overflow-auto space-y-2 md:space-y-3">
      {isLoading ? (
        ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"].map((id) => (
          <div key={id} className="rounded-lg border p-3 md:p-4 animate-pulse">
            <div className="h-3 bg-muted rounded w-1/4 mb-3" />
            <div className="h-5 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-1/3" />
          </div>
        ))
      ) : !data || data.stories.length === 0 ? (
        <div className="text-center py-16">
          <Rss className="size-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{emptyLabel(period)}</p>
          {!isCurrentPeriod && !isCustom && (
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
        data.stories.map((story, i) => (
          <FeedItem
            key={story.id}
            item={topStoryToContent(story)}
            rank={i + 1}
          />
        ))
      )}
    </div>
  );

  const periodTabs = (
    <div className="flex rounded-lg border bg-muted p-0.5 gap-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => setPeriod(p.value)}
          className={`flex-1 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
            period === p.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  const dateNav = (
    <div className="flex items-center justify-between gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigateDate(-1)}
        className="h-8 px-2"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <button
        type="button"
        onClick={goToCurrent}
        className="flex-1 text-center text-sm font-medium tabular-nums hover:text-primary transition-colors"
      >
        {isCurrentPeriod
          ? currentLabel(period)
          : formatDisplayDate(dateParam, period)}
      </button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigateDate(1)}
        disabled={isFutureBlocked}
        className="h-8 px-2"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );

  const calendarPicker = (
    <div className="flex flex-col items-center">
      <div className="text-sm text-muted-foreground mb-1">
        {customDateLabel}
      </div>
      <Calendar
        mode="range"
        selected={customRange}
        onSelect={handleCustomRangeSelect}
        disabled={{ after: new Date() }}
        numberOfMonths={1}
        className="rounded-lg border"
      />
    </div>
  );

  const controlsPanel = (
    <>
      <div className="shrink-0 mb-3 md:mb-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <Flame className="size-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Top Stories</h2>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Feed
          </Link>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground mb-2">Period</div>
            {periodTabs}
          </div>

          {isCustom ? (
            calendarPicker
          ) : (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Date</div>
              {dateNav}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="px-4 md:px-16 lg:px-24 py-4 h-dvh overflow-hidden">
      {/* Mobile Layout */}
      <div className="md:hidden h-full flex flex-col">
        <div className="shrink-0 mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-orange-500" />
              <h2 className="text-base font-semibold">Top Stories</h2>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Feed
            </Link>
          </div>
        </div>

        <div className="shrink-0 mb-3 space-y-2">
          {periodTabs}
          {isCustom ? calendarPicker : dateNav}
        </div>

        <div className="flex-1 min-h-0 flex flex-col">{storiesColumn}</div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:grid grid-cols-12 gap-8 h-full min-h-0 max-w-7xl mx-auto">
        <div className="col-span-7 lg:col-span-8 h-full min-h-0 flex flex-col">
          {storiesColumn}
        </div>
        <div className="col-span-5 lg:col-span-4 h-full min-h-0 flex flex-col overflow-auto">
          {controlsPanel}
        </div>
      </div>
    </div>
  );
}
