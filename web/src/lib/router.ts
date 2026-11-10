import { useEffect, useState } from 'react';

export type View = 'board' | 'summary' | 'archive' | 'profile' | 'search' | 'activity' | 'settings';
const VIEWS: View[] = ['board', 'summary', 'archive', 'profile', 'search', 'activity', 'settings'];

export interface Route {
  view: View;
  jobId: string | null;
  tab: string | null;
  section: string | null; // a section of a page with its own address, e.g. #/settings?section=connections
}

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const params = new URLSearchParams(query);
  const view = (VIEWS.includes(path as View) ? path : 'board') as View;
  return { view, jobId: params.get('job'), tab: params.get('tab'), section: params.get('section') };
}

function build(r: Route) {
  const params = new URLSearchParams();
  if (r.jobId) params.set('job', r.jobId);
  if (r.jobId && r.tab) params.set('tab', r.tab);
  if (r.section) params.set('section', r.section);
  const q = params.toString();
  return `#/${r.view}${q ? `?${q}` : ''}`;
}

export function navigate(patch: Partial<Route>, replace = false) {
  const next = { ...parse(), ...patch };
  if (patch.view && patch.jobId === undefined) next.jobId = null;
  if (patch.view && patch.section === undefined) next.section = null;
  const url = build(next);
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Keep the address in step with the section you scrolled to, without a history entry or a re-render. */
export function setSectionQuietly(section: string) {
  history.replaceState(null, '', build({ ...parse(), section }));
}

export const openJob = (id: string, tab?: string) => navigate({ jobId: id, tab: tab ?? null });
export const closeJob = () => navigate({ jobId: null, tab: null });

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return r;
}
