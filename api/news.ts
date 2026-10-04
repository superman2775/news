import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSnapshotLoaded, getSnapshot } from '../src/refresh.js';

export default async function handler(_request: VercelRequest, response: VercelResponse): Promise<void> {
  await ensureSnapshotLoaded();

  response.status(200).json(getSnapshot() ?? {
    refreshedAt: null,
    nextRefreshAt: null,
    articles: [],
    errors: [],
  });
}
