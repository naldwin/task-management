import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { Invitation } from '../../lib/database.types';

export function useMyInvitations() {
  const { user, profile } = useAuth();
  return useQuery({
    queryKey: ['invitations', 'mine', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Invitation[]> => {
      // Server-side matching: pending invites addressed to my user id OR my email (case-insensitive).
      const email = profile?.email?.toLowerCase() ?? user?.email?.toLowerCase() ?? '';
      let q = supabase
        .from('invitations')
        .select('*, space:spaces!invitations_space_id_fkey(id,name,prefix), inviter:profiles!invitations_invited_by_fkey(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Invitation[];
      return rows.filter(
        (r) => r.user_id === user!.id || r.email.toLowerCase() === email,
      );
    },
  });
}

export function usePendingInvitationCount() {
  const q = useMyInvitations();
  return { ...q, data: q.data?.length ?? 0 };
}

export function useSpaceInvitations(spaceId: string | undefined) {
  return useQuery({
    queryKey: ['invitations', 'space', spaceId],
    enabled: !!spaceId,
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('space_id', spaceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Invitation[];
    },
  });
}

export function useInviteUser(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; role: string }) => {
      const { error } = await supabase.rpc('invite_user', {
        p_space_id: spaceId, p_email: input.email, p_role: input.role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['invitations', 'space', spaceId] });
    },
  });
}

export function useRespondInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_invitation', {
        p_invitation_id: input.id, p_accept: input.accept,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['invitations'] });
      void qc.invalidateQueries({ queryKey: ['spaces'] });
    },
  });
}

export function useRevokeInvitation(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invitations').update({ status: 'revoked', responded_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['invitations', 'space', spaceId] }),
  });
}
