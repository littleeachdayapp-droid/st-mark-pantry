import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../lib/supabase.js';
import { getResend, FROM_EMAIL } from '../lib/resend.js';
import { confirmationEmail } from '../lib/emails.js';

interface SignupBody {
  signupId: string;
  volunteerId: string;
  firstName: string;
  lastName: string;
  email?: string;
  date: string;
  dayOfWeek: string;
  role?: string;
  recurringDays?: string[];
  recurringSlots?: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as SignupBody;
    const { signupId, volunteerId, firstName, lastName, email, date, dayOfWeek, role, recurringDays, recurringSlots } = body;

    if (!volunteerId || !firstName || !date || !dayOfWeek) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Upsert volunteer
    await getSupabase().from('volunteers').upsert({
      id: volunteerId,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      recurring_days: recurringDays || [],
      recurring_slots: recurringSlots || [],
      synced_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    // Upsert signup
    await getSupabase().from('signups').upsert({
      id: signupId,
      volunteer_id: volunteerId,
      date,
      day_of_week: dayOfWeek,
      role: role || null,
      status: 'signed-up',
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    // Send confirmation email if volunteer has email
    let emailSent = false;
    if (email) {
      const { subject, html } = confirmationEmail(firstName, date, dayOfWeek, role);
      const { error: emailError } = await getResend().emails.send({
        from: FROM_EMAIL,
        to: email,
        subject,
        html,
      });

      if (!emailError) {
        emailSent = true;
        // Record notification for dedup
        await getSupabase().from('notifications').insert({
          volunteer_id: volunteerId,
          session_date: date,
          type: 'confirmation',
        });
      }
    }

    return res.status(200).json({ ok: true, emailSent });
  } catch (err) {
    console.error('Signup API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
