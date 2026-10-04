import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSnapshotLoaded, getSnapshot, isRefreshing } from '../src/refresh.js';
import type { HealthResponse } from '../src/types.js';

export default async function handler(_request: VercelRequest, response: VercelResponse): Promise<void> {
  await ensureSnapshotLoaded();

  const snapshot = getSnapshot();
  const health: HealthResponse = {
    ok: true,
    refreshedAt: snapshot?.refreshedAt ?? null,
    nextRefreshAt: snapshot?.nextRefreshAt ?? null,
    articleCount: snapshot?.articles.length ?? 0,
    refreshing: isRefreshing(),
  };
  response.status(200).json(health);
}
