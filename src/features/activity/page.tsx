import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSpaces } from '../spaces/hooks';
import { useAuth } from '../../lib/auth';
import { useActivityFeed, type FeedPage } from './hooks';
import { FeedGroups } from './feed';
import { Button, Empty, ErrorBox, Input, Loading, Select } from '../../components/ui';
import {
  filterFeed,
  groupFeedByDay,
  mergeFeed,
  type FeedKindFilter,
  type FeedScopeFilter,
} from '../../lib/feed-selectors';

const PAGE_SIZE = 30;

const KIND_OPTIONS: Array<{ value: FeedKindFilter; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'updates', label: 'Updates' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'status', label: 'Status changes' },
];

const SCOPE_OPTIONS: Array<{ value: FeedScopeFilter; label: string }> = [
  { value: 'team', label: 'Team' },
  { value: 'mine', label: 'Mine' },
  { value: 'unassigned', label: 'Unassigned' },
];

function itemTime(i: { kind: 'comment'; comment: { created_at: string } } | { kind: 'event'; event: { created_at: string } }): string {
  return i.kind === 'comment' ? i.comment.created_at : i.event.created_at;
}

export function ActivityPage() {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const { data: spaces } = useSpaces();
  const [params, setParams] = useSearchParams();

  const spaceFilter = params.get('space') ?? '';
  const kind = (params.get('kind') as FeedKindFilter) || 'all';
  const scope = (params.get('scope') as FeedScopeFilter) || 'team';
  const q = params.get('q') ?? '';
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === 'all' || v === 'team') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: false });
  };

  const spaceIds = useMemo(() => (spaces ?? []).map((s) => s.id), [spaces]);
  const spaceNameOf = useMemo(() => {
    const m = Object.fromEntries((spaces ?? []).map((s) => [s.id, s.name]));
    return (id: string) => m[id] ?? id.slice(0, 8);
  }, [spaces]);

  // Cursor pagination: each "Load more" adds a server query bounded by the
  // oldest item seen so far; results accumulate client-side.
  const [before, setBefore] = useState<string | undefined>();
  const [acc, setAcc] = useState<FeedPage>({ comments: [], events: [] });
  const seenCursors = useRef<Set<string>>(new Set());

  const querySpaceIds = spaceFilter ? [spaceFilter] : spaceIds;
  const { data, isLoading, isFetching, error, refetch } = useActivityFeed(querySpaceIds, before, PAGE_SIZE);

  const filterSig = `${querySpaceIds.join(',')}|${kind}|${scope}|${q}`;
  useEffect(() => {
    setAcc({ comments: [], events: [] });
    setBefore(undefined);
    seenCursors.current = new Set();
  }, [filterSig]);

  useEffect(() => {
    if (!data) return;
    const cursor = before ?? '__first__';
    if (seenCursors.current.has(cursor)) return;
    seenCursors.current.add(cursor);
    setAcc((prev) => {
      const seen = new Set([...prev.comments.map((c) => `c:${c.id}`), ...prev.events.map((e) => `e:${e.id}`)]);
      return {
        comments: [...prev.comments, ...data.comments.filter((c) => !seen.has(`c:${c.id}`))],
        events: [...prev.events, ...data.events.filter((e) => !seen.has(`e:${e.id}`))],
      };
    });
  }, [data, before]);

  const items = useMemo(
    () => filterFeed(mergeFeed(acc.comments, acc.events), { spaceId: spaceFilter || undefined, kind, scope, q }, uid),
    [acc, spaceFilter, kind, scope, q, uid],
  );
  const groups = useMemo(() => groupFeedByDay(items), [items]);
  const hasMore = !!data && (data.comments.length >= PAGE_SIZE || data.events.length >= PAGE_SIZE);

  const loadMore = () => {
    const all = mergeFeed(acc.comments, acc.events);
    if (!all.length) return;
    setBefore(itemTime(all[all.length - 1]));
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">Activity</h1>
      <p className="text-sm text-muted">What’s happening across your spaces.</p>

      <div className="card mt-3 p-3 flex flex-wrap gap-x-3 gap-y-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label" htmlFor="a-q">Search</label>
          <Input id="a-q" placeholder="Task key, title, update…" defaultValue={q} onChange={(e) => set({ q: e.target.value || undefined })} />
        </div>
        <div className="min-w-[150px]">
          <label className="label" htmlFor="a-space">Space</label>
          <Select id="a-space" value={spaceFilter} onChange={(e) => set({ space: e.target.value || undefined })}>
            <option value="">All spaces</option>
            {(spaces ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div className="min-w-[150px]">
          <label className="label" htmlFor="a-kind">Type</label>
          <Select id="a-kind" value={kind} onChange={(e) => set({ kind: e.target.value })}>
            {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="min-w-[130px]">
          <label className="label" htmlFor="a-scope">Scope</label>
          <Select id="a-scope" value={scope} onChange={(e) => set({ scope: e.target.value })}>
            {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </div>

      <div className="mt-3" aria-live="polite">
        {isLoading ? <Loading label="Loading activity…" /> : error ? (
          <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />
        ) : !items.length ? (
          <Empty
            title={acc.comments.length || acc.events.length ? 'Nothing matches these filters' : 'No activity yet'}
            hint={acc.comments.length || acc.events.length ? 'Clear the search or widen the filters.' : 'Post the first update from any task.'}
          />
        ) : (
          <>
            <div className="card p-4">
              <FeedGroups groups={groups} spaceNameOf={spaceNameOf} />
            </div>
            {hasMore && (
              <div className="mt-3 text-center">
                <Button disabled={isFetching} onClick={loadMore}>{isFetching ? 'Loading…' : 'Load more'}</Button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-muted mt-3">
        Full threads live on each task — <Link to="/overview" className="no-underline">back to Overview</Link>.
      </p>
    </div>
  );
}
