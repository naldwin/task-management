import { describe, expect, it } from 'vitest';
import { detailActivity, FEED_EVENT_ACTIONS, labelActivity } from './activity-label';

describe('activity labels', () => {
  it('labels lifecycle actions', () => {
    const base = { field_name: null, old_value: null, new_value: null };
    expect(labelActivity({ ...base, action: 'completed' })).toBe('Completed');
    expect(labelActivity({ ...base, action: 'blocked' })).toBe('Marked blocked');
    expect(labelActivity({ ...base, action: 'status_changed' })).toBe('Status changed');
  });
  it('falls back to field name or raw action', () => {
    expect(labelActivity({ action: 'updated', field_name: 'priority', old_value: null, new_value: null })).toBe(
      'Updated priority',
    );
    expect(labelActivity({ action: 'mystery', field_name: null, old_value: null, new_value: null })).toBe('mystery');
  });
  it('renders label transitions and raw values', () => {
    expect(
      detailActivity({ action: 'status_changed', field_name: 'status', old_value: { label: 'To Do' }, new_value: { label: 'Done' } }),
    ).toBe('To Do → Done');
    expect(detailActivity({ action: 'x', field_name: null, old_value: null, new_value: null })).toBe('');
  });
  it('feed whitelist covers lifecycle, excludes field edits', () => {
    for (const a of ['created', 'completed', 'reopened', 'blocked', 'unblocked', 'status_changed', 'archived']) {
      expect(FEED_EVENT_ACTIONS.has(a)).toBe(true);
    }
    expect(FEED_EVENT_ACTIONS.has('updated')).toBe(false);
  });
});
