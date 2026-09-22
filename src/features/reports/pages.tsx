import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMyRole, useSpace } from '../spaces/hooks';
import { useGenerateReport, useReport, useReports } from './hooks';
import { Button, Empty, ErrorBox, Loading } from '../../components/ui';
import { PrintIcon, RefreshIcon } from '../../components/icons';
import { can } from '../../lib/utils';

function monthOptions(n = 12): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export function SpaceReportsPage() {
  const { spaceId } = useParams();
  const nav = useNavigate();
  const { data: space } = useSpace(spaceId);
  const { data: reports, isLoading, error, refetch } = useReports(spaceId);
  const { data: role, isLoading: roleLoading } = useMyRole(spaceId);
  const gen = useGenerateReport(spaceId!);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div>
      <p className="text-xs text-muted"><Link to={`/spaces/${spaceId}/tasks`} className="no-underline">← Back to tasks</Link></p>
      <h1 className="text-lg font-semibold mt-1">Reports <span className="text-muted font-normal">· {space?.name}</span></h1>
      <p className="text-sm text-muted">Select a month and click Generate report to gather this space&apos;s task list (timezone: {space?.timezone ?? 'UTC'}).</p>

      {/* Generate actions are always visible so the page never looks dead:
          permitted roles get the button, everyone else gets the reason why. */}
      <div className="card p-3 mt-3 flex flex-wrap items-end gap-2 no-print">
        <div>
          <label className="label" htmlFor="gen-month">Month (YYYY-MM)</label>
          <select id="gen-month" className="input" value={month} onChange={(e) => { setMonth(e.target.value); setOkMsg(null); }}>
            {monthOptions().map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {roleLoading ? (
          <p className="text-xs text-muted pb-2">Checking your role…</p>
        ) : can('manage-report', role) ? (
          <Button
            variant="primary"
            disabled={gen.isPending}
            icon={<RefreshIcon className="h-4 w-4" />}
            onClick={() => {
              setErr(null); setOkMsg(null);
              gen.mutateAsync(month)
                .then(() => nav(`/spaces/${spaceId}/reports/${month}`))
                .catch((e) => setErr((e as Error).message));
            }}
          >
            {gen.isPending ? 'Gathering…' : 'Generate report'}
          </Button>
        ) : (
          <p className="text-xs text-muted pb-2" role="note">
            {role
              ? `Your role in this space is "${role}" — only owners and leads can generate reports.`
              : 'You are not a member of this space, so you cannot generate reports.'}
          </p>
        )}
        {err && <p className="error-text" role="alert">{err}</p>}
        {okMsg && <p className="text-xs text-accent" role="status">{okMsg}</p>}
      </div>

      {!reports?.length ? (
        <div className="mt-3"><Empty title="No reports yet" hint="Select a month above and click Generate report." /></div>
      ) : (
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full table-compact">
            <thead><tr><th>Month</th><th>Summary</th><th>Generated</th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/spaces/${spaceId}/reports/${r.month_start.slice(0, 7)}`} className="no-underline font-mono">{r.month_start.slice(0, 7)}</Link></td>
                  <td className="text-muted">{r.summary || '—'}{r.generation_error ? ` · Error: ${r.generation_error}` : ''}</td>
                  <td className="text-muted">{new Date(r.generated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SpaceReportDetailPage() {
  const { spaceId, month } = useParams();
  const { data: space } = useSpace(spaceId);
  const { data: report, isLoading, error, refetch } = useReport(spaceId, month);
  const gen = useGenerateReport(spaceId!);
  const { data: role } = useMyRole(spaceId);
  const [err, setErr] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;

  const tasks = (report?.tasks_snapshot ?? []) as Array<Record<string, unknown>>;
  const comments = (report?.comments_snapshot ?? []) as Array<Record<string, unknown>>;
  const counts = (report?.counts ?? {}) as Record<string, number>;
  const byAssignee = (report?.by_assignee ?? []) as Array<{ assignee: string; completed: number; total: number }>;

  return (
    <div>
      <div className="no-print">
        <p className="text-xs text-muted"><Link to={`/spaces/${spaceId}/reports`} className="no-underline">← All reports</Link></p>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h1 className="text-lg font-semibold">Report · {space?.name} · <span className="font-mono">{month}</span></h1>
          {report && <span className="badge">Snapshot</span>}
        </div>
        <div className="flex gap-2 mt-2 flex-wrap items-center">
          {report && <Button variant="primary" onClick={() => window.print()} icon={<PrintIcon className="h-4 w-4" />}>Print / Save as PDF</Button>}
          {can('manage-report', role) ? (
            <Button variant={report ? 'default' : 'primary'} disabled={gen.isPending} icon={<RefreshIcon className="h-4 w-4" />} onClick={() => gen.mutateAsync(month!).then(() => refetch()).catch((e) => setErr((e as Error).message))}>
              {gen.isPending ? 'Gathering…' : report ? 'Regenerate' : 'Generate report'}
            </Button>
          ) : (
            <p className="text-xs text-muted" role="note">
              {role
                ? `Your role in this space is "${role}" — only owners and leads can generate reports.`
                : 'You are not a member of this space, so you cannot generate reports.'}
            </p>
          )}
          {err && <span className="error-text">{err}</span>}
        </div>
        {!report && (
          <div className="mt-3"><Empty title="No report for this month yet" hint="Owners and leads can generate it with the button above. Generating gathers this space's task list for the selected month." /></div>
        )}
      </div>

      {report && (
        <article className="print-area card no-print-card p-4 mt-3 bg-white">
          <ReportBody
            spaceName={space?.name ?? 'Space'}
            month={month!}
            timezone={report.timezone}
            generatedAt={report.generated_at}
            summary={report.summary}
            counts={counts}
            byAssignee={byAssignee}
            tasks={tasks}
            comments={comments}
          />
        </article>
      )}
    </div>
  );
}

export function ReportBody({ spaceName, month, timezone, generatedAt, summary, counts, byAssignee, tasks, comments }: {
  spaceName: string; month: string; timezone: string; generatedAt: string; summary: string;
  counts: Record<string, number>; byAssignee: Array<{ assignee: string; completed: number; total: number }>;
  tasks: Array<Record<string, unknown>>; comments: Array<Record<string, unknown>>;
}) {
  return (
    <div className="print:text-black">
      <h1 className="text-xl font-bold print:text-black">{spaceName} — Monthly Report · {month}</h1>
      <p className="text-sm text-muted print:text-black">Generated {new Date(generatedAt).toLocaleString()} · Timezone {timezone}</p>
      <p className="text-sm mt-2">{summary}</p>

      <h2 className="text-sm font-semibold mt-4">Counts</h2>
      <table>
        <thead><tr><th>Created</th><th>Completed</th><th>Cancelled</th><th>Open at month-end</th><th>Blocked</th><th>Overdue</th></tr></thead>
        <tbody><tr>
          {['created', 'completed', 'cancelled', 'open', 'blocked', 'overdue'].map((k) => <td key={k}>{counts[k] ?? 0}</td>)}
        </tr></tbody>
      </table>

      <h2 className="text-sm font-semibold mt-4">Completion by assignee (unique tasks)</h2>
      {!byAssignee.length ? <p className="text-sm">No data.</p> : (
        <table>
          <thead><tr><th>Assignee</th><th>Completed</th><th>Total in report</th></tr></thead>
          <tbody>
            {byAssignee.map((b) => <tr key={b.assignee}><td>{b.assignee}</td><td>{b.completed}</td><td>{b.total}</td></tr>)}
          </tbody>
        </table>
      )}
      <p className="text-xs text-muted print:text-black mt-1">Reopened tasks count once in completion metrics; a task completed then reopened in the same month appears with its month-end status and is explained in the task table.</p>

      <h2 className="text-sm font-semibold mt-4">Tasks ({tasks.length})</h2>
      {!tasks.length ? <p className="text-sm">No tasks in this report.</p> : (
        <table>
          <thead><tr>
            <th>Key</th><th>Title</th><th>Assignee</th><th>Month-end status</th><th>Priority</th><th>Due</th><th>Branch</th><th>PR</th><th>Why</th>
          </tr></thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={String(t.id)}>
                <td>{String(t.key ?? '')}</td>
                <td>{String(t.title ?? '')}</td>
                <td>{String(t.assignee_name ?? 'Unassigned')}</td>
                <td>{String(t.month_end_status ?? '')}</td>
                <td>{String(t.priority ?? '')}</td>
                <td>{String(t.due_date ?? '—')}</td>
                <td className="font-mono">{String(t.git_branch ?? '—')}</td>
                <td>{String(t.pr_url ?? '—')}</td>
                <td>{String(t.reason ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="text-sm font-semibold mt-4">Progress updates ({comments.length})</h2>
      {!comments.length ? <p className="text-sm">No updates this month.</p> : (
        <table>
          <thead><tr><th>Task</th><th>Author</th><th>Date</th><th>Update</th></tr></thead>
          <tbody>
            {comments.map((c) => (
              <tr key={String(c.id)}>
                <td>{String(c.task_key ?? '')}</td><td>{String(c.author ?? '')}</td>
                <td>{new Date(String(c.created_at)).toLocaleDateString()}</td><td>{String(c.body ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="text-sm font-semibold mt-4">Carryover to next month</h2>
      <p className="text-sm">
        {tasks.filter((t) => t.reason === 'Carryover').length} open task(s) carry over. Each is listed above with month-end status, assignee, and due date.
      </p>
    </div>
  );
}
