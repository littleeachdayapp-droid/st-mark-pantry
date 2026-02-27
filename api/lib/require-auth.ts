import type { VercelRequest, VercelResponse } from '@vercel/node';

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expectedKey = process.env.PANTRY_API_KEY?.trim();

  // Skip auth if env var not configured (local dev without env vars)
  if (!expectedKey) return true;

  const provided = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].trim() : '';
  if (provided !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}
