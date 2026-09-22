// Pure selectors for /overview. Kept dependency-free and unit-tested so the
// page stays a thin view over `useOverview()` data.
export type OverviewCategory = 'Not Started' | 'Active' | 'Done' | 'Cancelled' | string;

export interface OverviewTask {
  id: string;
  space_id: string;
  key?: string;
  title: string;
  priority: string;
  due_date: string | null;
  is_blocked: boolean;
  blocker_reason?: string | null;
  assignee_id: string | null;
  completed_at: string | null;
  updated_at: string;
  status?: { category: OverviewCategory; name?: string; color?: string } | null;
}

export interface OverviewSpace {
  id: string;
  name: string;
  prefix: string;
  role: string;
}

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dayKeyOfValue(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return dayKeyOfDate(d);
}

function dayKeyOfDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(aKey: string, bKey: string): number {
  // positive when a is after b (calendar days)
  const [ay, am, ad] = aKey.split('-').map(Number);
  const [by, bm, bd] = bKey.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isDoneOrCancelled(t: OverviewTask): boolean {
  const c = t.status?.category;
  return c === 'Done' || c === 'Cancelled';
}

export function isOverdueTask(t: OverviewTask, now = new Date()): boolean {
  const due = dayKeyOfValue(t.due_date);
  if (!due) return false;
  if (isDoneOrCancelled(t)) return false;
  return dayDiff(due, dayKeyOfDate(now)) < 0;
}

export function isDueSoonTask(t: OverviewTask, days = 7, now = new Date()): boolean {
  const due = dayKeyOfValue(t.due_date);
  if (!due) return false;
  if (isDoneOrCancelled(t)) return false;
  const diff = dayDiff(due, dayKeyOfDate(now));
  return diff >= 0 && diff <= days;
}

export interface OverviewKpis {
  myOverdue: number;
  dueSoonMine: number;
  blockedAll: number;
  doneMonthAll: number;
}

export function monthStart(d: Date): Date {
  const c = new Date(d);
  c.setDate(1);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function computeKpis(tasks: OverviewTask[], uid: string, now = new Date()): OverviewKpis {
  const start = monthStart(now);
  let myOverdue = 0;
  let dueSoonMine = 0;
  let blockedAll = 0;
  let doneMonthAll = 0;
  for (const t of tasks) {
    if (t.is_blocked && !isDoneOrCancelled(t)) blockedAll += 1;
    const completed = toDate(t.completed_at);
    if (completed && completed >= start) doneMonthAll += 1;
    if (t.assignee_id === uid) {
      if (isOverdueTask(t, now)) myOverdue += 1;
      else if (isDueSoonTask(t, 7, now)) dueSoonMine += 1;
    }
  }
  return { myOverdue, dueSoonMine, blockedAll, doneMonthAll };
}

export type AttentionReason =
  | 'Overdue · assigned to you'
  | 'Blocked · assigned to you'
  | 'Due soon · assigned to you'
  | 'Unassigned · needs owner/lead'
  | 'Overdue · needs owner/lead'
  | 'Recently updated · assigned to you';

export interface AttentionItem {
  task: OverviewTask;
  reason: AttentionReason;
  rank: number;
}

const LEAD_ROLES = new Set(['owner', 'lead']);

export function attentionReason(
  t: OverviewTask,
  uid: string,
  role: string | undefined,
  now = new Date(),
): AttentionItem | null {
  const mine = t.assignee_id === uid;
  const lead = role ? LEAD_ROLES.has(role) : false;
  const done = isDoneOrCancelled(t);
  if (done) return null;
  if (mine && isOverdueTask(t, now)) return { task: t, reason: 'Overdue · assigned to you', rank: 0 };
  if (mine && t.is_blocked) return { task: t, reason: 'Blocked · assigned to you', rank: 1 };
  if (mine && isDueSoonTask(t, 7, now)) return { task: t, reason: 'Due soon · assigned to you', rank: 2 };
  if (!t.assignee_id && lead) return { task: t, reason: 'Unassigned · needs owner/lead', rank: 3 };
  if (!mine && lead && isOverdueTask(t, now)) return { task: t, reason: 'Overdue · needs owner/lead', rank: 4 };
  if (mine) return { task: t, reason: 'Recently updated · assigned to you', rank: 5 };
  return null;
}

const PRIORITY_WEIGHT: Record<string, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };

export function topAttention(
  tasks: OverviewTask[],
  uid: string,
  roleBySpace: Record<string, string>,
  limit = 7,
  now = new Date(),
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const t of tasks) {
    const r = attentionReason(t, uid, roleBySpace[t.space_id], now);
    if (r) items.push(r);
  }
  items.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const pa = PRIORITY_WEIGHT[a.task.priority] ?? 9;
    const pb = PRIORITY_WEIGHT[b.task.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    const da = toDate(a.task.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = toDate(b.task.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return (b.task.updated_at ?? '').localeCompare(a.task.updated_at ?? '');
  });
  return items.slice(0, limit);
}

export interface TimelineBuckets {
  today: number;
  tomorrow: number;
  week: number;
  later: number;
  none: number;
}

export function dueTimeline(tasks: OverviewTask[], uid: string, now = new Date()): TimelineBuckets {
  const out: TimelineBuckets = { today: 0, tomorrow: 0, week: 0, later: 0, none: 0 };
  const today = dayKeyOfDate(now);
  for (const t of tasks) {
    if (t.assignee_id !== uid || isDoneOrCancelled(t)) continue;
    const due = dayKeyOfValue(t.due_date);
    if (!due) {
      out.none += 1;
      continue;
    }
    const diff = dayDiff(due, today);
    if (diff < 0) continue; // overdue already covered by KPI/queue
    if (diff === 0) out.today += 1;
    else if (diff === 1) out.tomorrow += 1;
    else if (diff <= 7) out.week += 1;
    else out.later += 1;
  }
  return out;
}

export function countByPriority(tasks: OverviewTask[]): Record<string, number> {
  const out: Record<string, number> = { Low: 0, Normal: 0, High: 0, Urgent: 0 };
  for (const t of tasks) {
    if (isDoneOrCancelled(t)) continue;
    out[t.priority] = (out[t.priority] ?? 0) + 1;
  }
  return out;
}

export interface SpaceWorkload {
  space: OverviewSpace;
  active: number;
  overdue: number;
  mine: number;
  dueSoon: number;
  unassigned: number;
  blocked: number;
  doneMonth: number;
}

export function perSpaceWorkload(
  spaces: OverviewSpace[],
  tasks: OverviewTask[],
  uid: string,
  now = new Date(),
): SpaceWorkload[] {
  const start = monthStart(now);
  return spaces.map((space) => {
    const rows = tasks.filter((t) => t.space_id === space.id);
    const active = rows.filter((t) => t.status?.category === 'Active' || t.status?.category === 'Not Started').length;
    const overdue = rows.filter((t) => isOverdueTask(t, now)).length;
    const mine = rows.filter((t) => t.assignee_id === uid && !isDoneOrCancelled(t)).length;
    const dueSoon = rows.filter((t) => isDueSoonTask(t, 7, now)).length;
    const unassigned = rows.filter((t) => !t.assignee_id && !isDoneOrCancelled(t)).length;
    const blocked = rows.filter((t) => t.is_blocked && !isDoneOrCancelled(t)).length;
    const doneMonth = rows.filter((t) => {
      const c = toDate(t.completed_at);
      return c && c >= start;
    }).length;
    return { space, active, overdue, mine, dueSoon, unassigned, blocked, doneMonth };
  });
}

/** Done counts for the last `weeks` weeks (oldest first), based on completed_at. */
export function weeklyDone(tasks: OverviewTask[], weeks = 4, now = new Date()): number[] {
  const out = new Array<number>(weeks).fill(0);
  const today = dayKeyOfDate(now);
  for (const t of tasks) {
    const c = dayKeyOfValue(t.completed_at);
    if (!c) continue;
    const diffDays = dayDiff(today, c);
    if (diffDays < 0) continue;
    const w = Math.floor(diffDays / 7);
    if (w < weeks) out[weeks - 1 - w] += 1;
  }
  return out;
}
