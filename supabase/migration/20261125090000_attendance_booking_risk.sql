create table if not exists public.attendance_booking_risk (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  risk_percent numeric(5, 2) not null default 0 check (risk_percent >= 0 and risk_percent <= 100),
  month_start date not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_booking_risk_events (
  attendance_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent')),
  change_percent numeric(5, 2) not null,
  month_start date not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_booking_risk_checks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  allowed boolean not null,
  risk_percent numeric(5, 2) not null,
  month_start date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id, month_start)
);

alter table public.attendance_booking_risk enable row level security;
alter table public.attendance_booking_risk_events enable row level security;
alter table public.attendance_booking_risk_checks enable row level security;

drop policy if exists "Members and management can read attendance booking risk" on public.attendance_booking_risk;
create policy "Members and management can read attendance booking risk"
  on public.attendance_booking_risk for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('leader', 'staff', 'teacher')
    )
  );

drop policy if exists "Management can read attendance risk events" on public.attendance_booking_risk_events;
create policy "Management can read attendance risk events"
  on public.attendance_booking_risk_events for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('leader', 'staff', 'teacher')
    )
  );

drop policy if exists "Members and management can read booking risk checks" on public.attendance_booking_risk_checks;
create policy "Members and management can read booking risk checks"
  on public.attendance_booking_risk_checks for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('leader', 'staff', 'teacher')
    )
  );

grant select on public.attendance_booking_risk to authenticated;
grant select on public.attendance_booking_risk_events to authenticated;
grant select on public.attendance_booking_risk_checks to authenticated;

create or replace function public.apply_attendance_booking_risk_event(
  p_attendance_id text,
  p_user_id uuid,
  p_session_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_month date := date_trunc('month', timezone('utc', now()))::date;
  v_current_month date;
  v_risk numeric(5, 2);
  v_base_risk numeric(5, 2);
  v_previous public.attendance_booking_risk_events%rowtype;
  v_change numeric(5, 2);
begin
  select role into v_actor_role from public.profiles where id = auth.uid();
  if auth.uid() is null or v_actor_role not in ('leader', 'staff', 'teacher') then
    raise exception 'Attendance management access required';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id and role = 'member') then
    return jsonb_build_object('user_id', p_user_id, 'risk_percent', 0, 'month_start', v_month);
  end if;

  if p_status not in ('present', 'late', 'absent') or not exists (
    select 1 from public.attendance
    where id::text = p_attendance_id
      and user_id::text = p_user_id::text
      and session_id::text = p_session_id
      and status = p_status
  ) then
    raise exception 'Attendance record does not match the risk update';
  end if;

  insert into public.attendance_booking_risk (user_id, risk_percent, month_start)
  values (p_user_id, 0, v_month)
  on conflict (user_id) do nothing;

  select risk_percent, month_start
    into v_risk, v_current_month
  from public.attendance_booking_risk
  where user_id = p_user_id
  for update;

  if v_current_month <> v_month then
    v_risk := 0;
    update public.attendance_booking_risk
    set risk_percent = 0, month_start = v_month, updated_at = now()
    where user_id = p_user_id;
  end if;

  select * into v_previous
  from public.attendance_booking_risk_events
  where attendance_id = p_attendance_id
  for update;

  if found and v_previous.month_start = v_month and v_previous.status = p_status then
    return jsonb_build_object('user_id', p_user_id, 'risk_percent', v_risk, 'month_start', v_month);
  end if;

  if found and v_previous.month_start = v_month then
    v_risk := greatest(0, v_risk - v_previous.change_percent);
  end if;
  v_base_risk := v_risk;

  v_change := case p_status
    when 'absent' then round((15 + random() * 15)::numeric, 2)
    when 'late' then round((10 + random() * 10)::numeric, 2)
    else -round((15 + random() * 15)::numeric, 2)
  end;
  v_risk := least(100, greatest(0, v_risk + v_change));
  v_change := v_risk - v_base_risk;

  insert into public.attendance_booking_risk_events (attendance_id, user_id, status, change_percent, month_start, updated_at)
  values (p_attendance_id, p_user_id, p_status, v_change, v_month, now())
  on conflict (attendance_id) do update
  set user_id = excluded.user_id,
      status = excluded.status,
      change_percent = excluded.change_percent,
      month_start = excluded.month_start,
      updated_at = now();

  update public.attendance_booking_risk
  set risk_percent = v_risk, month_start = v_month, updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object('user_id', p_user_id, 'risk_percent', v_risk, 'month_start', v_month);
end;
$$;

create or replace function public.evaluate_attendance_booking_risk(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_month date := date_trunc('month', timezone('utc', now()))::date;
  v_current_month date;
  v_risk numeric(5, 2);
  v_allowed boolean;
begin
  select role into v_role from public.profiles where id = v_user_id;
  if v_user_id is null or v_role <> 'member' then
    raise exception 'Member booking access required';
  end if;
  if not exists (select 1 from public.schedule where id::text = p_session_id) then
    raise exception 'Session not found';
  end if;

  insert into public.attendance_booking_risk (user_id, risk_percent, month_start)
  values (v_user_id, 0, v_month)
  on conflict (user_id) do nothing;

  select risk_percent, month_start
    into v_risk, v_current_month
  from public.attendance_booking_risk
  where user_id = v_user_id
  for update;

  if v_current_month <> v_month then
    v_risk := 0;
    update public.attendance_booking_risk
    set risk_percent = 0, month_start = v_month, updated_at = now()
    where user_id = v_user_id;
  end if;

  select allowed into v_allowed
  from public.attendance_booking_risk_checks
  where user_id = v_user_id and session_id = p_session_id and month_start = v_month;

  if found then
    return jsonb_build_object(
      'user_id', v_user_id,
      'risk_percent', v_risk,
      'month_start', v_month,
      'session_id', p_session_id,
      'allowed', v_allowed
    );
  end if;

  if exists (
    select 1
    from public.attendance_booking_risk_checks checks
    join public.schedule sessions on sessions.id::text = checks.session_id
    where checks.user_id = v_user_id
      and checks.month_start = v_month
      and checks.allowed = false
      and checks.session_id <> p_session_id
      and sessions.date::date >= timezone('utc', now())::date
  ) then
    v_allowed := true;
  else
    v_allowed := random() * 100 >= v_risk;
  end if;
  insert into public.attendance_booking_risk_checks (user_id, session_id, allowed, risk_percent, month_start)
  values (v_user_id, p_session_id, v_allowed, v_risk, v_month);

  return jsonb_build_object(
    'user_id', v_user_id,
    'risk_percent', v_risk,
    'month_start', v_month,
    'session_id', p_session_id,
    'allowed', v_allowed
  );
end;
$$;

create or replace function public.set_attendance_booking_risk(p_user_id uuid, p_risk_percent numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_month date := date_trunc('month', timezone('utc', now()))::date;
  v_risk numeric(5, 2);
begin
  select role into v_actor_role from public.profiles where id = auth.uid();
  if auth.uid() is null or v_actor_role <> 'leader' then
    raise exception 'Leader access required';
  end if;
  if p_risk_percent is null or p_risk_percent < 0 or p_risk_percent > 100 then
    raise exception 'Risk percentage must be between 0 and 100';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'member') then
    raise exception 'Member not found';
  end if;

  v_risk := round(p_risk_percent, 2);
  insert into public.attendance_booking_risk (user_id, risk_percent, month_start, updated_at)
  values (p_user_id, v_risk, v_month, now())
  on conflict (user_id) do update
  set risk_percent = excluded.risk_percent,
      month_start = excluded.month_start,
      updated_at = now();

  return jsonb_build_object('user_id', p_user_id, 'risk_percent', v_risk, 'month_start', v_month);
end;
$$;

revoke all on function public.apply_attendance_booking_risk_event(text, uuid, text, text) from public;
revoke all on function public.evaluate_attendance_booking_risk(text) from public;
revoke all on function public.set_attendance_booking_risk(uuid, numeric) from public;
grant execute on function public.apply_attendance_booking_risk_event(text, uuid, text, text) to authenticated;
grant execute on function public.evaluate_attendance_booking_risk(text) to authenticated;
grant execute on function public.set_attendance_booking_risk(uuid, numeric) to authenticated;
