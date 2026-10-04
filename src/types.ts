export type NewsSubject = {
  name: string;
};

export type NewsSource = {
  title: string;
  url: string;
  description: string;
  source: string;
  publishedAt?: string;
  extraSnippets: string[];
};

export type GeneratedArticle = {
  id: string;
  subject: string;
  title: string;
  summary: string;
  body: string;
  sources: NewsSource[];
  generatedAt: string;
};

export type NewsSnapshot = {
  refreshedAt: string;
  nextRefreshAt: string;
  articles: GeneratedArticle[];
  errors: string[];
};

export type HealthResponse = {
  ok: boolean;
  refreshedAt: string | null;
  nextRefreshAt: string | null;
  articleCount: number;
  refreshing: boolean;
};
