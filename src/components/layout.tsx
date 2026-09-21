import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { usePendingInvitationCount } from '../features/invitations/hooks';
import { useSpaces } from '../features/spaces/hooks';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md2 px-2.5 py-1.5 text-sm no-underline transition-colors ${
    isActive ? 'bg-charcoal-800 text-white' : 'text-muted hover:bg-charcoal-800 hover:text-white'
  }`;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();
  const { data: spaces } = useSpaces();
  const { data: inviteCount } = usePendingInvitationCount();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-0.5 p-2" aria-label="Primary">
      <NavLink to="/overview" className={linkCls} onClick={onNavigate}>Overview</NavLink>
      <NavLink to="/my-tasks" className={linkCls} onClick={onNavigate}>My Tasks</NavLink>
      <NavLink to="/spaces" className={linkCls} onClick={onNavigate}>
        Spaces{spaces?.length ? ` (${spaces.length})` : ''}
      </NavLink>
      <NavLink to="/invitations" className={linkCls} onClick={onNavigate}>
        Invitations{inviteCount ? ` (${inviteCount})` : ''}
      </NavLink>
      <NavLink to="/account" className={linkCls} onClick={onNavigate}>Account</NavLink>
    </nav>
  );

  return (
    <>
      {/* mobile bar */}
      <div className="no-print md:hidden flex items-center justify-between border-b border-charcoal-700 bg-charcoal-900 px-3 py-2">
        <span className="text-sm font-semibold">nalds <span className="text-muted font-normal">· Task Management</span></span>
        <button className="btn" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && <div className="no-print md:hidden border-b border-charcoal-700 bg-charcoal-900">{links}</div>}

      {/* desktop sidebar */}
      <aside className="no-print hidden md:flex w-56 shrink-0 flex-col border-r border-charcoal-700 bg-charcoal-900">
        <div className="px-3 py-3 border-b border-charcoal-700">
          <p className="text-sm font-bold leading-tight">nalds</p>
          <p className="text-xs text-muted">Task Management</p>
          {profile && <p className="text-xs text-muted mt-1 truncate" title={profile.email}>{profile.display_name}</p>}
        </div>
        <div className="flex-1 overflow-y-auto">{links}</div>
        <div className="p-2 border-t border-charcoal-700">
          <button
            className="btn w-full"
            onClick={() => { void signOut().then(() => nav('/login')); }}
          >
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <div className="min-h-full md:flex">
      <Sidebar onNavigate={() => setMobileNav(false)} />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-3 py-4 md:px-6" data-mobile-nav={mobileNav}>
          {children}
        </div>
      </main>
    </div>
  );
}
