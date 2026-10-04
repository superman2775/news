import type { VercelRequest, VercelResponse } from '@vercel/node';
import { refreshNews } from '../../src/refresh.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.authorization;

  if (configuredSecret && authorization !== `Bearer ${configuredSecret}`) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const snapshot = await refreshNews();
    response.status(200).json({ ok: true, refreshedAt: snapshot.refreshedAt, articleCount: snapshot.articles.length });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Refresh failed' });
  }
}
