import type { VercelRequest, VercelResponse } from '@vercel/node';

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expectedKey = process.env.PANTRY_API_KEY?.trim();

  // Reject all requests if API key not configured
  if (!expectedKey) {
    res.status(503).json({ error: 'API not configured' });
    return false;
  }

  const provided = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].trim() : '';
  if (provided !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
