import type { GeneratedArticle, NewsSnapshot } from './types.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderArticle(article: GeneratedArticle): string {
  const paragraphs = article.body
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
    .join('');
  const sources = article.sources
    .map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a> (${escapeHtml(source.source)})</li>`)
    .join('');

  return `<article>
  <header>
    <p><strong>${escapeHtml(article.subject)}</strong></p>
    <h2>${escapeHtml(article.title)}</h2>
    <p><em>${escapeHtml(article.summary)}</em></p>
  </header>
  ${paragraphs}
  <footer>
    <h3>Sources</h3>
    <ul>${sources}</ul>
    <small>Last refresh: ${escapeHtml(new Date(article.generatedAt).toLocaleString())}</small>
  </footer>
</article>`;
}

export function renderHome(snapshot: NewsSnapshot | null): string {
  const articles = snapshot?.articles.map(renderArticle).join('\n') ?? '<p>No news here yet! Please wait a few minutes and refresh.</p>';
  const errors = snapshot?.errors.length
    ? `<section><h2>Refresh notes</h2><ul>${snapshot.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul></section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>News</title>
</head>
<body>
  <header>
    <a href="/" aria-label="News home"><span>News</span></a>
    <nav aria-label="Main navigation">
      <a href="/" aria-current="page">Today</a>
      <a href="/docs/index.html">Documentation</a>
      <a href="/docs/api.html">API</a>
    </nav>
  </header>
  <main>
    ${errors}
    ${articles}
  </main>
  <footer>Made by super_man2775</footer>
</body>
</html>`;
}
