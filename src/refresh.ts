import { assertApiKeys, config } from './config.js';
import { fetchNews } from './search.js';
import { generateArticles } from './groq.js';
import { readSnapshot, writeSnapshot } from './store.js';
import type { GeneratedArticle, NewsSnapshot } from './types.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let currentSnapshot: NewsSnapshot | null = null;
let refreshing = false;

export function getSnapshot(): NewsSnapshot | null {
  return currentSnapshot;
}

export function isRefreshing(): boolean {
  return refreshing;
}

export async function loadStoredSnapshot(): Promise<void> {
  currentSnapshot = await readSnapshot();
}

let snapshotLoaded = false;

export async function ensureSnapshotLoaded(): Promise<void> {
  if (snapshotLoaded) {
    return;
  }
  snapshotLoaded = true;
  await loadStoredSnapshot();
}

export async function refreshNews(): Promise<NewsSnapshot> {
  if (refreshing) {
    return currentSnapshot ?? {
      refreshedAt: new Date(0).toISOString(),
      nextRefreshAt: new Date(0).toISOString(),
      articles: [],
      errors: ['Already refreshing the news articles.'],
    };
  }

  assertApiKeys();
  refreshing = true;
  const articles: GeneratedArticle[] = [];
  const errors: string[] = [];

  try {
    for (const subject of config.subjects) {
      try {
        const sources = await fetchNews(subject);
        if (!sources.length) {
          errors.push(`${subject.name}: searched, but didn't find anything. :(`);
          continue;
        }
        articles.push(...await generateArticles(subject, sources));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Some unknown error happened';
        errors.push(`${subject.name}: ${message}`);
      }
      await sleep(10_000);
    }

    const refreshedAt = new Date();
    currentSnapshot = {
      refreshedAt: refreshedAt.toISOString(),
      nextRefreshAt: new Date(refreshedAt.getTime() + config.refreshIntervalMs).toISOString(),
      articles,
      errors,
    };
    await writeSnapshot(currentSnapshot);
    return currentSnapshot;
  } finally {
    refreshing = false;
  }
}

export function startRefreshScheduler(): void {
  const timer = setInterval(() => {
    void refreshNews().catch((error) => console.error('Scheduled refresh failed:', error));
  }, config.refreshIntervalMs);
  timer.unref();
}
