import * as React from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, ChevronDown, FileText, HardDrive, Loader, MessageSquare, RefreshCw, Search, Send, ShieldCheck, SquareDashed } from 'lucide-react';
import type { HermesAccounts, SetupStatus } from '@shared/types';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button, CopyButton, Field, Input } from '@/components/ui';

export function StepHeader({ kicker, title, children }: { kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {/* On wide screens the sidebar already shows where you are. */}
      <div className="mb-2 text-[12px] font-semibold tracking-[0.1em] text-gold uppercase lg:hidden">{kicker}</div>
      <h2 className="font-display text-[32px] leading-[1.05] tracking-[-0.015em] text-ink">{title}</h2>
      {children && <p className="mt-3 text-[15px] leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

/** Where each step's Back / Continue buttons go: one bar pinned to the bottom, so they never move. */
export const FooterSlot = React.createContext<HTMLElement | null>(null);

export function StepFooter({ back, backLabel = 'Back', children }: { back?: () => void; backLabel?: string; children: React.ReactNode }) {
  const slot = React.useContext(FooterSlot);
  const bar = (
    <div className="flex items-center justify-between gap-3">
      {back ? (
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={back}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
  return slot ? createPortal(bar, slot) : bar;
}

export function NextButton({ children = 'Continue', ...rest }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="primary" size="lg" icon={<ArrowRight className="size-4" />} className="flex-row-reverse" {...rest}>
      {children}
    </Button>
  );
}

/** A quiet "skip" next to the main button: there if you need it, never competing with it. */
export function SkipLink({ onClick, title, children = 'Skip for now' }: { onClick: () => void; title?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} className="px-2 text-[13px] text-faint underline-offset-2 hover:text-muted hover:underline">
      {children}
    </button>
  );
}

/** A terminal command the person can copy with one click. */
function Cmd({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#17161c] py-1.5 pr-1.5 pl-3 font-mono text-[12.5px] text-[#e9e7f2]">
      <span className="min-w-0 flex-1 truncate select-all">{children}</span>
      <CopyButton text={children} className="border-white/15 text-[#e9e7f2] hover:bg-white/10" />
    </div>
  );
}

// ---------------- 0. Welcome ----------------

const WHAT_WE_ASK = [
  { icon: FileText, title: 'Your resume', body: 'Hermes reads it in the background while you carry on. You check what it found before anything else uses it.' },
  { icon: MessageSquare, title: 'Your story', body: 'A few questions, answered in your own words. Your cover letters are written from this, so they sound like you.' },
  { icon: Search, title: "What you're after", body: 'The roles and level you want, where and how you want to work, and your deal-breakers.' },
  { icon: Send, title: 'Where to look', body: 'Job boards, plus any companies or careers pages you want watched. Nothing is sent to an employer until you approve it.' },
];

export function WelcomeStep({ kicker, next }: { kicker: string; next: () => void }) {
  return (
    <div>
      <StepHeader kicker={kicker} title="First, let's get to know you.">
        Talaria finds jobs, tells you honestly where you stand and prepares each application. It can only do that as well as it knows you, so the next 10 minutes are about you. You can change any answer later.
      </StepHeader>

      <ul className="space-y-3">
        {WHAT_WE_ASK.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4 bg-card p-4 shadow-card">
            <div className="grid size-10 shrink-0 place-items-center bg-gold-soft text-gold">
              <Icon className="size-5" />
            </div>
            <div>
              <div className="text-[14.5px] font-semibold text-ink">{title}</div>
              <div className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{body}</div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[13px] leading-relaxed text-muted">
        <strong className="font-semibold text-ink">Have ready:</strong> your resume (PDF, Word, text or LaTeX) and an AI account you already use: ChatGPT, GitHub Copilot, or an API key.
      </p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <HardDrive className="size-3.5 text-faint" /> Everything you tell it stays on this computer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-faint" /> You approve everything
        </span>
      </div>

      <StepFooter>
        <NextButton onClick={next}>Let's start</NextButton>
      </StepFooter>
    </div>
  );
}

// ---------------- 1. Connect the AI ----------------

type ProviderId = 'openai-codex' | 'anthropic' | 'copilot' | 'other';

const PROVIDERS: { id: ProviderId; name: string; account: string; who: string }[] = [
  { id: 'openai-codex', name: 'ChatGPT / Codex', account: 'ChatGPT', who: 'I pay for ChatGPT (Plus, Pro or Business)' },
  { id: 'anthropic', name: 'Claude (Anthropic)', account: 'Claude', who: 'I pay for Claude (Pro or Max)' },
  { id: 'copilot', name: 'GitHub Copilot', account: 'GitHub Copilot', who: 'I have GitHub Copilot (the free student plan counts)' },
  { id: 'other', name: 'Something else', account: 'your provider', who: 'I have an API key (OpenRouter, Gemini, OpenAI…)' },
];

const MODEL_HINT: Partial<Record<ProviderId, string>> = {
  'openai-codex': 'The list shows the models your ChatGPT plan offers. Every call counts against your ChatGPT usage limits.',
  anthropic: 'Every call counts against your Claude plan’s usage limits, shared with claude.ai and Claude Code. Sonnet is the best balance; Opus uses the limits faster.',
  copilot: 'gpt-4.1 and gpt-4o are unlimited on Copilot. Premium models use your monthly quota and may need enabling at github.com/settings/copilot.',
};

type ConnectResult = { ok: boolean; model?: string; message?: string; latencyMs?: number };

// The subscriptions with their own button; any other provider goes under "Something else".
const SUBSCRIPTIONS: string[] = ['openai-codex', 'anthropic', 'copilot'];
const isSubscription = (provider: string) => SUBSCRIPTIONS.includes(provider);

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="bg-card shadow-card">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13.5px] font-medium text-ink">
        {title}
        <ChevronDown className={cn('size-4 text-faint transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-2 border-t border-line px-4 py-3 text-[13px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

function CheckRow({ ok, pending, title, children }: { ok: boolean; pending?: boolean; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('mt-0.5 grid size-5 shrink-0 place-items-center ', ok ? 'bg-ok-soft text-ok' : 'bg-ink/5 text-faint')}>
        {pending ? <Loader className="size-3 animate-spin" /> : ok ? <Check className="size-3" strokeWidth={3} /> : <SquareDashed className="size-3" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        {children && <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{children}</div>}
      </div>
    </div>
  );
}

export function ConnectStep({ kicker, next, back }: { kicker: string; next: () => void; back: () => void }) {
  const hermes = useApp(s => s.hermes);
  const settings = useApp(s => s.settings)!;
  const [setup, setSetup] = React.useState<SetupStatus | null>(null);
  const [looking, setLooking] = React.useState(true);
  const [choice, setChoice] = React.useState<ProviderId>(isSubscription(settings.hermes.provider) ? (settings.hermes.provider as ProviderId) : 'other');
  const current = PROVIDERS.find(p => p.id === choice)!;
  const [accounts, setAccounts] = React.useState<HermesAccounts | null>(null);
  // Only "Something else" asks for names; the subscriptions are known.
  const [otherProvider, setOtherProvider] = React.useState(isSubscription(settings.hermes.provider) ? '' : settings.hermes.provider);
  const [otherModel, setOtherModel] = React.useState(isSubscription(settings.hermes.provider) ? '' : settings.hermes.model);
  const [reSignIn, setReSignIn] = React.useState(false);
  const [connecting, setConnecting] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ConnectResult | null>(null);
  const provider = choice === 'other' ? otherProvider.trim() : choice;

  // Is Hermes installed? (A light check: it doesn't ask the AI anything yet.)
  const look = React.useCallback(async () => {
    setLooking(true);
    try {
      await api.post('/api/hermes/check?deep=0', {}, { quiet: true });
    } catch {}
    api.get<SetupStatus>('/api/setup/status', { quiet: true }).then(setSetup).catch(() => {});
    setLooking(false);
  }, []);
  React.useEffect(() => {
    look();
  }, [look]);

  // Which accounts Hermes is signed in to. Read again whenever the person comes back from the terminal.
  const loadAccounts = React.useCallback(() => api.get<HermesAccounts>('/api/hermes/accounts', { quiet: true }).then(setAccounts).catch(() => {}), []);
  React.useEffect(() => {
    loadAccounts();
    window.addEventListener('focus', loadAccounts);
    return () => window.removeEventListener('focus', loadAccounts);
  }, [loadAccounts]);

  // What `hermes model` set up fills in "Something else", so nobody retypes it.
  const configured = accounts?.configured;
  React.useEffect(() => {
    if (!configured?.provider || isSubscription(configured.provider) || otherProvider) return;
    setOtherProvider(configured.provider);
    setOtherModel(configured.model || '');
  }, [configured?.provider, configured?.model]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: ProviderId) => {
    setChoice(id);
    setReSignIn(false);
    setResult(r => (r?.ok ? r : null)); // a working connection still counts after looking at another option
  };

  /** Test the account and switch Talaria to it. Without a model, the server picks one the account accepts. */
  const connect = async (model?: string) => {
    if (!provider) return;
    setConnecting(model || 'auto');
    setResult(null);
    try {
      setResult(await api.post<ConnectResult>('/api/hermes/connect', { provider, model: model?.trim() || undefined }, { quiet: true }));
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Something went wrong.' });
    }
    setConnecting(null);
  };

  const signedIn = choice !== 'other' && Boolean(accounts?.signedIn.includes(choice));
  const usingThis = Boolean(provider) && settings.hermes.provider === provider;
  const connected = usingThis && Boolean(result?.ok || hermes.ok);
  // Any working account is enough to move on, even if the person is now looking at another option.
  const ready = Boolean(result?.ok) || (hermes.ok && hermes.provider === settings.hermes.provider);
  const models = accounts?.models[provider] || [];
  const otherProviders = [...new Set([...(accounts?.signedIn || []), ...Object.keys(accounts?.models || {})])].filter(p => !isSubscription(p));
  const windows = (setup?.platform ?? navigator.platform).toLowerCase().startsWith('win');
  const installCmd = windows ? 'iex (irm https://hermes-agent.nousresearch.com/install.ps1)' : 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash';

  return (
    <div>
      <StepHeader kicker={kicker} title="Connect the brain.">
        Talaria uses a free program called <strong className="font-semibold text-ink">Hermes</strong> to talk to an AI. You sign in to an AI account you already have, and Hermes does the rest. Talaria never sees your password.
      </StepHeader>

      {/* 1. Hermes installed? */}
      <div className="bg-card p-5 shadow-card">
        <CheckRow ok={hermes.installed} pending={looking} title={hermes.installed ? `Hermes is installed${hermes.version ? ` (v${hermes.version})` : ''}` : looking ? 'Looking for Hermes…' : 'Hermes is not installed yet'}>
          {!hermes.installed && !looking && (
            <div className="mt-2 space-y-2.5">
              <p>
                Open {windows ? <strong>PowerShell</strong> : 'a terminal'} (search for it in your {windows ? 'Start menu' : 'applications'}), paste this line, press Enter and wait for it to finish. Then close that window and press <em>Check again</em>.
              </p>
              <Cmd>{installCmd}</Cmd>
              <Button variant="secondary" size="sm" icon={<RefreshCw className="size-3.5" />} onClick={look}>
                Check again
              </Button>
            </div>
          )}
        </CheckRow>
      </div>

      {/* 2. Which AI account? */}
      {hermes.installed && (
        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-2 text-[13.5px] font-semibold text-ink">Which AI account do you have?</div>
            <div className="grid gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p.id)}
                  className={cn('flex items-center gap-3 border px-4 py-3 text-left transition-colors', choice === p.id ? 'border-ink bg-card shadow-card' : 'border-line bg-card/60 hover:border-ink/30')}
                >
                  <span className={cn('grid size-5 shrink-0 place-items-center border', choice === p.id ? 'border-ink bg-ink text-bg' : 'border-line')}>{choice === p.id && <Check className="size-3" strokeWidth={3} />}</span>
                  <span>
                    <span className="block text-[14px] font-semibold text-ink">{p.name}</span>
                    <span className="block text-[12.5px] text-muted">{p.who}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 bg-card p-5 shadow-card">
            <div className="text-[13.5px] font-semibold text-ink">{connected ? `Connected to ${current.account}` : signedIn ? 'Signed in' : 'Sign in (one time)'}</div>
            {signedIn && !reSignIn ? (
              <CheckRow ok title={`Hermes is already signed in to ${current.account}.`}>
                <button type="button" onClick={() => setReSignIn(true)} className="underline-offset-2 hover:text-ink hover:underline">
                  Use a different account
                </button>
              </CheckRow>
            ) : (
              <>
                {choice === 'openai-codex' && (
                  <>
                    <p className="text-[13px] leading-relaxed text-muted">Copy this into your terminal and press Enter. A browser window opens: sign in with your ChatGPT account and approve. Then come back here.</p>
                    <Cmd>hermes auth add openai-codex --type oauth</Cmd>
                    <p className="text-[12px] text-faint">Uses your ChatGPT plan's allowance, so there's no separate bill and no API key. Heavy use can hit your plan's limits; Talaria pauses and retries by itself.</p>
                  </>
                )}
                {choice === 'anthropic' && (
                  <>
                    <p className="text-[13px] leading-relaxed text-muted">Copy this into your terminal and press Enter. A browser window opens: sign in with your Claude account and approve. Then come back here.</p>
                    <Cmd>hermes auth add anthropic --type oauth</Cmd>
                    <p className="text-[12px] text-faint">Uses your Claude Pro or Max plan's allowance, so there's no separate bill and no API key. Heavy use can hit your plan's limits; Talaria pauses and retries by itself.</p>
                  </>
                )}
                {choice === 'copilot' && (
                  <>
                    <p className="text-[13px] leading-relaxed text-muted">Install the GitHub command-line tool if you don't have it, then sign in to GitHub. A browser window opens; approve the sign-in.</p>
                    {windows && <Cmd>winget install --id GitHub.cli</Cmd>}
                    <Cmd>gh auth login</Cmd>
                    <p className="text-[12px] text-faint">Copilot needs to be switched on for your GitHub account at github.com/settings/copilot.</p>
                  </>
                )}
                {choice === 'other' && (
                  <>
                    <p className="text-[13px] leading-relaxed text-muted">Run this in your terminal. It walks you through picking a provider, pasting your key and choosing a model. When you come back, Talaria fills in what you picked.</p>
                    <Cmd>hermes model</Cmd>
                  </>
                )}
              </>
            )}

            {choice === 'other' && (
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <Field label="Provider" hint="For example: openrouter, gemini, anthropic">
                  <Input value={otherProvider} list="talaria-providers" onChange={e => (setOtherProvider(e.target.value), setResult(null))} placeholder="e.g. openrouter" />
                  <datalist id="talaria-providers">
                    {otherProviders.map(p => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </Field>
                <Field
                  label="Model"
                  hint={
                    otherProvider.trim() === 'gemini'
                      ? 'Pick a Flash model such as gemini-flash-latest. Pro and preview models are often overloaded on the free tier.'
                      : models.length
                        ? 'Leave it empty and Talaria picks one.'
                        : undefined
                  }
                >
                  <Input value={otherModel} list="talaria-models" onChange={e => (setOtherModel(e.target.value), setResult(null))} placeholder={models[0] ? `e.g. ${models[0]}` : 'e.g. gpt-4.1'} />
                  <datalist id="talaria-models">
                    {models.map(m => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </Field>
              </div>
            )}

            {connected && choice !== 'other' ? (
              <div className="space-y-3 pt-1">
                <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ok">
                  <Check className="size-4" strokeWidth={3} /> It works!{result?.ok && result.latencyMs ? ` Answered in ${(result.latencyMs / 1000).toFixed(1)}s.` : ''}
                </div>
                <Field
                  label={
                    <span className="flex items-center gap-1.5">
                      Model {connecting && <Loader className="size-3 animate-spin text-gold" />}
                    </span>
                  }
                  hint={connecting ? `Trying ${connecting}…` : `Talaria picked one your account accepts; you can leave it. ${MODEL_HINT[choice] ?? ''}`}
                >
                  <select
                    value={settings.hermes.model}
                    disabled={Boolean(connecting)}
                    onChange={e => connect(e.target.value)}
                    className="h-9 w-full border border-line bg-card px-2.5 text-[13.5px] text-ink outline-none focus:border-accent/60 disabled:opacity-60 sm:max-w-xs"
                  >
                    {[...new Set([settings.hermes.model, ...models])].map(m => (
                      <option key={m} value={m}>
                        {m}
                        {m === accounts?.defaults[choice] ? ' (recommended)' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button variant="primary" loading={Boolean(connecting)} disabled={!provider} onClick={() => connect(choice === 'other' ? otherModel : undefined)}>
                  {connecting ? 'Connecting, about 15 seconds…' : signedIn || choice === 'other' ? 'Connect' : "I've signed in, connect"}
                </Button>
                {connected && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ok">
                    <Check className="size-4" strokeWidth={3} /> Connected, using {settings.hermes.model}
                  </span>
                )}
              </div>
            )}
            {result && !result.ok && <p className="bg-bad-soft px-3 py-2 text-[12.5px] leading-relaxed text-bad">{result.message}</p>}
          </div>
        </div>
      )}

      {/* 3. Optional extras */}
      <div className="mt-5 space-y-2">
        <div className="text-[12px] font-semibold tracking-[0.08em] text-faint uppercase">Optional extras (you can add these later)</div>
        <Collapsible title={`${setup?.pdflatex ? '✓' : '○'}  LaTeX, to keep your resume's exact design`}>
          <p>If your resume is a LaTeX file (from Overleaf, for example), Talaria can tailor it and keep your exact template. That needs a LaTeX program called MiKTeX. If your resume is a PDF or Word file, skip this.</p>
          {setup?.pdflatex ? <p className="font-medium text-ok">MiKTeX found.</p> : <p>Download it from miktex.org (Windows) or install TeX Live (Mac / Linux), then restart Talaria.</p>}
        </Collapsible>
        <Collapsible title={`${setup?.browser.ok ? '✓' : '○'}  Browser helper, for submitting applications for you`}>
          <p>To fill in and submit application forms, Talaria opens a window of your own browser (Chrome, Edge or Brave) with a separate profile. If you have none of those, it needs a one-time download of about 150 MB.</p>
          {setup?.browser.ok ? (
            <p className="font-medium text-ok">Ready: Talaria found a browser it can use.</p>
          ) : (
            <>
              <p>Run this in the Talaria folder, then restart Talaria:</p>
              <Cmd>npx playwright install chromium</Cmd>
            </>
          )}
        </Collapsible>
      </div>

      {!ready && <p className="mt-5 text-[12.5px] text-faint">Connect an AI account to continue. You can skip it for now, but nothing will work until it's connected.</p>}

      <StepFooter back={back}>
        {!ready && <SkipLink onClick={next} title="Nothing will work until the AI is connected" />}
        <NextButton onClick={next} disabled={!ready} />
      </StepFooter>
    </div>
  );
}
