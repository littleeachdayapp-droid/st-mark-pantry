import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body as { password?: string };
  const expected = process.env.PANTRY_PASSWORD || 'stmark';

  if (!password || password.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  return res.status(200).json({ ok: true, apiKey: (process.env.PANTRY_API_KEY || '').trim() });
}
