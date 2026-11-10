// A one-time notice for people who set Talaria up with Hermes Agent: Talaria no longer needs it,
// and one click removes it. Closing the notice in any way counts as the answer; it never comes back.

import * as React from 'react';
import { Check, HardDrive, Loader, Trash2, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Dialog } from '@/components/ui';

type Offer = { show: boolean; home?: string; sizeBytes?: number };
type Result = { ok: boolean; freedBytes: number; message: string; leftover?: string };

const size = (bytes = 0) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`);

export function HermesCleanup() {
  const [offer, setOffer] = React.useState<Offer | null>(null);
  const [open, setOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);

  React.useEffect(() => {
    api
      .get<Offer>('/api/hermes-cleanup', { quiet: true })
      .then(o => {
        setOffer(o);
        setOpen(o.show);
      })
      .catch(() => {});
  }, []);

  const close = () => {
    if (removing) return;
    setOpen(false);
    if (!result) api.post('/api/hermes-cleanup/dismiss', {}, { quiet: true }).catch(() => {});
  };

  const remove = async () => {
    setRemoving(true);
    try {
      setResult(await api.post<Result>('/api/hermes-cleanup/remove', {}, { quiet: true }));
    } catch (err: any) {
      setResult({ ok: false, freedBytes: 0, message: err?.message || 'Something went wrong.' });
    }
    setRemoving(false);
  };

  if (!offer?.show) return null;

  return (
    <Dialog open={open} onOpenChange={v => (v ? setOpen(true) : close())} title={result ? (result.ok ? 'Hermes Agent is removed' : 'Almost done') : 'Talaria doesn’t need Hermes Agent anymore'}>
      {result ? (
        <div className="mt-3 space-y-4">
          <div className={result.ok ? 'flex items-start gap-3 text-[13.5px] leading-relaxed text-ink' : 'flex items-start gap-3 bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed text-ink'}>
            {result.ok ? <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={3} /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />}
            <span>
              {result.ok ? `${size(result.freedBytes)} freed. Talaria keeps working exactly as before.` : result.message}
              {!result.ok && result.freedBytes > 0 && ` ${size(result.freedBytes)} freed so far.`}
            </span>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-4 text-[13.5px] leading-relaxed text-muted">
          <p>
            Talaria now talks to your AI account itself, so <strong className="font-semibold text-ink">Hermes Agent</strong>, the separate AI program it used to need, isn't used anymore. Your sign-ins have already been moved into Talaria, so nothing changes in how Talaria works.
          </p>
          <div className="flex items-center gap-2.5 border border-line bg-card px-3 py-2.5 text-[13px] text-ink">
            <HardDrive className="size-4 shrink-0 text-faint" />
            <span className="min-w-0 flex-1">
              Removing it frees about <strong className="font-semibold">{size(offer.sizeBytes)}</strong>
              {offer.home && <span className="block text-[12px] break-all text-faint">{offer.home}</span>}
            </span>
          </div>
          <p className="text-[12.5px]">This removes Hermes Agent completely, including its own settings and chat history. If you use Hermes Agent for anything besides Talaria, keep it.</p>
          <p className="text-[12.5px] text-faint">You'll only see this once. You can always remove it later yourself.</p>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button variant="ghost" disabled={removing} onClick={close}>
              Keep it
            </Button>
            <Button variant="primary" loading={removing} icon={<Trash2 className="size-4" />} onClick={remove}>
              {removing ? 'Removing, this can take a minute…' : 'Remove Hermes Agent'}
            </Button>
          </div>
        </div>
      )}
      {removing && (
        <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-faint">
          <Loader className="size-3 animate-spin" /> Keep Talaria open until this finishes.
        </div>
      )}
    </Dialog>
  );
}
