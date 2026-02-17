import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Volunteer } from '@/types';

interface AddVolunteerInput {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  notes?: string;
}

interface UpdateVolunteerInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export function useVolunteers() {
  const volunteers = useLiveQuery(
    () => db.volunteers.orderBy('lastName').toArray(),
    []
  );

  async function addVolunteer(input: AddVolunteerInput): Promise<Volunteer> {
    const volunteer: Volunteer = {
      id: crypto.randomUUID(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.volunteers.add(volunteer);
    return volunteer;
  }

  async function updateVolunteer(
    id: string,
    input: UpdateVolunteerInput
  ): Promise<void> {
    const updates: Partial<Volunteer> = {};

    if (input.firstName !== undefined) updates.firstName = input.firstName.trim();
    if (input.lastName !== undefined) updates.lastName = input.lastName.trim();
    if (input.phone !== undefined) updates.phone = input.phone.trim() || undefined;
    if (input.email !== undefined) updates.email = input.email.trim() || undefined;
    if (input.notes !== undefined) updates.notes = input.notes.trim() || undefined;

    await db.volunteers.update(id, updates);
  }

  async function deleteVolunteer(id: string): Promise<void> {
    await db.transaction('rw', [db.volunteers, db.volunteerShifts, db.volunteerSignups], async () => {
      // Delete all signups and shifts for this volunteer first
      await db.volunteerSignups.where('volunteerId').equals(id).delete();
      await db.volunteerShifts.where('volunteerId').equals(id).delete();
      // Then delete the volunteer
      await db.volunteers.delete(id);
    });
  }

  return {
    volunteers: volunteers ?? [],
    addVolunteer,
    updateVolunteer,
    deleteVolunteer,
  };
}
