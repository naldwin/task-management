import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { spaceSchema, type SpaceInput } from '../../lib/schemas';
import { useCreateSpace, useSpaces } from './hooks';
import { Button, Empty, ErrorBox, Field, Input, Loading } from '../../components/ui';
import { CloseIcon, DotsIcon, PlusIcon } from '../../components/icons';

export function SpacesPage() {
  const { data, isLoading, error, refetch } = useSpaces();
  const create = useCreateSpace();
  const [show, setShow] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMore) return;
    const onPointerDown = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMore(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showMore]);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<SpaceInput>({
    resolver: zodResolver(spaceSchema),
    defaultValues: { name: '', prefix: '', description: '', timezone: 'UTC' },
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;

  const visibleSpaces = (data ?? []).filter((s) => {
    if (!showArchived && s.is_archived) return false;
    if (roleFilter.length > 0 && !roleFilter.includes(s.role)) return false;
    return true;
  });

  const toggleRole = (role: string) =>
    setRoleFilter((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Spaces</h1>
          <p className="text-sm text-muted">Projects, teams, or work areas. You can belong to many.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={moreRef}>
            <Button variant="default" onClick={() => setShowMore((v) => !v)} aria-haspopup="menu" aria-expanded={showMore} icon={<DotsIcon className="h-4 w-4" />}>More</Button>
            {showMore && (
              <div className="card absolute right-0 mt-1 p-2 min-w-[220px] z-10" role="menu">
                <label className="text-xs flex items-center gap-2 px-2 py-1.5 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show archived spaces
                </label>
                <div className="border-t border-charcoal-700 mt-1 pt-1" role="group" aria-label="Filter by role">
                  <p className="text-[11px] uppercase tracking-wide text-muted px-2 py-1">Role</p>
                  {['owner', 'lead', 'member', 'viewer'].map((role) => (
                    <label key={role} className="text-xs flex items-center gap-2 px-2 py-1.5 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={roleFilter.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      User is {role}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button variant="primary" onClick={() => setShow((v) => !v)} icon={show ? <CloseIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}>{show ? 'Close' : 'New space'}</Button>
        </div>
      </div>

      {show && (
        <form
          className="card p-4 mt-3"
          onSubmit={handleSubmit(async (v) => {
            setServerError(null);
            try {
              await create.mutateAsync(v);
              reset();
              setShow(false);
            } catch (e) {
              setServerError((e as Error).message);
            }
          })}
        >
          <Field label="Name" error={formState.errors.name?.message}><Input {...register('name')} /></Field>
          <Field label="Task prefix (e.g. DEV)" error={formState.errors.prefix?.message}>
            <Input {...register('prefix')} placeholder="DEV" style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="Description"><Input {...register('description')} /></Field>
          <Field label="Reporting timezone">
            <Input {...register('timezone')} placeholder="UTC or Europe/Berlin" />
          </Field>
          {serverError && <p className="error-text" role="alert">{serverError}</p>}
          <Button variant="primary" disabled={create.isPending} icon={<PlusIcon className="h-4 w-4" />}>{create.isPending ? 'Creating…' : 'Create space'}</Button>
        </form>
      )}

      <div className="mt-3">
        {!data?.length ? (
          <>
            <Empty title="No spaces" hint="Create your first space above." />
            <p className="text-sm text-muted mt-3">
              Not sure where to start? Use the ? icon at the top of the sidebar to see the core workflow.
            </p>
          </>
        ) : !visibleSpaces.length ? (
          <Empty
            title="No spaces match"
            hint={
              roleFilter.length > 0
                ? 'No spaces match the selected role filters. Adjust filters from the More menu.'
                : 'All your spaces are archived. Enable Show archived spaces from the More menu to see them.'
            }
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full table-compact">
              <thead><tr><th>Name</th><th>Prefix</th><th>Role</th><th>State</th><th></th></tr></thead>
              <tbody>
                {visibleSpaces.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/spaces/${s.id}/tasks`} className="no-underline font-medium">{s.name}</Link></td>
                    <td className="font-mono text-xs">{s.prefix}</td>
                    <td className="text-muted">{s.role}</td>
                    <td className="text-muted">{s.is_archived ? 'Archived' : 'Active'}</td>
                    <td className="whitespace-nowrap">
                      <Link to={`/spaces/${s.id}/tasks`} className="no-underline text-xs mr-2">Tasks</Link>
                      <Link to={`/spaces/${s.id}/members`} className="no-underline text-xs mr-2">Members</Link>
                      <Link to={`/spaces/${s.id}/reports`} className="no-underline text-xs">Reports</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
