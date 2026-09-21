import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Task, TaskActivity, TaskComment } from '../../lib/database.types';

export interface TaskFilter {
  q?: string;
  status?: string;
  assignee?: string; // user id | 'unassigned'
  priority?: string;
  blocked?: string; // 'only'
  overdue?: string; // 'only'
  archived?: string; // 'include' | default hide
  sort?: string; // e.g. 'updated_desc'
  page?: number;
  view?: string; // 'table' | 'board'
}

const PAGE_SIZE = 20;

export function useTasks(spaceId: string | undefined, f: TaskFilter) {
  return useQuery({
    queryKey: ['tasks', spaceId, f],
    enabled: !!spaceId,
    queryFn: async (): Promise<{ rows: Task[]; total: number }> => {
      let q = supabase
        .from('tasks')
        .select('*, status:statuses!tasks_status_id_fkey(*), assignee:profiles!tasks_assignee_id_fkey(*)', { count: 'exact' })
        .eq('space_id', spaceId)
        .order('updated_at', { ascending: false });
      if (!f.archived || f.archived !== 'include') q = q.is('archived_at', null);
      if (f.status) q = q.eq('status_id', f.status);
      if (f.priority) q = q.eq('priority', f.priority);
      if (f.assignee === 'unassigned') q = q.is('assignee_id', null);
      else if (f.assignee) q = q.eq('assignee_id', f.assignee);
      if (f.blocked === 'only') q = q.eq('is_blocked', true);
      if (f.q) q = q.or(`title.ilike.%${f.q}%,key.ilike.%${f.q}%,git_branch.ilike.%${f.q}%`);
      if (f.sort === 'due_asc') q = q.order('due_date', { ascending: true, nullsFirst: false }).order('updated_at', { ascending: false });
      else if (f.sort === 'created_desc') q = q.order('created_at', { ascending: false });
      else if (f.sort === 'priority') q = q.order('priority', { ascending: true });
      const page = Math.max(1, f.page ?? 1);
      q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as Task[];
      if (f.overdue === 'only') {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        rows = rows.filter((t) => {
          const cat = t.status?.category;
          return t.due_date && new Date(t.due_date) < today && cat !== 'Done' && cat !== 'Cancelled' && !t.archived_at;
        });
      }
      return { rows, total: f.overdue === 'only' ? rows.length : (count ?? rows.length) };
    },
  });
}

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<Task | null> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, status:statuses!tasks_status_id_fkey(*), assignee:profiles!tasks_assignee_id_fkey(*), creator:profiles!tasks_creator_id_fkey(*)')
        .eq('id', taskId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Task) ?? null;
    },
  });
}

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['comments', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskComment[]> => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!comments_author_id_fkey(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TaskComment[];
    },
  });
}

export function useActivity(taskId: string | undefined) {
  return useQuery({
    queryKey: ['activity', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskActivity[]> => {
      const { data, error } = await supabase
        .from('task_activity')
        .select('*, actor:profiles!task_activity_actor_id_fkey(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as TaskActivity[];
    },
  });
}

export function useCreateTask(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string; description?: string; status_id?: string; priority?: string;
      assignee_id?: string | null; due_date?: string | null; git_branch?: string | null; pr_url?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('create_task', {
        p_space_id: spaceId,
        p_title: input.title,
        p_description: input.description ?? '',
        p_status_id: input.status_id || null,
        p_priority: input.priority ?? 'Normal',
        p_assignee_id: input.assignee_id || null,
        p_due_date: input.due_date || null,
        p_git_branch: input.git_branch || null,
        p_pr_url: input.pr_url || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', spaceId] });
      void qc.invalidateQueries({ queryKey: ['overview'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      task_id: string; title?: string; description?: string; status_id?: string; priority?: string;
      assignee_id?: string | null; clear_assignee?: boolean;
      due_date?: string | null; clear_due?: boolean;
      git_branch?: string | null; clear_branch?: boolean;
      pr_url?: string | null; clear_pr?: boolean;
      is_blocked?: boolean; blocker_reason?: string; archive?: boolean | null;
    }) => {
      const { task_id, ...rest } = input;
      const payload: Record<string, unknown> = { p_task_id: task_id };
      if (rest.title !== undefined) payload.p_title = rest.title;
      if (rest.description !== undefined) payload.p_description = rest.description;
      if (rest.status_id !== undefined) payload.p_status_id = rest.status_id || null;
      if (rest.priority !== undefined) payload.p_priority = rest.priority;
      if (rest.assignee_id !== undefined) payload.p_assignee_id = rest.assignee_id || null;
      if (rest.clear_assignee) payload.p_clear_assignee = true;
      if (rest.due_date !== undefined) payload.p_due_date = rest.due_date || null;
      if (rest.clear_due) payload.p_clear_due = true;
      if (rest.git_branch !== undefined) payload.p_git_branch = rest.git_branch || null;
      if (rest.clear_branch) payload.p_clear_branch = true;
      if (rest.pr_url !== undefined) payload.p_pr_url = rest.pr_url || null;
      if (rest.clear_pr) payload.p_clear_pr = true;
      if (rest.is_blocked !== undefined) payload.p_is_blocked = rest.is_blocked;
      if (rest.blocker_reason !== undefined) payload.p_blocker_reason = rest.blocker_reason;
      if (rest.archive !== undefined && rest.archive !== null) payload.p_archive = rest.archive;
      const { error } = await supabase.rpc('update_task', payload);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['task', v.task_id] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['activity', v.task_id] });
      void qc.invalidateQueries({ queryKey: ['overview'] });
      void qc.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { task_id: string; body: string }) => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) throw new Error('not authenticated');
      const { error } = await supabase.from('comments').insert({ task_id: input.task_id, author_id: uid, body: input.body });
      if (error) throw error;
      // touch task updated_at for report "worked on" visibility
      await supabase.from('tasks').update({ updated_at: new Date().toISOString() }).eq('id', input.task_id);
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['comments', v.task_id] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useMyTasks() {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: async (): Promise<Task[]> => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*, status:statuses!tasks_status_id_fkey(*), assignee:profiles!tasks_assignee_id_fkey(*)')
        .eq('assignee_id', uid)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Task[];
    },
  });
}

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return [];
      const { data: mems, error: mErr } = await supabase.from('memberships').select('role, spaces(*)').eq('user_id', uid).eq('is_active', true);
      if (mErr) throw mErr;
      const memRows = (mems ?? []) as unknown as Array<{ role: string; spaces: { id: string; name: string; prefix: string } }>;
      const spaces = memRows.map((m) => ({ ...m.spaces, role: m.role }));
      const out: Array<{ id: string; name: string; prefix: string; role: string; active: number; blocked: number; overdue: number; doneMonth: number }> = [];
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
      for (const s of spaces) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id,is_blocked,due_date,completed_at,status:statuses!tasks_status_id_fkey(category)')
          .eq('space_id', s.id)
          .is('archived_at', null);
        const raw = (tasks ?? []) as unknown as Array<{ is_blocked: boolean; due_date: string | null; completed_at: string | null; status: { category: string } | Array<{ category: string }> }>;
        const rows = raw.map((t) => ({ ...t, status: Array.isArray(t.status) ? t.status[0] : t.status }));
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const active = rows.filter((t) => t.status?.category === 'Active' || t.status?.category === 'Not Started').length;
        const blocked = rows.filter((t) => t.is_blocked).length;
        const overdue = rows.filter((t) => t.due_date && new Date(t.due_date) < today && t.status?.category !== 'Done' && t.status?.category !== 'Cancelled').length;
        const doneMonth = rows.filter((t) => t.completed_at && new Date(t.completed_at) >= start).length;
        out.push({ ...s, active, blocked, overdue, doneMonth });
      }
      return out;
    },
  });
}
