// Free public search services that need no key, used when DuckDuckGo turns a search away.
// Both are hosted MCP servers: one JSON-RPC "tools/call" per search.

import { randomUUID } from 'node:crypto';
import type { SearchHit } from './web.ts';

const SESSION = randomUUID().replace(/-/g, '');

async function mcpCall(url: string, name: string, args: Record<string, unknown>): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'User-Agent': 'Talaria' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Plain JSON, or server-sent events whose data lines carry the JSON.
  const payloads = body.trim().startsWith('{') ? [body] : body.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim());
  for (const p of payloads) {
    try {
      const msg = JSON.parse(p);
      if (msg.error) throw new Error(msg.error.message || 'error');
      if (msg.result?.isError) throw new Error((msg.result.content || []).map((c: any) => c.text).join(' ').slice(0, 200) || 'error');
      if (msg.result?.content) return (msg.result.content as any[]).map(c => c.text || '').join('\n');
    } catch (err) {
      if (err instanceof SyntaxError) continue;
      throw err;
    }
  }
  throw new Error('empty answer');
}

/** Exa: text blocks separated by ---, each with Title: / URL: lines and highlights. */
async function exa(query: string, n: number): Promise<SearchHit[]> {
  const text = await mcpCall('https://mcp.exa.ai/mcp', 'web_search_exa', { query, numResults: n });
  const hits: SearchHit[] = [];
  for (const block of text.split(/\n-{3,}\n/)) {
    const url = block.match(/^URL:\s*(\S+)/m)?.[1];
    if (!url) continue;
    const title = block.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || url;
    const snippet = block
      .replace(/^(Title|URL|Published Date|Author|Highlights|Text):.*$/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    hits.push({ title, url, snippet });
  }
  return hits.slice(0, n);
}

/** Parallel: JSON text with results[{url, title, excerpts}]. */
async function parallel(query: string, n: number): Promise<SearchHit[]> {
  const text = await mcpCall('https://search.parallel.ai/mcp', 'web_search', { objective: query, search_queries: [query], session_id: SESSION });
  const data = JSON.parse(text.slice(text.indexOf('{')));
  return ((data.results || []) as any[])
    .filter(r => r?.url)
    .slice(0, n)
    .map(r => ({ title: String(r.title || r.url), url: String(r.url), snippet: (Array.isArray(r.excerpts) ? r.excerpts.join(' ') : '').replace(/\s+/g, ' ').slice(0, 300) }));
}

export { exa as exaSearch, parallel as parallelSearch };
