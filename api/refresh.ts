import type { VercelRequest, VercelResponse } from '@vercel/node';
import { refreshNews } from '../src/refresh.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await refreshNews();
    response.redirect(303, '/');
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Refresh failed' });
  }
}
