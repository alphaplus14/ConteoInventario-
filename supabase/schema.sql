create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.count_items (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reference text not null,
  qty numeric not null default 0,
  detail text,
  updated_at timestamptz not null default now(),
  reviewed boolean not null default false,
  review_status text check (review_status is null or review_status in ('ok', 'equivalente', 'no_creado')),
  review_note text,
  reviewed_at timestamptz,
  primary key (session_id, reference)
);

create table public.count_log (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reference text not null,
  qty numeric not null,
  created_at timestamptz not null default now()
);

create index on public.count_log (session_id, id desc);

alter table public.sessions    enable row level security;
alter table public.count_items enable row level security;
alter table public.count_log   enable row level security;

create policy "own rows" on public.sessions    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.count_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.count_log   for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.add_count(
  p_session uuid, p_ref text, p_qty numeric, p_detail text default null
) returns table(qty numeric, detail text) language plpgsql security invoker as $$
declare v_ref text := upper(trim(p_ref)); v_detail text := nullif(trim(coalesce(p_detail, '')), '');
begin
  insert into public.count_log(session_id, reference, qty) values (p_session, v_ref, p_qty);
  return query
  insert into public.count_items as ci(session_id, reference, qty, detail)
  values (p_session, v_ref, p_qty, v_detail)
  on conflict (session_id, reference)
  do update set qty = ci.qty + excluded.qty,
                detail = coalesce(excluded.detail, ci.detail),
                updated_at = now()
  returning ci.qty, ci.detail;
end $$;

create or replace function public.undo_last(p_session uuid)
returns table(reference text, qty numeric) language plpgsql security invoker as $$
declare v_log public.count_log%rowtype;
begin
  select * into v_log from public.count_log l where l.session_id = p_session order by l.id desc limit 1;
  if not found then return; end if;
  delete from public.count_log where id = v_log.id;
  update public.count_items ci set qty = ci.qty - v_log.qty, updated_at = now()
   where ci.session_id = p_session and ci.reference = v_log.reference;
  delete from public.count_items ci
   where ci.session_id = p_session and ci.reference = v_log.reference
     and ci.qty = 0 and ci.detail is null and ci.reviewed = false
     and not exists (select 1 from public.count_log l where l.session_id = p_session and l.reference = v_log.reference);
  return query select v_log.reference, v_log.qty;
end $$;

grant execute on function public.add_count(uuid, text, numeric, text) to authenticated;
grant execute on function public.undo_last(uuid) to authenticated;
