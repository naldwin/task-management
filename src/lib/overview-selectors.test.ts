import { describe, expect, it } from 'vitest';
import {
  computeKpis,
  countByPriority,
  dueTimeline,
  perSpaceWorkload,
  topAttention,
  weeklyDone,
  type OverviewSpace,
  type OverviewTask,
} from './overview-selectors';

const spaces: OverviewSpace[] = [
  { id: 's1', name: 'Alpha', prefix: 'AL', role: 'owner' },
  { id: 's2', name: 'Beta', prefix: 'BE', role: 'member' },
];

function task(patch: Partial<OverviewTask> & { id: string }): OverviewTask {
  return {
    space_id: 's1',
    title: `task ${patch.id}`,
    priority: 'Normal',
    due_date: null,
    is_blocked: false,
    assignee_id: null,
    completed_at: null,
    updated_at: '2026-09-20T00:00:00Z',
    status: { category: 'Active' },
    ...patch,
  };
}

const NOW = new Date('2026-09-22T12:00:00Z');
const UID = 'u1';

describe('overview selectors', () => {
  it('computeKpis counts mine-overdue, due-soon-mine, blocked, done-month', () => {
    const tasks = [
      task({ id: 'a', assignee_id: UID, due_date: '2026-09-10' }), // overdue mine
      task({ id: 'b', assignee_id: UID, due_date: '2026-09-24' }), // due soon mine
      task({ id: 'c', assignee_id: UID, due_date: '2026-12-01' }), // later mine
      task({ id: 'd', is_blocked: true }), // blocked anyone
      task({ id: 'e', status: { category: 'Done' }, completed_at: '2026-09-05T00:00:00Z' }),
      task({ id: 'f', status: { category: 'Done' }, completed_at: '2026-08-05T00:00:00Z' }), // last month
      task({ id: 'g', due_date: '2026-09-01', status: { category: 'Done' } }), // done overdue ignored
    ];
    expect(computeKpis(tasks, UID, NOW)).toEqual({ myOverdue: 1, dueSoonMine: 1, blockedAll: 1, doneMonthAll: 1 });
  });

  it('topAttention ranks overdue-mine first, then blocked-mine, then lead unassigned', () => {
    const tasks = [
      task({ id: 'un', space_id: 's1' }), // unassigned, owner sees it
      task({ id: 'od', space_id: 's2', assignee_id: UID, due_date: '2026-09-01' }),
      task({ id: 'bl', space_id: 's2', assignee_id: UID, is_blocked: true, due_date: '2026-12-01' }),
    ];
    const got = topAttention(tasks, UID, { s1: 'owner', s2: 'member' }, 7, NOW).map((i) => i.task.id);
    expect(got).toEqual(['od', 'bl', 'un']);
  });

  it('topAttention hides lead-only items from plain members', () => {
    const tasks = [task({ id: 'un', space_id: 's2' })];
    expect(topAttention(tasks, UID, { s2: 'member' }, 7, NOW)).toEqual([]);
    expect(topAttention(tasks, UID, { s2: 'lead' }, 7, NOW).map((i) => i.reason)).toEqual([
      'Unassigned · needs owner/lead',
    ]);
  });

  it('dueTimeline buckets only mine, skips overdue and done', () => {
    const tasks = [
      task({ id: 't', assignee_id: UID, due_date: '2026-09-22' }),
      task({ id: 'm', assignee_id: UID, due_date: '2026-09-23' }),
      task({ id: 'w', assignee_id: UID, due_date: '2026-09-27' }),
      task({ id: 'l', assignee_id: UID, due_date: '2026-10-22' }),
      task({ id: 'n', assignee_id: UID, due_date: null }),
      task({ id: 'o', assignee_id: UID, due_date: '2026-09-01' }), // overdue -> skipped
      task({ id: 'x', assignee_id: 'other', due_date: '2026-09-22' }),
    ];
    expect(dueTimeline(tasks, UID, NOW)).toEqual({ today: 1, tomorrow: 1, week: 1, later: 1, none: 1 });
  });

  it('perSpaceWorkload aggregates without double counting', () => {
    const tasks = [
      task({ id: 'a', space_id: 's1', assignee_id: UID, due_date: '2026-09-01' }),
      task({ id: 'b', space_id: 's1' }),
      task({ id: 'c', space_id: 's2', assignee_id: UID, due_date: '2026-09-24', is_blocked: true }),
    ];
    const rows = perSpaceWorkload(spaces, tasks, UID, NOW);
    expect(rows[0]).toMatchObject({ active: 2, overdue: 1, mine: 1, unassigned: 1 });
    expect(rows[1]).toMatchObject({ active: 1, overdue: 0, mine: 1, blocked: 1, dueSoon: 1 });
  });

  it('countByPriority skips done, weeklyDone buckets oldest-first', () => {
    const tasks = [
      task({ id: 'a', priority: 'Urgent' }),
      task({ id: 'b', priority: 'High', status: { category: 'Done' }, completed_at: '2026-09-21T00:00:00Z' }),
      task({ id: 'c', status: { category: 'Done' }, completed_at: '2026-09-10T00:00:00Z' }),
      task({ id: 'd', status: { category: 'Done' }, completed_at: '2026-08-01T00:00:00Z' }),
    ];
    expect(countByPriority(tasks)).toMatchObject({ Urgent: 1, High: 0 });
    const w = weeklyDone(tasks, 4, NOW);
    expect(w.length).toBe(4);
    expect(w[3]).toBe(1); // this week
    expect(w.reduce((a, b) => a + b, 0)).toBe(2); // Aug task outside 4w window
  });
});
