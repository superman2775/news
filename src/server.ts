import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from './config.js';
import { renderHome } from './html.js';
import { getSnapshot, isRefreshing, loadStoredSnapshot, refreshNews, startRefreshScheduler } from './refresh.js';
import type { HealthResponse } from './types.js';

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function sendHtml(response: ServerResponse, status: number, html: string): void {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
}

const staticPages: Record<string, { file: string; contentType: string }> = {
  '/docs/index.html': { file: 'index.html', contentType: 'text/html; charset=utf-8' },
  '/docs/api.html': { file: 'api.html', contentType: 'text/html; charset=utf-8' },
  '/docs/deployment.html': { file: 'deployment.html', contentType: 'text/html; charset=utf-8' },
};

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const snapshot = getSnapshot();

  if (request.method === 'GET' && url.pathname === '/docs') {
    response.writeHead(308, { Location: '/docs/index.html' });
    response.end();
    return;
  }

  const staticPage = staticPages[url.pathname];
  if (request.method === 'GET' && staticPage) {
    const contents = await readFile(resolve(process.cwd(), 'public', 'docs', staticPage.file));
    response.writeHead(200, { 'Content-Type': staticPage.contentType });
    response.end(contents);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/') {
    sendHtml(response, 200, renderHome(snapshot));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/news') {
    sendJson(response, 200, snapshot ?? { refreshedAt: null, nextRefreshAt: null, articles: [], errors: [] });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    const health: HealthResponse = {
      ok: true,
      refreshedAt: snapshot?.refreshedAt ?? null,
      nextRefreshAt: snapshot?.nextRefreshAt ?? null,
      articleCount: snapshot?.articles.length ?? 0,
      refreshing: isRefreshing(),
    };
    sendJson(response, 200, health);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/refresh') {
    void refreshNews()
      .then(() => {
        response.writeHead(303, { Location: '/' });
        response.end();
      })
      .catch((error: unknown) => {
        sendJson(response, 500, { error: error instanceof Error ? error.message : 'Failed to refresh' });
      });
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

await loadStoredSnapshot();

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error: unknown) => {
    console.error('Request failed:', error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: 'Internal server error' });
    }
  });
});

server.listen(config.port, () => {
  console.log(`News website up and running: http://localhost:${config.port}`);
  startRefreshScheduler();
  if (!getSnapshot()) {
    void refreshNews().catch((error) => console.error('Error:', error));
  }
});
