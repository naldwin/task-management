import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './components/layout';
import { Loading } from './components/ui';
import { LoginPage, RegisterPage } from './features/auth/pages';
import { OverviewPage } from './features/overview/page';
import { MyTasksPage } from './features/mytasks/page';
import { SpacesPage } from './features/spaces/pages';
import { SpaceTasksPage } from './features/tasks/list';
import { TaskDetailPage } from './features/tasks/detail';
import { SpaceMembersPage, SpaceSettingsPage } from './features/spaces/manage';
import { SpaceReportDetailPage, SpaceReportsPage } from './features/reports/pages';
import { AccountPage } from './features/settings/account';

function Protected() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-6"><Loading /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function NotFound() {
  return (
    <div className="card p-6">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-muted">The link may be wrong or the item was removed.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/my-tasks" element={<MyTasksPage />} />
        <Route path="/profile" element={<AccountPage />} />
        <Route path="/spaces" element={<SpacesPage />} />
        <Route path="/spaces/:spaceId/tasks" element={<SpaceTasksPage />} />
        <Route path="/spaces/:spaceId/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/spaces/:spaceId/members" element={<SpaceMembersPage />} />
        <Route path="/spaces/:spaceId/settings" element={<SpaceSettingsPage />} />
        <Route path="/spaces/:spaceId/reports" element={<SpaceReportsPage />} />
        <Route path="/spaces/:spaceId/reports/:month" element={<SpaceReportDetailPage />} />
        <Route path="/account" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
