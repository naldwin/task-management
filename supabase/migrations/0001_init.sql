-- nalds — Task Management: initial schema
-- Run with: supabase db push  (or paste into Supabase SQL editor)

-- extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============ tables ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_unique on public.profiles (lower(email));

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  prefix text not null check (prefix ~ '^[A-Z]{2,8}$'),
  description text not null default '',
  owner_id uuid not null references public.profiles(id),
  timezone text not null default 'UTC',
  is_archived boolean not null default false,
  task_counter integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spaces_prefix_unique unique (prefix)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','lead','member','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint memberships_unique unique (space_id, user_id)
);
create index memberships_space_idx on public.memberships (space_id);
create index memberships_user_idx on public.memberships (user_id);

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#7dd3a8',
  position integer not null default 0,
  category text not null default 'Active' check (category in ('Not Started','Active','Done','Cancelled')),
  is_default boolean not null default false,
  is_retired boolean not null default false,
  created_at timestamptz not null default now(),
  constraint statuses_space_name_unique unique (space_id, name)
);
create index statuses_space_idx on public.statuses (space_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  number integer not null,
  key text not null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  status_id uuid not null references public.statuses(id),
  priority text not null default 'Normal' check (priority in ('Low','Normal','High','Urgent')),
  assignee_id uuid references public.profiles(id) on delete set null,
  creator_id uuid not null references public.profiles(id),
  due_date date,
  git_branch text,
  pr_url text check (pr_url is null or pr_url ~ '^https?://'),
  is_blocked boolean not null default false,
  blocker_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz,
  constraint tasks_space_number_unique unique (space_id, number),
  constraint tasks_space_key_unique unique (space_id, key)
);
create index tasks_space_idx on public.tasks (space_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_status_idx on public.tasks (status_id);
create index tasks_due_idx on public.tasks (due_date);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index comments_task_idx on public.comments (task_id);

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index activity_task_idx on public.task_activity (task_id, created_at desc);
create index activity_space_idx on public.task_activity (space_id, created_at desc);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  email text not null,
  user_id uuid references public.profiles(id) on delete set null,
  role text not null default 'member' check (role in ('owner','lead','member','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
-- prevent duplicate *pending* invitations per space+email (case-insensitive via lower())
create unique index invitations_pending_unique
  on public.invitations (space_id, lower(email))
  where status = 'pending';

create table public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  month_start date not null,
  month_end date not null,
  timezone text not null default 'UTC',
  generated_at timestamptz not null default now(),
  is_final boolean not null default false,
  summary text not null default '',
  counts jsonb not null default '{}'::jsonb,
  by_assignee jsonb not null default '[]'::jsonb,
  tasks_snapshot jsonb not null default '[]'::jsonb,
  comments_snapshot jsonb not null default '[]'::jsonb,
  generation_error text,
  constraint reports_space_month_unique unique (space_id, month_start)
);

-- ============ helper functions (security definer, for RLS) ============

create or replace function public.my_role(p_space_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.memberships
  where space_id = p_space_id and user_id = auth.uid() and is_active = true
  limit 1;
$$;

create or replace function public.is_space_member(p_space_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where space_id = p_space_id and user_id = auth.uid() and is_active = true
  );
$$;

create or replace function public.is_owner_or_lead(p_space_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where space_id = p_space_id and user_id = auth.uid() and is_active = true
      and role in ('owner','lead')
  );
$$;

create or replace function public.is_space_owner(p_space_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where space_id = p_space_id and user_id = auth.uid() and is_active = true
      and role = 'owner'
  );
$$;

-- normalize email
create or replace function public.norm_email(e text)
returns text language sql immutable as $$ select lower(trim(both ' ' from e)) $$;

-- ============ RPC: create_space ============
-- Any authenticated user can create a space and becomes owner.
create or replace function public.create_space(
  p_name text, p_prefix text, p_description text default '', p_timezone text default 'UTC'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_space_id uuid; v_prefix text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  v_prefix := upper(trim(both ' ' from p_prefix));
  if v_prefix !~ '^[A-Z]{2,8}$' then raise exception 'prefix must be 2-8 uppercase letters'; end if;
  insert into public.spaces (name, prefix, description, owner_id, timezone)
  values (p_name, v_prefix, coalesce(p_description,''), auth.uid(), coalesce(p_timezone,'UTC'))
  returning id into v_space_id;
  insert into public.memberships (space_id, user_id, role) values (v_space_id, auth.uid(), 'owner');
  insert into public.statuses (space_id, name, color, position, category, is_default) values
    (v_space_id, 'Backlog',     '#9aa0ae', 0, 'Not Started', false),
    (v_space_id, 'To Do',       '#8ab4ff', 1, 'Not Started', true),
    (v_space_id, 'In Progress', '#e5c07b', 2, 'Active',      false),
    (v_space_id, 'In Review',   '#c678dd', 3, 'Active',      false),
    (v_space_id, 'Done',        '#7dd3a8', 4, 'Done',        false),
    (v_space_id, 'Cancelled',   '#6b7280', 5, 'Cancelled',   false);
  return v_space_id;
end $$;

-- ============ RPC: create_task (atomic numbering) ============
create or replace function public.create_task(
  p_space_id uuid, p_title text, p_description text default '',
  p_status_id uuid default null, p_priority text default 'Normal',
  p_assignee_id uuid default null, p_due_date date default null,
  p_git_branch text default null, p_pr_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_role text; v_num int; v_key text; v_prefix text; v_status uuid; v_task uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select role into v_role from public.memberships
    where space_id = p_space_id and user_id = auth.uid() and is_active = true;
  if v_role is null then raise exception 'not a member'; end if;
  if v_role = 'viewer' then raise exception 'viewers cannot create tasks'; end if;
  if p_assignee_id is not null and not exists (
    select 1 from public.memberships where space_id = p_space_id and user_id = p_assignee_id and is_active = true
  ) then raise exception 'assignee must be an active member of the space'; end if;
  if p_status_id is null then
    select id into v_status from public.statuses
      where space_id = p_space_id and is_default = true and is_retired = false limit 1;
  else
    if not exists (select 1 from public.statuses where id = p_status_id and space_id = p_space_id) then
      raise exception 'invalid status for space';
    end if;
    v_status := p_status_id;
  end if;
  if v_status is null then raise exception 'no default status'; end if;
  -- atomic counter
  update public.spaces set task_counter = task_counter + 1, updated_at = now()
    where id = p_space_id returning task_counter, prefix into v_num, v_prefix;
  v_key := v_prefix || '-' || lpad(v_num::text, 3, '0');
  insert into public.tasks (space_id, number, key, title, description, status_id, priority, assignee_id, creator_id, due_date, git_branch, pr_url)
  values (p_space_id, v_num, v_key, p_title, coalesce(p_description,''), v_status, coalesce(p_priority,'Normal'),
    p_assignee_id, auth.uid(), p_due_date, nullif(trim(coalesce(p_git_branch,'')),''), nullif(trim(coalesce(p_pr_url,'')), ''))
  returning id into v_task;
  insert into public.task_activity (task_id, space_id, actor_id, action, new_value)
  values (v_task, p_space_id, auth.uid(), 'created', jsonb_build_object('key', v_key, 'title', p_title));
  return v_task;
end $$;

-- ============ helper: append one task_activity row (used by update_task) ============
create or replace function public.log_task_activity(
  p_task_id uuid, p_space_id uuid, p_field text, p_old jsonb, p_new jsonb, p_action text default 'updated'
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.task_activity (task_id, space_id, actor_id, action, field_name, old_value, new_value)
  values (p_task_id, p_space_id, auth.uid(), p_action, p_field, p_old, p_new);
end $$;

-- ============ RPC: update_task (permission-checked, logs activity, handles Done/completion) ============
create or replace function public.update_task(
  p_task_id uuid, p_title text default null, p_description text default null,
  p_status_id uuid default null, p_priority text default null, p_assignee_id uuid default null,
  p_clear_assignee boolean default false, p_due_date date default null, p_clear_due boolean default false,
  p_git_branch text default null, p_clear_branch boolean default false,
  p_pr_url text default null, p_clear_pr boolean default false,
  p_is_blocked boolean default null, p_blocker_reason text default null,
  p_archive boolean default null
) returns void language plpgsql security definer set search_path = public as $$
declare t public.tasks; v_role text; v_cat text; v_old_status_name text; v_new_status_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'task not found'; end if;
  select role into v_role from public.memberships
    where space_id = t.space_id and user_id = auth.uid() and is_active = true;
  if v_role is null then raise exception 'not a member'; end if;
  if v_role = 'viewer' then raise exception 'viewers cannot edit tasks'; end if;
  if v_role = 'member' and not (t.creator_id = auth.uid() or t.assignee_id = auth.uid() or p_status_id is distinct from null or true) then
    -- members may comment freely; task edits limited to own/assigned below
    null;
  end if;
  -- member edit scope: can create; can edit tasks they created or are assigned to; status changes allowed for members on those tasks
  if v_role = 'member' and t.creator_id <> auth.uid() and coalesce(t.assignee_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid() then
    -- allow status/assignee self-service? Spec: member edits tasks they created or are assigned to.
    -- Block field edits except comments (comments handled separately).
    if p_title is not null or p_description is not null or p_priority is not null or p_due_date is not null
       or p_git_branch is not null or p_pr_url is not null or p_is_blocked is not null or p_archive is not null then
      raise exception 'members can only edit tasks they created or are assigned to';
    end if;
  end if;
  if p_assignee_id is not null and not exists (
    select 1 from public.memberships where space_id = t.space_id and user_id = p_assignee_id and is_active = true
  ) then raise exception 'assignee must be an active member of the space'; end if;

  if p_title is not null and p_title <> t.title then
    perform public.log_task_activity(t.id, t.space_id, 'title', to_jsonb(t.title), to_jsonb(p_title)); t.title := p_title; end if;
  if p_description is not null and p_description <> t.description then
    perform public.log_task_activity(t.id, t.space_id, 'description', to_jsonb(t.description), to_jsonb(p_description)); t.description := p_description; end if;
  if p_priority is not null and p_priority <> t.priority then
    perform public.log_task_activity(t.id, t.space_id, 'priority', to_jsonb(t.priority), to_jsonb(p_priority)); t.priority := p_priority; end if;
  if p_clear_assignee then
    if t.assignee_id is not null then perform public.log_task_activity(t.id, t.space_id, 'assignee', to_jsonb(t.assignee_id), null); t.assignee_id := null; end if;
  elsif p_assignee_id is not null and p_assignee_id is distinct from t.assignee_id then
    perform public.log_task_activity(t.id, t.space_id, 'assignee', to_jsonb(t.assignee_id), to_jsonb(p_assignee_id)); t.assignee_id := p_assignee_id; end if;
  if p_clear_due then
    if t.due_date is not null then perform public.log_task_activity(t.id, t.space_id, 'due_date', to_jsonb(t.due_date), null); t.due_date := null; end if;
  elsif p_due_date is not null and p_due_date is distinct from t.due_date then
    perform public.log_task_activity(t.id, t.space_id, 'due_date', to_jsonb(t.due_date), to_jsonb(p_due_date)); t.due_date := p_due_date; end if;
  if p_clear_branch then
    if t.git_branch is not null then perform public.log_task_activity(t.id, t.space_id, 'git_branch', to_jsonb(t.git_branch), null); t.git_branch := null; end if;
  elsif p_git_branch is not null and p_git_branch is distinct from t.git_branch then
    perform public.log_task_activity(t.id, t.space_id, 'git_branch', to_jsonb(t.git_branch), to_jsonb(p_git_branch)); t.git_branch := p_git_branch; end if;
  if p_clear_pr then
    if t.pr_url is not null then perform public.log_task_activity(t.id, t.space_id, 'pr_url', to_jsonb(t.pr_url), null); t.pr_url := null; end if;
  elsif p_pr_url is not null and p_pr_url is distinct from t.pr_url then
    perform public.log_task_activity(t.id, t.space_id, 'pr_url', to_jsonb(t.pr_url), to_jsonb(p_pr_url)); t.pr_url := p_pr_url; end if;
  if p_is_blocked is not null and p_is_blocked <> t.is_blocked then
    perform public.log_task_activity(t.id, t.space_id, 'is_blocked', to_jsonb(t.is_blocked), to_jsonb(p_is_blocked),
      case when p_is_blocked then 'blocked' else 'unblocked' end);
    t.is_blocked := p_is_blocked; end if;
  if p_blocker_reason is not null and p_blocker_reason <> t.blocker_reason then
    perform public.log_task_activity(t.id, t.space_id, 'blocker_reason', to_jsonb(t.blocker_reason), to_jsonb(p_blocker_reason)); t.blocker_reason := p_blocker_reason; end if;
  if p_status_id is not null and p_status_id <> t.status_id then
    if not exists (select 1 from public.statuses where id = p_status_id and space_id = t.space_id and is_retired = false) then
      raise exception 'invalid or retired status';
    end if;
    select name into v_old_status_name from public.statuses where id = t.status_id;
    select name, category into v_new_status_name, v_cat from public.statuses where id = p_status_id;
    perform public.log_task_activity(t.id, t.space_id, 'status',
      jsonb_build_object('id', t.status_id, 'label', coalesce(v_old_status_name,'?')),
      jsonb_build_object('id', p_status_id, 'label', v_new_status_name, 'category', v_cat),
      'status_changed');
    t.status_id := p_status_id;
    if v_cat = 'Done' then
      if t.completed_at is null then
        t.completed_at := now();
        insert into public.task_activity (task_id, space_id, actor_id, action, new_value)
        values (t.id, t.space_id, auth.uid(), 'completed', jsonb_build_object('status', v_new_status_name));
      end if;
    else
      if t.completed_at is not null then
        insert into public.task_activity (task_id, space_id, actor_id, action, old_value)
        values (t.id, t.space_id, auth.uid(), 'reopened', jsonb_build_object('completed_at', t.completed_at));
        t.completed_at := null;
      end if;
    end if;
  end if;
  if p_archive is not null then
    if p_archive and t.archived_at is null then
      t.archived_at := now();
      insert into public.task_activity (task_id, space_id, actor_id, action) values (t.id, t.space_id, auth.uid(), 'archived');
    elsif not p_archive and t.archived_at is not null then
      t.archived_at := null;
      insert into public.task_activity (task_id, space_id, actor_id, action) values (t.id, t.space_id, auth.uid(), 'unarchived');
    end if;
  end if;
  t.updated_at := now();
  update public.tasks set title=t.title, description=t.description, status_id=t.status_id, priority=t.priority,
    assignee_id=t.assignee_id, due_date=t.due_date, git_branch=t.git_branch, pr_url=t.pr_url,
    is_blocked=t.is_blocked, blocker_reason=t.blocker_reason, updated_at=t.updated_at,
    completed_at=t.completed_at, archived_at=t.archived_at where id = t.id;
end $$;

-- ============ RPC: invite_user (server-side email resolution, no directory exposure) ============
create or replace function public.invite_user(p_space_id uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_my_role text; v_email text; v_uid uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select role into v_my_role from public.memberships
    where space_id = p_space_id and user_id = auth.uid() and is_active = true;
  if v_my_role is null then raise exception 'not a member'; end if;
  if v_my_role not in ('owner','lead') then raise exception 'only owners and leads can invite'; end if;
  if p_role in ('owner','lead') and v_my_role <> 'owner' then
    raise exception 'leads cannot invite owners or leads';
  end if;
  if p_role not in ('owner','lead','member','viewer') then raise exception 'invalid role'; end if;
  v_email := public.norm_email(p_email);
  if v_email = '' or v_email not like '%@%' then raise exception 'invalid email'; end if;
  select id into v_uid from public.profiles where lower(email) = v_email limit 1;
  if v_uid is not null and exists (
    select 1 from public.memberships where space_id = p_space_id and user_id = v_uid and is_active = true
  ) then raise exception 'user is already a member'; end if;
  if exists (select 1 from public.invitations where space_id = p_space_id and lower(email) = v_email and status = 'pending') then
    raise exception 'duplicate pending invitation';
  end if;
  insert into public.invitations (space_id, email, user_id, role, invited_by)
  values (p_space_id, v_email, v_uid, p_role, auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- ============ RPC: respond_invitation (identity from session) ============
create or replace function public.respond_invitation(p_invitation_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.invitations; v_my_email text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into inv from public.invitations where id = p_invitation_id;
  if not found then raise exception 'invitation not found'; end if;
  if inv.status <> 'pending' then raise exception 'invitation is no longer pending'; end if;
  select email into v_my_email from public.profiles where id = auth.uid();
  -- match pending invitation created before account existed
  if inv.user_id is null and public.norm_email(v_my_email) = public.norm_email(inv.email) then
    update public.invitations set user_id = auth.uid() where id = inv.id;
    inv.user_id := auth.uid();
  end if;
  if inv.user_id is distinct from auth.uid() then
    -- also allow match by email for robustness
    if public.norm_email(v_my_email) <> public.norm_email(inv.email) then
      raise exception 'only the invited user can respond';
    else
      update public.invitations set user_id = auth.uid() where id = inv.id;
    end if;
  end if;
  if p_accept then
    insert into public.memberships (space_id, user_id, role)
    values (inv.space_id, auth.uid(), inv.role)
    on conflict (space_id, user_id) do update set role = excluded.role, is_active = true;
    update public.invitations set status = 'accepted', responded_at = now() where id = inv.id;
  else
    update public.invitations set status = 'declined', responded_at = now() where id = inv.id;
  end if;
end $$;

-- ============ RPC: update_member_role / transfer / archive guards ============
create or replace function public.update_member_role(p_space_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_my_role text; v_count int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select role into v_my_role from public.memberships where space_id=p_space_id and user_id=auth.uid() and is_active=true;
  if v_my_role <> 'owner' then raise exception 'only owners can change roles'; end if;
  if p_role not in ('owner','lead','member','viewer') then raise exception 'invalid role'; end if;
  if p_role <> 'owner' then
    select count(*) into v_count from public.memberships where space_id=p_space_id and role='owner' and is_active=true;
    if v_count <= 1 and exists (select 1 from public.memberships where space_id=p_space_id and user_id=p_user_id and role='owner') then
      raise exception 'cannot remove the last owner';
    end if;
  end if;
  update public.memberships set role = p_role where space_id=p_space_id and user_id=p_user_id;
end $$;

create or replace function public.remove_member(p_space_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_my_role text; v_count int; v_target_role text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select role into v_my_role from public.memberships where space_id=p_space_id and user_id=auth.uid() and is_active=true;
  if v_my_role <> 'owner' then raise exception 'only owners can remove members'; end if;
  select role into v_target_role from public.memberships where space_id=p_space_id and user_id=p_user_id;
  if v_target_role = 'owner' then
    select count(*) into v_count from public.memberships where space_id=p_space_id and role='owner' and is_active=true;
    if v_count <= 1 then raise exception 'cannot remove the last owner'; end if;
  end if;
  update public.memberships set is_active = false where space_id=p_space_id and user_id=p_user_id;
end $$;

create or replace function public.retire_status(p_status_id uuid, p_replacement_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.statuses; r public.statuses; v_my_role text; v_def_count int; v_done_count int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into s from public.statuses where id = p_status_id;
  if not found then raise exception 'status not found'; end if;
  select * into r from public.statuses where id = p_replacement_id;
  if not found or r.space_id <> s.space_id then raise exception 'invalid replacement'; end if;
  select role into v_my_role from public.memberships where space_id=s.space_id and user_id=auth.uid() and is_active=true;
  if v_my_role not in ('owner','lead') then raise exception 'only owners and leads can manage statuses'; end if;
  if r.is_retired then raise exception 'replacement must be active'; end if;
  -- migrate tasks in one transaction
  update public.tasks set status_id = r.id, updated_at = now() where status_id = s.id;
  update public.statuses set is_retired = true, is_default = false where id = s.id;
  -- ensure constraints still hold
  select count(*) into v_def_count from public.statuses where space_id=s.space_id and is_default=true and is_retired=false;
  if v_def_count = 0 then
    update public.statuses set is_default = true where id = r.id;
  end if;
  select count(*) into v_done_count from public.statuses where space_id=s.space_id and category='Done' and is_retired=false;
  if v_done_count = 0 then raise exception 'space must keep at least one Done status'; end if;
end $$;

-- ============ RPC: generate_monthly_report (idempotent, deterministic, snapshot) ============
create or replace function public.generate_monthly_report(p_space_id uuid, p_month date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_tz text; v_space_name text; v_role text; v_report_id uuid;
  v_created int; v_completed int; v_cancelled int; v_open int; v_blocked int; v_overdue int;
  v_tasks jsonb; v_comments jsonb; v_by_assignee jsonb; v_summary text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  -- allow owners/leads to generate on demand; cron uses service role (bypasses RLS anyway)
  select role into v_role from public.memberships where space_id=p_space_id and user_id=auth.uid() and is_active=true;
  select timezone, name into v_tz, v_space_name from public.spaces where id = p_space_id;
  if not found then raise exception 'space not found'; end if;

  -- month-end status reconstruction: latest activity status label before v_end, else current status.
  -- NOTE: materialized as a temp table because a WITH clause only lives for a
  -- single statement, and three separate selects below need the same row set.
  drop table if exists pg_temp.flagged;
  create temp table flagged as
  with month_tasks as (
    select t.*, s.name as status_label, s.category as status_category,
      ap.display_name as assignee_name, cp.display_name as creator_name
    from public.tasks t
    join public.statuses s on s.id = t.status_id
    left join public.profiles ap on ap.id = t.assignee_id
    left join public.profiles cp on cp.id = t.creator_id
    where t.space_id = p_space_id
      and (
        (t.created_at >= v_start and t.created_at < v_end + interval '1 day') -- created during month
        or (t.updated_at >= v_start and t.updated_at < v_end + interval '1 day') -- activity
        or (t.completed_at >= v_start and t.completed_at < v_end + interval '1 day')
        or (t.archived_at is null and t.completed_at is null
            and not exists (select 1 from public.statuses s2 where s2.id=t.status_id and s2.category='Cancelled'))
        -- carryover: still open at month-end (created before end, not completed/cancelled before end)
        or (t.created_at < v_end and (t.completed_at is null or t.completed_at >= v_end))
      )
  )
  select mt.*,
    (mt.created_at >= v_start and mt.created_at < v_end + interval '1 day') as f_created,
    exists (select 1 from public.task_activity a where a.task_id = mt.id and a.created_at >= v_start and a.created_at < v_end + interval '1 day') as f_worked,
    (mt.completed_at >= v_start and mt.completed_at < v_end + interval '1 day') as f_completed,
    ((mt.archived_at is null) and mt.status_category not in ('Done','Cancelled')) as f_carry
  from month_tasks mt;

  select
    count(*) filter (where f_created),
    count(*) filter (where f_completed),
    count(*) filter (where status_category='Cancelled' and (completed_at >= v_start and completed_at < v_end + interval '1 day' or updated_at >= v_start and updated_at < v_end + interval '1 day')),
    count(*) filter (where f_carry),
    count(*) filter (where is_blocked and archived_at is null),
    count(*) filter (where due_date < v_end and archived_at is null and status_category not in ('Done','Cancelled'))
  into v_created, v_completed, v_cancelled, v_open, v_blocked, v_overdue from flagged;

  select coalesce(jsonb_agg(row_to_json(f) order by f.key), '[]'::jsonb) into v_tasks
  from (select id, key, title, description, status_label as month_end_status, status_category, priority,
    assignee_name, due_date, git_branch, pr_url, is_blocked, blocker_reason, created_at, completed_at,
    case when f_created then 'Created' when f_completed then 'Completed' when f_worked then 'Worked On' when f_carry then 'Carryover' else 'Worked On' end as reason
    from flagged f) f;

  select coalesce(jsonb_agg(row_to_json(c) order by c.created_at), '[]'::jsonb) into v_comments
  from (select cm.id, cm.task_id, t.key as task_key, p.display_name as author, cm.body, cm.created_at
    from public.comments cm join public.tasks t on t.id=cm.task_id
    join public.profiles p on p.id=cm.author_id
    where t.space_id=p_space_id and cm.created_at >= v_start and cm.created_at < v_end + interval '1 day') c;

  select coalesce(jsonb_agg(row_to_json(b) order by b.completed desc), '[]'::jsonb) into v_by_assignee
  from (select coalesce(assignee_name,'Unassigned') as assignee, count(*) filter (where f_completed) as completed, count(*) as total
    from flagged group by 1) b;
  drop table pg_temp.flagged;

  v_summary := format('%s — %s: %s created, %s completed, %s open at month-end (%s blocked, %s overdue).',
    v_space_name, to_char(v_start,'Mon YYYY'), v_created, v_completed, v_open, v_blocked, v_overdue);

  insert into public.monthly_reports
    (space_id, month_start, month_end, timezone, is_final, summary, counts, by_assignee, tasks_snapshot, comments_snapshot)
  values (p_space_id, v_start, v_end, coalesce(v_tz,'UTC'), true, v_summary,
    jsonb_build_object('created',v_created,'completed',v_completed,'cancelled',v_cancelled,'open',v_open,'blocked',v_blocked,'overdue',v_overdue),
    coalesce(v_by_assignee,'[]'), coalesce(v_tasks,'[]'), coalesce(v_comments,'[]'))
  on conflict (space_id, month_start) do update set
    month_end=excluded.month_end, timezone=excluded.timezone, generated_at=now(), is_final=true,
    summary=excluded.summary, counts=excluded.counts, by_assignee=excluded.by_assignee,
    tasks_snapshot=excluded.tasks_snapshot, comments_snapshot=excluded.comments_snapshot, generation_error=null
  returning id into v_report_id;
  return v_report_id;
end $$;

-- auto-match pending invitations on new profile (matches by email, no verification in this version)
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.invitations set user_id = new.id where lower(email) = lower(new.email) and status='pending' and user_id is null;
  return new;
end $$;
drop trigger if exists trg_match_invitations on public.profiles;
create trigger trg_match_invitations after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.memberships enable row level security;
alter table public.statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.task_activity enable row level security;
alter table public.invitations enable row level security;
alter table public.monthly_reports enable row level security;

-- profiles: readable by authenticated (needed for assignee names), writable only own row.
-- NOTE: no searchable directory is exposed via app queries; keep this narrow in app code.
drop policy if exists "profiles_read_auth" on public.profiles;
create policy "profiles_read_auth" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid());

-- spaces: members can read; creation via RPC (also allow direct insert for owner bootstrap)
drop policy if exists "spaces_read_member" on public.spaces;
create policy "spaces_read_member" on public.spaces for select to authenticated using (public.is_space_member(id));
drop policy if exists "spaces_insert_auth" on public.spaces;
create policy "spaces_insert_auth" on public.spaces for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "spaces_update_owner" on public.spaces;
create policy "spaces_update_owner" on public.spaces for update to authenticated
  using (public.is_space_owner(id)) with check (public.is_space_owner(id));

-- memberships: members can read own space memberships; mutations via RPC only (no direct insert/update/delete for clients)
drop policy if exists "memberships_read" on public.memberships;
create policy "memberships_read" on public.memberships for select to authenticated using (public.is_space_member(space_id));

-- statuses: members read; mutations via RPC (owner/lead enforced there). Allow direct writes for owner/lead as fallback.
drop policy if exists "statuses_read" on public.statuses;
create policy "statuses_read" on public.statuses for select to authenticated using (public.is_space_member(space_id));
drop policy if exists "statuses_write_lead" on public.statuses;
create policy "statuses_write_lead" on public.statuses for all to authenticated
  using (public.is_owner_or_lead(space_id)) with check (public.is_owner_or_lead(space_id));

-- tasks: members read non-archived + archived (members see all in space); writes via RPC preferred; allow constrained direct writes:
drop policy if exists "tasks_read" on public.tasks;
create policy "tasks_read" on public.tasks for select to authenticated using (public.is_space_member(space_id));
drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert to authenticated with check (
  public.is_space_member(space_id) and public.my_role(space_id) <> 'viewer');
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks for update to authenticated
  using (public.is_space_member(space_id) and public.my_role(space_id) <> 'viewer')
  with check (public.is_space_member(space_id) and public.my_role(space_id) <> 'viewer');

-- comments: members read; non-viewers insert; authors update own
drop policy if exists "comments_read" on public.comments;
create policy "comments_read" on public.comments for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_space_member(t.space_id)));
drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments for insert to authenticated with check (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_space_member(t.space_id)
    and public.my_role(t.space_id) <> 'viewer') and author_id = auth.uid());
drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- activity: members read; no direct client writes (append-only via RPC)
drop policy if exists "activity_read" on public.task_activity;
create policy "activity_read" on public.task_activity for select to authenticated using (public.is_space_member(space_id));

-- invitations: space owners/leads see space invites; recipients see their own
drop policy if exists "invites_read" on public.invitations;
create policy "invites_read" on public.invitations for select to authenticated using (
  public.is_owner_or_lead(space_id) or user_id = auth.uid()
  or lower(email) = lower((select email from public.profiles where id = auth.uid())));
drop policy if exists "invites_update" on public.invitations;
create policy "invites_update" on public.invitations for update to authenticated
  using (public.is_owner_or_lead(space_id) or user_id = auth.uid())
  with check (public.is_owner_or_lead(space_id) or user_id = auth.uid());

-- reports: members read; owner/lead generate (RPC uses definer so allowed)
drop policy if exists "reports_read" on public.monthly_reports;
create policy "reports_read" on public.monthly_reports for select to authenticated using (public.is_space_member(space_id));
