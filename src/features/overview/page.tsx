import { Link } from 'react-router-dom';
import { useOverview } from '../tasks/hooks';
import { Empty, ErrorBox, Loading } from '../../components/ui';

export function OverviewPage() {
  const { data, isLoading, error, refetch } = useOverview();

  if (isLoading) return <Loading label="Loading overview…" />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (!data?.length) return (
    <div>
      <h1 className="text-lg font-semibold">Overview</h1>
      <p className="text-sm text-muted">What needs attention across your spaces.</p>
      <div className="mt-3"><Empty title="No spaces yet" hint="Create a space to start organizing work." /></div>
      <p className="text-sm text-muted mt-3">
        New here? Use the ? icon at the top of the sidebar for how spaces, tasks, and reports fit together.
      </p>
    </div>
  );

  const totals = data.reduce(
    (a, s) => ({ active: a.active + s.active, blocked: a.blocked + s.blocked, overdue: a.overdue + s.overdue, done: a.done + s.doneMonth }),
    { active: 0, blocked: 0, overdue: 0, done: 0 },
  );

  return (
    <div>
      <h1 className="text-lg font-semibold">Overview</h1>
      <p className="text-sm text-muted">What needs attention across your spaces.</p>

      <div className="card mt-3 px-3 py-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Summary">
        <span><strong>{totals.active}</strong> <span className="text-muted">active</span></span>
        <span><strong>{totals.blocked}</strong> <span className="text-muted">blocked</span></span>
        <span><strong>{totals.overdue}</strong> <span className="text-muted">overdue</span></span>
        <span><strong>{totals.done}</strong> <span className="text-muted">completed this month</span></span>
      </div>

      <div className="card mt-3 overflow-x-auto">
        <table className="w-full table-compact">
          <thead><tr><th>Space</th><th>Active</th><th>Blocked</th><th>Overdue</th><th>Done (month)</th><th>Role</th></tr></thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id}>
                <td><Link to={`/spaces/${s.id}/tasks`} className="no-underline font-medium">{s.name} <span className="text-muted">· {s.prefix}</span></Link></td>
                <td><Link to={`/spaces/${s.id}/tasks?view=table`}>{s.active}</Link></td>
                <td><Link to={`/spaces/${s.id}/tasks?blocked=only`}>{s.blocked}</Link></td>
                <td><Link to={`/spaces/${s.id}/tasks?overdue=only`}>{s.overdue}</Link></td>
                <td>{s.doneMonth}</td>
                <td className="text-muted">{s.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
