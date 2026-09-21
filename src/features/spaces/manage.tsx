import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router-dom';
import { statusSchema } from '../../lib/schemas';
import { useMembers, useMyRole, useSpace, useStatuses, useCreateStatus, useUpdateStatus, useRetireStatus, useChangeRole, useRemoveMember, useUpdateSpace } from './hooks';
import { SpaceInvitePanel } from '../invitations/pages';
import { Button, Empty, ErrorBox, Field, Input, Loading, Select, StatusDot } from '../../components/ui';
import { can } from '../../lib/utils';

export function SpaceMembersPage() {
  const { spaceId } = useParams();
  const { data: members, isLoading, error, refetch } = useMembers(spaceId);
  const { data: role } = useMyRole(spaceId);
  const change = useChangeRole();
  const remove = useRemoveMember();
  const [err, setErr] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div>
      <p className="text-xs text-muted"><Link to={`/spaces/${spaceId}/tasks`} className="no-underline">← Back to tasks</Link></p>
      <h1 className="text-lg font-semibold mt-1">Members</h1>
      {err && <p className="error-text" role="alert">{err}</p>}
      <div className="card mt-3 overflow-x-auto">
        <table className="w-full table-compact">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th>{role === 'owner' && <th></th>}</tr></thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id}>
                <td>{(m.profile as unknown as { display_name?: string })?.display_name ?? '—'}</td>
                <td className="text-muted">{(m.profile as unknown as { email?: string })?.email ?? '—'}</td>
                <td>
                  {role === 'owner' ? (
                    <Select
                      value={m.role}
                      onChange={(e) => change.mutateAsync({ space_id: spaceId!, user_id: m.user_id, role: e.target.value }).catch((ex) => setErr((ex as Error).message))}
                      aria-label={`Role for ${(m.profile as unknown as { display_name?: string })?.display_name}`}
                    >
                      {['owner', 'lead', 'member', 'viewer'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  ) : m.role}
                </td>
                {role === 'owner' && (
                  <td><Button disabled={remove.isPending} onClick={() => remove.mutateAsync({ space_id: spaceId!, user_id: m.user_id }).catch((ex) => setErr((ex as Error).message))}>Remove</Button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {spaceId && <SpaceInvitePanel spaceId={spaceId} />}
    </div>
  );
}

export function SpaceSettingsPage() {
  const { spaceId } = useParams();
  const { data: space, isLoading } = useSpace(spaceId);
  const { data: role } = useMyRole(spaceId);
  const { data: statuses } = useStatuses(spaceId);
  const updateSpace = useUpdateSpace();
  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();
  const retire = useRetireStatus();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<{ name: string; color: string; category: 'Not Started' | 'Active' | 'Done' | 'Cancelled' }>({
    resolver: zodResolver(statusSchema),
    defaultValues: { name: '', color: '#5b9bff', category: 'Active' },
  });

  if (isLoading) return <Loading />;
  if (!space) return <ErrorBox message="Space not found." />;
  const isOwner = role === 'owner';
  const canStatus = can('manage-status', role);

  const saveSpace = async () => {
    setErr(null); setMsg(null);
    try {
      await updateSpace.mutateAsync({
        id: space.id,
        ...(name !== null ? { name } : {}),
        ...(desc !== null ? { description: desc } : {}),
        ...(tz !== null ? { timezone: tz } : {}),
      });
      setMsg('Space saved.');
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div>
      <p className="text-xs text-muted"><Link to={`/spaces/${space.id}/tasks`} className="no-underline">← Back to tasks</Link></p>
      <h1 className="text-lg font-semibold mt-1">Space settings</h1>

      <div className="card p-4 mt-3">
        <h2 className="text-sm font-semibold">General</h2>
        {err && <p className="error-text" role="alert">{err}</p>}
        {msg && <p className="text-xs text-accent" role="status">{msg}</p>}
        <div className="grid sm:grid-cols-2 gap-2 mt-2">
          <div><label className="label">Name</label><Input defaultValue={space.name} disabled={!isOwner} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label">Reporting timezone</label><Input defaultValue={space.timezone} disabled={!isOwner} onChange={(e) => setTz(e.target.value)} placeholder="UTC" /></div>
        </div>
        <div className="mt-2"><label className="label">Description</label><Input defaultValue={space.description} disabled={!isOwner} onChange={(e) => setDesc(e.target.value)} /></div>
        <p className="text-xs text-muted mt-1">Prefix <span className="font-mono">{space.prefix}</span> cannot be changed (task keys must stay stable).</p>
        {isOwner && (
          <div className="mt-2 flex gap-2">
            <Button variant="primary" onClick={saveSpace}>Save</Button>
            <Button
              variant={space.is_archived ? 'default' : 'danger'}
              onClick={() => updateSpace.mutateAsync({ id: space.id, is_archived: !space.is_archived }).then(() => setMsg(space.is_archived ? 'Unarchived.' : 'Archived.')).catch((e) => setErr((e as Error).message))}
            >
              {space.is_archived ? 'Unarchive space' : 'Archive space'}
            </Button>
          </div>
        )}
      </div>

      <div className="card p-4 mt-3">
        <h2 className="text-sm font-semibold">Workflow statuses</h2>
        <p className="text-xs text-muted">Reporting categories drive dashboards. “In Review” stays Active; blocking is tracked separately.</p>
        {!statuses?.length ? <div className="mt-2"><Empty title="No statuses" /></div> : (
          <table className="w-full table-compact mt-2">
            <thead><tr><th>Order</th><th>Status</th><th>Category</th><th>Default</th>{canStatus && <th></th>}</tr></thead>
            <tbody>
              {statuses.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td><StatusDot color={s.color} label={s.name} /></td>
                  <td className="text-muted">{s.category}</td>
                  <td>{s.is_default ? 'Yes' : '—'}</td>
                  {canStatus && (
                    <td className="whitespace-nowrap">
                      <Button
                        className="mr-1" title="Move up"
                        onClick={() => updateStatus.mutateAsync({ id: s.id, space_id: space.id, position: Math.max(0, s.position - 1) }).catch((e) => setErr((e as Error).message))}
                      >↑</Button>
                      <Button
                        className="mr-1" title="Set as default start"
                        onClick={() => updateStatus.mutateAsync({ id: s.id, space_id: space.id, is_default: true }).catch((e) => setErr((e as Error).message))}
                      >Default</Button>
                      <RetireButton statusId={s.id} spaceId={space.id} others={(statuses ?? []).filter((o) => o.id !== s.id)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canStatus && (
          <form
            className="mt-3 flex flex-wrap gap-2 items-end"
            onSubmit={handleSubmit(async (v) => {
              setErr(null);
              try {
                await createStatus.mutateAsync({ space_id: space.id, name: v.name, color: v.color, category: v.category, position: (statuses ?? []).length });
                reset();
              } catch (e) { setErr((e as Error).message); }
            })}
          >
            <div><label className="label">Name</label><Input {...register('name')} placeholder="QA" /></div>
            <div><label className="label">Color</label><Input type="color" {...register('color')} /></div>
            <div><label className="label">Category</label>
              <Select {...register('category')}>
                {['Not Started', 'Active', 'Done', 'Cancelled'].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <Button variant="primary">Add status</Button>
            {formState.errors.name && <p className="error-text w-full">{formState.errors.name.message}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

function RetireButton({ statusId, spaceId, others }: { statusId: string; spaceId: string; others: Array<{ id: string; name: string }> }) {
  const retire = useRetireStatus();
  const [pick, setPick] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!confirming) return <Button onClick={() => setConfirming(true)}>Retire…</Button>;
  return (
    <span className="inline-flex items-center gap-1">
      <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Replacement status">
        <option value="">Replacement…</option>
        {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
      <Button
        variant="danger"
        disabled={!pick || retire.isPending}
        onClick={() => retire.mutateAsync({ status_id: statusId, replacement_id: pick }).then(() => setConfirming(false)).catch((e) => setErr((e as Error).message))}
      >Migrate</Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
      {err && <span className="error-text">{err}</span>}
      <span className="hidden">{spaceId}</span>
    </span>
  );
}
