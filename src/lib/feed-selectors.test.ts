import { describe, expect, it } from 'vitest';
import {
  filterFeed,
  groupFeedByDay,
  mergeFeed,
  snippet,
  timeAgo,
  type FeedComment,
  type FeedEvent,
} from './feed-selectors';

function comment(patch: Partial<FeedComment> & { id: string }): FeedComment {
  return {
    created_at: '2026-09-22T10:00:00Z',
    space_id: 's1',
    task_id: 't1',
    task_key: 'AL-001',
    task_title: 'Fix login',
    author_name: 'Ana',
    body: 'Deployed the fix',
    assignee_id: 'u1',
    ...patch,
  };
}

function event(patch: Partial<FeedEvent> & { id: string; action: string }): FeedEvent {
  return {
    created_at: '2026-09-22T10:00:00Z',
    space_id: 's1',
    task_id: 't1',
    task_key: 'AL-001',
    task_title: 'Fix login',
    actor_name: 'Bob',
    field_name: null,
    old_value: null,
    new_value: null,
    assignee_id: 'u1',
    ...patch,
  };
}

describe('feed selectors', () => {
  it('merges newest-first and drops non-whitelisted actions', () => {
    const items = mergeFeed(
      [comment({ id: 'c1', created_at: '2026-09-22T09:00:00Z' })],
      [
        event({ id: 'e1', action: 'completed', created_at: '2026-09-22T11:00:00Z' }),
        event({ id: 'e2', action: 'title', created_at: '2026-09-22T12:00:00Z' }),
      ],
    );
    expect(items.map((i) => (i.kind === 'comment' ? i.comment.id : i.event.id))).toEqual(['e1', 'c1']);
  });

  it('filters by kind buckets', () => {
    const items = mergeFeed(
      [comment({ id: 'c1' })],
      [
        event({ id: 'e1', action: 'completed' }),
        event({ id: 'e2', action: 'blocked' }),
        event({ id: 'e3', action: 'status_changed' }),
      ],
    );
    expect(filterFeed(items, { kind: 'updates' }, 'u1')).toHaveLength(1);
    expect(filterFeed(items, { kind: 'completed' }, 'u1').map((i) => (i.kind === 'event' ? i.event.id : ''))).toEqual(['e1']);
    expect(filterFeed(items, { kind: 'blocked' }, 'u1')).toHaveLength(1);
    expect(filterFeed(items, { kind: 'status' }, 'u1')).toHaveLength(1);
  });

  it('filters by scope and space and search', () => {
    const items = mergeFeed(
      [
        comment({ id: 'c1', assignee_id: 'u1', body: 'auth token refresh' }),
        comment({ id: 'c2', assignee_id: null, space_id: 's2', task_key: 'BE-009' }),
      ],
      [],
    );
    expect(filterFeed(items, { scope: 'mine' }, 'u1')).toHaveLength(1);
    expect(filterFeed(items, { scope: 'unassigned' }, 'u1')).toHaveLength(1);
    expect(filterFeed(items, { spaceId: 's2' }, 'u1')).toHaveLength(1);
    expect(filterFeed(items, { q: 'token' }, 'u1')).toHaveLength(1);
    expect(filterFeed(items, { q: 'BE-009' }, 'u1')).toHaveLength(1);
    expect(filterFeed(items, { q: 'nope' }, 'u1')).toHaveLength(0);
  });

  it('groups by day newest-first', () => {
    // Local-time timestamps keep this independent of the machine timezone.
    const noon = new Date(2026, 8, 22, 12, 0, 0).toISOString();
    const twoDaysAgo = new Date(2026, 8, 20, 12, 0, 0).toISOString();
    const items = mergeFeed(
      [comment({ id: 'c1', created_at: noon }), comment({ id: 'c2', created_at: twoDaysAgo })],
      [],
    );
    const groups = groupFeedByDay(items, new Date(2026, 8, 22, 18, 0, 0));
    expect(groups[0].label).toBe('Today');
    expect(groups.map((g) => g.items.length)).toEqual([1, 1]);
  });

  it('truncates snippets and formats relative time', () => {
    expect(snippet('a '.repeat(200), 20).length).toBeLessThanOrEqual(20);
    expect(snippet('short')).toBe('short');
    const now = new Date('2026-09-22T12:00:00Z');
    expect(timeAgo('2026-09-22T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-09-22T11:00:00Z', now)).toBe('1h ago');
    expect(timeAgo('2026-09-19T12:00:00Z', now)).toBe('3d ago');
    expect(timeAgo('not-a-date', now)).toBe('—');
  });
});
