import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyTasks } from '../tasks/hooks';
import { useSpaces } from '../spaces/hooks';
import { Empty, ErrorBox, Loading, PriorityBadge, StatusDot } from '../../components/ui';
import { fmtDate } from '../../lib/utils';

export function MyTasksPage() {
  const { data, isLoading, error, refetch } = useMyTasks();
  const { data: spaces } = useSpaces();
  const [spaceFilter, setSpaceFilter] = useState('');
  const spaceName = useMemo(() => Object.fromEntries((spaces ?? []).map((s) => [s.id, s.name])), [spaces]);
  const rows = (data ?? []).filter((t) => !spaceFilter || t.space_id === spaceFilter);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div>
      <h1 className="text-lg font-semibold">My Tasks</h1>
      <p className="text-sm text-muted">Tasks assigned to you across spaces.</p>
      <div className="mt-3 flex gap-2 items-center">
        <label className="text-xs text-muted" htmlFor="space-filter">Space</label>
        <select id="space-filter" className="input max-w-xs" value={spaceFilter} onChange={(e) => setSpaceFilter(e.target.value)}>
          <option value="">All spaces</option>
          {(spaces ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {!rows.length ? (
        <div className="mt-3"><Empty title="Nothing assigned" hint="Tasks assigned to you will show up here." /></div>
      ) : (
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full table-compact">
            <thead><tr><th>Key</th><th>Title</th><th>Space</th><th>Status</th><th>Priority</th><th>Due</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap font-mono text-xs">{t.key}</td>
                  <td><Link to={`/spaces/${t.space_id}/tasks/${t.id}`} className="no-underline">{t.title}</Link></td>
                  <td className="text-muted">{spaceName[t.space_id] ?? t.space_id.slice(0, 8)}</td>
                  <td>{t.status && <StatusDot color={t.status.color} label={t.status.name} />}</td>
                  <td><PriorityBadge priority={t.priority} /></td>
                  <td>{fmtDate(t.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
