// Pure selectors for the activity feed. Merging, filtering, and day-grouping
// live here so they are unit-tested; hooks only fetch rows.
import { FEED_EVENT_ACTIONS } from './activity-label';

export interface FeedComment {
  id: string;
  created_at: string;
  space_id: string;
  task_id: string;
  task_key: string;
  task_title: string;
  author_name: string;
  body: string;
  assignee_id: string | null;
}

export interface FeedEvent {
  id: string;
  created_at: string;
  space_id: string;
  task_id: string;
  task_key: string;
  task_title: string;
  actor_name: string;
  action: string;
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  assignee_id: string | null;
}

export type FeedItem = { kind: 'comment'; comment: FeedComment } | { kind: 'event'; event: FeedEvent };

export function isFeedEvent(action: string): boolean {
  return FEED_EVENT_ACTIONS.has(action);
}

function itemTime(i: FeedItem): string {
  return i.kind === 'comment' ? i.comment.created_at : i.event.created_at;
}

/** Merge comments + whitelisted events, newest first. */
export function mergeFeed(comments: FeedComment[], events: FeedEvent[]): FeedItem[] {
  const items: FeedItem[] = [
    ...comments.map((comment) => ({ kind: 'comment' as const, comment })),
    ...events.filter((e) => isFeedEvent(e.action)).map((event) => ({ kind: 'event' as const, event })),
  ];
  items.sort((a, b) => {
    const t = itemTime(b).localeCompare(itemTime(a));
    if (t !== 0) return t;
    if (a.kind !== b.kind) return a.kind === 'comment' ? -1 : 1;
    const aid = a.kind === 'comment' ? a.comment.id : a.event.id;
    const bid = b.kind === 'comment' ? b.comment.id : b.event.id;
    return aid.localeCompare(bid);
  });
  return items;
}

export type FeedKindFilter = 'all' | 'updates' | 'completed' | 'blocked' | 'status';
export type FeedScopeFilter = 'team' | 'mine' | 'unassigned';

export interface FeedFilter {
  spaceId?: string;
  kind?: FeedKindFilter;
  scope?: FeedScopeFilter;
  q?: string;
}

function eventKind(action: string): FeedKindFilter | null {
  if (action === 'completed') return 'completed';
  if (action === 'blocked' || action === 'unblocked') return 'blocked';
  if (action === 'status_changed' || action === 'reopened') return 'status';
  return null; // created / archived: visible under "all" only
}

function assigneeOf(i: FeedItem): string | null {
  return i.kind === 'comment' ? i.comment.assignee_id : i.event.assignee_id;
}

function haystack(i: FeedItem): string {
  if (i.kind === 'comment') {
    const c = i.comment;
    return `${c.task_key} ${c.task_title} ${c.body} ${c.author_name}`.toLowerCase();
  }
  const e = i.event;
  return `${e.task_key} ${e.task_title} ${e.actor_name} ${e.action}`.toLowerCase();
}

export function filterFeed(items: FeedItem[], f: FeedFilter, uid: string): FeedItem[] {
  const q = (f.q ?? '').trim().toLowerCase();
  return items.filter((i) => {
    if (f.spaceId && (i.kind === 'comment' ? i.comment.space_id : i.event.space_id) !== f.spaceId) return false;
    const kind = f.kind ?? 'all';
    if (kind === 'updates' && i.kind !== 'comment') return false;
    if (kind !== 'all' && kind !== 'updates') {
      if (i.kind !== 'event' || eventKind(i.event.action) !== kind) return false;
    }
    const scope = f.scope ?? 'team';
    if (scope === 'mine' && assigneeOf(i) !== uid) return false;
    if (scope === 'unassigned' && assigneeOf(i) !== null) return false;
    if (q && !haystack(i).includes(q)) return false;
    return true;
  });
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key: string, today: string, yesterday: string): string {
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface FeedDayGroup {
  key: string;
  label: string;
  items: FeedItem[];
}

/** Group newest-first items under Today / Yesterday / date headers. */
export function groupFeedByDay(items: FeedItem[], now = new Date()): FeedDayGroup[] {
  const today = dayKey(now);
  const yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  const yesterday = dayKey(yd);
  const groups: FeedDayGroup[] = [];
  const byKey = new Map<string, FeedItem[]>();
  for (const i of items) {
    const d = new Date(itemTime(i));
    const key = Number.isNaN(d.getTime()) ? 'unknown' : dayKey(d);
    const arr = byKey.get(key);
    if (arr) arr.push(i);
    else byKey.set(key, [i]);
  }
  const order = [...byKey.keys()].sort((a, b) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : b.localeCompare(a)));
  for (const key of order) {
    groups.push({ key, label: key === 'unknown' ? 'Unknown date' : dayLabel(key, today, yesterday), items: byKey.get(key)! });
  }
  return groups;
}

export function snippet(body: string, max = 200): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Compact relative timestamp ("just now", "5m ago", "3h ago", "4d ago"); older dates fall back to locale date. */
export function timeAgo(iso: string, now = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Math.max(0, now.getTime() - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}
