import { Link } from 'react-router-dom';
import { WorkloggerLogo } from '../../components/brand';

const steps = [
  {
    title: 'Create a space',
    body: 'Give it a name, a short prefix such as DEV, and a reporting timezone. You become the owner. The prefix cannot change later because task keys must stay stable.',
    to: '/spaces',
    linkLabel: 'Go to Spaces',
  },
  {
    title: 'Define the workflow',
    body: 'Add the statuses your work moves through in Space settings. Each status maps to one reporting category: Not Started, Active, Done, or Cancelled. Retiring a status asks for a replacement and moves its tasks in one step.',
    to: '/spaces',
    linkLabel: 'Open a space, then Settings',
  },
  {
    title: 'Invite by email',
    body: 'Owners and leads invite from the Members page. Nothing is sent by email — the invite waits under Invitations until the recipient accepts. Leads can invite members and viewers; only owners can invite leads and owners.',
    to: '/invitations',
    linkLabel: 'Go to Invitations',
  },
  {
    title: 'Add and assign tasks',
    body: 'Tasks get stable keys like DEV-001 that are never reused. Owners, leads, and members can create tasks, change status, and comment. Assignment is limited to active members of the same space. Blocking is a separate flag with a reason, so a blocked task keeps its status.',
    to: '/my-tasks',
    linkLabel: 'Go to My Tasks',
  },
  {
    title: 'Follow blocked, overdue, and completed work',
    body: 'Search, filters, sorting, and pagination live in the URL, so a filtered view can be shared and survives refresh. Done records when the task finished; reopening clears that date but keeps the history. The activity log is append-only.',
    to: '/overview',
    linkLabel: 'Go to Overview',
  },
  {
    title: 'Generate the monthly report',
    body: 'Owners and leads pick a month (YYYY-MM) on the Reports page and click Generate report. The result is a saved snapshot: counts, completion by assignee, the task list at month-end, and progress updates. Re-running a month overwrites that snapshot; Print saves it to PDF.',
    to: '/spaces',
    linkLabel: 'Open a space, then Reports',
  },
];

export function SystemOverviewContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div>
      <WorkloggerLogo className="h-7 w-auto" />
      <h2 id="system-overview-title" className="text-lg font-semibold mt-2">System overview</h2>
      <p className="text-sm text-muted mt-1 leading-relaxed">
        Spaces hold the members and the workflow. Tasks move through that
        workflow. Invitations grant access. Reports freeze one month of that
        work into a snapshot you can keep.
      </p>

      <section aria-label="Core workflow" className="mt-5">
        <h3 className="text-sm font-semibold">
          Core workflow
        </h3>
        <ol className="mt-2 space-y-2">
          {steps.map((s, i) => (
            <li key={s.title} className="card px-3 py-2.5 flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm2 border border-charcoal-600 text-xs text-muted"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-sm text-muted mt-0.5 leading-relaxed">{s.body}</p>
                <p className="text-xs mt-1">
                  <Link to={s.to} className="no-underline" onClick={onNavigate}>
                    {s.linkLabel}
                  </Link>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="How statuses feed the dashboards" className="mt-5">
        <h3 className="text-sm font-semibold">
          How statuses feed the dashboards
        </h3>
        <p className="text-sm text-muted mt-1">
          Status names are yours. Their category is what Overview and reports count.
        </p>
        <div className="card mt-2 overflow-x-auto">
          <table className="w-full table-compact">
            <thead>
              <tr>
                <th>Category</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Not Started</td><td className="text-muted">Queued work, not yet active.</td></tr>
              <tr><td>Active</td><td className="text-muted">In progress, including review. Blocking is tracked separately.</td></tr>
              <tr><td>Done</td><td className="text-muted">Finished. Records the completion date.</td></tr>
              <tr><td>Cancelled</td><td className="text-muted">Closed without finishing. Kept for the record.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Roles in a space" className="mt-5">
        <h3 className="text-sm font-semibold">
          Roles in a space
        </h3>
        <div className="card mt-2 px-3 py-2.5 text-sm leading-relaxed">
          <p><strong>Owner</strong> <span className="text-muted">— manages the space, members, statuses, and reports. The last owner cannot be removed.</span></p>
          <p className="mt-1"><strong>Lead</strong> <span className="text-muted">— invites members and viewers, manages statuses and reports.</span></p>
          <p className="mt-1"><strong>Member</strong> <span className="text-muted">— creates tasks, changes status and assignee, comments.</span></p>
          <p className="mt-1"><strong>Viewer</strong> <span className="text-muted">— reads. Cannot create tasks or generate reports.</span></p>
        </div>
      </section>

      <section aria-label="Get started" className="mt-5">
        <h3 className="text-sm font-semibold">
          Get started
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li><Link to="/spaces" className="no-underline font-medium" onClick={onNavigate}>Create your first space</Link> <span className="text-muted">— name, prefix, timezone.</span></li>
          <li><Link to="/invitations" className="no-underline font-medium" onClick={onNavigate}>Check invitations</Link> <span className="text-muted">— accept a space someone shared with this email.</span></li>
          <li><Link to="/my-tasks" className="no-underline font-medium" onClick={onNavigate}>Open My Tasks</Link> <span className="text-muted">— work assigned to you across spaces.</span></li>
          <li><Link to="/account" className="no-underline font-medium" onClick={onNavigate}>Review your account</Link> <span className="text-muted">— display name shown to teammates.</span></li>
        </ul>
      </section>
    </div>
  );
}
