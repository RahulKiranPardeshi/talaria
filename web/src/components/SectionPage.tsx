import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Save } from 'lucide-react';
import { setSectionQuietly, useRoute } from '@/lib/router';
import { cn } from '@/lib/utils';
import { Button } from './ui';

export type PageSection = { id: string; label: string };

const JumpContext = React.createContext<(id: string) => void>(() => {});
/** Scroll the page to one of its sections, from anywhere inside it (the live panel's links use this). */
export const useSectionJump = () => React.useContext(JumpContext);

/**
 * The shared shape of Profile, Job search and Settings: the page's sections listed on the left,
 * the form in the middle, and a live panel on the right. Every section has its own address
 * (?section=…), so a toast or another page can link straight to it.
 */
export function SectionPage({
  title,
  subtitle,
  sections,
  rail,
  children,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  sections: PageSection[];
  rail?: React.ReactNode;
  children: React.ReactNode;
}) {
  const route = useRoute();
  const scroller = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(sections[0]?.id);
  const activeRef = React.useRef(active);
  const jumping = React.useRef<number | null>(null);
  const ids = sections.map(s => s.id).join();

  const mark = (id: string) => {
    if (activeRef.current === id) return;
    activeRef.current = id;
    setActive(id);
    setSectionQuietly(id);
  };

  const jump = React.useCallback((id: string, smooth = true) => {
    const el = scroller.current?.querySelector<HTMLElement>(`#sec-${id}`);
    if (!el) return;
    mark(id);
    // While the smooth scroll runs, the scroll listener would light up every section it passes.
    if (jumping.current) clearTimeout(jumping.current);
    jumping.current = window.setTimeout(() => (jumping.current = null), smooth ? 700 : 50);
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arriving from a link to a section: go there.
  React.useEffect(() => {
    if (!route.section) return;
    const id = route.section;
    requestAnimationFrame(() => jump(id, false));
  }, [route.section, jump]);

  // Light up the section you're reading.
  React.useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const on = () => {
      if (jumping.current) return;
      const line = root.getBoundingClientRect().top + 140;
      let cur = sections[0]?.id;
      for (const s of sections) {
        const el = root.querySelector(`#sec-${s.id}`);
        if (el && el.getBoundingClientRect().top <= line) cur = s.id;
      }
      if (root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 4) cur = sections[sections.length - 1]?.id;
      if (cur) mark(cur);
    };
    root.addEventListener('scroll', on, { passive: true });
    return () => root.removeEventListener('scroll', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return (
    <JumpContext.Provider value={jump}>
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-7 pt-6 pb-4">
        <h1 className="font-display text-[27px] leading-none tracking-[-0.015em] text-ink">{title}</h1>
        <p className="mt-2 text-[13.5px] text-muted">{subtitle}</p>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-7 pb-28">
        {/* Narrow windows: the sections become a strip you can scroll sideways. */}
        <nav aria-label="Sections" className="sticky top-0 z-10 -mx-7 mb-4 flex gap-1 overflow-x-auto bg-bg/90 px-7 py-2 backdrop-blur lg:hidden">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              className={cn('h-7 shrink-0 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors', active === s.id ? 'bg-card text-ink shadow-card' : 'text-muted hover:text-ink-2')}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="flex items-start gap-8">
          <nav aria-label="Sections" className="sticky top-1 hidden w-[164px] shrink-0 flex-col pt-1 lg:flex">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                aria-current={active === s.id ? 'true' : undefined}
                className={cn(
                  'relative py-1.5 pl-3.5 text-left text-[13px] transition-colors',
                  active === s.id ? 'font-medium text-ink' : 'text-muted hover:text-ink-2',
                )}
              >
                <span className={cn('absolute inset-y-1 left-0 w-[2px] rounded-full transition-colors', active === s.id ? 'bg-ink' : 'bg-line')} />
                {s.label}
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
            <div className="min-w-0 flex-1 space-y-9">{children}</div>
            {rail && <aside className="order-first space-y-3 xl:sticky xl:top-1 xl:order-last xl:w-[300px] xl:shrink-0 2xl:w-[340px]">{rail}</aside>}
          </div>
        </div>
      </div>
    </div>
    </JumpContext.Provider>
  );
}

/** One section of a SectionPage, with its own address. */
export function PageSectionBlock({ id, title, desc, action, children }: { id: string; title: React.ReactNode; desc?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={`sec-${id}`} className="scroll-mt-3">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {desc && <p className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-muted">{desc}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** A card in the right-hand live panel. */
export function RailCard({ title, children, className }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-card p-4 shadow-card', className)}>
      {title && <div className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">{title}</div>}
      {children}
    </div>
  );
}

/** Long text pages keep an explicit save; this is the bar that appears once something changed. */
export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  // Closing or reloading the window with unsaved edits asks first.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
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

/** A small status line for the live panel: a coloured dot, what it is, and what's going on. */
export function StatusLine({ tone, title, detail, onClick }: { tone: 'ok' | 'warn' | 'bad' | 'off'; title: React.ReactNode; detail?: React.ReactNode; onClick?: () => void }) {
  const dot = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', off: 'bg-faint' }[tone];
  const body = (
    <>
      <span className={cn('mt-[5px] size-2 shrink-0 rounded-full', dot)} />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">{title}</span>
        {detail && <span className="block text-[12px] leading-snug text-muted">{detail}</span>}
      </span>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="-mx-2 flex w-[calc(100%+16px)] items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-ink/[0.04]">
      {body}
    </button>
  ) : (
    <div className="flex items-start gap-2.5 py-1.5">{body}</div>
  );
}
