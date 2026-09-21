import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { commentSchema } from '../../lib/schemas';
import { useMembers, useMyRole, useStatuses } from '../spaces/hooks';
import { useActivity, useAddComment, useComments, useTask, useUpdateTask } from './hooks';
import { Button, ErrorBox, Field, Input, Loading, PriorityBadge, Select, StatusDot, Textarea } from '../../components/ui';
import { can, copyText, fmtDateTime } from '../../lib/utils';
import { useAuth } from '../../lib/auth';

export function TaskDetailPage() {
  const { spaceId, taskId } = useParams();
  const { data: task, isLoading, error, refetch } = useTask(taskId);
  const { data: role } = useMyRole(spaceId);
  const { data: statuses } = useStatuses(spaceId);
  const { data: members } = useMembers(spaceId);
  const update = useUpdateTask();
  const { user } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (!task) return <ErrorBox message="Task not found." />;

  const canEditAll = role === 'owner' || role === 'lead';
  const canEditOwn = canEditAll || (role === 'member' && (task.creator_id === user?.id || task.assignee_id === user?.id));
  const canChangeStatus = role !== 'viewer';

  const save = async (patch: Parameters<typeof update.mutateAsync>[0]) => {
    setErr(null); setMsg(null);
    try { await update.mutateAsync(patch); setMsg('Saved.'); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <div>
      <p className="text-xs text-muted"><Link to={`/spaces/${spaceId}/tasks`} className="no-underline">← Back to tasks</Link></p>
      <h1 className="text-lg font-semibold mt-1"><span className="font-mono text-sm text-muted">{task.key}</span> · {task.title}</h1>
      {msg && <p className="text-xs text-accent mt-1" role="status">{msg}</p>}
      {err && <p className="error-text" role="alert">{err}</p>}

      <div className="grid md:grid-cols-3 gap-3 mt-3">
        <div className="md:col-span-2">
          <div className="card p-4">
            <h2 className="text-sm font-semibold">Details</h2>
            {task.status && <p className="mt-1"><StatusDot color={task.status.color} label={`${task.status.name} (${task.status.category})`} /></p>}
            <p className="text-sm mt-2 whitespace-pre-wrap">{task.description || <span className="text-muted">No description.</span>}</p>
            <p className="text-xs text-muted mt-2">
              Priority: <PriorityBadge priority={task.priority} /> · Assignee: {task.assignee?.display_name ?? 'Unassigned'} ·
              Due: {task.due_date ?? '—'} {task.is_blocked ? `· Blocked: ${task.blocker_reason || 'no reason given'}` : ''}
            </p>
            <p className="text-xs text-muted mt-1">
              Created {fmtDateTime(task.created_at)} · Updated {fmtDateTime(task.updated_at)} ·
              Completed: {fmtDateTime(task.completed_at)} · Archived: {task.archived_at ? fmtDateTime(task.archived_at) : 'no'}
            </p>

            {canEditOwn && (
              <EditForm
                key={task.updated_at}
                initial={{ title: task.title, description: task.description, priority: task.priority, due_date: task.due_date ?? '', git_branch: task.git_branch ?? '', pr_url: task.pr_url ?? '', blocker_reason: task.blocker_reason }}
                onSave={(v) => save({
                  task_id: task.id, title: v.title, description: v.description, priority: v.priority,
                  ...(v.due_date ? { due_date: v.due_date } : { clear_due: true }),
                  ...(v.git_branch ? { git_branch: v.git_branch } : { clear_branch: true }),
                  ...(v.pr_url ? { pr_url: v.pr_url } : { clear_pr: true }),
                  blocker_reason: v.blocker_reason,
                })}
              />
            )}
          </div>

          <div className="card p-4 mt-3">
            <h2 className="text-sm font-semibold">Status & assignment</h2>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              <div>
                <label className="label" htmlFor="d-status">Status</label>
                <Select id="d-status" value={task.status_id} disabled={!canChangeStatus || update.isPending}
                  onChange={(e) => save({ task_id: task.id, status_id: e.target.value })}>
                  {(statuses ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="d-assignee">Assignee</label>
                <Select id="d-assignee" value={task.assignee_id ?? ''} disabled={!canChangeStatus || update.isPending}
                  onChange={(e) => save(e.target.value ? { task_id: task.id, assignee_id: e.target.value } : { task_id: task.id, clear_assignee: true })}>
                  <option value="">Unassigned</option>
                  {(members ?? []).map((m) => (
                    <option key={m.user_id} value={m.user_id}>{(m.profile as unknown as { display_name?: string })?.display_name ?? m.user_id.slice(0, 8)}</option>
                  ))}
                </Select>
              </div>
            </div>
            {canEditOwn && (
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={task.is_blocked} onChange={(e) => save({ task_id: task.id, is_blocked: e.target.checked })} /> Blocked
                </label>
                <Button disabled={update.isPending} onClick={() => save({ task_id: task.id, archive: !task.archived_at })}>
                  {task.archived_at ? 'Unarchive' : 'Archive'}
                </Button>
              </div>
            )}
          </div>

          <GitPanel task={task} canEdit={canEditOwn} onSave={(p) => save({ task_id: task.id, ...p })} />

          <CommentsPanel taskId={task.id} canComment={role === 'owner' || role === 'lead' || role === 'member'} />
        </div>

        <div>
          <ActivityPanel taskId={task.id} />
        </div>
      </div>
    </div>
  );
}

function EditForm({ initial, onSave }: {
  initial: { title: string; description: string; priority: string; due_date: string; git_branch: string; pr_url: string; blocker_reason: string };
  onSave: (v: { title: string; description: string; priority: string; due_date: string; git_branch: string; pr_url: string; blocker_reason: string }) => void;
}) {
  const [v, setV] = useState(initial);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));
  return (
    <div className="mt-3 border-t border-charcoal-700 pt-3">
      <div className="grid gap-2">
        <div><label className="label">Title</label><Input value={v.title} onChange={set('title')} /></div>
        <div><label className="label">Description</label><Textarea rows={3} value={v.description} onChange={set('description')} /></div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div><label className="label">Priority</label>
            <Select value={v.priority} onChange={set('priority')}>
              {['Low', 'Normal', 'High', 'Urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <div><label className="label">Due date</label><Input type="date" value={v.due_date} onChange={set('due_date')} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div><label className="label">Git branch</label><Input value={v.git_branch} onChange={set('git_branch')} /></div>
          <div><label className="label">PR URL</label><Input value={v.pr_url} onChange={set('pr_url')} /></div>
        </div>
        <div><label className="label">Blocker reason</label><Input value={v.blocker_reason} onChange={set('blocker_reason')} /></div>
        <Button variant="primary" onClick={() => onSave(v)}>Save changes</Button>
      </div>
    </div>
  );
}

function GitPanel({ task, canEdit, onSave }: {
  task: import('../../lib/database.types').Task; canEdit: boolean;
  onSave: (p: { git_branch?: string; clear_branch?: boolean; pr_url?: string; clear_pr?: boolean }) => void;
}) {
  const [branch, setBranch] = useState(task.git_branch ?? '');
  const [pr, setPr] = useState(task.pr_url ?? '');
  return (
    <div className="card p-4 mt-3">
      <h2 className="text-sm font-semibold">Git info <span className="text-muted font-normal">(optional, manual entry)</span></h2>
      <div className="mt-2 text-sm space-y-1">
        <p>Branch: <code className="font-mono text-xs">{task.git_branch ?? '—'}</code>
          {task.git_branch && <button className="btn ml-2 !px-2 !py-0.5 text-xs" onClick={() => copyText(task.git_branch!)}>Copy</button>}
        </p>
        <p>PR: {task.pr_url ? <><a href={task.pr_url} target="_blank" rel="noreferrer">Open PR ↗</a>
          <button className="btn ml-2 !px-2 !py-0.5 text-xs" onClick={() => copyText(task.pr_url!)}>Copy</button></> : '—'}
        </p>
      </div>
      {canEdit && (
        <div className="grid sm:grid-cols-2 gap-2 mt-2">
          <div><label className="label">Branch</label><Input value={branch} onChange={(e) => setBranch(e.target.value)} /></div>
          <div><label className="label">PR URL</label><Input value={pr} onChange={(e) => setPr(e.target.value)} /></div>
          <div className="sm:col-span-2">
            <Button onClick={() => onSave({ git_branch: branch || undefined, clear_branch: !branch ? true : undefined, pr_url: pr || undefined, clear_pr: !pr ? true : undefined })}>
              Save git info
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentsPanel({ taskId, canComment }: { taskId: string; canComment: boolean }) {
  const { data, isLoading } = useComments(taskId);
  const add = useAddComment();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<{ body: string }>({ resolver: zodResolver(commentSchema) });
  return (
    <div className="card p-4 mt-3">
      <h2 className="text-sm font-semibold">Comments & progress updates</h2>
      {isLoading ? <Loading /> : !data?.length ? <p className="text-xs text-muted mt-1">No comments yet.</p> : (
        <ul className="mt-2 space-y-2">
          {data.map((c) => (
            <li key={c.id} className="border-t border-charcoal-800 pt-2">
              <p className="text-xs text-muted">{c.author?.display_name ?? 'Someone'} · {fmtDateTime(c.created_at)}</p>
              <p className="text-sm whitespace-pre-wrap mt-0.5">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {canComment && (
        <form
          className="mt-3"
          onSubmit={handleSubmit(async (v) => {
            setErr(null);
            try { await add.mutateAsync({ task_id: taskId, body: v.body }); reset(); }
            catch (e) { setErr((e as Error).message); }
          })}
        >
          <Field label="Add update" error={formState.errors.body?.message}>
            <Textarea rows={2} {...register('body')} placeholder="Progress, context, next steps…" />
          </Field>
          {err && <p className="error-text" role="alert">{err}</p>}
          <Button variant="primary" disabled={add.isPending}>{add.isPending ? 'Posting…' : 'Post update'}</Button>
        </form>
      )}
    </div>
  );
}

function ActivityPanel({ taskId }: { taskId: string }) {
  const { data, isLoading } = useActivity(taskId);
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold">Activity timeline</h2>
      {isLoading ? <Loading /> : !data?.length ? <p className="text-xs text-muted mt-1">No activity.</p> : (
        <ul className="mt-2 space-y-2">
          {data.map((a) => (
            <li key={a.id} className="text-xs border-t border-charcoal-800 pt-1.5">
              <p className="font-medium">{label(a)}</p>
              <p className="text-muted">{a.actor?.display_name ?? 'System'} · {fmtDateTime(a.created_at)}</p>
              {detail(a) && <p className="text-muted mt-0.5 break-words">{detail(a)}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function label(a: import('../../lib/database.types').TaskActivity): string {
  switch (a.action) {
    case 'created': return 'Created';
    case 'status_changed': return 'Status changed';
    case 'completed': return 'Completed';
    case 'reopened': return 'Reopened (completion cleared, history preserved)';
    case 'blocked': return 'Marked blocked';
    case 'unblocked': return 'Unblocked';
    case 'archived': return 'Archived';
    case 'unarchived': return 'Unarchived';
    default: return a.field_name ? `Updated ${a.field_name}` : a.action;
  }
}

function detail(a: import('../../lib/database.types').TaskActivity): string {
  try {
    const o = a.old_value as { label?: string } | null;
    const n = a.new_value as { label?: string } | null;
    if (o && typeof o === 'object' && n && typeof n === 'object' && ('label' in o || 'label' in n)) {
      return `${(o as { label?: string }).label ?? JSON.stringify(o)} → ${(n as { label?: string }).label ?? JSON.stringify(n)}`;
    }
    if (a.old_value != null || a.new_value != null) {
      const s = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
      if (a.old_value != null && a.new_value != null) return `${s(a.old_value)} → ${s(a.new_value)}`;
      return s(a.new_value ?? a.old_value);
    }
  } catch { /* ignore */ }
  return '';
}
