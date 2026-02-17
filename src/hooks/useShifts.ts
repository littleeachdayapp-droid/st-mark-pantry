import { db } from '@/db/database';
import type { PantryDay, VolunteerShift } from '@/types';

export function useShifts() {
  async function addShift(
    volunteerId: string,
    date: string,
    dayOfWeek: PantryDay,
    role?: string
  ): Promise<VolunteerShift> {
    const shift: VolunteerShift = {
      id: crypto.randomUUID(),
      volunteerId,
      date,
      dayOfWeek,
      role: role || undefined,
    };
    await db.volunteerShifts.add(shift);
    return shift;
  }

  async function getShiftsForDate(date: string): Promise<VolunteerShift[]> {
    return db.volunteerShifts.where('date').equals(date).toArray();
  }

  async function getShiftsForVolunteer(volunteerId: string): Promise<VolunteerShift[]> {
    return db.volunteerShifts
      .where('volunteerId')
      .equals(volunteerId)
      .reverse()
      .sortBy('date');
  }

  async function updateShift(
    id: string,
    updates: Partial<Pick<VolunteerShift, 'hoursWorked' | 'role' | 'notes'>>
  ): Promise<void> {
    await db.volunteerShifts.update(id, updates);
  }

  async function deleteShift(id: string): Promise<void> {
    await db.volunteerShifts.delete(id);
  }

  return { addShift, getShiftsForDate, getShiftsForVolunteer, updateShift, deleteShift };
}
