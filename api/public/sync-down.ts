import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../lib/supabase.js';
import { requireAuth } from '../lib/require-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  try {
    const since = req.query.since as string | undefined;
    const supabase = getSupabase();
    const syncedAt = new Date().toISOString();

    // Fetch volunteers
    let volQuery = supabase
      .from('volunteers')
      .select('id, first_name, last_name, email, phone, recurring_days, recurring_slots, synced_at');

    if (since) {
      volQuery = volQuery.gte('synced_at', since);
    }

    const { data: volunteers, error: volError } = await volQuery;
    if (volError) {
      console.error('Sync-down volunteers error:', volError);
      return res.status(500).json({ error: 'Failed to fetch volunteers' });
    }

    // Fetch signups
    let sigQuery = supabase
      .from('signups')
      .select('id, volunteer_id, date, day_of_week, role, status, created_at');

    if (since) {
      sigQuery = sigQuery.gte('created_at', since);
    }

    const { data: signups, error: sigError } = await sigQuery;
    if (sigError) {
      console.error('Sync-down signups error:', sigError);
      return res.status(500).json({ error: 'Failed to fetch signups' });
    }

    return res.status(200).json({
      ok: true,
      volunteers: volunteers || [],
      signups: signups || [],
      syncedAt,
    });
  } catch (err) {
    console.error('Sync-down error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
