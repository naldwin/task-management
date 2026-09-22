import { Link } from 'react-router-dom';
import { detailActivity, labelActivity } from '../../lib/activity-label';
import { snippet, timeAgo, type FeedDayGroup, type FeedItem } from '../../lib/feed-selectors';
import { fmtDateTime } from '../../lib/utils';

function eventBadgeClass(action: string): string {
  if (action === 'completed') return 'border-accent text-accent';
  if (action === 'blocked') return 'border-red-900 text-red-300';
  if (action === 'reopened') return 'border-amber-900 text-amber-200';
  return '';
}

export function FeedItemRow({ item, spaceName }: { item: FeedItem; spaceName: string }) {
  if (item.kind === 'comment') {
    const c = item.comment;
    return (
      <li className="border-b border-charcoal-800 pb-2 last:border-0 last:pb-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm min-w-0">
            <span className="badge mr-1.5">Update</span>
            <span className="font-mono text-xs text-muted mr-1">{c.task_key}</span>
            <Link to={`/spaces/${c.space_id}/tasks/${c.task_id}`} className="no-underline font-medium">
              {c.task_title}
            </Link>
          </p>
          <span className="text-xs text-muted shrink-0" title={fmtDateTime(c.created_at)}>{timeAgo(c.created_at)}</span>
        </div>
        <p className="text-sm mt-0.5">{snippet(c.body)}</p>
        <p className="text-xs text-muted mt-0.5">
          {c.author_name} · {spaceName}
        </p>
      </li>
    );
  }
  const e = item.event;
  const detail = detailActivity({ action: e.action, field_name: e.field_name, old_value: e.old_value, new_value: e.new_value });
  return (
    <li className="border-b border-charcoal-800 pb-2 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm min-w-0">
          <span className={`badge mr-1.5 ${eventBadgeClass(e.action)}`}>{labelActivity({ action: e.action, field_name: e.field_name, old_value: null, new_value: null })}</span>
          <span className="font-mono text-xs text-muted mr-1">{e.task_key}</span>
          <Link to={`/spaces/${e.space_id}/tasks/${e.task_id}`} className="no-underline font-medium">
            {e.task_title}
          </Link>
        </p>
        <span className="text-xs text-muted shrink-0" title={fmtDateTime(e.created_at)}>{timeAgo(e.created_at)}</span>
      </div>
      {detail && <p className="text-xs text-muted mt-0.5">{detail}</p>}
      <p className="text-xs text-muted mt-0.5">
        {e.actor_name} · {spaceName}
      </p>
    </li>
  );
}

export function FeedGroups({ groups, spaceNameOf }: { groups: FeedDayGroup[]; spaceNameOf: (spaceId: string) => string }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</h3>
          <ul className="mt-1.5 flex flex-col gap-2">
            {g.items.map((i) => (
              <FeedItemRow
                key={`${i.kind}-${i.kind === 'comment' ? i.comment.id : i.event.id}`}
                item={i}
                spaceName={spaceNameOf(i.kind === 'comment' ? i.comment.space_id : i.event.space_id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
