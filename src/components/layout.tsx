import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { usePendingInvitationCount } from '../features/invitations/hooks';
import { useSpaces } from '../features/spaces/hooks';
import { SystemOverviewContent } from '../features/system/page';
import { WorkloggerLogo } from './brand';
import { CloseIcon, LogoutIcon } from './icons';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md2 px-2.5 py-1.5 text-sm no-underline transition-colors ${
    isActive ? 'bg-charcoal-800 text-white' : 'text-muted hover:bg-charcoal-800 hover:text-white'
  }`;

function HelpButton({ onClick, label = 'How this system works' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-haspopup="dialog"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm2 text-sm leading-none text-muted hover:text-white hover:bg-charcoal-800"
    >
      <span aria-hidden>?</span>
    </button>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-overview-title"
    >
      <button
        type="button"
        aria-label="Close system overview"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <div className="card relative max-h-[85dvh] w-full max-w-3xl overflow-y-auto p-4 md:p-5">
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="btn"
          >
            <span aria-hidden className="inline-flex shrink-0"><CloseIcon className="h-4 w-4" /></span>
            Close
          </button>
        </div>
        <SystemOverviewContent onNavigate={onClose} />
      </div>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();
  const { data: spaces } = useSpaces();
  const { data: inviteCount } = usePendingInvitationCount();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const activeSpaceCount = spaces?.filter((s) => !s.is_archived).length ?? 0;

  const links = (
    <nav className="flex flex-col gap-0.5 p-2" aria-label="Primary">
      <NavLink to="/overview" className={linkCls} onClick={onNavigate}>Overview</NavLink>
      <NavLink to="/my-tasks" className={linkCls} onClick={onNavigate}>My Tasks</NavLink>
      <NavLink to="/spaces" className={linkCls} onClick={onNavigate}>
        Spaces{activeSpaceCount ? ` (${activeSpaceCount})` : ''}
      </NavLink>
      <NavLink to="/profile" className={linkCls} onClick={onNavigate}>
        Profile{inviteCount ? ` (${inviteCount})` : ''}
      </NavLink>
    </nav>
  );

  const displayName = profile?.display_name ?? 'Member';
  const email = profile?.email ?? '';

  return (
    <>
      {/* mobile bar */}
      <div className="no-print md:hidden flex items-center justify-between border-b border-charcoal-700 bg-charcoal-900 px-3 py-2">
        <WorkloggerLogo className="h-10 w-auto" />
        <span className="flex items-center gap-2">
          <HelpButton onClick={() => setHelpOpen(true)} />
          <button className="btn" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Menu'}
          </button>
        </span>
      </div>
      {open && <div className="no-print md:hidden border-b border-charcoal-700 bg-charcoal-900">{links}</div>}

      {/* desktop sidebar */}
      <aside className="no-print hidden md:flex w-56 shrink-0 self-start flex-col border-r border-charcoal-700 bg-charcoal-900 md:sticky md:top-0 md:h-dvh">
        <div className="px-3 py- border-b border-charcoal-700 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <WorkloggerLogo className="h-12 w-auto" />
            <HelpButton onClick={() => setHelpOpen(true)} />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{links}</div>
        <div className="py-2 pl-4 pr-2 border-t border-charcoal-700 flex items-center gap-2 shrink-0 bg-charcoal-900">
          <span className="flex-1 min-w-0 leading-tight">
            <span className="block truncate text-sm font-medium text-slate-100" title={email || displayName}>{displayName}</span>
            {email && <span className="block truncate text-xs text-muted" title={email}>{email}</span>}
          </span>
          <button
            type="button"
            title="Log out"
            aria-label="Log out"
            className="btn btn-ghost !px-2 shrink-0 text-muted hover:text-white"
            onClick={() => { void signOut().then(() => nav('/login')); }}
          >
            <span aria-hidden className="inline-flex shrink-0"><LogoutIcon className="h-4 w-4" /></span>
          </button>
        </div>
      </aside>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <div className="min-h-dvh md:flex md:items-start">
      <Sidebar onNavigate={() => setMobileNav(false)} />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-3 py-4 md:px-6" data-mobile-nav={mobileNav}>
          {children}
        </div>
      </main>
    </div>
  );
}
