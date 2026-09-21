// Generated database types (checked in for convenience).
// Regenerate with: npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
export type Role = 'owner' | 'lead' | 'member' | 'viewer';
export type Priority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type Category = 'Not Started' | 'Active' | 'Done' | 'Cancelled';

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}
export interface Space {
  id: string;
  name: string;
  prefix: string;
  description: string;
  owner_id: string;
  timezone: string;
  is_archived: boolean;
  task_counter: number;
  created_at: string;
  updated_at: string;
}
export interface Membership {
  id: string;
  space_id: string;
  user_id: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  profile?: Profile;
}
export interface Status {
  id: string;
  space_id: string;
  name: string;
  color: string;
  position: number;
  category: Category;
  is_default: boolean;
  is_retired: boolean;
  created_at: string;
}
export interface Task {
  id: string;
  space_id: string;
  number: number;
  key: string;
  title: string;
  description: string;
  status_id: string;
  priority: Priority;
  assignee_id: string | null;
  creator_id: string;
  due_date: string | null;
  git_branch: string | null;
  pr_url: string | null;
  is_blocked: boolean;
  blocker_reason: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
  status?: Status;
  assignee?: Profile | null;
  creator?: Profile | null;
}
export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: Profile;
}
export interface TaskActivity {
  id: string;
  task_id: string;
  space_id: string;
  actor_id: string | null;
  action: string;
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  actor?: Profile | null;
}
export interface Invitation {
  id: string;
  space_id: string;
  email: string;
  user_id: string | null;
  role: Role;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  invited_by: string | null;
  created_at: string;
  responded_at: string | null;
  space?: Pick<Space, 'id' | 'name' | 'prefix'>;
  inviter?: Profile | null;
}
export interface MonthlyReport {
  id: string;
  space_id: string;
  month_start: string;
  month_end: string;
  timezone: string;
  generated_at: string;
  is_final: boolean;
  summary: string;
  counts: Record<string, number>;
  by_assignee: Array<{ assignee: string; completed: number; total: number }>;
  tasks_snapshot: Array<Record<string, unknown>>;
  comments_snapshot: Array<Record<string, unknown>>;
  generation_error: string | null;
}
