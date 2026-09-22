// Shared human-readable labels for task_activity rows.
// Used by both the task detail timeline and the activity feed — keep them here
// so the two views never diverge.
export interface ActivityLike {
  action: string;
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
}

export function labelActivity(a: ActivityLike): string {
  switch (a.action) {
    case 'created':
      return 'Created';
    case 'status_changed':
      return 'Status changed';
    case 'completed':
      return 'Completed';
    case 'reopened':
      return 'Reopened (completion cleared, history preserved)';
    case 'blocked':
      return 'Marked blocked';
    case 'unblocked':
      return 'Unblocked';
    case 'archived':
      return 'Archived';
    case 'unarchived':
      return 'Unarchived';
    default:
      return a.field_name ? `Updated ${a.field_name}` : a.action;
  }
}

export function detailActivity(a: ActivityLike): string {
  try {
    const o = a.old_value as { label?: string } | null;
    const n = a.new_value as { label?: string } | null;
    if (
      o &&
      typeof o === 'object' &&
      n &&
      typeof n === 'object' &&
      ('label' in o || 'label' in n)
    ) {
      return `${(o as { label?: string }).label ?? JSON.stringify(o)} → ${(n as { label?: string }).label ?? JSON.stringify(n)}`;
    }
    if (a.old_value != null || a.new_value != null) {
      const s = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
      if (a.old_value != null && a.new_value != null) return `${s(a.old_value)} → ${s(a.new_value)}`;
      return s(a.new_value ?? a.old_value);
    }
  } catch {
    /* ignore */
  }
  return '';
}

/** Lifecycle actions worth surfacing in the team feed (field-level edits excluded as noise). */
export const FEED_EVENT_ACTIONS: ReadonlySet<string> = new Set([
  'created',
  'completed',
  'reopened',
  'blocked',
  'unblocked',
  'status_changed',
  'archived',
]);
