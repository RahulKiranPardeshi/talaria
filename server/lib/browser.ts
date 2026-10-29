// One real, visible browser window with its own saved profile (data/browser-profile*). Sign-ins
// you make there (LinkedIn) persist between runs. Talaria never sees or stores your passwords —
// you type them into the site yourself.
//
// The window is your own default browser when Talaria can drive it (Chrome, Edge, Brave and other
// Chromium browsers), so it looks and feels like the browser you use. Arc, Firefox and Safari can't
// be driven from outside; then it's Chrome or Edge, and only as a last resort Playwright's Chromium.

import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import type { BrowserContext, Page } from 'playwright';
import { DATA_DIR } from './paths.ts';

const PROFILE_DIR = path.join(DATA_DIR, 'browser-profile');
let ctx: BrowserContext | null = null;
let starting: Promise<BrowserContext> | null = null;
let current = 'Chromium';

type Candidate = { name: string; executablePath?: string; channel?: string };

const UNDRIVABLE = /\b(arc|firefox|safari|zen|librewolf|waterfox)\b/i;

function reg(key: string, value?: string): Promise<string> {
  return new Promise(resolve =>
    execFile('reg', ['query', key, ...(value ? ['/v', value] : ['/ve'])], { windowsHide: true, timeout: 5000 }, (err, out) => {
      const line = err ? '' : out.split(/\r?\n/).find(l => /REG_(EXPAND_)?SZ/.test(l)) || '';
      resolve(line.replace(/^.*?REG_(EXPAND_)?SZ\s+/, '').trim());
    }),
  );
}

/** Your default browser on Windows: its name and program, from the https handler you picked. */
async function windowsDefault(): Promise<Candidate | null> {
  const progId = await reg('HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', 'ProgId');
  if (!progId) return null;
  const command = await reg(`HKCR\\${progId}\\shell\\open\\command`);
  const exe = command.match(/^"([^"]+)"/)?.[1] || command.split(' ')[0];
  const name = (await reg(`HKCR\\${progId}\\Application`, 'ApplicationName')) || path.basename(exe, '.exe');
  return exe && fs.existsSync(exe) ? { name, executablePath: exe } : null;
}

/** Browsers to try, best first. */
async function candidates(): Promise<Candidate[]> {
  const list: Candidate[] = [];
  const preferred = process.platform === 'win32' ? await windowsDefault() : null;
  if (preferred && !UNDRIVABLE.test(preferred.name) && !UNDRIVABLE.test(preferred.executablePath || '')) list.push(preferred);
  list.push({ name: 'Google Chrome', channel: 'chrome' }, { name: 'Microsoft Edge', channel: 'msedge' }, { name: 'Chromium' });
  // Your own browser might be Chrome or Edge already; try it once.
  return list.filter((c, i) => !list.slice(0, i).some(o => o.name === c.name));
}

/** Each browser keeps its own profile: one browser can't open another's. */
const profileFor = (c: Candidate) => (c.name === 'Chromium' ? PROFILE_DIR : `${PROFILE_DIR}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

export async function browser(): Promise<BrowserContext> {
  if (ctx) return ctx;
  if (starting) return starting;
  starting = (async () => {
    const { chromium } = await import('playwright');
    let lastError: unknown;
    for (const cand of await candidates()) {
      const dir = process.env.TALARIA_BROWSER_PROFILE || profileFor(cand);
      fs.mkdirSync(dir, { recursive: true });
      try {
        const c = await chromium.launchPersistentContext(dir, {
          headless: process.env.TALARIA_HEADLESS === '1',
          viewport: null,
          executablePath: cand.executablePath,
          channel: cand.channel,
          timeout: 30000,
          args: ['--window-size=1280,900', '--disable-blink-features=AutomationControlled'],
          // Without this, real Chrome shows a "controlled by automated test software" bar.
          ignoreDefaultArgs: ['--enable-automation'],
          acceptDownloads: false,
        });
        c.on('close', () => {
          ctx = null;
        });
        // tsx/esbuild wrap named functions in __name(); functions we send into pages need it to exist.
        await c.addInitScript('globalThis.__name = globalThis.__name || ((fn) => fn);');
        // The window opens with a blank tab; keep it as a harmless placeholder.
        current = cand.name;
        ctx = c;
        return c;
      } catch (err) {
        lastError = err;
        console.warn(`[browser] couldn't open ${cand.name}, trying the next one: ${(err as Error).message.split('\n')[0]}`);
      }
    }
    throw lastError;
  })();
  try {
    return await starting;
  } finally {
    starting = null;
  }
}

/** The browser Talaria's window runs in (known once it has opened). */
export const browserName = () => current;

export async function newPage(): Promise<Page> {
  const c = await browser();
  const blank = c.pages().find(p => p.url() === 'about:blank');
  return blank || c.newPage();
}

export async function closeBrowser() {
  const c = ctx;
  ctx = null;
  await c?.close().catch(() => {});
}

export const isBrowserOpen = () => Boolean(ctx);

/** A pause that looks like a person reading, so sites aren't hammered. */
export const humanPause = (min = 1500, max = 3500) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

const INSTALLED_BROWSERS: Record<string, string[]> = {
  win32: [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
  ],
  darwin: ['/Applications/Google Chrome.app', '/Applications/Microsoft Edge.app'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge'],
};

/** Whether Talaria can open a browser window: Chrome or Edge on this computer, or Playwright's own Chromium. */
export async function playwrightReady(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { chromium } = await import('playwright');
    if ((INSTALLED_BROWSERS[process.platform] || []).some(p => fs.existsSync(p))) return { ok: true };
    const exe = chromium.executablePath();
    return fs.existsSync(exe) ? { ok: true } : { ok: false, error: 'Talaria needs Google Chrome or Microsoft Edge. Install one, or run: npx playwright install chromium' };
  } catch (err: any) {
    return { ok: false, error: `Playwright isn't installed (${err.message}).` };
  }
}
