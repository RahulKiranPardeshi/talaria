// One-time move of sign-ins from Hermes, the separate AI program Talaria used before it had its
// own AI client, so people who set Talaria up with Hermes don't have to sign in again.
// Runs once (data/ai-import.json marks it done) and only fills providers Talaria has no sign-in for.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../paths.ts';
import { getSettings } from '../store.ts';
import { getCreds, setCreds } from './credentials.ts';
import { findHermes } from './hermesLegacy.ts';

const MARKER = path.join(DATA_DIR, 'ai-import.json');

function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return out;
}

function decodeExp(token: string): number | undefined {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp * 1000;
  } catch {
    return undefined;
  }
}

const KEY_VARS: [string, string[]][] = [
  ['gemini', ['GEMINI_API_KEY', 'GOOGLE_API_KEY']],
  ['openrouter', ['OPENROUTER_API_KEY']],
  ['openai', ['OPENAI_API_KEY']],
  ['anthropic', ['ANTHROPIC_API_KEY']],
  ['groq', ['GROQ_API_KEY']],
  ['xai', ['XAI_API_KEY']],
];

/** Returns the providers it brought over. */
export function importHermesSignIns(): string[] {
  if (fs.existsSync(MARKER)) return [];
  const home = findHermes()?.home;
  const brought: string[] = [];
  try {
    if (!home) return brought;
    // Talaria ran Hermes under its own "talaria" profile; that profile's files win over the main ones.
    const dirs = [path.join(home, 'profiles', 'talaria'), home];

    if (!getCreds('openai-codex')) {
      for (const dir of dirs) {
        const auth = readJson(path.join(dir, 'auth.json'));
        const t = auth?.providers?.['openai-codex']?.tokens;
        const pooled = (auth?.credential_pool?.['openai-codex'] || []).find((c: any) => c?.refresh_token);
        const access = t?.access_token || pooled?.access_token;
        const refresh = t?.refresh_token || pooled?.refresh_token;
        if (access && refresh) {
          const claims = (() => {
            try {
              return JSON.parse(Buffer.from(access.split('.')[1], 'base64url').toString('utf8'));
            } catch {
              return {};
            }
          })();
          setCreds('openai-codex', { type: 'codex', accessToken: access, refreshToken: refresh, accountId: claims['https://api.openai.com/auth']?.chatgpt_account_id, expiresAt: decodeExp(access) ?? 0 });
          brought.push('openai-codex');
          break;
        }
      }
    }

    const env = { ...readEnv(path.join(home, '.env')), ...readEnv(path.join(home, 'profiles', 'talaria', '.env')) };

    if (!getCreds('copilot')) {
      let token = env.COPILOT_GITHUB_TOKEN || process.env.COPILOT_GITHUB_TOKEN || '';
      // Talaria's old setup had Copilot users sign in with the GitHub CLI; Hermes read that sign-in.
      const usedGh = dirs.some(dir => (readJson(path.join(dir, 'auth.json'))?.credential_pool?.copilot || []).some((c: any) => c?.source === 'gh_cli'));
      if (!token && (usedGh || getSettings().ai.provider === 'copilot')) {
        try {
          token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', windowsHide: true, timeout: 10000 }).trim();
        } catch {}
      }
      if (/^(gho_|ghu_|github_pat_)/.test(token)) {
        setCreds('copilot', { type: 'copilot', githubToken: token });
        brought.push('copilot');
      }
    }

    for (const [provider, vars] of KEY_VARS) {
      if (getCreds(provider)) continue;
      // Hermes also read keys set for your whole Windows account.
      const key = vars.map(v => env[v] || process.env[v]).find(Boolean);
      if (!key || (provider === 'anthropic' && !key.startsWith('sk-ant-api'))) continue;
      setCreds(provider, { type: 'key', apiKey: key });
      brought.push(provider);
    }
  } finally {
    fs.writeFileSync(MARKER, JSON.stringify({ done: true, at: new Date().toISOString(), brought }));
  }
  return brought;
}
