import type { VercelRequest, VercelResponse } from '@vercel/node';
import { renderHome } from '../src/html.js';
import { ensureSnapshotLoaded, getSnapshot } from '../src/refresh.js';

export default async function handler(_request: VercelRequest, response: VercelResponse): Promise<void> {
  await ensureSnapshotLoaded();

  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.status(200).send(renderHome(getSnapshot()));
}
