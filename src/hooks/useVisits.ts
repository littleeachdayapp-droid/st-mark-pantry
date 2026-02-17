import { db } from '@/db/database';
import type { Visit, PantryDay } from '@/types';
import { isSameMonth } from '@/utils/dateHelpers';

export function useVisits() {
  /**
   * Creates a new visit record for a client.
   */
  async function addVisit(
    clientId: string,
    date: string,
    dayOfWeek: PantryDay,
    servedBy?: string
  ): Promise<Visit> {
    const visit: Visit = {
      id: crypto.randomUUID(),
      clientId,
      date,
      dayOfWeek,
      servedBy: servedBy?.trim() || undefined,
      checkedInAt: new Date().toISOString(),
    };

    await db.visits.add(visit);
    return visit;
  }

  /**
   * Returns all visits for a specific client, sorted newest first.
   */
  async function getVisitsForClient(clientId: string): Promise<Visit[]> {
    const visits = await db.visits
      .where('clientId')
      .equals(clientId)
      .toArray();

    return visits.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Returns all visits for a specific date (e.g. today's check-in list).
   */
  async function getVisitsForDate(date: string): Promise<Visit[]> {
    return db.visits
      .where('date')
      .equals(date)
      .toArray();
  }

  /**
   * Finds the most recent visit for a client within the same calendar month
   * as the given date. Used for the monthly guard-rail warning
   * (to alert if a client has already visited this month).
   * Returns undefined if no visit found in that month.
   */
  async function getLastVisitInMonth(
    clientId: string,
    date: string
  ): Promise<Visit | undefined> {
    const visits = await db.visits
      .where('clientId')
      .equals(clientId)
      .toArray();

    const sameMonthVisits = visits
      .filter((v) => isSameMonth(v.date, date))
      .sort((a, b) => b.date.localeCompare(a.date));

    return sameMonthVisits[0];
  }

  return {
    addVisit,
    getVisitsForClient,
    getVisitsForDate,
    getLastVisitInMonth,
  };
}
