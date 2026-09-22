import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { FEED_EVENT_ACTIONS } from '../../lib/activity-label';
import type { FeedComment, FeedEvent } from '../../lib/feed-selectors';

export interface FeedPage {
  comments: FeedComment[];
  events: FeedEvent[];
}

type JoinedTask = {
  space_id: string;
  key: string;
  title: string;
  assignee_id: string | null;
} | Array<{
  space_id: string;
  key: string;
  title: string;
  assignee_id: string | null;
}>;

type NameRow = { display_name: string } | Array<{ display_name: string }> | null;

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const COMMENT_SELECT =
  'id,created_at,body,task_id,author:profiles!comments_author_id_fkey(display_name),task:tasks!inner(space_id,key,title,assignee_id)';
const ACTIVITY_SELECT =
  'id,created_at,action,field_name,old_value,new_value,task_id,actor:profiles!task_activity_actor_id_fkey(display_name),task:tasks!task_activity_task_id_fkey(space_id,key,title,assignee_id)';

/**
 * Team pulse across spaces: recent comments + key lifecycle events.
 * RLS already permits this (members read comments/activity of their spaces),
 * so no migration is needed — just two parallel newest-first queries.
 */
export function useActivityFeed(spaceIds: string[], before?: string, pageSize = 50) {
  const key = [...spaceIds].sort().join(',');
  return useQuery({
    queryKey: ['activity-feed', key, before ?? null, pageSize],
    enabled: spaceIds.length > 0,
    queryFn: async (): Promise<FeedPage> => {
      const commentsBase = supabase
        .from('comments')
        .select(COMMENT_SELECT)
        .in('task.space_id', spaceIds)
        .order('created_at', { ascending: false })
        .order('id');
      const activityBase = supabase
        .from('task_activity')
        .select(ACTIVITY_SELECT)
        .in('space_id', spaceIds)
        .in('action', [...FEED_EVENT_ACTIONS])
        .order('created_at', { ascending: false })
        .order('id');
      const commentsQ = (before ? commentsBase.lt('created_at', before) : commentsBase).limit(pageSize);
      const activityQ = (before ? activityBase.lt('created_at', before) : activityBase).limit(pageSize);
      const [{ data: commentsData, error: commentsError }, { data: activityData, error: activityError }] =
        await Promise.all([commentsQ, activityQ]);
      if (commentsError) throw commentsError;
      if (activityError) throw activityError;

      type CommentRow = {
        id: string; created_at: string; body: string; task_id: string;
        author: NameRow; task: JoinedTask;
      };
      const comments: FeedComment[] = ((commentsData ?? []) as unknown as CommentRow[]).map((c) => {
        const task = one(c.task)!;
        return {
          id: c.id,
          created_at: c.created_at,
          space_id: task.space_id,
          task_id: c.task_id,
          task_key: task.key,
          task_title: task.title,
          author_name: one(c.author)?.display_name ?? 'Someone',
          body: c.body,
          assignee_id: task.assignee_id,
        };
      });

      type ActivityRow = {
        id: string; created_at: string; action: string; field_name: string | null;
        old_value: unknown; new_value: unknown; task_id: string;
        actor: NameRow; task: JoinedTask | null;
      };
      const events: FeedEvent[] = ((activityData ?? []) as unknown as ActivityRow[])
        .filter((a) => a.task)
        .map((a) => {
          const task = one(a.task)!;
          return {
            id: a.id,
            created_at: a.created_at,
            space_id: task.space_id,
            task_id: a.task_id,
            task_key: task.key,
            task_title: task.title,
            actor_name: one(a.actor)?.display_name ?? 'System',
            action: a.action,
            field_name: a.field_name,
            old_value: a.old_value,
            new_value: a.new_value,
            assignee_id: task.assignee_id,
          };
        });

      return { comments, events };
    },
  });
}
