import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { spaceSchema, type SpaceInput } from '../../lib/schemas';
import { useCreateSpace, useSpaces } from './hooks';
import { Button, Empty, ErrorBox, Field, Input, Loading } from '../../components/ui';

export function SpacesPage() {
  const { data, isLoading, error, refetch } = useSpaces();
  const create = useCreateSpace();
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<SpaceInput>({
    resolver: zodResolver(spaceSchema),
    defaultValues: { name: '', prefix: '', description: '', timezone: 'UTC' },
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Spaces</h1>
          <p className="text-sm text-muted">Projects, teams, or work areas. You can belong to many.</p>
        </div>
        <Button variant="primary" onClick={() => setShow((v) => !v)}>{show ? 'Close' : 'New space'}</Button>
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
          <Button variant="primary" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create space'}</Button>
        </form>
      )}

      <div className="mt-3">
        {!data?.length ? (
          <Empty title="No spaces" hint="Create your first space above." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full table-compact">
              <thead><tr><th>Name</th><th>Prefix</th><th>Role</th><th>State</th><th></th></tr></thead>
              <tbody>
                {data.map((s) => (
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
