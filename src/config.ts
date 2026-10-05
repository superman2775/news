import { loadDotEnv } from './env.js';
import type { NewsSubject } from './types.js';

loadDotEnv();

const DEFAULT_SUBJECTS: NewsSubject[] = [
  { name: 'Technology' },
  { name: 'Business' },
  { name: 'Science' },
  { name: 'Health' },
  { name: 'Climate' },
  { name: 'Sports' },
  { name: 'Entertainment' },
  { name: 'AI' },
];

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function subjectsFromEnvironment(): NewsSubject[] {
  const configured = process.env.NEWS_SUBJECTS
    ?.split(',')
    .map((subject) => subject.trim())
    .filter(Boolean);

  if (!configured?.length) {
    return DEFAULT_SUBJECTS;
  }

  return configured.slice(0, 10).map((name) => ({
    name,
  }));
}

export const config = {
  braveApiKey: (process.env.HACK_CLUB_AI_API_KEY?.trim() ?? process.env.BRAVE_API_KEY?.trim() ?? '').replace(/^Bearer\s+/i, ''),
  groqApiKey: process.env.GROQ_API_KEY?.trim() ?? '',
  groqModel: process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b',
  groqTemperature: positiveNumber(process.env.GROQ_TEMPERATURE, 0.1),
  port: positiveNumber(process.env.PORT, 3000),
  refreshIntervalMs: positiveNumber(process.env.REFRESH_INTERVAL_HOURS, 24) * 60 * 60 * 1000,
  subjects: subjectsFromEnvironment(),
};

export function assertApiKeys(): void {
  const missing = [
    !config.braveApiKey && 'HACK_CLUB_AI_API_KEY',
    !config.groqApiKey && 'GROQ_API_KEY',
  ].filter((key): key is string => Boolean(key));

  if (missing.length) {
    throw new Error(`Set the right value in your .env: ${missing.join(', ')}. The search key has to be one from https://ai.hackclub.com.`);
  }
}
