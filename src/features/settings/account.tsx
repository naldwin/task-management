import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button, Empty, ErrorBox, Field, Input, Loading } from '../../components/ui';
import { LogoutIcon, SaveIcon } from '../../components/icons';
import { useMyInvitations } from '../invitations/hooks';
import { InvitationList } from '../invitations/pages';
import { useSpaces } from '../spaces/hooks';

export function AccountPage() {
  return <ProfilePage />;
}

function initials(name: string, email: string): string {
  const base = (name || '').trim() || (email || '').split('@')[0] || '?';
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const invites = useMyInvitations();
  const { data: spaces } = useSpaces();

  // Profile loads asynchronously after session restore — sync the field once it arrives.
  useEffect(() => {
    if (profile?.display_name !== undefined) setName((cur) => (cur === '' ? profile.display_name : cur));
  }, [profile?.display_name]);

  const email = profile?.email ?? user?.email ?? '';
  const savedName = profile?.display_name ?? '';
  const trimmed = name.trim();
  const dirty = trimmed !== savedName.trim();
  const nameError = !trimmed ? 'Display name is required.' : trimmed.length > 80 ? 'Keep it under 80 characters.' : null;
  const activeSpaces = (spaces ?? []).filter((s) => !s.is_archived).length;
  const inviteCount = invites.data?.length ?? 0;

  const save = async () => {
    setErr(null);
    setMsg(null);
    if (!user || nameError || !dirty) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) setErr(error.message);
      else {
        await refreshProfile();
        setMsg('Saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">Profile</h1>
      <p className="text-sm text-muted">Your identity and space invitations.</p>

      <div className="mt-3 grid gap-3 items-start lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-charcoal-800 border border-charcoal-600 text-sm font-semibold text-slate-100"
            >
              {initials(savedName, email)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" title={savedName || email}>{savedName || 'Member'}</p>
              <p className="text-xs text-muted truncate" title={email}>{email}</p>
            </div>
          </div>
          <p className="text-xs text-muted mt-2">
            Member of {activeSpaces} space{activeSpaces === 1 ? '' : 's'}.
          </p>
          <div className="mt-3">
            <Field label="Display name" error={nameError ?? undefined}>
              <Input
                value={name}
                maxLength={80}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setName(e.target.value); setMsg(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
                placeholder="Your name"
                aria-describedby="profile-email"
              />
            </Field>
            <p id="profile-email" className="text-xs text-muted -mt-2 mb-3">
              Email <span className="font-mono">{email || '—'}</span> can’t be changed here.
            </p>
            <div aria-live="polite">
              {msg && <p className="text-xs text-accent" role="status">{msg}</p>}
              {err && <p className="error-text" role="alert">{err}</p>}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Button variant="primary" disabled={!dirty || !!nameError || saving} icon={<SaveIcon className="h-4 w-4" />} onClick={() => void save()}>
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </Button>
              <Button onClick={() => void signOut().then(() => nav('/login'))} icon={<LogoutIcon className="h-4 w-4" />}>Log out</Button>
            </div>
          </div>
        </div>

        <section aria-labelledby="profile-invitations-heading" id="invitations" className="card p-4 scroll-mt-4 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id="profile-invitations-heading" className="text-sm font-semibold">Invitations</h2>
            {inviteCount > 0 && <span className="badge border-accent text-accent">{inviteCount} pending</span>}
          </div>
          <p className="text-xs text-muted mt-0.5">Spaces you’ve been invited to. Accept or decline — accepted spaces appear under Spaces.</p>
          <div className="mt-3">
            {invites.isLoading ? <Loading /> : invites.error ? (
              <ErrorBox message={(invites.error as Error).message} onRetry={() => invites.refetch()} />
            ) : !invites.data?.length ? (
              <Empty title="No pending invitations" hint="New invites to this email will show up here." />
            ) : (
              <InvitationList rows={invites.data} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
