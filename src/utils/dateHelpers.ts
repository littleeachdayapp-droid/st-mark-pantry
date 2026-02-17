import type { PantryDay } from '@/types';

/**
 * Returns today's date as 'YYYY-MM-DD' in local time.
 */
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's full day name (e.g. 'Monday', 'Friday', 'Wednesday').
 */
export function getTodayDayOfWeek(): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
}

/**
 * Checks whether a given date (or today) falls on a pantry day (Monday or Friday).
 */
export function isPantryDay(date?: string): boolean {
  const d = date ? parseLocalDate(date) : new Date();
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
  return dayName === 'Monday' || dayName === 'Friday';
}

/**
 * Returns 'Monday' or 'Friday' based on today's date.
 * If today is a pantry day, returns today's day.
 * Otherwise, returns whichever pantry day is nearest (past or future).
 */
export function getDefaultPantryDay(): PantryDay {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  if (dayOfWeek === 1) return 'Monday';
  if (dayOfWeek === 5) return 'Friday';

  // Calculate distance to Monday (1) and Friday (5)
  const distToMonday = Math.min(
    Math.abs(dayOfWeek - 1),
    Math.abs(dayOfWeek - 1 + 7),
    Math.abs(dayOfWeek - 1 - 7)
  );
  const distToFriday = Math.min(
    Math.abs(dayOfWeek - 5),
    Math.abs(dayOfWeek - 5 + 7),
    Math.abs(dayOfWeek - 5 - 7)
  );

  return distToMonday <= distToFriday ? 'Monday' : 'Friday';
}

/**
 * Formats an ISO date string as 'Mon, Feb 16, 2026'.
 */
export function formatDate(iso: string): string {
  const date = parseLocalDate(iso);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Formats an ISO datetime string as '10:04 AM'.
 */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Returns the start and end dates (YYYY-MM-DD) for the calendar month
 * containing the given date (or today).
 */
export function getMonthRange(date?: string): { start: string; end: string } {
  const d = date ? parseLocalDate(date) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return {
    start: formatISO(firstDay),
    end: formatISO(lastDay),
  };
}

/**
 * Checks whether two ISO date strings fall in the same calendar month and year.
 */
export function isSameMonth(date1: string, date2: string): boolean {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

// ---- Internal helpers ----

/**
 * Parses a 'YYYY-MM-DD' string as a local date (not UTC).
 */
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a Date object as 'YYYY-MM-DD'.
 */
function formatISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
