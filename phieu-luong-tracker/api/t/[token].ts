import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// 1x1 transparent GIF
const GIF = Buffer.from(
  'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

const redis = (() => {
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
})();

const RETENTION_SECONDS = 60 * 60 * 24 * 180; // 180 days

function sendGif(res: VercelResponse) {
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Content-Length', GIF.length.toString());
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.status(200).send(GIF);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always return a GIF so email clients don't show a broken image.
  // Only GET requests count as an "open" — HEAD/POST/etc. may come from
  // monitoring, prefetchers, or fuzzers and must not inflate the counter.
  if (req.method !== 'GET') {
    sendGif(res);
    return;
  }

  const rawToken = req.query.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  const cleanToken = (token ?? '').replace(/\.gif$/i, '');

  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(cleanToken)) {
    sendGif(res);
    return;
  }

  if (redis) {
    const key = `open:${cleanToken}`;
    const now = Date.now();
    const ua = String(req.headers['user-agent'] ?? '').slice(0, 200);
    try {
      await redis.hset(key, { lastAt: now, ua });
      await redis.hsetnx(key, 'firstAt', now);
      await redis.hincrby(key, 'count', 1);
      await redis.expire(key, RETENTION_SECONDS);
    } catch (e) {
      console.error('[track] redis error:', e);
    }
  } else {
    console.warn('[track] redis not configured — open recorded only in logs:', cleanToken);
  }

  sendGif(res);
}
