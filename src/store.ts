import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { head, put } from '@vercel/blob';
import type { NewsSnapshot } from './types.js';

const SNAPSHOT_PATH = 'data/news.json';
const BLOB_PATH = 'news/latest.json';

function useBlobStorage(): boolean {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  const explicitlyEnabled = process.env.USE_BLOB_STORAGE === 'true';

  return hasToken && (process.env.VERCEL === '1' || explicitlyEnabled);
}

export async function readSnapshot(): Promise<NewsSnapshot | null> {
  if (useBlobStorage()) {
    try {
      const metadata = await head(BLOB_PATH);
      const response = await fetch(metadata.url, { cache: 'no-store' });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as NewsSnapshot;
    } catch {
      return null;
    }
  }

  try {
    const contents = await readFile(SNAPSHOT_PATH, 'utf8');
    return JSON.parse(contents) as NewsSnapshot;
  } catch {
    return null;
  }
}

export async function writeSnapshot(snapshot: NewsSnapshot): Promise<void> {
  const serialized = JSON.stringify(snapshot, null, 2);
  if (useBlobStorage()) {
    await put(BLOB_PATH, serialized, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 0,
    });
    return;
  }

  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, serialized, 'utf8');
}
