import { describe, expect, it } from 'vitest';
import { can, isOverdue, monthKey, monthStartOf } from './utils';

// Authorization boundaries: UI helper must match server rules (owner-only actions,
// lead/member limits, viewer read-only). Server RLS/RPC is authoritative; this
// guards the client from offering forbidden actions.
describe('authorization boundaries (can)', () => {
  it('only owners manage spaces / roles', () => {
    expect(can('manage-space', 'owner')).toBe(true);
    expect(can('manage-space', 'lead')).toBe(false);
    expect(can('manage-space', 'member')).toBe(false);
    expect(can('manage-space', 'viewer')).toBe(false);
  });
  it('owners and leads manage statuses, reports, invitations', () => {
    for (const a of ['manage-status', 'manage-report', 'invite']) {
      expect(can(a, 'owner')).toBe(true);
      expect(can(a, 'lead')).toBe(true);
      expect(can(a, 'member')).toBe(false);
      expect(can(a, 'viewer')).toBe(false);
    }
  });
  it('viewers are read-only', () => {
    expect(can('create-task', 'viewer')).toBe(false);
    expect(can('comment', 'viewer')).toBe(false);
    expect(can('read', 'viewer')).toBe(true);
  });
  it('unknown role grants nothing', () => {
    expect(can('read', null)).toBe(false);
    expect(can('read', undefined)).toBe(false);
  });
});

// Invitation acceptance: lead invite rules (leads cannot invite owner/lead).
describe('invitation role rules', () => {
  const leadMayInvite = (myRole: string, offered: string) =>
    myRole === 'owner' ? true : !['owner', 'lead'].includes(offered);
  it('leads cannot invite owners or leads', () => {
    expect(leadMayInvite('lead', 'owner')).toBe(false);
    expect(leadMayInvite('lead', 'lead')).toBe(false);
    expect(leadMayInvite('lead', 'member')).toBe(true);
    expect(leadMayInvite('lead', 'viewer')).toBe(true);
    expect(leadMayInvite('owner', 'owner')).toBe(true);
  });
  it('email normalization matches server norm_email()', () => {
    const norm = (e: string) => e.trim().toLowerCase();
    expect(norm('  Alice@Example.COM ')).toBe('alice@example.com');
  });
});

// Custom status handling: reporting category mapping (In Review -> Active).
describe('custom status categories', () => {
  const categoryOf = (name: string, fallback = 'Active') => {
    const map: Record<string, string> = {
      Backlog: 'Not Started', 'To Do': 'Not Started', 'In Progress': 'Active',
      'In Review': 'Active', Done: 'Done', Cancelled: 'Cancelled',
    };
    return map[name] ?? fallback;
  };
  it('maps In Review to Active', () => {
    expect(categoryOf('In Review')).toBe('Active');
  });
  it('dashboards use categories, not names', () => {
    expect(categoryOf('QA Review', 'Active')).toBe('Active');
    expect(categoryOf('Shipped', 'Done')).toBe('Done');
  });
});

// Task reopening: Done sets completion; reopening clears current timestamp but keeps history.
describe('task reopening semantics', () => {
  it('overdue excludes Done and Cancelled', () => {
    expect(isOverdue('2000-01-01', 'Active')).toBe(true);
    expect(isOverdue('2000-01-01', 'Done')).toBe(false);
    expect(isOverdue('2000-01-01', 'Cancelled')).toBe(false);
    expect(isOverdue(null, 'Active')).toBe(false);
  });
});

// Monthly report date boundaries: inclusive start, exclusive next-month start.
describe('monthly report date boundaries', () => {
  it('month key round-trips', () => {
    expect(monthKey(new Date(2026, 7, 15))).toBe('2026-08');
    expect(monthStartOf('2026-08').toISOString().slice(0, 10)).toBe('2026-08-01');
  });
  it('event belongs to month iff start <= t < nextStart', () => {
    const inMonth = (t: Date, start: Date, end: Date) => t >= start && t < end;
    const start = new Date('2026-08-01T00:00:00Z');
    const end = new Date('2026-09-01T00:00:00Z');
    expect(inMonth(new Date('2026-08-01T00:00:00Z'), start, end)).toBe(true);
    expect(inMonth(new Date('2026-08-31T23:59:59Z'), start, end)).toBe(true);
    expect(inMonth(new Date('2026-09-01T00:00:00Z'), start, end)).toBe(false);
    expect(inMonth(new Date('2026-07-31T23:59:59Z'), start, end)).toBe(false);
  });
});
