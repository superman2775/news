import { config } from './config.js';
import type { NewsSource, NewsSubject } from './types.js';
// In case ur cloning this repo and dont have access to hack club you need to change the api.
const EXA_PROXY_URL = 'https://ai.hackclub.com/proxy/v1/exa/search';

type ExaResult = {
  title?: string;
  url?: string;
  publishedDate?: string;
  author?: string;
  summary?: string;
  text?: string;
};

type ExaSearchResponse = {
  results?: ExaResult[];
};

export async function fetchNews(subject: NewsSubject): Promise<NewsSource[]> {
  const response = await fetch(EXA_PROXY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.braveApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `${subject.name} news`,
      numResults: 10,
      category: 'news',
      startPublishedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Exa returned ${response.status} for ${subject.name}: ${details.slice(0, 300)}`);
  }

  const payload = (await response.json()) as ExaSearchResponse;
  return (payload.results ?? [])
    .filter((result) => result.title && result.url)
    .map((result) => ({
      title: result.title ?? 'Untitled',
      url: result.url ?? '',
      description: result.summary ?? result.text?.slice(0, 500) ?? '',
      source: new URL(result.url ?? '').hostname.replace(/^www\./, ''),
      publishedAt: result.publishedDate,
      extraSnippets: [result.author].filter((value): value is string => Boolean(value)),
    }));
}
