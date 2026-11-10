// Your AI sign-ins and keys, kept on this computer only.
//
// Stored in data/ai-accounts.json. On Windows the contents are encrypted with your Windows account
// (DPAPI), so the file is useless if copied to another computer or user; elsewhere the file is only
// readable by you. Settings never hold these: settings are sent to the browser, sign-ins never are.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../paths.ts';

const FILE = path.join(DATA_DIR, 'ai-accounts.json');

export interface CodexCreds {
  type: 'codex';
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  accountId?: string;
  expiresAt?: number; // ms
  email?: string;
}
export interface CopilotCreds {
  type: 'copilot';
  githubToken: string; // the long-lived GitHub sign-in; the short Copilot token is fetched from it
  login?: string;
}
export interface KeyCreds {
  type: 'key';
  apiKey: string;
}
export type Creds = CodexCreds | CopilotCreds | KeyCreds;

type Store = Record<string, Creds>;

const win = process.platform === 'win32';

function ps(script: string, input: string): string {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input, windowsHide: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
}

const PROTECT = `Add-Type -AssemblyName System.Security; $t = [Console]::In.ReadToEnd(); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($t), $null, 'CurrentUser'))`;
const UNPROTECT = `Add-Type -AssemblyName System.Security; $t = [Console]::In.ReadToEnd().Trim(); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($t), $null, 'CurrentUser'))`;

let cache: Store | null = null;

function load(): Store {
  if (cache) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (raw?.dpapi) cache = JSON.parse(ps(UNPROTECT, raw.dpapi));
    else cache = raw?.plain || {};
  } catch (err: any) {
    if (fs.existsSync(FILE)) console.warn(`[ai] couldn't read your saved AI sign-ins: ${err.message}`);
    cache = {};
  }
  return cache!;
}

function save() {
  const store = load();
  const json = JSON.stringify(store);
  let body: string;
  if (win) {
    try {
      body = JSON.stringify({ v: 1, dpapi: ps(PROTECT, json) });
    } catch (err: any) {
      // Without PowerShell's encryption the sign-in still has to be kept; the file stays private to this folder.
      console.warn(`[ai] couldn't encrypt your AI sign-ins, saving them unencrypted: ${err.message}`);
      body = JSON.stringify({ v: 1, plain: store });
    }
  } else body = JSON.stringify({ v: 1, plain: store });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, body, { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

export function getCreds<T extends Creds = Creds>(provider: string): T | undefined {
  return load()[provider] as T | undefined;
}

export function setCreds(provider: string, creds: Creds) {
  load()[provider] = creds;
  save();
}

export function removeCreds(provider: string) {
  if (!(provider in load())) return;
  delete load()[provider];
  save();
}

/** Which providers have a sign-in or key saved (names only). */
export const savedProviders = () => Object.keys(load());
