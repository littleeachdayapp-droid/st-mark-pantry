import Dexie, { type Table } from 'dexie';
import type { Client, Visit, Volunteer, VolunteerShift, VolunteerSignup } from '@/types';

export class PantryDatabase extends Dexie {
  clients!: Table<Client>;
  visits!: Table<Visit>;
  volunteers!: Table<Volunteer>;
  volunteerShifts!: Table<VolunteerShift>;
  volunteerSignups!: Table<VolunteerSignup>;

  constructor() {
    super('st-mark-pantry');
    this.version(1).stores({
      clients: 'id, firstName, lastName, [firstName+lastName], createdAt',
      visits: 'id, clientId, date, [clientId+date], dayOfWeek',
      volunteers: 'id, firstName, lastName, createdAt',
      volunteerShifts: 'id, volunteerId, date, dayOfWeek',
    });

    // Version 2: schema unchanged (non-indexed fields don't require migration)
    this.version(2).stores({
      clients: 'id, firstName, lastName, [firstName+lastName], createdAt',
      visits: 'id, clientId, date, [clientId+date], dayOfWeek',
      volunteers: 'id, firstName, lastName, createdAt',
      volunteerShifts: 'id, volunteerId, date, dayOfWeek',
    });

    // Version 3: add volunteer scheduling (signups table + recurringDays on volunteers)
    this.version(3).stores({
      clients: 'id, firstName, lastName, [firstName+lastName], createdAt',
      visits: 'id, clientId, date, [clientId+date], dayOfWeek',
      volunteers: 'id, firstName, lastName, createdAt',
      volunteerShifts: 'id, volunteerId, date, dayOfWeek',
      volunteerSignups: 'id, volunteerId, date, [volunteerId+date], dayOfWeek, status',
    });
  }
}

export const db = new PantryDatabase();
