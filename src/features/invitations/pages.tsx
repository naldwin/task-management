import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { inviteSchema } from '../../lib/schemas';
import { useMembers, useMyRole } from '../spaces/hooks';
import { useRevokeInvitation, useInviteUser, useSpaceInvitations } from './hooks';
import { useAuth } from '../../lib/auth';
import { Button, Empty, ErrorBox, Field, Input, Loading, Select } from '../../components/ui';
import { CheckIcon, CloseIcon, SendIcon, TrashIcon } from '../../components/icons';
import { can } from '../../lib/utils';

export function InvitationsPage() {
  return (
    <div>
      <MyInvitations />
    </div>
  );
}

export function MyInvitations() {
  const { data, isLoading, error, refetch } = useMyInvitationsList();
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  return (
    <div>
      <h1 className="text-lg font-semibold">Invitations</h1>
      <p className="text-sm text-muted">Spaces you have been invited to. Accept or decline.</p>
      <div className="mt-3">
        {!data?.length ? <Empty title="No pending invitations" /> : <InvitationList rows={data} />}
      </div>
    </div>
  );
}

// re-export hooks with local names to avoid circular import confusion
import { useMyInvitations as useMyInvitationsList, useRespondInvitation } from './hooks';

export function InvitationList({ rows }: { rows: import('../../lib/database.types').Invitation[] }) {
  const respond = useRespondInvitation();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card overflow-x-auto">
      {err && <p className="error-text p-2" role="alert">{err}</p>}
      <table className="w-full table-compact">
        <thead><tr><th>Space</th><th>Role offered</th><th>Invited by</th><th>Date</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.space?.name ?? r.space_id.slice(0, 8)}</td>
              <td>{r.role}</td>
              <td className="text-muted">{r.inviter?.display_name ?? '—'}</td>
              <td className="text-muted">{new Date(r.created_at).toLocaleDateString()}</td>
              <td className="whitespace-nowrap">
                <Button
                  variant="primary" className="mr-2"
                  disabled={respond.isPending}
                  icon={<CheckIcon className="h-4 w-4" />}
                  onClick={() => respond.mutateAsync({ id: r.id, accept: true }).catch((e) => setErr((e as Error).message))}
                >
                  Accept
                </Button>
                <Button
                  disabled={respond.isPending}
                  icon={<CloseIcon className="h-4 w-4" />}
                  onClick={() => respond.mutateAsync({ id: r.id, accept: false }).catch((e) => setErr((e as Error).message))}
                >
                  Decline
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SpaceInvitePanel({ spaceId }: { spaceId: string }) {
  const { data: role } = useMyRole(spaceId);
  const { data: members } = useMembers(spaceId);
  const { data: pending, isLoading } = useSpaceInvitations(spaceId);
  const invite = useInviteUser(spaceId);
  const revoke = useRevokeInvitation(spaceId);
  const { user } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<{ email: string; role: 'member' | 'viewer' | 'lead' | 'owner' }>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member' },
  });

  if (!can('invite', role)) return null;
  const allowedRoles = role === 'owner' ? ['member', 'viewer', 'lead', 'owner'] : ['member', 'viewer'];
  const myMembership = members?.find((m) => m.user_id === user?.id);

  return (
    <div className="card p-4 mt-3">
      <h2 className="text-sm font-semibold">Invite by email</h2>
      <p className="text-xs text-muted">No email is sent. The recipient sees it under Invitations. {role !== 'owner' && 'Leads cannot invite owners or leads.'}</p>
      <form
        className="mt-2 flex flex-col sm:flex-row gap-2"
        onSubmit={handleSubmit(async (v) => {
          setServerError(null);
          if (!allowedRoles.includes(v.role)) { setServerError('Your role cannot invite that role.'); return; }
          try { await invite.mutateAsync(v); reset(); }
          catch (e) { setServerError((e as Error).message); }
        })}
      >
        <div className="flex-1">
          <Field label="Email" error={formState.errors.email?.message}>
            <Input type="email" placeholder="teammate@example.com" {...register('email')} />
          </Field>
        </div>
        <div>
          <Field label="Role">
            <Select {...register('role')}>
              {allowedRoles.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex items-end pb-3">
          <Button variant="primary" disabled={invite.isPending} icon={<SendIcon className="h-4 w-4" />}>{invite.isPending ? 'Inviting…' : 'Invite'}</Button>
        </div>
      </form>
      {serverError && <p className="error-text" role="alert">{serverError}</p>}
      {myMembership && <p className="hidden">{myMembership.role}</p>}

      <h3 className="text-sm font-semibold mt-3">Pending invitations</h3>
      {isLoading ? <Loading /> : !pending?.length ? (
        <p className="text-xs text-muted mt-1">None pending.</p>
      ) : (
        <table className="w-full table-compact mt-1">
          <thead><tr><th>Email</th><th>Role</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {pending.map((p) => (
              <tr key={p.id}>
                <td>{p.email}</td><td>{p.role}</td>
                <td className="text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                <td><Button disabled={revoke.isPending} icon={<TrashIcon className="h-4 w-4" />} onClick={() => revoke.mutate(p.id)}>Revoke</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
