import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskSchema, type TaskInput } from '../../lib/schemas';
import { useMembers, useMyRole, useSpace, useStatuses } from '../spaces/hooks';
import { useCreateTask, useTasks, useUpdateTask, type TaskFilter } from './hooks';
import { Button, Empty, ErrorBox, Field, Input, Loading, PriorityBadge, Select, StatusDot, Textarea } from '../../components/ui';
import { BoardIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, ExternalIcon, PlusIcon, TableIcon } from '../../components/icons';
import { CopyButton } from '../../components/copy-button';
import { can, fmtDate, taskCopyKey } from '../../lib/utils';

function useFilterFromUrl(): [TaskFilter, (patch: Partial<TaskFilter>) => void] {
  const [params, setParams] = useSearchParams();
  const f: TaskFilter = {
    q: params.get('q') ?? undefined,
    status: params.get('status') ?? undefined,
    assignee: params.get('assignee') ?? undefined,
    priority: params.get('priority') ?? undefined,
    blocked: params.get('blocked') ?? undefined,
    overdue: params.get('overdue') ?? undefined,
    archived: params.get('archived') ?? undefined,
    sort: params.get('sort') ?? undefined,
    view: params.get('view') ?? 'table',
    page: Number(params.get('page') ?? '1') || 1,
  };
  const set = (patch: Partial<TaskFilter>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || (k === 'page' && (v === 1 || v === undefined)) || (k === 'view' && v === 'table')) {
        next.delete(k);
      } else next.set(k, String(v));
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: false });
  };
  return [f, set];
}

export function SpaceTasksPage() {
  const { spaceId } = useParams();
  const [filter, setFilter] = useFilterFromUrl();
  const { data: space } = useSpace(spaceId);
  const { data: role } = useMyRole(spaceId);
  const { data: statuses } = useStatuses(spaceId);
  const { data: members } = useMembers(spaceId);
  const { data, isLoading, error, refetch } = useTasks(spaceId, filter);
  const [showCreate, setShowCreate] = useState(false);

  const editable = can('create-task', role);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">{space?.name ?? 'Space'} <span className="text-muted font-mono text-xs">{space?.prefix}</span></h1>
          <div className="text-xs text-muted flex gap-2">
            <Link to={`/spaces/${spaceId}/tasks`} className="no-underline">Tasks</Link>
            <Link to={`/spaces/${spaceId}/members`} className="no-underline">Members</Link>
            <Link to={`/spaces/${spaceId}/reports`} className="no-underline">Reports</Link>
            <Link to={`/spaces/${spaceId}/settings`} className="no-underline">Settings</Link>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={filter.view === 'board' ? 'default' : 'ghost'} onClick={() => setFilter({ view: filter.view === 'board' ? 'table' : 'board' })} icon={filter.view === 'board' ? <TableIcon className="h-4 w-4" /> : <BoardIcon className="h-4 w-4" />}>
            {filter.view === 'board' ? 'Table view' : 'Board view'}
          </Button>
          {editable && <Button variant="primary" onClick={() => setShowCreate((v) => !v)} icon={showCreate ? <CloseIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}>{showCreate ? 'Close' : 'New task'}</Button>}
        </div>
      </div>

      {showCreate && spaceId && (
        <CreateTaskForm spaceId={spaceId} onDone={() => setShowCreate(false)} />
      )}

      <FilterBar
        filter={filter} setFilter={setFilter}
        statuses={statuses ?? []} members={(members ?? []).map((m) => ({ id: m.user_id, name: (m.profile as { display_name?: string } | undefined)?.display_name ?? m.user_id.slice(0, 8) }))}
      />

      {isLoading ? <Loading /> : error ? <ErrorBox message={(error as Error).message} onRetry={() => refetch()} /> : !data?.rows.length ? (
        <div className="mt-3"><Empty title="No tasks match" hint="Adjust filters or create a task." /></div>
      ) : filter.view === 'board' ? (
        <BoardView spaceId={spaceId!} statuses={statuses ?? []} rows={data.rows} role={role} />
      ) : (
        <TaskTable spaceId={spaceId!} rows={data.rows} total={data.total} page={filter.page ?? 1} setFilter={setFilter} role={role} />
      )}
    </div>
  );
}

function FilterBar({ filter, setFilter, statuses, members }: {
  filter: TaskFilter; setFilter: (p: Partial<TaskFilter>) => void;
  statuses: Array<{ id: string; name: string }>; members: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="card mt-3 p-3 flex flex-wrap gap-x-3 gap-y-2 items-end">
      <div className="flex-1 min-w-[200px]">
        <label className="label" htmlFor="f-q">Search</label>
        <Input id="f-q" placeholder="Key, title, branch…" defaultValue={filter.q ?? ''} onChange={(e) => setFilter({ q: e.target.value || undefined })} className="w-full" />
      </div>
      <div className="min-w-[150px]">
        <label className="label" htmlFor="f-status">Status</label>
        <Select id="f-status" value={filter.status ?? ''} onChange={(e) => setFilter({ status: e.target.value || undefined })} className="w-full">
          <option value="">All</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
      <div className="min-w-[150px]">
        <label className="label" htmlFor="f-assignee">Assignee</label>
        <Select id="f-assignee" value={filter.assignee ?? ''} onChange={(e) => setFilter({ assignee: e.target.value || undefined })} className="w-full">
          <option value="">All</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>
      <div className="min-w-[130px]">
        <label className="label" htmlFor="f-priority">Priority</label>
        <Select id="f-priority" value={filter.priority ?? ''} onChange={(e) => setFilter({ priority: e.target.value || undefined })} className="w-full">
          <option value="">All</option>
          {['Low', 'Normal', 'High', 'Urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      </div>
      <div className="min-w-[160px]">
        <label className="label" htmlFor="f-sort">Sort</label>
        <Select id="f-sort" value={filter.sort ?? ''} onChange={(e) => setFilter({ sort: e.target.value || undefined })} className="w-full">
          <option value="">Recently updated</option>
          <option value="due_asc">Due date</option>
          <option value="created_desc">Newest</option>
        </Select>
      </div>
      <div>
        <span className="label" id="f-flags">Flags</span>
        <div className="flex items-center gap-3 h-[34px]" role="group" aria-labelledby="f-flags">
          <label className="text-xs flex items-center gap-1 whitespace-nowrap">
            <input type="checkbox" checked={filter.blocked === 'only'} onChange={(e) => setFilter({ blocked: e.target.checked ? 'only' : undefined })} /> Blocked
          </label>
          <label className="text-xs flex items-center gap-1 whitespace-nowrap">
            <input type="checkbox" checked={filter.overdue === 'only'} onChange={(e) => setFilter({ overdue: e.target.checked ? 'only' : undefined })} /> Overdue
          </label>
          <label className="text-xs flex items-center gap-1 whitespace-nowrap">
            <input type="checkbox" checked={filter.archived === 'include'} onChange={(e) => setFilter({ archived: e.target.checked ? 'include' : undefined })} /> Archived
          </label>
        </div>
      </div>
    </div>
  );
}

function CreateTaskForm({ spaceId, onDone }: { spaceId: string; onDone: () => void }) {
  const { data: statuses } = useStatuses(spaceId);
  const { data: members } = useMembers(spaceId);
  const create = useCreateTask(spaceId);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', description: '', priority: 'Normal', is_blocked: false, blocker_reason: '' },
  });
  return (
    <form
      className="card p-4 mt-3"
      onSubmit={handleSubmit(async (v) => {
        setErr(null);
        try {
          await create.mutateAsync({
            title: v.title, description: v.description, status_id: v.status_id || undefined,
            priority: v.priority, assignee_id: (v.assignee_id as string) || null,
            due_date: v.due_date || null, git_branch: v.git_branch || null, pr_url: v.pr_url || null,
          });
          onDone();
        } catch (e) { setErr((e as Error).message); }
      })}
    >
      <Field label="Title" error={formState.errors.title?.message}><Input {...register('title')} /></Field>
      <Field label="Description"><Textarea rows={3} {...register('description')} /></Field>
      <div className="grid sm:grid-cols-4 gap-2">
        <Field label="Status">
          <Select {...register('status_id')}>
            <option value="">Default</option>
            {(statuses ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select {...register('priority')}>
            {['Low', 'Normal', 'High', 'Urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Assignee">
          <Select {...register('assignee_id')}>
            <option value="">Unassigned</option>
            {(members ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>{(m.profile as unknown as { display_name?: string })?.display_name ?? m.user_id.slice(0, 8)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Due date"><Input type="date" {...register('due_date')} /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <Field label="Git branch (optional)"><Input {...register('git_branch')} placeholder="feature/xyz" /></Field>
        <Field label="PR URL (optional)" error={formState.errors.pr_url?.message}><Input {...register('pr_url')} placeholder="https://…" /></Field>
      </div>
      {err && <p className="error-text" role="alert">{err}</p>}
      <Button variant="primary" disabled={create.isPending} icon={<PlusIcon className="h-4 w-4" />}>{create.isPending ? 'Creating…' : 'Create task'}</Button>
    </form>
  );
}

function TaskTable({ spaceId, rows, total, page, setFilter, role }: {
  spaceId: string; rows: import('../../lib/database.types').Task[]; total: number; page: number;
  setFilter: (p: Partial<TaskFilter>) => void; role: string | null | undefined;
}) {
  const update = useUpdateTask();
  const { data: statuses } = useStatuses(spaceId);
  const { data: members } = useMembers(spaceId);
  const pages = Math.max(1, Math.ceil(total / 20));
  const [err, setErr] = useState<string | null>(null);
  const canEdit = role === 'owner' || role === 'lead' || role === 'member';

  return (
    <div className="card mt-3 overflow-x-auto">
      {err && <p className="error-text p-2" role="alert">{err}</p>}
      <table className="w-full table-compact min-w-[900px]">
        <thead><tr>
          <th>Key / Title</th><th>Status</th><th>Priority</th><th>Assignee</th>
          <th>Due</th><th>Branch</th><th>PR</th><th>Updated</th>
        </tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>
                <CopyButton text={taskCopyKey(t.key, t.title)} label={`task identifier ${taskCopyKey(t.key, t.title)}`} className="mr-1 align-middle" />
                <span className="font-mono text-xs text-muted">{t.key}</span>{' '}
                <Link to={`/spaces/${spaceId}/tasks/${t.id}`} className="no-underline font-medium">{t.title}</Link>
                {t.is_blocked && <span className="badge ml-1 border-red-900 text-red-300">Blocked</span>}
                {t.archived_at && <span className="badge ml-1">Archived</span>}
              </td>
              <td>
                {canEdit ? (
                  <Select
                    aria-label={`Status for ${t.key}`}
                    value={t.status_id}
                    disabled={update.isPending}
                    onChange={(e) => update.mutateAsync({ task_id: t.id, status_id: e.target.value }).catch((ex) => setErr((ex as Error).message))}
                    className="w-32 text-xs"
                  >
                    {(statuses ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                ) : (t.status && <StatusDot color={t.status.color} label={t.status.name} />)}
              </td>
              <td><PriorityBadge priority={t.priority} /></td>
              <td>
                {canEdit ? (
                  <Select
                    aria-label={`Assignee for ${t.key}`}
                    value={t.assignee_id ?? ''}
                    disabled={update.isPending}
                    onChange={(e) => update.mutateAsync(
                      e.target.value ? { task_id: t.id, assignee_id: e.target.value } : { task_id: t.id, clear_assignee: true },
                    ).catch((ex) => setErr((ex as Error).message))}
                    className="w-32 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {(members ?? []).map((m) => (
                      <option key={m.user_id} value={m.user_id}>{(m.profile as unknown as { display_name?: string })?.display_name ?? m.user_id.slice(0, 8)}</option>
                    ))}
                  </Select>
                ) : (t.assignee?.display_name ?? '—')}
              </td>
              <td className="whitespace-nowrap">{fmtDate(t.due_date)}</td>
              <td>
                {t.git_branch ? (
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    <span className="truncate max-w-[140px]" title={t.git_branch}>{t.git_branch}</span>
                    <CopyButton text={t.git_branch} label={`branch ${t.git_branch}`} />
                  </span>
                ) : <span className="text-muted">—</span>}
              </td>
              <td>{t.pr_url ? <a href={t.pr_url} target="_blank" rel="noreferrer" className="text-xs no-underline inline-flex items-center gap-1">Open <ExternalIcon className="h-3.5 w-3.5" /></a> : <span className="text-muted">—</span>}</td>
              <td className="text-muted whitespace-nowrap text-xs">{fmtDate(t.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between p-2 text-xs text-muted">
        <span>{total} task{total === 1 ? '' : 's'} · page {page} of {pages}</span>
        <span>
          <Button disabled={page <= 1} onClick={() => setFilter({ page: page - 1 })} className="mr-1" icon={<ChevronLeftIcon className="h-4 w-4" />}>Prev</Button>
          <Button disabled={page >= pages} onClick={() => setFilter({ page: page + 1 })} icon={<ChevronRightIcon className="h-4 w-4" />}>Next</Button>
        </span>
      </div>
    </div>
  );
}

function BoardView({ spaceId, statuses, rows, role }: {
  spaceId: string; statuses: import('../../lib/database.types').Status[];
  rows: import('../../lib/database.types').Task[]; role: string | null | undefined;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const s of statuses) m.set(s.id, []);
    for (const t of rows) {
      const arr = m.get(t.status_id);
      if (arr) arr.push(t);
    }
    return statuses.map((s) => ({ status: s, tasks: m.get(s.id) ?? [] }));
  }, [statuses, rows]);
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
      {groups.map(({ status, tasks }) => (
        <div key={status.id} className="card p-2">
          <p className="text-xs font-semibold mb-2"><StatusDot color={status.color} label={`${status.name} (${tasks.length})`} /></p>
          <div className="flex flex-col gap-1.5">
            {tasks.map((t) => (
              <Link key={t.id} to={`/spaces/${spaceId}/tasks/${t.id}`} className="no-underline card p-2 hover:border-charcoal-600">
                <p className="font-mono text-[11px] text-muted">{t.key}</p>
                <p className="text-xs font-medium leading-snug">{t.title}</p>
                <p className="text-[11px] text-muted mt-0.5">{t.assignee?.display_name ?? 'Unassigned'} · {t.priority}{t.is_blocked ? ' · Blocked' : ''}</p>
              </Link>
            ))}
            {!tasks.length && <p className="text-[11px] text-muted">No tasks</p>}
          </div>
          <p className="hidden">{role}</p>
        </div>
      ))}
    </div>
  );
}
