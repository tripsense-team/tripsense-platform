import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/shared";
import { TripTabs } from "./trip-tabs";
import type { TripResponse } from "../types";

export function CalendarScreen({
  trips,
  loading,
  error,
  onRetry,
}: {
  trips: TripResponse[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const days = weekDays();
  const hours = ["5am", "6am", "7am", "8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm"];

  return (
    <section className="min-h-screen px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <h1 className="text-3xl font-black tracking-normal">Your calendar</h1>
      <TripTabs active="calendar" />
      <div className="mt-10 flex items-center justify-between">
        <div className="flex items-center gap-5 text-base font-black tracking-normal">
          <button type="button" aria-label="Previous week"><ChevronLeft className="h-5 w-5" /></button>
          <span>{formatWeekLabel(days[0], days[6])}</span>
          <button type="button" aria-label="Next week"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <button type="button" className="flex items-center gap-2 text-base font-medium">
          Week <ChevronDown className="h-5 w-5" />
        </button>
      </div>
      {error && <ErrorState className="mt-8" message={error} onRetry={onRetry} />}
      {loading ? <LoadingState className="mt-12" text="Loading calendar..." /> : null}
      <div className="mt-10 overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[92px_repeat(7,minmax(120px,1fr))] border-b border-border">
            <div />
            {days.map((day) => (
              <div key={day.toISOString()} className="pb-4 text-center text-base font-medium text-muted-foreground">
                {formatDayHeading(day)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[92px_repeat(7,minmax(120px,1fr))]">
            <div className="border-r border-border py-4 text-right text-sm text-muted-foreground">all-day</div>
            {days.map((day) => (
              <CalendarCell key={`all-${day.toISOString()}`} day={day} trips={trips} allDay />
            ))}
            {hours.map((hour) => (
              <React.Fragment key={hour}>
                <div className="border-r border-t border-border px-3 py-6 text-right text-sm font-medium text-muted-foreground">{hour}</div>
                {days.map((day) => (
                  <CalendarCell key={`${hour}-${day.toISOString()}`} day={day} trips={trips} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CalendarCell({ day, trips, allDay = false }: { day: Date; trips: TripResponse[]; allDay?: boolean }) {
  const matchingTrip = allDay ? trips.find((trip) => isDateInsideTrip(day, trip)) : null;
  return (
    <div className="min-h-24 border-r border-t border-border p-2">
      {matchingTrip && (
        <Link href={`/trips/${matchingTrip.id}`} className="block rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          {matchingTrip.destinationName}
        </Link>
      )}
    </div>
  );
}

function weekDays(): Date[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatWeekLabel(start: Date, end: Date): string {
  const month = new Intl.DateTimeFormat("en", { month: "short" }).format(start);
  return `${month} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`;
}

function formatDayHeading(day: Date): string {
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "numeric", day: "numeric" }).format(day);
}

function isDateInsideTrip(day: Date, trip: TripResponse): boolean {
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const value = new Date(day.toISOString().slice(0, 10));
  return value >= start && value <= end;
}
