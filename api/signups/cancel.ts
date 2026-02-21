import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../lib/supabase.js';
import { getResend, FROM_EMAIL } from '../../lib/resend.js';
import { cancellationEmail } from '../../lib/emails.js';

interface CancelBody {
  signupId?: string;
  volunteerId: string;
  date: string;
  dayOfWeek: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as CancelBody;
    const { signupId, volunteerId, date, dayOfWeek } = body;

    if (!volunteerId || !date || !dayOfWeek) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (signupId) {
      // Delete the one-off signup
      await getSupabase().from('signups').delete().eq('id', signupId);
    } else {
      // Recurring excuse — upsert a cancelled record
      await getSupabase().from('signups').upsert({
        id: crypto.randomUUID(),
        volunteer_id: volunteerId,
        date,
        day_of_week: dayOfWeek,
        status: 'cancelled',
        created_at: new Date().toISOString(),
      });
    }

    // Send cancellation email if volunteer has email
    let emailSent = false;
    const { data: volunteer } = await getSupabase()
      .from('volunteers')
      .select('first_name, email')
      .eq('id', volunteerId)
      .single();

    if (volunteer?.email) {
      const { subject, html } = cancellationEmail(volunteer.first_name, date, dayOfWeek);
      const { error: emailError } = await getResend().emails.send({
        from: FROM_EMAIL,
        to: volunteer.email,
        subject,
        html,
      });
      emailSent = !emailError;
    }

    return res.status(200).json({ ok: true, emailSent });
  } catch (err) {
    console.error('Cancel API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
