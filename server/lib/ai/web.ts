// Talaria's own web tools for the AI: search the web, and read one page.
//
// Search uses free services that need no key: Exa first, then DuckDuckGo, then Parallel. One
// that turns a search away (a rate limit, a bot check) rests for a few minutes. Pages are read from this computer (like a normal visit), and
// opened in a hidden browser when they need JavaScript to show anything.

import { fetchHtml, readableText, renderHtml } from '../../sources/jobpage.ts';
import { decodeEntities } from '../text.ts';
import { exaSearch, parallelSearch } from './keyless.ts';

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const strip = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

export async function duckDuckGo(query: string, n: number): Promise<SearchHit[]> {
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    body: new URLSearchParams({ q: query, kl: '' }).toString(),
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  if (res.status !== 200 || /anomaly-modal|challenge-form|Unfortunately, bots use DuckDuckGo/i.test(html)) throw new Error(`turned the search away (${res.status})`);
  const hits: SearchHit[] = [];
  const blocks = html.split(/<div[^>]+class="[^"]*\bresult\b[^"]*"/i).slice(1);
  for (const b of blocks) {
    const a = b.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    let url = decodeEntities(a[1]);
    const redirect = url.match(/[?&]uddg=([^&]+)/);
    if (redirect) url = decodeURIComponent(redirect[1]);
    if (url.startsWith('//')) url = 'https:' + url;
    if (!/^https?:\/\//.test(url) || /duckduckgo\.com\/y\.js/.test(url)) continue; // ads
    const snippet = b.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(a|div|td)>/i)?.[1] || '';
    hits.push({ title: strip(a[2]), url, snippet: strip(snippet) });
    if (hits.length >= n) break;
  }
  return hits;
}

const SERVICES: { name: string; search: (q: string, n: number) => Promise<SearchHit[]>; restUntil: number }[] = [
  { name: 'Exa', search: exaSearch, restUntil: 0 },
  { name: 'DuckDuckGo', search: duckDuckGo, restUntil: 0 },
  { name: 'Parallel', search: parallelSearch, restUntil: 0 },
];

export async function webSearch(query: string, n = 8): Promise<{ hits: SearchHit[]; via: string }> {
  const q = query.trim().slice(0, 400);
  if (!q) return { hits: [], via: 'none' };
  const errors: string[] = [];
  let empty = '';
  for (const s of SERVICES) {
    if (Date.now() < s.restUntil) continue;
    try {
      const hits = await s.search(q, n);
      if (hits.length) return { hits, via: s.name };
      empty ||= s.name;
    } catch (err: any) {
      errors.push(`${s.name}: ${err.message}`);
      s.restUntil = Date.now() + 5 * 60_000;
    }
  }
  if (empty) return { hits: [], via: empty };
  throw new Error(errors.length ? `Web search failed (${errors.join('; ')})` : 'Every web search service is resting after turning searches away. Try again in a few minutes.');
}

const PAGE_CHARS = 12000;

/** A page's readable text, read from this computer; opened in a hidden browser if it needs JavaScript. */
export async function webExtract(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) throw new Error('Not a web address.');
  let text = '';
  try {
    text = readableText(await fetchHtml(url));
  } catch {}
  if (text.length < 600) {
    try {
      const rendered = readableText(await renderHtml(url));
      if (rendered.length > text.length) text = rendered;
    } catch {}
  }
  if (!text) throw new Error("Couldn't read that page.");
  return text.length > PAGE_CHARS ? text.slice(0, PAGE_CHARS) + '\n\n[…page cut for length…]' : text;
}

// ---------- as tools the AI can call ----------

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const WEB_TOOLS: ToolSpec[] = [
  {
    name: 'web_search',
    description: 'Search the web. Returns up to 8 results, each with title, URL and a short snippet. Use several focused searches rather than one broad one.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The search query. Supports site:example.com to search one site.' } },
      required: ['query'],
    },
  },
  {
    name: 'web_extract',
    description: "Read a web page and return its main text (up to about 12,000 characters). Use it to check a posting's details or that it's still open.",
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: 'The full URL of the page, starting with https://' } },
      required: ['url'],
    },
  },
];

/** Run one tool call from the AI and return what it gets back, as text. Errors come back as text too, so the AI can carry on. */
export async function runWebTool(name: string, args: any, log?: (text: string) => void): Promise<string> {
  try {
    if (name === 'web_search') {
      const query = String(args?.query || '');
      const { hits, via } = await webSearch(query);
      log?.(`Searched “${query.slice(0, 120)}” (${hits.length} results via ${via})`);
      if (!hits.length) return 'No results. Try different words.';
      return hits.map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet}`).join('\n');
    }
    if (name === 'web_extract') {
      const url = String(args?.url || (Array.isArray(args?.urls) ? args.urls[0] : '') || '');
      const text = await webExtract(url);
      log?.(`Read ${url.slice(0, 160)}`);
      return text;
    }
    return `Unknown tool ${name}.`;
  } catch (err: any) {
    log?.(`${name} failed: ${String(err?.message || err).slice(0, 160)}`);
    return `Error: ${err?.message || err}`;
  }
}
