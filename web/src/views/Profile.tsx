import * as React from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { BookmarkCheck, Check, ChevronDown, FileText, Globe, GraduationCap, List, Loader2, Plus, RefreshCw, Rss, Save, Search, Sparkles, Trash2, UploadCloud, X } from 'lucide-react';
import type { AnswerBankItem, CustomBoard, ExperienceItem, Preferences, Profile, SourceId, TargetCompany } from '@shared/types';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { cn, timeAgo } from '@/lib/utils';
import { Badge, Button, Card, ChipInput, Dialog, EmptyState, Field, Input, SectionTitle, Segmented, SuggestInput, Switch, Textarea } from '@/components/ui';
import { countryOptions, placeOptions } from '@/lib/suggest';
import { composeStory, STORY_QUESTIONS } from '@shared/story';
import { PreferencesForm, SkipCompaniesField } from './Onboarding';
import { toast } from 'sonner';
import { dismissLookup, lookUpCompany, receiveCompanies, useLookups, type Lookup } from '@/lib/companyLookups';

type Tab = 'profile' | 'preferences' | 'sources' | 'answers';

export function ProfileView() {
  const [tab, setTab] = React.useState<Tab>('profile');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-7 pt-6 pb-5">
        <h1 className="font-display text-[27px] leading-none tracking-[-0.015em] text-ink">Profile & preferences</h1>
        <p className="mt-2 text-[13.5px] text-muted">Everything Hermes knows about you. Better inputs, better matches.</p>
        <Segmented
          className="mt-5"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'profile', label: 'Profile' },
            { value: 'preferences', label: 'Job preferences' },
            { value: 'sources', label: 'Sources' },
            { value: 'answers', label: 'Remembered answers' },
          ]}
        />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-24">
        <div className="max-w-[860px]">
          {tab === 'profile' && <ProfileEditor />}
          {tab === 'preferences' && <PreferencesTab />}
          {tab === 'sources' && <SourcesTab />}
          {tab === 'answers' && <AnswerBank />}
        </div>
      </div>
    </div>
  );
}

// ---------------- save bar ----------------

function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl bg-ink py-2 pr-2 pl-4 text-bg shadow-pop">
            <span className="text-[13px]">Unsaved changes</span>
            <Button size="sm" variant="ghost" className="text-bg/70 hover:bg-white/10 hover:text-bg" onClick={onReset}>
              Discard
            </Button>
            <Button size="sm" variant="gold" loading={saving} icon={<Save className="size-3.5" />} onClick={onSave}>
              Save
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------- profile ----------------

/**
 * The answers your story starts from: the saved ones, else your onboarding answers, else an older
 * free-text story kept whole under "Anything else" so nothing is lost.
 */
function startingAnswers(profile: Profile, onboarding?: Record<string, string>): { answers: Record<string, string>; carriedOver: boolean } {
  if (profile.storyAnswers) return { answers: profile.storyAnswers, carriedOver: false };
  const story = profile.story?.trim() || '';
  if (onboarding && Object.values(onboarding).some(a => a?.trim()) && (!story || composeStory(onboarding) === story)) return { answers: onboarding, carriedOver: false };
  return { answers: story ? { more: story } : {}, carriedOver: Boolean(story) };
}

const clean = (a: Record<string, string>) => JSON.stringify(Object.fromEntries(STORY_QUESTIONS.map(q => [q.id, (a[q.id] || '').trim()]).filter(([, v]) => v)));

/** Your story as questions you answer; Hermes weaves the answers into the story your cover letters use. */
function StorySection() {
  const profile = useApp(s => s.profile)!;
  const onboarding = useApp(s => s.settings?.onboarding?.story);
  const runs = useApp(s => s.runs);
  const lastRun = runs.filter(r => r.kind === 'story').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const weaving = lastRun?.status === 'queued' || lastRun?.status === 'running';
  const start = React.useMemo(() => startingAnswers(profile, onboarding), [profile.storyAnswers]); // eslint-disable-line react-hooks/exhaustive-deps
  const [answers, setAnswers] = React.useState(start.answers);
  const [saving, setSaving] = React.useState(false);
  const [sorting, setSorting] = React.useState<'idle' | 'sorting' | 'failed'>('idle');
  const touched = React.useRef(false);
  const dirty = clean(answers) !== clean(profile.storyAnswers ?? {});
  // Saved answers coming back from the server replace the form only while you haven't typed in it.
  React.useEffect(() => {
    if (!touched.current) setAnswers(start.answers);
  }, [start]);
  const type = (id: string, text: string) => {
    touched.current = true;
    setAnswers(a => ({ ...a, [id]: text }));
  };

  // A story written before the questions existed: Hermes sorts your own sentences into them, once.
  const asked = React.useRef(false);
  React.useEffect(() => {
    if (!start.carriedOver || profile.storyAnswers || asked.current) return;
    asked.current = true;
    setSorting('sorting');
    api
      .post('/api/profile/story/sort', {}, { quiet: true })
      .then(() => setSorting('idle'))
      .catch(() => setSorting('failed'));
  }, [start.carriedOver, profile.storyAnswers]);
  const sortedFromStory = Boolean(profile.storyAnswers && !profile.storyWovenAt && profile.story && composeStory(profile.storyAnswers) !== profile.story.trim());

  const save = async (again = false) => {
    setSaving(true);
    try {
      await api.post('/api/profile/story', { answers, again });
      toast.success(again ? 'Hermes is weaving your story again' : 'Saved. Hermes is weaving your answers into your story.');
    } finally {
      setSaving(false);
    }
  };

  const words = (profile.story || '').trim().split(/\s+/).filter(Boolean).length;
  const failed = !weaving && lastRun?.status === 'error' && !profile.storyWovenAt;
  return (
    <section>
      <SectionTitle>Your story</SectionTitle>
      <Card className="space-y-5 p-5">
        <p className="text-[12.5px] leading-relaxed text-muted">
          Your resume says what you did; this is who you are. Answer in your own words, like you'd talk to a friend. Hermes weaves your answers into your story, and your cover letters are written from it.
          It never adds anything you didn't say, so the more real detail you give, the more personal every letter gets.
        </p>
        {sorting === 'sorting' && !touched.current && (
          <p className="flex items-center gap-2 rounded-lg bg-gold-soft/40 px-3 py-2 text-[12px] leading-relaxed text-ink-2">
            <Loader2 className="size-3.5 shrink-0 animate-spin text-gold" /> Hermes is sorting your earlier story into these questions, using your own sentences…
          </p>
        )}
        {sorting === 'failed' && !profile.storyAnswers && (
          <p className="rounded-lg bg-gold-soft/40 px-3 py-2 text-[12px] leading-relaxed text-ink-2">
            Hermes couldn't sort your earlier story right now, so all of it is under <strong className="font-semibold">Anything else</strong> and nothing is lost. Move parts of it into the questions if you like, then save.
          </p>
        )}
        {sortedFromStory && !touched.current && (
          <p className="rounded-lg bg-gold-soft/40 px-3 py-2 text-[12px] leading-relaxed text-ink-2">
            Hermes sorted your earlier story into these questions, using your own sentences. Anything that didn't fit a question is under <strong className="font-semibold">Anything else</strong>. Check them, then save to weave your story.
          </p>
        )}
        {STORY_QUESTIONS.map(q => (
          <Field
            key={q.id}
            label={
              <span className="flex items-center gap-1.5">
                {q.q} {q.optional && <span className="text-[11px] font-normal text-faint">optional</span>}
              </span>
            }
            hint={q.hint}
          >
            <Textarea value={answers[q.id] || ''} disabled={sorting === 'sorting'} onChange={e => type(q.id, e.target.value)} rows={q.id === 'more' ? 4 : 3} placeholder={q.placeholder} />
          </Field>
        ))}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-faint">Kept when you replace your resume.</span>
          <Button
            variant="primary"
            loading={saving}
            // Sorted but not woven yet counts as something to save.
            disabled={sorting === 'sorting' || !(dirty || (!profile.storyWovenAt && Object.values(answers).some(a => a?.trim())))}
            icon={<Sparkles className="size-3.5 text-gold" />}
            onClick={() => save(!dirty)}
          >
            Save and weave my story
          </Button>
        </div>
      </Card>

      <Card className="mt-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13.5px] font-semibold text-ink">Your story, as your cover letters see it</div>
            <div className="mt-0.5 text-[12px] text-muted">
              {weaving
                ? 'Hermes is weaving your answers…'
                : profile.storyWovenAt
                  ? `Woven by Hermes ${timeAgo(profile.storyWovenAt, false)} · ${words} words`
                  : profile.story
                    ? 'Not woven yet: this is your story as you wrote it.'
                    : 'Answer the questions above and save to see it here.'}
            </div>
          </div>
          <Button variant="ghost" size="sm" disabled={weaving || saving || dirty || !profile.story} title={dirty ? 'Save your changes first' : undefined} icon={weaving ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} onClick={() => save(true)}>
            Weave again
          </Button>
        </div>
        {failed && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-[12px] text-bad">Hermes couldn't weave it ({lastRun.error?.split('\n')[0]}). Until it can, cover letters use your answers as written.</p>}
        {profile.story && <p className={cn('mt-4 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-2', weaving && 'opacity-50')}>{profile.story}</p>}
      </Card>
    </section>
  );
}

function ProfileEditor() {
  const stored = useApp(s => s.profile)!;
  const [p, setP] = React.useState<Profile>(stored);
  const [saving, setSaving] = React.useState(false);
  const [showText, setShowText] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => setP(stored), [stored]);
  const dirty = JSON.stringify(p) !== JSON.stringify(stored);
  const up = (patch: Partial<Profile>) => setP(x => ({ ...x, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      // Your story has its own save, and Hermes may be weaving it right now: leave it out of this one.
      const { story: _story, storyAnswers: _answers, storyWovenAt: _woven, ...rest } = p;
      await api.put('/api/profile', rest);
      toast.success('Profile saved');
    } finally {
      setSaving(false);
    }
  };

  const replace = async (f?: File | null) => {
    if (!f) return;
    if (!confirm('Replace your resume? Hermes will rebuild your profile from the new file (your preferences stay).')) return;
    const fd = new FormData();
    fd.append('file', f);
    setUploading(true);
    try {
      await api.post('/api/resume', fd);
      toast.success('Resume updated — profile rebuilt');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card className="flex items-center gap-4 p-4">
        <div className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">{uploading ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate text-[14px] font-semibold text-ink">
            {uploading ? 'Hermes is reading your new resume…' : stored.resumeFileName || 'Pasted resume'}
            {stored.latexSource && !uploading && <Badge tone="accent">LaTeX template</Badge>}
          </div>
          <div className="text-[12.5px] text-muted">
            {stored.latexSource ? 'Every tailored resume is rendered in your own template. ' : ''}Profile last updated {timeAgo(stored.updatedAt, false)}
          </div>
        </div>
        {stored.latexSource && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const id = toast.loading('Compiling your template with pdfLaTeX…');
              try {
                const r = await api.post<{ ok: boolean; pages?: number; error?: string }>('/api/latex/test');
                if (r.ok) toast.success(`Compiles fine — ${r.pages} page${r.pages === 1 ? '' : 's'}`, { id });
                else toast.error(`Doesn't compile: ${r.error?.split('\n')[0] || 'pdflatex not installed'}`, { id });
              } catch {
                toast.dismiss(id);
              }
            }}
          >
            Test compile
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setShowText(true)}>
          View text
        </Button>
        <Button variant="secondary" size="sm" icon={<UploadCloud className="size-3.5" />} onClick={() => fileRef.current?.click()} disabled={uploading}>
          Replace resume
        </Button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.tex,.zip" className="hidden" onChange={e => replace(e.target.files?.[0])} />
      </Card>

      <StorySection />

      <section>
        <SectionTitle>Basics</SectionTitle>
        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={p.name} onChange={e => up({ name: e.target.value })} />
            </Field>
            <Field label="Headline">
              <Input value={p.headline} onChange={e => up({ headline: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={p.email} onChange={e => up({ email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={p.phone} onChange={e => up({ phone: e.target.value })} />
            </Field>
            <Field label="Location">
              <SuggestInput value={p.location} onChange={location => up({ location })} search={placeOptions} placeholder="Start typing a city or country" />
            </Field>
            <Field label="Years of professional experience">
              <Input type="number" min={0} value={p.yearsExperience ?? ''} onChange={e => up({ yearsExperience: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Summary">
            <Textarea value={p.summary} onChange={e => up({ summary: e.target.value })} />
          </Field>
          <Field label="Links">
            <div className="space-y-2">
              {p.links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="w-36" value={l.label} onChange={e => up({ links: p.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" />
                  <Input value={l.url} onChange={e => up({ links: p.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} placeholder="https://" />
                  <Button variant="ghost" size="md" aria-label="Remove link" onClick={() => up({ links: p.links.filter((_, j) => j !== i) })}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />} onClick={() => up({ links: [...p.links, { label: '', url: '' }] })}>
                Add link
              </Button>
            </div>
          </Field>
          <Field label="Skills" hint="Order matters — put your strongest first.">
            <ChipInput value={p.skills} onChange={skills => up({ skills })} placeholder="Add a skill" />
          </Field>
        </Card>
      </section>

      <section>
        <SectionTitle
          action={
            <Button variant="ghost" size="xs" icon={<Plus className="size-3" />} onClick={() => up({ experience: [{ company: '', title: '', start: '', end: '', bullets: [] }, ...p.experience] })}>
              Add role
            </Button>
          }
        >
          Experience
        </SectionTitle>
        <div className="space-y-2.5">
          {p.experience.map((e, i) => (
            <EntryEditor
              key={i}
              title={e.title || 'New role'}
              subtitle={[e.company, [e.start, e.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
              onRemove={() => up({ experience: p.experience.filter((_, j) => j !== i) })}
            >
              <ExperienceFields value={e} onChange={v => up({ experience: p.experience.map((x, j) => (j === i ? v : x)) })} />
            </EntryEditor>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <Button variant="ghost" size="xs" icon={<Plus className="size-3" />} onClick={() => up({ projects: [{ name: '', bullets: [], tech: [] }, ...p.projects] })}>
              Add project
            </Button>
          }
        >
          Projects
        </SectionTitle>
        <div className="space-y-2.5">
          {p.projects.map((pr, i) => (
            <EntryEditor key={i} title={pr.name || 'New project'} subtitle={pr.tech?.join(', ')} onRemove={() => up({ projects: p.projects.filter((_, j) => j !== i) })}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <Input value={pr.name} onChange={e => up({ projects: p.projects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                </Field>
                <Field label="Link">
                  <Input value={pr.link || ''} onChange={e => up({ projects: p.projects.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)) })} />
                </Field>
              </div>
              <Field label="Tech" className="mt-3">
                <ChipInput value={pr.tech || []} onChange={tech => up({ projects: p.projects.map((x, j) => (j === i ? { ...x, tech } : x)) })} />
              </Field>
              <BulletsField value={pr.bullets} onChange={bullets => up({ projects: p.projects.map((x, j) => (j === i ? { ...x, bullets } : x)) })} />
            </EntryEditor>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <Button variant="ghost" size="xs" icon={<Plus className="size-3" />} onClick={() => up({ education: [...p.education, { school: '', degree: '', field: '' }] })}>
              Add
            </Button>
          }
        >
          Education
        </SectionTitle>
        <div className="space-y-2.5">
          {p.education.map((ed, i) => (
            <EntryEditor key={i} title={ed.school || 'New entry'} subtitle={[ed.degree, ed.field].filter(Boolean).join(', ')} onRemove={() => up({ education: p.education.filter((_, j) => j !== i) })}>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['school', 'degree', 'field', 'start', 'end', 'details'] as const).map(k => (
                  <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                    <Input value={ed[k] || ''} onChange={e => up({ education: p.education.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} />
                  </Field>
                ))}
              </div>
            </EntryEditor>
          ))}
        </div>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setP(stored)} />
      <Dialog open={showText} onOpenChange={setShowText} title="Extracted resume text" description="This is exactly what Hermes reads." className="max-w-2xl">
        <pre className="mt-4 max-h-[60vh] overflow-auto rounded-xl bg-panel p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-2">{stored.resumeText}</pre>
      </Dialog>
    </div>
  );
}

function EntryEditor({ title, subtitle, children, onRemove }: { title: string; subtitle?: string; children: React.ReactNode; onRemove: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">{title}</div>
          {subtitle && <div className="truncate text-[12.5px] text-muted">{subtitle}</div>}
        </div>
        <ChevronDown className={cn('size-4 text-faint transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-line-2 p-4">
              {children}
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="xs" className="text-bad hover:bg-bad-soft hover:text-bad" icon={<Trash2 className="size-3" />} onClick={onRemove}>
                  Remove
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function ExperienceFields({ value: e, onChange }: { value: ExperienceItem; onChange: (v: ExperienceItem) => void }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <Input value={e.title} onChange={x => onChange({ ...e, title: x.target.value })} />
        </Field>
        <Field label="Company">
          <Input value={e.company} onChange={x => onChange({ ...e, company: x.target.value })} />
        </Field>
        <Field label="Start">
          <Input value={e.start || ''} onChange={x => onChange({ ...e, start: x.target.value })} placeholder="Jun 2024" />
        </Field>
        <Field label="End">
          <Input value={e.end || ''} onChange={x => onChange({ ...e, end: x.target.value })} placeholder="Present" />
        </Field>
      </div>
      <BulletsField value={e.bullets} onChange={bullets => onChange({ ...e, bullets })} />
    </>
  );
}

function BulletsField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = React.useState(value.join('\n'));
  React.useEffect(() => setText(value.join('\n')), [value.join('\n')]);
  return (
    <Field label="Bullet points" hint="One per line." className="mt-3">
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() =>
          onChange(
            text
              .split('\n')
              .map(s => s.replace(/^[•\-*]\s*/, '').trim())
              .filter(Boolean),
          )
        }
        className="min-h-[110px] text-[13px]"
      />
    </Field>
  );
}

// ---------------- preferences ----------------

function PreferencesTab() {
  const stored = useApp(s => s.preferences)!;
  const [prefs, setPrefs] = React.useState(stored);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setPrefs(stored), [stored]);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(stored);
  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/preferences', prefs);
      toast.success('Preferences saved — they apply to the next search');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PreferencesForm prefs={prefs} onChange={p => setPrefs(x => ({ ...x, ...p }))} />
        <div className="mt-5 border-t border-line-2 pt-5">
          <Field label="Hide postings older than" hint="Stale postings are usually filled already.">
            <Segmented
              size="sm"
              value={String(prefs.maxAgeDays)}
              onChange={v => setPrefs(x => ({ ...x, maxAgeDays: Number(v) }))}
              options={[
                { value: '7', label: '1 week' },
                { value: '14', label: '2 weeks' },
                { value: '30', label: '1 month' },
                { value: '60', label: '2 months' },
              ]}
            />
          </Field>
          <div className="mt-5">
            <SkipCompaniesField prefs={prefs} onChange={p => setPrefs(x => ({ ...x, ...p }))} />
          </div>
        </div>
      </Card>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setPrefs(stored)} />
    </div>
  );
}

// ---------------- sources ----------------

export const BOARDS: { id: SourceId; name: string; desc: string }[] = [
  { id: 'hermes_web', name: 'Hermes web search', desc: "Hermes searches the open web: companies' own career sites, Workday, Greenhouse, Lever and more." },
  { id: 'remotive', name: 'Remotive', desc: 'Curated remote tech jobs.' },
  { id: 'remoteok', name: 'Remote OK', desc: 'Large feed of remote roles worldwide.' },
  { id: 'himalayas', name: 'Himalayas', desc: 'Remote jobs with salary data.' },
  { id: 'jobicy', name: 'Jobicy', desc: 'Remote roles across many fields.' },
  { id: 'themuse', name: 'The Muse', desc: 'Jobs filtered by your locations and level.' },
  { id: 'arbeitnow', name: 'Arbeitnow', desc: 'Germany & EU roles, many with visa sponsorship.' },
];

const PLATFORM: Record<TargetCompany['ats'], string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  workable: 'Workable',
  smartrecruiters: 'SmartRecruiters',
  recruitee: 'Recruitee',
  site: 'Own website',
};

type Suggestion = { name: string; url: string; why: string };

const HOW: Record<CustomBoard['how'], { label: string; icon: React.ReactNode }> = {
  feed: { label: 'Read from its feed', icon: <Rss className="size-3.5" /> },
  page: { label: 'Read from its listings', icon: <List className="size-3.5" /> },
  search: { label: 'Searched by Hermes', icon: <Search className="size-3.5" /> },
};

/** Job boards you add yourself: any site that lists jobs, searched alongside the built-in ones. */
function CustomBoards({ prefs, onChange }: { prefs: Preferences; onChange: (p: Partial<Preferences>) => void }) {
  const boards = prefs.customBoards || [];
  const webSearch = useApp(s => s.settings?.hermes.webSearch);
  const [input, setInput] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const set = (customBoards: CustomBoard[]) => onChange({ customBoards });

  // Talaria works out how to read the board and how many jobs it lists; you still press Save.
  const add = async () => {
    if (!input.trim()) return;
    setAdding(true);
    try {
      const { board: b, count } = await api.post<{ board: CustomBoard; count: number }>('/api/preferences/resolve-board', { input });
      set([...boards.filter(x => x.url !== b.url), b]);
      toast.success(
        b.how === 'feed'
          ? `${b.name}: Talaria reads its job feed (${count} jobs in it now)`
          : b.how === 'page'
            ? `${b.name}: ${count} job links on the page. Talaria reads the ones that match your roles.`
            : `${b.name}: its listings can't be read directly, so Hermes searches the site for your roles${webSearch ? '' : ' (turn on web search in Settings)'}.`,
      );
      setInput('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card p-5 shadow-card">
      <div className="text-[14px] font-semibold text-ink">Your job boards</div>
      <div className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
        Add any site where jobs in your field get posted: a niche board, a country's job site, a community's jobs page. Paste its link and Talaria works out how to read it: its job feed, its listings, or a Hermes search within the site.
      </div>

      {boards.length > 0 ? (
        <div className="mt-4 divide-y divide-line-2 overflow-hidden rounded-xl border border-line">
          {boards.map(b => (
            <div key={b.id} className={cn('flex items-center gap-3 px-3.5 py-2.5', !b.enabled && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <input
                    aria-label="Board name"
                    title="Rename"
                    value={b.name}
                    onChange={e => set(boards.map(x => (x.id === b.id ? { ...x, name: e.target.value } : x)))}
                    onBlur={() => !b.name.trim() && set(boards.map(x => (x.id === b.id ? { ...x, name: b.domain } : x)))}
                    size={Math.max(4, b.name.length)}
                    className="min-w-0 truncate rounded bg-transparent px-1 -mx-1 outline-none hover:bg-ink/[0.05] focus:bg-ink/[0.05]"
                  />
                  <a href={b.url.replaceAll('{query}', encodeURIComponent(prefs.roles[0] || ''))} target="_blank" rel="noopener noreferrer" className="truncate text-[11.5px] font-normal text-accent hover:underline">
                    {b.domain}
                  </a>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-faint">
                  {HOW[b.how].icon}
                  {HOW[b.how].label}
                  {b.url.includes('{query}') && ' · once for each of your roles'}
                </div>
              </div>
              <Switch checked={b.enabled} onChange={enabled => set(boards.map(x => (x.id === b.id ? { ...x, enabled } : x)))} label={`Search ${b.name}`} />
              <button aria-label={`Remove ${b.name}`} onClick={() => set(boards.filter(x => x.id !== b.id))} className="rounded p-1 text-faint hover:bg-ink/10 hover:text-ink">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
          No boards of your own yet. Paste the link to one below, for example its page of jobs in your field.
        </p>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          add();
        }}
        className="mt-4 flex gap-2"
      >
        <Input className="flex-1" value={input} onChange={e => setInput(e.target.value)} placeholder="Job board link, e.g. weworkremotely.com/categories/remote-design-jobs" />
        <Button type="submit" variant="secondary" loading={adding} disabled={!input.trim() || adding} icon={<Plus className="size-4" />}>
          Add
        </Button>
      </form>
      <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
        Best is the board's page already filtered to your field or location. To search it for each of your roles, put <code className="rounded bg-ink/[0.06] px-1 text-ink-2">{'{query}'}</code> where the search words go, e.g. <span className="text-ink-2">example.com/jobs?q={'{query}'}</span>.
      </p>
    </div>
  );
}

const PHD_FIELD_IDEAS = ['Haptics', 'XR / virtual and augmented reality', 'Automotive HMI', 'Generative UI', 'Human-computer interaction', 'Multisensory interaction', 'Human-AI interaction', 'Interaction design'];

/** PhD positions: their own search, in your research fields, on the PhDs side of the board. */
function PhdSettings({ prefs, onChange }: { prefs: Preferences; onChange: (p: Partial<Preferences>) => void }) {
  const phd = prefs.phd || { enabled: false, fields: [], countries: [] };
  const set = (patch: Partial<typeof phd>) => onChange({ phd: { ...phd, ...patch } });
  return (
    <div className="rounded-2xl bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <GraduationCap className="size-4 text-accent" /> PhD positions
          </div>
          <div className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
            Hermes searches academic job boards (EURAXESS, Academic Positions, jobs.ac.uk, FindAPhD, Varbi) and university and lab pages for open, funded PhDs in these fields, plus close ones your background fits. They appear on the PhDs side of the board, and their applications get an academic CV and a motivation letter.
          </div>
        </div>
        <Switch checked={phd.enabled} onChange={enabled => set({ enabled, fields: phd.fields.length ? phd.fields : PHD_FIELD_IDEAS.slice(0, 6) })} label="Search for PhD positions" />
      </div>
      {phd.enabled && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Research fields" hint="What you'd want to research. Hermes also looks at closely related topics.">
            <ChipInput value={phd.fields} onChange={fields => set({ fields })} placeholder="Add a field" suggestions={PHD_FIELD_IDEAS} />
          </Field>
          <Field label="Where" hint="Countries or cities. Leave empty for anywhere in Europe.">
            <ChipInput value={phd.countries} onChange={countries => set({ countries })} placeholder="Start typing a country or region" search={countryOptions} suggestions={['Sweden', 'Germany', 'Netherlands', 'Denmark', 'Finland', 'Switzerland', 'United Kingdom']} />
          </Field>
        </div>
      )}
    </div>
  );
}

export function SourcesEditor({ prefs, onChange }: { prefs: Preferences; onChange: (p: Partial<Preferences>) => void }) {
  const [input, setInput] = React.useState('');
  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const lookups = useLookups(s => s.items);
  const toggle = (id: SourceId, v: boolean) => onChange({ sources: { ...prefs.sources, [id]: v } });

  // Several lookups can finish at once, before the new list comes back down: keep our own latest copy.
  const companies = React.useRef(prefs.targetCompanies);
  const seen = React.useRef(prefs.targetCompanies);
  if (seen.current !== prefs.targetCompanies) seen.current = companies.current = prefs.targetCompanies;
  const setCompanies = (next: TargetCompany[]) => {
    companies.current = next;
    onChange({ targetCompanies: next });
  };
  React.useEffect(() => receiveCompanies(c => setCompanies([...companies.current.filter(x => !(x.ats === c.ats && x.slug === c.slug)), c])));

  // Talaria looks the company up in the background (which platform, how many open jobs); you keep typing.
  const add = (text: string, name?: string) => {
    if (!text.trim()) return;
    lookUpCompany(text, name);
    if (name) setSuggestions(s => s.filter(x => x.name !== name));
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      const r = await api.post<{ companies: Suggestion[] }>('/api/preferences/suggest-companies');
      setSuggestions(r.companies);
      if (!r.companies.length) toast('Hermes found no new companies this time');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2">
        {BOARDS.map(b => (
          <label key={b.id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors', prefs.sources[b.id] ? 'border-line bg-card shadow-card' : 'border-dashed border-line')}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                {b.id === 'hermes_web' && <Globe className="size-3.5 text-gold" />}
                {b.name}
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-muted">{b.desc}</div>
            </div>
            <Switch checked={Boolean(prefs.sources[b.id])} onChange={v => toggle(b.id, v)} label={b.name} />
          </label>
        ))}
      </div>

      <CustomBoards prefs={prefs} onChange={onChange} />

      <PhdSettings prefs={prefs} onChange={onChange} />

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[14px] font-semibold text-ink">Companies to watch</div>
            <div className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
              Add any company by name or by the link to its jobs page. Talaria finds where it posts: Greenhouse, Lever, Ashby, Workday, Workable, SmartRecruiters, Recruitee, or its own careers website, which Hermes searches for your roles.
            </div>
          </div>
          <Button variant="secondary" size="sm" loading={suggesting} icon={<Sparkles className="size-3.5 text-gold" />} onClick={suggest}>
            {suggesting ? 'Hermes is looking…' : 'Suggest companies'}
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-gold/20 bg-gold-soft/30">
            <div className="flex items-center justify-between border-b border-gold/15 px-3.5 py-2 text-[12px] font-semibold text-gold">
              Hermes suggests
              <span className="flex items-center gap-3">
                <button onClick={() => suggestions.forEach(sg => add(sg.url, sg.name))} className="font-semibold text-ink hover:underline">
                  Add all
                </button>
                <button onClick={() => setSuggestions([])} className="font-medium text-muted hover:text-ink">
                  Dismiss
                </button>
              </span>
            </div>
            {suggestions.map(sg => (
              <div key={sg.name} className="flex items-center gap-3 border-b border-gold/10 px-3.5 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink">
                    {sg.name}{' '}
                    <a href={sg.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-[11.5px] font-normal text-accent hover:underline">
                      careers page
                    </a>
                  </div>
                  <div className="text-[12px] leading-snug text-muted">{sg.why}</div>
                </div>
                <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => add(sg.url, sg.name)}>
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}

        {!prefs.targetCompanies.length && !suggestions.length && !lookups.length && (
          <p className="mt-4 rounded-xl border border-dashed border-line px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
            No companies yet. Add the ones you'd love to work for below, or press <strong className="font-semibold text-ink">Suggest companies</strong> and Hermes picks some that fit your profile.
          </p>
        )}
        {/* Every chip animates its position, so when one arrives or leaves the rest glide into place. */}
        <LayoutGroup>
          <div className="mt-4 flex flex-wrap gap-1.5 empty:hidden">
            <AnimatePresence initial={false}>
              {prefs.targetCompanies.map(c => (
                <motion.span
                  key={`${c.ats}:${c.slug}`}
                  layout
                  layoutId={`company:${c.ats}:${c.slug}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={CHIP_MOTION}
                  title={c.url || undefined}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-ink/[0.05] pr-1 pl-2.5 text-[12.5px] font-medium text-ink-2 dark:bg-white/[0.07]"
                >
                  {c.ats === 'site' && <Globe className="size-3 text-faint" />}
                  {c.name}
                  <span className="text-[11px] font-normal text-faint">{PLATFORM[c.ats] || c.ats}</span>
                  <button aria-label={`Remove ${c.name}`} onClick={() => setCompanies(companies.current.filter(x => x !== c))} className="rounded p-0.5 text-faint hover:bg-ink/10 hover:text-ink">
                    <X className="size-3" />
                  </button>
                </motion.span>
              ))}
              {lookups.map(l => (
                <LookupChip key={l.id} lookup={l} onRetry={() => (setInput(l.input), dismissLookup(l.id))} />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
        {lookups.some(l => l.state === 'failed') && (
          <div className="mt-2 space-y-1">
            {lookups
              .filter(l => l.state === 'failed')
              .map(l => (
                <p key={l.id} className="text-[12px] leading-snug text-bad">
                  <strong className="font-semibold">{l.label}:</strong> {l.note} Click it to edit it and try again.
                </p>
              ))}
          </div>
        )}
        <form
          onSubmit={e => {
            e.preventDefault();
            add(input);
            setInput('');
          }}
          className="mt-4 flex gap-2"
        >
          <Input className="flex-1" value={input} onChange={e => setInput(e.target.value)} placeholder="Company name or careers link, e.g. Volvo Cars or capgemini.com/se-en/careers" />
          <Button type="submit" variant="secondary" disabled={!input.trim()} icon={<Plus className="size-4" />}>
            Add
          </Button>
        </form>
        <p className="mt-2 text-[11.5px] text-faint">Add as many as you like; each is looked up in the background. A link is fastest. With just a name, Talaria checks the common hiring platforms, then asks Hermes to find their careers site (up to a minute).</p>
      </div>
    </div>
  );
}

/** A company being looked up: working, then a green pop when found, or a red shake when not. */
// Chips slide to their new spot on a soft spring instead of jumping there.
const CHIP_MOTION = { duration: 0.25, layout: { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } } as const;

function LookupChip({ lookup: l, onRetry }: { lookup: Lookup; onRetry: () => void }) {
  return (
    <motion.span
      layout
      // Once found, it shares an id with the company chip it becomes, so it moves into its place in the list.
      layoutId={l.company ? `company:${l.company.ats}:${l.company.slug}` : undefined}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={l.state === 'found' ? { opacity: 1, scale: [1, 1.12, 1] } : l.state === 'failed' ? { opacity: 1, scale: 1, x: [0, -5, 5, -4, 4, -2, 0] } : { opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ ...CHIP_MOTION, duration: l.state === 'working' ? 0.18 : 0.45 }}
      title={l.state === 'failed' ? `${l.note} Click to edit it and try again.` : undefined}
      onClick={l.state === 'failed' ? onRetry : undefined}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-lg pr-1 pl-2.5 text-[12.5px] font-medium transition-colors duration-300',
        l.state === 'working' && 'bg-ink/[0.05] text-muted dark:bg-white/[0.07]',
        l.state === 'found' && 'bg-ok-soft pr-2.5 text-ok ring-1 ring-ok/30',
        l.state === 'failed' && 'cursor-pointer bg-bad-soft text-bad ring-1 ring-bad/30',
      )}
    >
      {l.state === 'working' && <Loader2 className="size-3 animate-spin" />}
      {l.state === 'found' && <Check className="size-3" strokeWidth={3} />}
      {l.label}
      <span className="text-[11px] font-normal opacity-75">{l.state === 'working' ? 'finding jobs page…' : l.state === 'found' ? l.note : "couldn't find it"}</span>
      {l.state !== 'found' && (
        <button
          aria-label={`Dismiss ${l.label}`}
          onClick={e => (e.stopPropagation(), dismissLookup(l.id))}
          className="rounded p-0.5 opacity-70 hover:bg-ink/10 hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
    </motion.span>
  );
}

function SourcesTab() {
  const stored = useApp(s => s.preferences)!;
  const [prefs, setPrefs] = React.useState(stored);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setPrefs(stored), [stored]);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(stored);
  return (
    <>
      <SourcesEditor prefs={prefs} onChange={p => setPrefs(x => ({ ...x, ...p, sources: { ...x.sources, ...(p.sources || {}) } }))} />
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-dashed border-line p-4">
        <div className="text-[12.5px] text-muted">Jobs you skipped or that scored low aren't shown again. Reset that list to give them another look on the next search.</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await api.post('/api/scout/reset-skipped');
            toast.success('Skipped jobs can show up again');
          }}
        >
          Reset skipped
        </Button>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onReset={() => setPrefs(stored)}
        onSave={async () => {
          setSaving(true);
          try {
            await api.put('/api/preferences', prefs);
            toast.success('Sources saved');
          } finally {
            setSaving(false);
          }
        }}
      />
    </>
  );
}

// ---------------- answer bank ----------------

function AnswerBank() {
  const answers = useApp(s => s.answers);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const save = (next: AnswerBankItem[]) => api.put('/api/answers', next);

  if (!answers.length)
    return (
      <EmptyState icon={<BookmarkCheck className="size-5" />} title="No remembered answers yet">
        When Hermes asks you something while preparing an application — sponsorship, notice period, salary — your answer is saved here and reused, so you never get asked twice.
      </EmptyState>
    );

  return (
    <div className="space-y-2.5">
      <p className="mb-4 text-[13px] text-muted">Hermes reuses these when filling in applications. Keep them current.</p>
      {answers.map(a => (
        <Card key={a.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[13.5px] font-semibold text-ink">{a.question}</div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge>used {a.uses}×</Badge>
              <button aria-label="Delete answer" onClick={() => save(answers.filter(x => x.id !== a.id))} className="rounded-md p-1 text-faint hover:bg-bad-soft hover:text-bad">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
          {editing === a.id ? (
            <div className="mt-2 flex gap-2">
              <Input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && (save(answers.map(x => (x.id === a.id ? { ...x, answer: draft, updatedAt: new Date().toISOString() } : x))), setEditing(null))} />
              <Button
                variant="primary"
                icon={<Check className="size-4" />}
                onClick={() => {
                  save(answers.map(x => (x.id === a.id ? { ...x, answer: draft, updatedAt: new Date().toISOString() } : x)));
                  setEditing(null);
                }}
              >
                Save
              </Button>
            </div>
          ) : (
            <button onClick={() => (setEditing(a.id), setDraft(a.answer))} className="mt-1 w-full text-left text-[13.5px] text-ink-2 hover:text-ink">
              {a.answer}
              <span className="ml-2 text-[11.5px] text-faint">· edited {timeAgo(a.updatedAt)}</span>
            </button>
          )}
        </Card>
      ))}
    </div>
  );
}
