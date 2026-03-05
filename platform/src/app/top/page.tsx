"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Rss } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type HTMLAttributes,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CalendarMonth as CalendarMonthType, DateRange } from "react-day-picker";
import { FeedItem } from "@/components/feed-item";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
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

function toLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

function computePeriodRange(
  dateStr: string,
  period: TopStoriesPeriod,
): { from: Date; to: Date } {
  const d = new Date(`${dateStr}T12:00:00`);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();

  switch (period) {
    case "week": {
      const dow = d.getDay();
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(y, m, day + mondayOffset, 12);
      const sunday = new Date(y, m, day + mondayOffset + 6, 12);
      return { from: monday, to: sunday };
    }
    case "month": {
      const first = new Date(y, m, 1, 12);
      const last = new Date(y, m + 1, 0, 12);
      return { from: first, to: last };
    }
    case "year": {
      const first = new Date(y, 0, 1, 12);
      const last = new Date(y, 11, 31, 12);
      return { from: first, to: last };
    }
    default:
      return { from: d, to: d };
  }
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

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function MonthYearPicker({
  currentMonth,
  onSelect,
}: {
  currentMonth: Date;
  onSelect: (month: Date) => void;
}) {
  const [year, setYear] = useState(currentMonth.getFullYear());
  const now = new Date();

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setYear((y) => y - 1)}
          className="size-7 p-0"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">{year}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= now.getFullYear()}
          className="size-7 p-0"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MONTH_LABELS.map((label, i) => {
          const isDisabled =
            year === now.getFullYear() && i > now.getMonth();
          const isCurrent =
            year === currentMonth.getFullYear() &&
            i === currentMonth.getMonth();
          return (
            <button
              key={label}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(new Date(year, i, 1))}
              className={cn(
                "py-2 rounded-md text-sm transition-colors",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
                isDisabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
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

  const isCustom = period === "custom";

  const displayedRange: DateRange = useMemo(() => {
    if (isCustom) {
      return {
        from: toLocalDate(customStartParam),
        to: toLocalDate(customEndParam),
      };
    }
    const { from, to } = computePeriodRange(dateParam, period);
    return { from, to };
  }, [isCustom, customStartParam, customEndParam, dateParam, period]);

  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => new Date(
      (displayedRange.from ?? new Date()).getFullYear(),
      (displayedRange.from ?? new Date()).getMonth(),
      1,
    ),
  );
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  useEffect(() => {
    if (displayedRange.from) {
      setCalendarMonth(
        new Date(displayedRange.from.getFullYear(), displayedRange.from.getMonth(), 1),
      );
      setShowMonthPicker(false);
    }
  }, [displayedRange.from]);

  const [limit] = useState(30);

  const { data, isLoading } = useTopStories({
    date: dateParam,
    period,
    limit,
    customStart: isCustom ? customStartParam : undefined,
    customEnd: isCustom ? customEndParam : undefined,
  });

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
      const start = displayedRange.from
        ? toDateStr(displayedRange.from)
        : todayUTC();
      const end = displayedRange.to ? toDateStr(displayedRange.to) : start;
      router.push(
        `/top?${new URLSearchParams({ period: "custom", start, end })}`,
      );
    } else {
      router.push(buildUrl(dateParam, p));
    }
  }

  function handleCalendarRangeSelect(range: DateRange | undefined) {
    if (!range?.from) return;
    const start = toDateStr(range.from);
    const end = range.to ? toDateStr(range.to) : start;
    router.push(
      `/top?${new URLSearchParams({ period: "custom", start, end })}`,
    );
  }

  function handleCalendarDaySelect(day: Date | undefined) {
    if (!day) return;
    const dateStr = toDateStr(day);
    router.push(buildUrl(dateStr, period));
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

  const dateLabel = isCustom
    ? customStartParam === customEndParam
      ? formatShortDate(customStartParam)
      : `${formatShortDate(customStartParam)} – ${formatShortDate(customEndParam)}`
    : isCurrentPeriod
      ? currentLabel(period)
      : formatDisplayDate(dateParam, period);

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

  const dateNav = !isCustom ? (
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
        {dateLabel}
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
  ) : (
    <div className="text-center text-sm font-medium tabular-nums">
      {dateLabel}
    </div>
  );

  const clickableCaption = useMemo(
    () =>
      function ClickableMonthCaption(
        props: {
          calendarMonth: CalendarMonthType;
          displayIndex: number;
        } & HTMLAttributes<HTMLDivElement>,
      ) {
        const { calendarMonth: cm, displayIndex: _, ...rest } = props;
        return (
          <div {...rest}>
            <button
              type="button"
              onClick={() => setShowMonthPicker(true)}
              className="text-sm font-medium hover:text-primary transition-colors cursor-pointer"
            >
              {cm.date.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </button>
          </div>
        );
      },
    [],
  );

  const periodRangeModifiers =
    !isCustom && period !== "day" && displayedRange.from && displayedRange.to
      ? {
          modifiers: {
            periodRange: {
              from: displayedRange.from,
              to: displayedRange.to,
            },
          },
          modifiersClassNames: {
            periodRange:
              "bg-accent text-accent-foreground rounded-none aria-selected:bg-accent",
          },
        }
      : {};

  const calendarWidget = showMonthPicker ? (
    <div className="rounded-lg border w-full">
      <MonthYearPicker
        currentMonth={calendarMonth}
        onSelect={(m) => {
          setCalendarMonth(m);
          setShowMonthPicker(false);
        }}
      />
    </div>
  ) : isCustom ? (
    <Calendar
      mode="range"
      selected={displayedRange}
      onSelect={handleCalendarRangeSelect}
      disabled={{ after: new Date() }}
      numberOfMonths={1}
      month={calendarMonth}
      onMonthChange={setCalendarMonth}
      components={{ MonthCaption: clickableCaption }}
      className="rounded-lg border w-full"
    />
  ) : (
    <Calendar
      mode="single"
      selected={period === "day" ? displayedRange.from : undefined}
      onSelect={handleCalendarDaySelect}
      disabled={{ after: new Date() }}
      numberOfMonths={1}
      month={calendarMonth}
      onMonthChange={setCalendarMonth}
      components={{ MonthCaption: clickableCaption }}
      {...periodRangeModifiers}
      className="rounded-lg border w-full"
    />
  );

  const controlsPanel = (
    <div className="shrink-0 space-y-4">
      <div className="flex items-center justify-between gap-2">
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

      <div>
        <div className="text-sm text-muted-foreground mb-2">Period</div>
        {periodTabs}
      </div>

      <div>
        <div className="text-sm text-muted-foreground mb-2">Date</div>
        {dateNav}
      </div>

      {calendarWidget}
    </div>
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
          {dateNav}
        </div>

        <div className="flex-1 min-h-0 flex flex-col">{storiesColumn}</div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:grid grid-cols-12 gap-8 h-full min-h-0 max-w-7xl mx-auto">
        <div className="col-span-7 lg:col-span-8 h-full min-h-0 flex flex-col">
          {storiesColumn}
        </div>
        <div className="col-span-5 lg:col-span-4 h-full min-h-0 overflow-auto">
          {controlsPanel}
        </div>
      </div>
    </div>
  );
}
