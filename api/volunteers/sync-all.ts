import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../lib/supabase.js';

interface VolunteerData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  recurringDays?: string[];
  recurringSlots?: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { volunteers } = req.body as { volunteers: VolunteerData[] };

    if (!Array.isArray(volunteers) || volunteers.length === 0) {
      return res.status(400).json({ error: 'No volunteers provided' });
    }

    const now = new Date().toISOString();
    let synced = 0;
    let failed = 0;

    // Process in batches of 100
    for (let i = 0; i < volunteers.length; i += 100) {
      const batch = volunteers.slice(i, i + 100).map((v) => ({
        id: v.id,
        first_name: v.firstName,
        last_name: v.lastName,
        email: v.email || null,
        recurring_days: v.recurringDays || [],
        recurring_slots: v.recurringSlots || [],
        synced_at: now,
      }));

      const { error } = await getSupabase().from('volunteers').upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error('Bulk sync batch error:', error);
        failed += batch.length;
      } else {
        synced += batch.length;
      }
    }

    return res.status(200).json({ ok: true, synced, failed });
  } catch (err) {
    console.error('Bulk sync error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
