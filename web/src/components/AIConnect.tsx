// Connecting an AI account, shared by onboarding and Settings. Talaria signs in itself: ChatGPT in
// your browser, GitHub Copilot with a short code, everything else with an API key. No terminal.

import * as React from 'react';
import { Check, ExternalLink, KeyRound, Loader, LogOut } from 'lucide-react';
import type { AIAccounts, AISignIn } from '@shared/types';
import { AI_PROVIDERS, aiProviderLabel } from '@shared/aiProviders';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button, CopyButton, Field, Input } from '@/components/ui';

export type ConnectResult = { ok: boolean; model?: string; message?: string; latencyMs?: number };

const WHO: Record<string, string> = {
  'openai-codex': 'I pay for ChatGPT (Plus, Pro, Business or Edu)',
  copilot: 'I have GitHub Copilot (the free student plan counts)',
  gemini: 'Free: a Google account is enough',
};

export const MODEL_HINT: Record<string, string> = {
  'openai-codex': 'The list shows the models your ChatGPT plan offers. Every call counts against your ChatGPT usage limits.',
  copilot: 'gpt-4.1 and gpt-4o are unlimited on Copilot. Premium models use your monthly quota and may need enabling at github.com/settings/copilot.',
  gemini: 'Flash models are fastest and the most reliable on the free tier.',
  anthropic: 'Sonnet is the best balance; Opus costs more per task.',
};

/** Which accounts are signed in and what each offers. Read again when asked. */
export function useAccounts() {
  const [accounts, setAccounts] = React.useState<AIAccounts | null>(null);
  const load = React.useCallback(() => api.get<AIAccounts>('/api/ai/accounts', { quiet: true }).then(setAccounts).catch(() => {}), []);
  React.useEffect(() => {
    load();
  }, [load]);
  return [accounts, load] as const;
}

/**
 * Pick an AI account, sign in and switch Talaria to it. `compact` drops the per-option descriptions
 * (Settings, where the person has done this before).
 */
export function AIConnect({ onConnected, compact = false }: { onConnected?: (r: ConnectResult) => void; compact?: boolean }) {
  const settings = useApp(s => s.settings)!;
  const ai = useApp(s => s.ai);
  const signins = useApp(s => s.signin);
  const [accounts, reload] = useAccounts();
  const [choice, setChoice] = React.useState<string>(settings.ai.provider || 'openai-codex');
  const [key, setKey] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ConnectResult | null>(null);
  const info = AI_PROVIDERS.find(p => p.id === choice) || AI_PROVIDERS[0];
  const signedIn = Boolean(accounts?.signedIn.includes(info.id));
  const using = settings.ai.provider === info.id && (ai.ok || Boolean(result?.ok));
  const signin: AISignIn | undefined = signins[info.id];
  const models = accounts?.models[info.id] || [];

  const pick = (id: string) => {
    setChoice(id);
    setKey('');
    setResult(r => (r?.ok ? r : null)); // a working connection still counts after looking at another option
  };

  const connect = async (model?: string) => {
    setBusy(model || 'connect');
    setResult(null);
    try {
      const r = await api.post<ConnectResult>('/api/ai/connect', { provider: info.id, model }, { quiet: true });
      setResult(r);
      if (r.ok) onConnected?.(r);
      reload();
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Something went wrong.' });
    }
    setBusy(null);
  };

  const saveKey = async () => {
    if (!key.trim()) return;
    setBusy('key');
    setResult(null);
    try {
      const r = await api.post<ConnectResult>('/api/ai/key', { provider: info.id, key: key.trim() }, { quiet: true });
      setResult(r);
      if (r.ok) {
        setKey('');
        onConnected?.(r);
      }
      reload();
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Something went wrong.' });
    }
    setBusy(null);
  };

  const startSignIn = async () => {
    setBusy('signin');
    setResult(null);
    try {
      const s = await api.post<AISignIn>('/api/ai/signin', { provider: info.id }, { quiet: true });
      useApp.setState(st => ({ signin: { ...st.signin, [info.id]: s } }));
      // ChatGPT: open its sign-in page right away. GitHub: the person copies the code first.
      if (s.url && !s.userCode) window.open(s.url, '_blank', 'noopener');
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Could not start the sign-in.' });
    }
    setBusy(null);
  };

  const signOut = async () => {
    await api.post('/api/ai/signout', { provider: info.id }, { quiet: true }).catch(() => {});
    setResult(null);
    reload();
  };

  // When an in-app sign-in finishes, test it and switch to it.
  const finished = signin?.state === 'done';
  React.useEffect(() => {
    if (!finished) return;
    useApp.setState(st => {
      const next = { ...st.signin };
      delete next[info.id];
      return { signin: next };
    });
    reload();
    connect();
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const subs = AI_PROVIDERS.filter(p => p.auth !== 'key');
  const keys = AI_PROVIDERS.filter(p => p.auth === 'key');
  const option = (p: (typeof AI_PROVIDERS)[number]) => {
    const on = accounts?.signedIn.includes(p.id);
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => pick(p.id)}
        className={cn('flex items-center gap-3 border px-4 py-3 text-left transition-colors', choice === p.id ? 'border-ink bg-card shadow-card' : 'border-line bg-card/60 hover:border-ink/30')}
      >
        <span className={cn('grid size-5 shrink-0 place-items-center border', choice === p.id ? 'border-ink bg-ink text-bg' : 'border-line')}>{choice === p.id && <Check className="size-3" strokeWidth={3} />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">{p.label}</span>
          {!compact && (WHO[p.id] || p.keyHint) && <span className="block text-[12.5px] text-muted">{WHO[p.id] || p.keyHint}</span>}
        </span>
        {on && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ok">
            <Check className="size-3" strokeWidth={3} /> {settings.ai.provider === p.id ? 'In use' : 'Signed in'}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <div className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-faint uppercase">Use a plan you pay for</div>
          <div className="grid gap-2 sm:grid-cols-2">{subs.map(option)}</div>
        </div>
        <div>
          <div className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-faint uppercase">Or use an API key</div>
          <div className="grid gap-2 sm:grid-cols-2">{keys.map(option)}</div>
        </div>
      </div>

      <div className="space-y-3 bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13.5px] font-semibold text-ink">{using ? `Connected to ${info.label}` : signedIn ? `Signed in to ${info.label}` : `Connect ${info.label}`}</div>
          {signedIn && (
            <button type="button" onClick={signOut} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
              <LogOut className="size-3" /> Sign out
            </button>
          )}
        </div>

        {!signedIn && info.auth === 'chatgpt' && (
          <>
            <p className="text-[13px] leading-relaxed text-muted">Sign in with your ChatGPT account in your browser and approve Talaria. Uses your plan's allowance, so there's no separate bill and no API key.</p>
            {signin?.state === 'waiting' && signin.userCode ? (
              <CodeWait signin={signin} site="ChatGPT" />
            ) : signin?.state === 'waiting' ? (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-[13px] text-ink">
                  <Loader className="size-3.5 animate-spin text-gold" /> Waiting for you to sign in in the browser tab that opened…
                </div>
                {signin.url && (
                  <p className="text-[12px] text-faint">
                    No tab?{' '}
                    <a href={signin.url} target="_blank" rel="noopener" className="text-accent hover:underline">
                      Open the sign-in page
                    </a>
                    .
                  </p>
                )}
              </div>
            ) : (
              <Button variant="primary" loading={busy === 'signin'} icon={<ExternalLink className="size-4" />} onClick={startSignIn}>
                Sign in with ChatGPT
              </Button>
            )}
          </>
        )}

        {!signedIn && info.auth === 'copilot' && (
          <>
            <p className="text-[13px] leading-relaxed text-muted">Sign in with GitHub: you get a short code, type it on GitHub's page and approve. Copilot has to be switched on for your account at github.com/settings/copilot.</p>
            {signin?.state === 'waiting' && signin.userCode ? (
              <CodeWait signin={signin} site="GitHub" />
            ) : (
              <Button variant="primary" loading={busy === 'signin'} icon={<ExternalLink className="size-4" />} onClick={startSignIn}>
                Sign in with GitHub
              </Button>
            )}
          </>
        )}

        {!signedIn && info.auth === 'key' && (
          <>
            {info.keyHint && <p className="text-[13px] leading-relaxed text-muted">{info.keyHint}</p>}
            <Field
              label="API key"
              hint={
                info.keyUrl ? (
                  <a href={info.keyUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-accent hover:underline">
                    Get a key <ExternalLink className="size-3" />
                  </a>
                ) : undefined
              }
            >
              <div className="flex flex-wrap gap-2">
                <Input type="password" autoComplete="off" spellCheck={false} value={key} onChange={e => (setKey(e.target.value), setResult(null))} onKeyDown={e => e.key === 'Enter' && saveKey()} placeholder="Paste your key" className="min-w-0 flex-1 sm:max-w-sm" />
                <Button variant="primary" loading={busy === 'key'} disabled={!key.trim()} icon={<KeyRound className="size-4" />} onClick={saveKey}>
                  {busy === 'key' ? 'Testing…' : 'Save and test'}
                </Button>
              </div>
            </Field>
            <p className="text-[12px] text-faint">The key is stored on this computer only{navigator.platform.toLowerCase().startsWith('win') ? ', encrypted with your Windows account' : ''}.</p>
          </>
        )}

        {signin?.state === 'error' && <p className="bg-bad-soft px-3 py-2 text-[12.5px] leading-relaxed text-bad">{signin.message || 'The sign-in didn’t finish. Try again.'}</p>}

        {signedIn &&
          (using ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ok">
                <Check className="size-4" strokeWidth={3} /> It works!{result?.ok && result.latencyMs ? ` Answered in ${(result.latencyMs / 1000).toFixed(1)}s.` : ''}
              </div>
              {!compact && (
                <Field
                  label={
                    <span className="flex items-center gap-1.5">
                      Model {busy && busy !== 'connect' && <Loader className="size-3 animate-spin text-gold" />}
                    </span>
                  }
                  hint={busy && busy !== 'connect' ? `Trying ${busy}…` : `Talaria picked one your account accepts; you can leave it. ${MODEL_HINT[info.id] ?? ''}`}
                >
                  <select
                    value={settings.ai.model}
                    disabled={Boolean(busy)}
                    onChange={e => connect(e.target.value)}
                    className="h-9 w-full border border-line bg-card px-2.5 text-[13.5px] text-ink outline-none focus:border-accent/60 disabled:opacity-60 sm:max-w-xs"
                  >
                    {[...new Set([settings.ai.model, ...models])].map(m => (
                      <option key={m} value={m}>
                        {m}
                        {m === accounts?.defaults[info.id] ? ' (recommended)' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          ) : (
            <Button variant="primary" loading={busy === 'connect'} onClick={() => connect()}>
              {busy === 'connect' ? 'Connecting, about 10 seconds…' : `Use ${info.label}`}
            </Button>
          ))}

        {result && !result.ok && <p className="bg-bad-soft px-3 py-2 text-[12.5px] leading-relaxed text-bad">{result.message}</p>}
      </div>
    </div>
  );
}

/** A sign-in code to type on the provider's page, with a link there, while Talaria waits for the approval. */
function CodeWait({ signin, site }: { signin: AISignIn; site: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">Open {site}'s page, sign in if asked, and type this code:</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="border border-line bg-bg px-4 py-2 font-mono text-[22px] font-semibold tracking-[0.2em] text-ink select-all">{signin.userCode}</span>
        <CopyButton text={signin.userCode!} label="Copy code" size="sm" />
        {signin.url && (
          <a href={signin.url} target="_blank" rel="noopener">
            <Button variant="primary" icon={<ExternalLink className="size-4" />}>
              Open {site}
            </Button>
          </a>
        )}
      </div>
      <div className="inline-flex items-center gap-2 text-[12.5px] text-muted">
        <Loader className="size-3.5 animate-spin text-gold" /> Waiting for you to approve on {site}…
      </div>
    </div>
  );
}

export { aiProviderLabel };
