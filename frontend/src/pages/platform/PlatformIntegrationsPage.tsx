import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';

type Settings = { publicBaseUrl: string; webhookSecretMasked: string; demoAutoComplete: boolean };

export function PlatformIntegrationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['platform-payment-settings'],
    queryFn: async () => (await api.get<Settings>('/api/v1/platform/payment-settings')).data,
  });
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      await api.put('/api/v1/platform/payment-settings', {
        publicBaseUrl: publicBaseUrl || undefined,
        webhookSecret: webhookSecret || undefined,
        demoAutoComplete: demoAuto,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-payment-settings'] });
      setWebhookSecret('');
      toast.success('Saved', 'Payment settings updated.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const [demoAuto, setDemoAuto] = useState(false);

  useEffect(() => {
    if (q.data) {
      setPublicBaseUrl(q.data.publicBaseUrl);
      setDemoAuto(q.data.demoAutoComplete);
    }
  }, [q.data]);

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Payment integrations</h2>
        <Link className="muted" to="/app">
          ← Platform dashboard
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Configure webhook base URL and secrets used by the in-process payment gateway. Values apply immediately for new fee orders.
      </p>
      {q.isLoading ? (
        <div className="muted">Loading…</div>
      ) : q.isError ? (
        <div style={{ color: '#b91c1c' }}>{String((q.error as any)?.response?.data ?? q.error)}</div>
      ) : (
        <div className="card stack">
          <div className="muted" style={{ fontSize: 13 }}>
            Current webhook (masked): <code>{q.data?.webhookSecretMasked}</code>
          </div>
          <label>Public base URL</label>
          <input value={publicBaseUrl} onChange={(e) => setPublicBaseUrl(e.target.value)} />
          <label>New webhook secret (leave blank to keep)</label>
          <input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} type="password" autoComplete="off" />
          <label className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={demoAuto} onChange={(e) => setDemoAuto(e.target.checked)} />
            Demo auto-complete synthetic payments
          </label>
          <button className="btn" type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
