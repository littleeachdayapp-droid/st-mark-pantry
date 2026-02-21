import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../lib/supabase.js';

interface SyncBody {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  recurringDays?: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as SyncBody;
    const { id, firstName, lastName, email, recurringDays } = body;

    if (!id || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { error } = await getSupabase().from('volunteers').upsert({
      id,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      recurring_days: recurringDays || [],
      synced_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (error) {
      console.error('Volunteer sync error:', error);
      return res.status(500).json({ error: 'Failed to sync volunteer' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Volunteer sync error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
