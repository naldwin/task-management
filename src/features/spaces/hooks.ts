import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Membership, Space, Status, Profile } from '../../lib/database.types';
import { useAuth } from '../../lib/auth';

export function useSpaces() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['spaces', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Array<Space & { role: string }>> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('role, spaces(*)')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{ role: string; spaces: Space }>;
      return rows
        .map((m) => ({ ...(m.spaces as Space), role: m.role }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useSpace(spaceId: string | undefined) {
  return useQuery({
    queryKey: ['space', spaceId],
    enabled: !!spaceId,
    queryFn: async () => {
      const { data, error } = await supabase.from('spaces').select('*').eq('id', spaceId).maybeSingle();
      if (error) throw error;
      return data as Space | null;
    },
  });
}

export function useMyRole(spaceId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-role', spaceId, user?.id],
    enabled: !!spaceId && !!user,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('role')
        .eq('space_id', spaceId)
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as string) ?? null;
    },
  });
}

export function useMembers(spaceId: string | undefined) {
  return useQuery({
    queryKey: ['members', spaceId],
    enabled: !!spaceId,
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('*, profile:profiles!memberships_user_id_fkey(*)')
        .eq('space_id', spaceId)
        .eq('is_active', true)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });
}

export function useStatuses(spaceId: string | undefined) {
  return useQuery({
    queryKey: ['statuses', spaceId],
    enabled: !!spaceId,
    queryFn: async (): Promise<Status[]> => {
      const { data, error } = await supabase
        .from('statuses')
        .select('*')
        .eq('space_id', spaceId)
        .eq('is_retired', false)
        .order('position');
      if (error) throw error;
      return (data ?? []) as Status[];
    },
  });
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; prefix: string; description?: string; timezone?: string }) => {
      const { data, error } = await supabase.rpc('create_space', {
        p_name: input.name,
        p_prefix: input.prefix,
        p_description: input.description ?? '',
        p_timezone: input.timezone ?? 'UTC',
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['spaces'] }),
  });
}

export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string; timezone?: string; is_archived?: boolean }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      if (input.timezone !== undefined) patch.timezone = input.timezone;
      if (input.is_archived !== undefined) patch.is_archived = input.is_archived;
      const { error } = await supabase.from('spaces').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['spaces'] });
      void qc.invalidateQueries({ queryKey: ['space', v.id] });
    },
  });
}

export function useCreateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { space_id: string; name: string; color: string; category: string; is_default?: boolean; position?: number }) => {
      const { error } = await supabase.from('statuses').insert({
        space_id: input.space_id, name: input.name, color: input.color,
        category: input.category, is_default: input.is_default ?? false, position: input.position ?? 99,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['statuses', v.space_id] }),
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; space_id: string; name?: string; color?: string; category?: string; position?: number; is_default?: boolean }) => {
      const { id, space_id: _s, ...patch } = input;
      const { error } = await supabase.from('statuses').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['statuses', v.space_id] }),
  });
}

export function useRetireStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { status_id: string; replacement_id: string }) => {
      const { error } = await supabase.rpc('retire_status', {
        p_status_id: input.status_id, p_replacement_id: input.replacement_id,
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['statuses'] }),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { space_id: string; user_id: string; role: string }) => {
      const { error } = await supabase.rpc('update_member_role', {
        p_space_id: input.space_id, p_user_id: input.user_id, p_role: input.role,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['members', v.space_id] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { space_id: string; user_id: string }) => {
      const { error } = await supabase.rpc('remove_member', {
        p_space_id: input.space_id, p_user_id: input.user_id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['members', v.space_id] });
      void qc.invalidateQueries({ queryKey: ['spaces'] });
    },
  });
}

export function useAllProfiles() {
  // Intentionally NOT used for a searchable directory.
  // Only used to resolve names for already-visible member lists.
  return useQuery({
    queryKey: ['profiles-count'],
    queryFn: async () => 0,
  });
}

export type { Profile };
