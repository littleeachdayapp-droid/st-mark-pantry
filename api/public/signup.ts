import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../lib/supabase.js';
import { getResend, FROM_EMAIL } from '../../lib/resend.js';
import { publicConfirmationEmail } from '../../lib/emails.js';

interface SignupDate {
  date: string;
  dayOfWeek: string;
}

interface PublicSignupBody {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  dates: SignupDate[];
}

function corsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as PublicSignupBody;
    const { firstName, lastName, email, phone, role, dates } = body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'firstName, lastName, and email are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'At least one date is required' });
    }

    if (dates.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 dates per submission' });
    }

    // Honeypot check — if present in body, silently succeed
    if ((body as unknown as Record<string, unknown>).website) {
      return res.status(200).json({ ok: true, emailSent: false, volunteerId: null, signupCount: 0 });
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();

    // ---- Volunteer dedup by email (case-insensitive) ----
    const emailLower = email.toLowerCase();
    const { data: existing } = await supabase
      .from('volunteers')
      .select('id')
      .ilike('email', emailLower)
      .limit(1) as { data: Array<{ id: string }> | null };

    let volunteerId: string;

    if (existing && existing.length > 0) {
      // Update existing volunteer
      volunteerId = existing[0].id;
      await supabase.from('volunteers').update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        synced_at: now,
      }).eq('id', volunteerId);
    } else {
      // Create new volunteer
      volunteerId = crypto.randomUUID();
      await supabase.from('volunteers').insert({
        id: volunteerId,
        first_name: firstName,
        last_name: lastName,
        email: emailLower,
        phone: phone || null,
        recurring_days: [],
        recurring_slots: [],
        synced_at: now,
      });
    }

    // ---- Create signups (dedup by volunteer+date) ----
    let signupCount = 0;

    for (const d of dates) {
      // Check for existing signup
      const { data: existingSignup } = await supabase
        .from('signups')
        .select('id')
        .eq('volunteer_id', volunteerId)
        .eq('date', d.date)
        .limit(1) as { data: Array<{ id: string }> | null };

      if (existingSignup && existingSignup.length > 0) {
        continue; // Skip duplicate
      }

      await supabase.from('signups').insert({
        id: crypto.randomUUID(),
        volunteer_id: volunteerId,
        date: d.date,
        day_of_week: d.dayOfWeek,
        role: role || null,
        status: 'signed-up',
        created_at: now,
      });
      signupCount++;
    }

    // ---- Send single confirmation email ----
    let emailSent = false;
    const { subject, html } = publicConfirmationEmail(firstName, dates, role);

    try {
      const { error: emailError } = await getResend().emails.send({
        from: FROM_EMAIL,
        to: email,
        subject,
        html,
      });
      if (!emailError) emailSent = true;
    } catch {
      // Email failure is non-fatal
    }

    return res.status(200).json({ ok: true, emailSent, volunteerId, signupCount });
  } catch (err) {
    console.error('Public signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
