-- Run in Supabase SQL Editor. Existing browser data is never touched.
-- The linked Database aggregate stays JSONB to preserve IDs, review history,
-- source definitions, ranges, original text and all existing UI behavior.
create table if not exists public.kokrecall_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  data jsonb not null check (coalesce(jsonb_typeof(data) = 'object' and data->>'version' = '1'
    and jsonb_typeof(data->'lessons') = 'array'
    and jsonb_typeof(data->'feedback') = 'array'
    and jsonb_typeof(data->'cards') = 'array'
    and jsonb_typeof(data->'sessions') = 'array'
    and jsonb_typeof(data->'sources') = 'array'
    and jsonb_typeof(data->'groups') = 'array'
    and jsonb_typeof(data->'categories') = 'array', false)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kokrecall_data enable row level security;
revoke all on public.kokrecall_data from anon;
grant select, insert, update, delete on public.kokrecall_data to authenticated;
drop policy if exists own_select on public.kokrecall_data;
create policy own_select on public.kokrecall_data for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists own_insert on public.kokrecall_data;
create policy own_insert on public.kokrecall_data for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists own_update on public.kokrecall_data;
create policy own_update on public.kokrecall_data for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists own_delete on public.kokrecall_data;
create policy own_delete on public.kokrecall_data for delete to authenticated using (user_id = (select auth.uid()));
-- Compare-and-swap: one atomic transaction for all linked records.
-- SECURITY INVOKER ensures RLS applies; no elevated/service-role privileges.
create or replace function public.kokrecall_save(expected_revision bigint, new_data jsonb)
returns setof public.kokrecall_data language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  if expected_revision = 0 then
    return query insert into public.kokrecall_data(user_id,data) values(auth.uid(),new_data)
      on conflict (user_id) do nothing returning *;
  else
    return query update public.kokrecall_data set data=new_data, revision=revision+1, updated_at=now()
      where user_id=auth.uid() and revision=expected_revision returning *;
  end if;
end $$;
revoke all on function public.kokrecall_save(bigint,jsonb) from public, anon;
grant execute on function public.kokrecall_save(bigint,jsonb) to authenticated;
