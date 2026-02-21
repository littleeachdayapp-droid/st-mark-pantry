import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { matchesRecurringSlot } from '@/utils/dateHelpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import type { PantryDay, Volunteer, VolunteerSignup } from '@/types';

const PANTRY_DAYS: Record<number, PantryDay> = {
  1: 'Monday',
  5: 'Friday',
  6: 'Saturday',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getVolunteerCount(
  date: string,
  dayOfWeek: PantryDay,
  volunteers: Volunteer[],
  signups: VolunteerSignup[]
): number {
  const addedIds = new Set<string>();

  // Cancelled signups for this date
  const cancelledIds = new Set(
    signups
      .filter((s) => s.date === date && s.status === 'cancelled')
      .map((s) => s.volunteerId)
  );

  // Recurring volunteers
  for (const v of volunteers) {
    if (matchesRecurringSlot(v.recurringSlots, v.recurringDays, date, dayOfWeek) && !cancelledIds.has(v.id)) {
      addedIds.add(v.id);
    }
  }

  // Explicit signups
  for (const s of signups) {
    if (s.date === date && s.status === 'signed-up' && !addedIds.has(s.volunteerId)) {
      addedIds.add(s.volunteerId);
    }
  }

  return addedIds.size;
}

interface CalendarDay {
  date: Date;
  iso: string;
  dayOfWeek: number;
  isCurrentMonth: boolean;
  isPantryDay: boolean;
  pantryDay?: PantryDay;
}

function getCalendarDays(year: number, month: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Fill in days from previous month to start on Sunday
  const startDow = firstDay.getDay();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({
      date: d,
      iso: formatISODate(d),
      dayOfWeek: d.getDay(),
      isCurrentMonth: false,
      isPantryDay: d.getDay() in PANTRY_DAYS,
      pantryDay: PANTRY_DAYS[d.getDay()],
    });
  }

  // Current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, month, day);
    days.push({
      date: d,
      iso: formatISODate(d),
      dayOfWeek: d.getDay(),
      isCurrentMonth: true,
      isPantryDay: d.getDay() in PANTRY_DAYS,
      pantryDay: PANTRY_DAYS[d.getDay()],
    });
  }

  // Fill in days from next month to complete the grid
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        iso: formatISODate(d),
        dayOfWeek: d.getDay(),
        isCurrentMonth: false,
        isPantryDay: d.getDay() in PANTRY_DAYS,
        pantryDay: PANTRY_DAYS[d.getDay()],
      });
    }
  }

  return days;
}

export function VolunteerCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const volunteers = useLiveQuery(() => db.volunteers.toArray());
  const allSignups = useLiveQuery(() => db.volunteerSignups.toArray());

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);
  const todayISO = formatISODate(today);

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  function goToToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  if (volunteers === undefined || allSignups === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Pre-compute counts for all pantry days in this calendar view
  const counts = new Map<string, number>();
  for (const day of calendarDays) {
    if (day.isPantryDay && day.pantryDay) {
      counts.set(day.iso, getVolunteerCount(day.iso, day.pantryDay, volunteers, allSignups));
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/volunteers">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Volunteer Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Monthly view of volunteer coverage
          </p>
        </div>
      </div>

      {/* Month Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">
                {MONTH_NAMES[month]} {year}
              </CardTitle>
              {(year !== today.getFullYear() || month !== today.getMonth()) && (
                <Button variant="ghost" size="sm" onClick={goToToday}>
                  Today
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className={`text-center text-xs font-medium py-1 ${
                  d === 'Mon' || d === 'Fri' || d === 'Sat'
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
            {calendarDays.map((day) => {
              const count = counts.get(day.iso) ?? 0;
              const isToday = day.iso === todayISO;
              const isPast = day.iso < todayISO;

              return (
                <div
                  key={day.iso}
                  className={`min-h-[4.5rem] p-1.5 ${
                    day.isCurrentMonth ? 'bg-background' : 'bg-muted/30'
                  } ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}
                >
                  <div
                    className={`text-xs ${
                      isToday
                        ? 'font-bold text-primary'
                        : day.isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/50'
                    }`}
                  >
                    {day.date.getDate()}
                  </div>

                  {day.isPantryDay && day.isCurrentMonth && (
                    <div className="mt-1">
                      <Link
                        to="/volunteers/schedule"
                        className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors ${
                          count > 0
                            ? isPast
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary/10 text-primary hover:bg-primary/20'
                            : isPast
                              ? 'bg-muted/50 text-muted-foreground/60'
                              : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                        }`}
                      >
                        <Users className="size-3 shrink-0" />
                        <span className="font-medium">{count}</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded bg-primary/10 border border-primary/20" />
              <span>Has volunteers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded bg-destructive/10 border border-destructive/20" />
              <span>Needs coverage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="h-4 px-1 text-[10px]">Mon</Badge>
              <Badge variant="outline" className="h-4 px-1 text-[10px]">Fri</Badge>
              <Badge variant="outline" className="h-4 px-1 text-[10px]">Sat</Badge>
              <span>= Pantry days</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
