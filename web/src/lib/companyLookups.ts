// Companies being looked up in the background, so you can keep adding while Talaria works out
// where each one posts jobs. A lookup outlives the screen it started on: if you've moved on by
// the time it finds the company, the company is saved for you.

import { create } from 'zustand';
import type { TargetCompany } from '@shared/types';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';

export type Lookup = {
  id: string;
  label: string; // what you typed, or the suggestion's name
  input: string;
  state: 'working' | 'found' | 'failed';
  note?: string; // "Workday · 23 open" once found, or why it failed
  company?: TargetCompany;
};

export const useLookups = create<{ items: Lookup[] }>(() => ({ items: [] }));

// How long a found company stays green before joining the list.
const CELEBRATE_MS = 1400;

let deliver: ((company: TargetCompany) => void) | null = null;

/** The sources editor on screen takes found companies; with none on screen, they're saved directly. */
export function receiveCompanies(fn: (company: TargetCompany) => void) {
  deliver = fn;
  return () => {
    if (deliver === fn) deliver = null;
  };
}

const sameCompany = (a: TargetCompany, b: TargetCompany) => a.ats === b.ats && a.slug === b.slug;

function hand(company: TargetCompany) {
  if (deliver) return deliver(company);
  const current = useApp.getState().preferences?.targetCompanies || [];
  api.put('/api/preferences', { targetCompanies: [...current.filter(c => !sameCompany(c, company)), company] }, { quiet: true }).catch(() => {});
}

const update = (id: string, patch: Partial<Lookup>) => useLookups.setState(s => ({ items: s.items.map(x => (x.id === id ? { ...x, ...patch } : x)) }));
export const dismissLookup = (id: string) => useLookups.setState(s => ({ items: s.items.filter(x => x.id !== id) }));

/** Start looking a company up; returns at once. Nothing happens if it's already being looked up. */
export function lookUpCompany(input: string, name?: string) {
  const label = (name || input).trim();
  if (!label || useLookups.getState().items.some(x => x.state !== 'failed' && x.label.toLowerCase() === label.toLowerCase())) return;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  useLookups.setState(s => ({ items: [...s.items.filter(x => x.label.toLowerCase() !== label.toLowerCase()), { id, label, input, state: 'working' }] }));
  api
    .post<{ company: TargetCompany; count: number; platform: string }>('/api/preferences/resolve-company', { input, name }, { quiet: true })
    .then(r => {
      if (!useLookups.getState().items.some(x => x.id === id)) return; // dismissed while it was looking
      const c = r.company;
      update(id, { state: 'found', company: c, label: c.name, note: c.ats === 'site' ? 'own careers site' : `${r.platform} · ${r.count} open` });
      setTimeout(() => {
        dismissLookup(id);
        hand(c);
      }, CELEBRATE_MS);
    })
    .catch((err: Error) => update(id, { state: 'failed', note: err.message }));
}
