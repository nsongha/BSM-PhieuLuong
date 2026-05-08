import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = (() => {
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
})();

type OpenInfo =
  | { opened: false }
  | { opened: true; firstAt: number; lastAt: number; count: number };

const MAX_TOKENS = 500;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// @vercel/node 3.x auto-parses JSON bodies BEFORE the handler runs, with
// no way to opt out (bodyParser config is Next.js-only).
//   - Content-Type: application/json + malformed → Vercel returns 500
//     FUNCTION_INVOCATION_FAILED. This is a platform behavior we can't
//     intercept. Our app always sends valid JSON, so this only affects
//     fuzzers/broken clients. Non-issue for real traffic.
//   - Content-Type: text/plain (or omitted) + malformed → req.body is the
//     raw string, we parse ourselves and return a clean 400 below.
//   - Valid JSON object → req.body is the parsed object.
function parseBodyTokens(body: unknown): { ok: true; tokens: string[] } | { ok: false; reason: 'invalid_json' } {
  let value = body;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return { ok: true, tokens: [] };
    try {
      value = JSON.parse(trimmed);
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }
  }
  if (value && typeof value === 'object' && Array.isArray((value as { tokens?: unknown }).tokens)) {
    return { ok: true, tokens: (value as { tokens: unknown[] }).tokens.map(String) };
  }
  return { ok: true, tokens: [] };
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const expected = process.env.TRACKER_SECRET;
  if (expected) {
    const auth = String(req.headers.authorization ?? '');
    const presented = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!presented || !timingSafeEqual(presented, expected)) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  if (!redis) {
    res.status(503).json({ error: 'Tracker Redis chưa được cấu hình (env UPSTASH_REDIS_REST_URL + _TOKEN)' });
    return;
  }

  let tokens: string[] = [];
  if (req.method === 'GET') {
    const raw = req.query.tokens;
    if (typeof raw === 'string' && raw.length > 0) {
      tokens = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  } else {
    const parsed = parseBodyTokens(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: 'invalid JSON body' });
      return;
    }
    tokens = parsed.tokens;
  }

  if (tokens.length === 0) {
    res.status(400).json({ error: 'missing tokens' });
    return;
  }
  if (tokens.length > MAX_TOKENS) {
    res.status(413).json({
      error: `too many tokens (max ${MAX_TOKENS})`,
      maxTokens: MAX_TOKENS,
      received: tokens.length,
      hint: 'Chunk your request client-side into batches of 500 or fewer.',
    });
    return;
  }

  const uuidRe = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const valid = tokens.filter((t) => uuidRe.test(t));

  const out: Record<string, OpenInfo> = {};
  if (valid.length === 0) {
    res.status(200).json({ tokens: out });
    return;
  }

  const pipeline = redis.pipeline();
  for (const t of valid) pipeline.hgetall(`open:${t}`);

  try {
    const results = (await pipeline.exec()) as Array<Record<string, unknown> | null>;
    valid.forEach((t, i) => {
      const r = results[i];
      if (r && r.firstAt != null) {
        out[t] = {
          opened: true,
          firstAt: Number(r.firstAt),
          lastAt: Number(r.lastAt ?? r.firstAt),
          count: Number(r.count ?? 1),
        };
      } else {
        out[t] = { opened: false };
      }
    });
  } catch (e) {
    console.error('[opens] redis error:', e);
    res.status(500).json({ error: 'tracker internal error' });
    return;
  }

  res.status(200).json({ tokens: out });
}
