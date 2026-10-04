import { config } from './config.js';
import type { GeneratedArticle, NewsSource, NewsSubject } from './types.js';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_ARTICLES_PER_SUBJECT = 10;

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type ArticleDraft = {
  sources?: unknown;
  title?: string;
  summary?: string;
  body?: string;
};

function stripCodeFence(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseDraft(content: string): ArticleDraft {
  const cleaned = stripCodeFence(content);
  try {
    return JSON.parse(cleaned) as ArticleDraft;
  } catch {
    return {
      title: 'Latest news',
      summary: cleaned.slice(0, 280),
      body: cleaned,
    };
  }
}

function parseDrafts(content: string): ArticleDraft[] {
  try {
    const parsed = JSON.parse(stripCodeFence(content)) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is ArticleDraft =>
        Boolean(entry) && typeof entry === 'object' && typeof (entry as ArticleDraft).title === 'string');
    }
    if (parsed && typeof parsed === 'object' && typeof (parsed as ArticleDraft).title === 'string') {
      return [parsed as ArticleDraft];
    }
  } catch {
  }
  return [parseDraft(content)];
}

function draftSourceUrls(draft: ArticleDraft): string[] {
  if (!Array.isArray(draft.sources)) {
    return [];
  }
  const urls: string[] = [];
  for (const entry of draft.sources) {
    if (typeof entry === 'string' && entry && !urls.includes(entry)) {
      urls.push(entry);
    }
  }
  return urls;
}

function resolveAssignments(drafts: ArticleDraft[], sources: NewsSource[]): string[][] {
  const articlesByUrl = new Map<string, number>();
  sources.forEach((source, index) => {
    if (!articlesByUrl.has(source.url)) {
      articlesByUrl.set(source.url, index);
    }
  });

  const assignments: string[][] = [];
  const used = new Set<number>();

  for (const draft of drafts) {
    const claimed = draftSourceUrls(draft)
      .map((url) => articlesByUrl.get(url))
      .filter((index): index is number => index !== undefined && !used.has(index));
    if (!claimed.length) {
      continue;
    }
    claimed.forEach((index) => used.add(index));
    assignments.push(claimed.map((index) => sources[index].url));
  }

  return assignments;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_RETRY_MS = 15_000;
const MAX_ATTEMPTS = 4;

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }
  return DEFAULT_RETRY_MS * 2 ** attempt;
}

async function requestChatCompletion(body: string): Promise<Response> {
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(retryDelayMs(lastResponse as Response, attempt - 1));
    }
    const response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (response.status !== 429) {
      return response;
    }
    lastResponse = response;
  }
  return lastResponse as Response;
}

export async function generateArticles(subject: NewsSubject, sources: NewsSource[]): Promise<GeneratedArticle[]> {
  const sourceText = sources
    .map((source) => `- "${source.title}" from ${source.source} (${source.url})\n  Details: ${source.description}\n  Extra context: ${source.extraSnippets.join(' ')}`)
    .join('\n');

  const requestBody = JSON.stringify({
    model: config.groqModel,
    temperature: config.groqTemperature,
    messages: [
      {
        role: 'user',
        content: `You are a careful newsroom editor. Synthesize only the supplied reporting. Do not invent facts. Attribute claims to sources when useful. Write in simple, plain language a curious teenager can easily follow: short sentences, everyday words, no jargon (explain any technical term in one plain phrase), and no filler.\n\nBelow are news sources for the ${subject.name} section. Decide yourself how many articles this material supports: group the same stories together. Every source belongs to exactly one article, no story may be covered twice, and each article must be a focused piece on one story or tightly related stories, never an overview or roundup. Write as many articles as the material genuinely supports, up to ${MAX_ARTICLES_PER_SUBJECT}; one big article is not better than several smaller ones.\n\nWrite one article per group. Return JSON only: an array of objects, each with exactly these fields:\n- "sources": array of the exact URLs (copied from the list) the article is built from\n- "title", "summary", "body": strings; each body should be 4-7 paragraphs separated by blank lines\n\n${sourceText}`,
      },
    ],
  });

  const response = await requestChatCompletion(requestBody);

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Groq gave an error ${response.status}: ${details.slice(0, 500)}`);
  }

  const payload = (await response.json()) as GroqResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Groq did not give us any articles about ${subject.name}`);
  }

  const drafts = parseDrafts(content).slice(0, MAX_ARTICLES_PER_SUBJECT);
  if (!drafts.length) {
    throw new Error(`Groq gave no usable articles about ${subject.name}`);
  }

  const assignments = resolveAssignments(drafts, sources);
  const generatedAt = new Date().toISOString();
  const subjectSlug = subject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const articles: GeneratedArticle[] = [];
  drafts.forEach((draft, index) => {
    const urls = assignments[index];
    if (!urls?.length) {
      return;
    }
    articles.push({
      id: `${subjectSlug}-${articles.length + 1}-${Date.now()}`,
      subject: subject.name,
      title: draft.title?.trim() || `${subject.name} news`,
      summary: draft.summary?.trim() || 'A summary of the latest news.',
      body: draft.body?.trim() || 'No article was generated.',
      sources: urls.map((url) => sources.find((source) => source.url === url) as NewsSource),
      generatedAt,
    });
  });

  if (!articles.length) {
    throw new Error(`Groq gave us no good articles about ${subject.name}`);
  }

  return articles;
}
