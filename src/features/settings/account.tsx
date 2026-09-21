import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button, Field, Input } from '../../components/ui';

export function AccountPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div>
      <h1 className="text-lg font-semibold">Account</h1>
      <div className="card p-4 mt-3 max-w-md">
        <Field label="Email"><Input value={profile?.email ?? user?.email ?? ''} disabled /></Field>
        <Field label="Display name">
          <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder={profile?.display_name ?? ''} />
        </Field>
        {msg && <p className="text-xs text-accent" role="status">{msg}</p>}
        {err && <p className="error-text" role="alert">{err}</p>}
        <div className="flex gap-2 mt-1">
          <Button
            variant="primary"
            onClick={async () => {
              setErr(null); setMsg(null);
              if (!user) return;
              const { error } = await supabase.from('profiles').update({ display_name: name.trim(), updated_at: new Date().toISOString() }).eq('id', user.id);
              if (error) setErr(error.message);
              else { await refreshProfile(); setMsg('Saved.'); }
            }}
          >
            Save
          </Button>
          <Button onClick={() => void signOut().then(() => nav('/login'))}>Log out</Button>
        </div>
        <p className="text-xs text-muted mt-3">
          Branding owner: <strong>nalds</strong>. Display names never grant permissions — only space membership roles do.
        </p>
      </div>
    </div>
  );
}
