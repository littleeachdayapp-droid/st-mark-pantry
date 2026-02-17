import { useMemo } from 'react';
import { Check, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatTime } from '@/utils/dateHelpers';
import type { Client, Visit } from '@/types';

interface TodaysListProps {
  visits: Visit[];
  clients: Client[];
}

/**
 * Renders today's visitor list, joined with client data.
 * Sorted by checkedInAt ascending (earliest first).
 * Newly added items (within 2 seconds) get the check-flash animation.
 */
export default function TodaysList({ visits, clients }: TodaysListProps) {
  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    for (const client of clients) {
      map.set(client.id, client);
    }
    return map;
  }, [clients]);

  const sortedVisits = useMemo(() => {
    return [...visits].sort((a, b) =>
      a.checkedInAt.localeCompare(b.checkedInAt)
    );
  }, [visits]);

  if (sortedVisits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Check className="mb-2 size-8 opacity-40" />
        <p className="text-sm">No visitors checked in yet</p>
      </div>
    );
  }

  const now = Date.now();

  return (
    <ul className="divide-y divide-border">
      {sortedVisits.map((visit, index) => {
        const client = clientMap.get(visit.clientId);
        if (!client) return null;

        const checkedInMs = new Date(visit.checkedInAt).getTime();
        const isRecent = now - checkedInMs < 2000;

        return (
          <li
            key={visit.id}
            className={`flex items-center justify-between px-4 py-3 ${
              index % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
            } ${isRecent ? 'check-flash' : ''}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-muted-foreground font-mono tabular-nums w-6 shrink-0 text-right">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {client.lastName}, {client.firstName}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Users className="size-3" />
                {client.numberInFamily}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground tabular-nums shrink-0 ml-3">
              {formatTime(visit.checkedInAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
