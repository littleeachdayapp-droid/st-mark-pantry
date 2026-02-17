import Fuse, { type IFuseOptions } from 'fuse.js';
import type { Client, Volunteer } from '@/types';

const fuseOptions: IFuseOptions<Client> = {
  keys: [
    { name: 'firstName', weight: 0.35 },
    { name: 'lastName', weight: 0.35 },
    { name: 'phone', weight: 0.15 },
    { name: 'address.street', weight: 0.15 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

/**
 * Returns a display name for a client (firstName + lastName).
 */
export function getFamilyName(client: Client): string {
  return `${client.firstName} ${client.lastName}`;
}

/**
 * Searches clients using Fuse.js fuzzy matching.
 * Returns matching clients sorted by relevance score.
 * Supports "Last, First" format (e.g. "Smith, John").
 */
export function searchClients(clients: Client[], query: string): Client[] {
  if (!query || query.trim().length < 2) return [];

  let normalizedQuery = query.trim();

  // Handle "Last, First" format
  if (normalizedQuery.includes(',')) {
    const parts = normalizedQuery.split(',').map((s) => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      normalizedQuery = `${parts[1]} ${parts[0]}`;
    }
  }

  const fuse = new Fuse(clients, fuseOptions);
  return fuse.search(normalizedQuery, { limit: 20 }).map((result) => result.item);
}

const volunteerFuseOptions: IFuseOptions<Volunteer> = {
  keys: [
    { name: 'firstName', weight: 0.4 },
    { name: 'lastName', weight: 0.4 },
    { name: 'phone', weight: 0.1 },
    { name: 'email', weight: 0.1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

/**
 * Searches volunteers using Fuse.js fuzzy matching.
 * Returns matching volunteers sorted by relevance score.
 */
export function searchVolunteers(volunteers: Volunteer[], query: string): Volunteer[] {
  if (!query || query.trim().length < 2) return [];
  const fuse = new Fuse(volunteers, volunteerFuseOptions);
  return fuse.search(query, { limit: 20 }).map((result) => result.item);
}
