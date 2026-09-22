import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOverview } from '../tasks/hooks';
import { useActivityFeed } from '../activity/hooks';
import { FeedItemRow } from '../activity/feed';
import { usePendingInvitationCount } from '../invitations/hooks';
import { Empty, ErrorBox, Loading, PriorityBadge, StatusDot } from '../../components/ui';
import { fmtDate } from '../../lib/utils';
import { mergeFeed } from '../../lib/feed-selectors';
import {
  computeKpis,
  countByPriority,
  dueTimeline,
  perSpaceWorkload,
  topAttention,
  weeklyDone,
  type AttentionItem,
  type OverviewTask,
} from '../../lib/overview-selectors';

const SHOW_ALL_KEY = 'overview:showAllSpaces';

function KpiCard({ label, value, to, accent }: { label: string; value: number; to?: string; accent?: 'red' | 'amber' }) {
  const border = accent === 'red' ? 'border-l-2 border-l-red-900' : accent === 'amber' ? 'border-l-2 border-l-amber-900' : '';
  const inner = (
    <>
      <p className="text-xl font-semibold leading-none">{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </>
  );
  return (
    <div className={`card p-3 ${border}`}>
      {to ? <Link to={to} className="no-underline block hover:opacity-90">{inner}</Link> : inner}
    </div>
  );
}

function Bar({ pct, className = 'bg-accent' }: { pct: number; className?: string }) {
  return (
    <div className="h-2 flex-1 rounded bg-charcoal-800 overflow-hidden" aria-hidden>
      <div className={`h-full rounded ${className}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

function reasonBadgeClass(reason: AttentionItem['reason']): string {
  if (reason.startsWith('Overdue')) return 'border-red-900 text-red-300';
  if (reason.startsWith('Blocked')) return 'border-red-900 text-red-300';
  if (reason.startsWith('Due soon')) return 'border-amber-900 text-amber-200';
  return '';
}

export function OverviewPage() {
  const { data, isLoading, error, refetch } = useOverview();
  const { data: inviteCount } = usePendingInvitationCount();
  const [showAll, setShowAll] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(SHOW_ALL_KEY);
      return v === null ? null : v === '1';
    } catch {
      return null;
    }
  });

  const spaces = data?.spaces ?? [];
  const tasks = useMemo<OverviewTask[]>(() => (data?.tasks ?? []) as OverviewTask[], [data]);
  const uid = data?.uid ?? '';

  const roleBySpace = useMemo(() => Object.fromEntries(spaces.map((s) => [s.id, s.role])), [spaces]);
  const spaceById = useMemo(() => Object.fromEntries(spaces.map((s) => [s.id, s])), [spaces]);
  const kpis = useMemo(() => computeKpis(tasks, uid), [tasks, uid]);
  const attention = useMemo(() => topAttention(tasks, uid, roleBySpace, 7), [tasks, uid, roleBySpace]);
  const timeline = useMemo(() => dueTimeline(tasks, uid), [tasks, uid]);
  const byPriority = useMemo(() => countByPriority(tasks), [tasks]);
  const workload = useMemo(() => perSpaceWorkload(spaces, tasks, uid), [spaces, tasks, uid]);
  const trend = useMemo(() => weeklyDone(tasks, 4), [tasks]);
  const recent = useMemo(
    () => tasks.filter((t) => t.assignee_id === uid).sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).slice(0, 5),
    [tasks, uid],
  );
  const feedSpaceIds = useMemo(() => spaces.map((s) => s.id), [spaces]);
  const { data: feed } = useActivityFeed(feedSpaceIds, undefined, 10);
  const feedItems = useMemo(
    () => (feed ? mergeFeed(feed.comments, feed.events).slice(0, 7) : []),
    [feed],
  );

  const defaultExpanded = spaces.length <= 4;
  const expanded = showAll ?? defaultExpanded;
  const toggleShowAll = () => {
    const next = !expanded;
    setShowAll(next);
    try {
      localStorage.setItem(SHOW_ALL_KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable — toggle still works for this session */
    }
  };

  const sortedWorkload = useMemo(() => [...workload].sort((a, b) => b.active - a.active), [workload]);
  const maxActive = Math.max(1, ...workload.map((w) => w.active));
  const visibleSpaces = expanded ? sortedWorkload : sortedWorkload.slice(0, 4);

  const timelineRows = [
    { label: 'Today', value: timeline.today, cls: 'bg-red-400' },
    { label: 'Tomorrow', value: timeline.tomorrow, cls: 'bg-amber-300' },
    { label: 'This week', value: timeline.week, cls: 'bg-accent' },
    { label: 'Later', value: timeline.later, cls: 'bg-charcoal-600' },
    { label: 'No date', value: timeline.none, cls: 'bg-charcoal-700' },
  ];
  const timelineMax = Math.max(1, ...timelineRows.map((r) => r.value));

  const priorityRows = (['Urgent', 'High', 'Normal', 'Low'] as const).map((p) => ({ label: p, value: byPriority[p] ?? 0 }));
  const priorityMax = Math.max(1, ...priorityRows.map((r) => r.value));
  const unassignedTotal = useMemo(
    () => tasks.filter((t) => !t.assignee_id && t.status?.category !== 'Done' && t.status?.category !== 'Cancelled').length,
    [tasks],
  );

  const trendMax = Math.max(1, ...trend);
  const topBlockedSpace = useMemo(() => [...spaces].sort((a, b) => b.blocked - a.blocked)[0], [spaces]);

  if (isLoading) return <Loading label="Loading overview…" />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (!spaces.length) return (
    <div>
      <h1 className="text-lg font-semibold">Overview</h1>
      <p className="text-sm text-muted">What needs attention across your spaces.</p>
      <div className="mt-3"><Empty title="No spaces yet" hint="Create a space to start organizing work." /></div>
      <p className="text-sm text-muted mt-3">
        New here? Use the ? icon at the top of the sidebar for how spaces, tasks, and reports fit together.
      </p>
    </div>
  );

  return (
    <div>
      <h1 className="text-lg font-semibold">Overview</h1>
      <p className="text-sm text-muted">What needs attention across your spaces.</p>

      {!!inviteCount && (
        <div className="card mt-3 p-3 border-accent flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm">
            You have <strong>{inviteCount}</strong> pending invitation{inviteCount === 1 ? '' : 's'}.
          </p>
          <Link to="/profile#invitations" className="btn btn-primary no-underline text-sm">Review invitations</Link>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2" aria-label="Summary">
        <KpiCard label="My overdue" value={kpis.myOverdue} to="/my-tasks" accent={kpis.myOverdue ? 'red' : undefined} />
        <KpiCard label="Due next 7 days (mine)" value={kpis.dueSoonMine} to="/my-tasks" accent={kpis.dueSoonMine ? 'amber' : undefined} />
        <KpiCard
          label="Blocked"
          value={kpis.blockedAll}
          to={topBlockedSpace && kpis.blockedAll ? `/spaces/${topBlockedSpace.id}/tasks?blocked=only` : undefined}
          accent={kpis.blockedAll ? 'red' : undefined}
        />
        <div className="card p-3">
          <p className="text-xl font-semibold leading-none">{kpis.doneMonthAll}</p>
          <p className="text-xs text-muted mt-1">Completed this month</p>
          <div className="mt-2 flex items-end gap-1 h-6" aria-label={`Weekly completions: ${trend.join(', ')}`} title={`Last 4 weeks: ${trend.join(', ')}`}>
            {trend.map((v, i) => (
              <div key={i} className="flex-1 rounded-sm bg-accent/70" style={{ height: `${Math.max(8, (v / trendMax) * 100)}%` }} title={`Week ${i + 1}: ${v}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="card p-3 md:col-span-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Needs your attention</h2>
            <Link to="/my-tasks" className="text-xs no-underline">View all my tasks →</Link>
          </div>
          {!attention.length ? (
            <p className="text-sm text-muted mt-2">Nothing urgent. Tasks assigned to you — or unassigned work in spaces you lead — will appear here.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {attention.map(({ task: t, reason }) => (
                <li key={t.id} className="border-b border-charcoal-800 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-sm min-w-0">
                      <span className="font-mono text-xs text-muted mr-1">{t.key}</span>
                      <Link to={`/spaces/${t.space_id}/tasks/${t.id}`} className="no-underline font-medium">{t.title}</Link>
                      <span className="text-xs text-muted"> · {spaceById[t.space_id]?.name ?? t.space_id.slice(0, 8)}</span>
                    </p>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                    <span className={`badge ${reasonBadgeClass(reason)}`}>{reason}</span>
                    {t.status && <StatusDot color={t.status.color ?? '#888'} label={t.status.name ?? t.status.category} />}
                    <span className="text-muted">Due {fmtDate(t.due_date)}</span>
                  </div>
                  {t.is_blocked && t.blocker_reason && (
                    <p className="text-xs text-muted mt-0.5 truncate" title={t.blocker_reason}>Blocked: {t.blocker_reason}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-3">
          <h2 className="text-sm font-semibold">Due timeline</h2>
          <p className="text-xs text-muted">Your open tasks by due date.</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {timelineRows.map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-muted">{r.label}</span>
                <Bar pct={(r.value / timelineMax) * 100} className={r.cls} />
                <span className="w-6 text-right font-medium">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className="card p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Workload by space</h2>
            <Link to="/spaces" className="text-xs no-underline">All spaces →</Link>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {sortedWorkload.slice(0, 5).map((w) => (
              <div key={w.space.id} className="flex items-center gap-2 text-xs">
                <Link to={`/spaces/${w.space.id}/tasks`} className="no-underline font-medium w-28 shrink-0 truncate" title={`${w.space.name} · ${w.space.prefix}`}>
                  {w.space.name}
                </Link>
                <Bar pct={(w.active / maxActive) * 100} />
                <span className="text-muted whitespace-nowrap w-32 text-right" title={`${w.active} active · ${w.overdue} overdue`}>
                  {w.active} active{w.overdue ? ` · ${w.overdue} overdue` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-3">
          <h2 className="text-sm font-semibold">By priority</h2>
          <p className="text-xs text-muted">Open tasks across your spaces.</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {priorityRows.map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0"><PriorityBadge priority={r.label} /></span>
                <Bar pct={(r.value / priorityMax) * 100} className={r.label === 'Urgent' ? 'bg-red-400' : r.label === 'High' ? 'bg-amber-300' : 'bg-accent'} />
                <span className="w-6 text-right font-medium">{r.value}</span>
              </div>
            ))}
          </div>
          {!!unassignedTotal && <p className="text-xs text-muted mt-2">{unassignedTotal} open task{unassignedTotal === 1 ? ' is' : 's are'} unassigned.</p>}
        </div>
      </div>

      <div className="card mt-2 p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold">Spaces ({spaces.length})</h2>
          {spaces.length > 4 && (
            <button type="button" className="btn" onClick={toggleShowAll} aria-expanded={expanded}>
              {expanded ? `Hide (${spaces.length - 4} spaces)` : `Show all ${spaces.length} spaces`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-compact">
            <thead><tr><th>Space</th><th>Mine</th><th>Active</th><th>Blocked</th><th>Due soon</th><th>Overdue</th><th>Done (month)</th><th>Role</th></tr></thead>
            <tbody>
              {visibleSpaces.map((w) => (
                <tr key={w.space.id}>
                  <td><Link to={`/spaces/${w.space.id}/tasks`} className="no-underline font-medium">{w.space.name} <span className="text-muted">· {w.space.prefix}</span></Link></td>
                  <td><Link to="/my-tasks">{w.mine}</Link></td>
                  <td><Link to={`/spaces/${w.space.id}/tasks?view=table`}>{w.active}</Link></td>
                  <td><Link to={`/spaces/${w.space.id}/tasks?blocked=only`}>{w.blocked}</Link></td>
                  <td>{w.dueSoon}</td>
                  <td><Link to={`/spaces/${w.space.id}/tasks?overdue=only`}>{w.overdue}</Link></td>
                  <td>{w.doneMonth}</td>
                  <td className="text-muted">{w.space.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(!!feedItems.length || !!recent.length) && (
        <div className="card mt-2 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <Link to="/activity" className="text-xs no-underline">View all activity →</Link>
          </div>
          {!!feedItems.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {feedItems.map((i) => (
                <FeedItemRow
                  key={`${i.kind}-${i.kind === 'comment' ? i.comment.id : i.event.id}`}
                  item={i}
                  spaceName={spaceById[i.kind === 'comment' ? i.comment.space_id : i.event.space_id]?.name ?? ''}
                />
              ))}
            </ul>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {recent.map((t) => (
                <li key={t.id} className="text-sm flex items-baseline gap-2 min-w-0">
                  <span className="font-mono text-xs text-muted shrink-0">{t.key}</span>
                  <Link to={`/spaces/${t.space_id}/tasks/${t.id}`} className="no-underline truncate">{t.title}</Link>
                  <span className="text-xs text-muted shrink-0 ml-auto">{fmtDate(t.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
