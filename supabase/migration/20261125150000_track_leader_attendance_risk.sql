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
  if auth.uid() is null or coalesce(v_actor_role, '') not in ('leader', 'staff', 'teacher') then
    raise exception 'Attendance management access required';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id and role in ('member', 'leader')) then
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

create or replace function public.add_attendance_roster_member(p_session_id text, p_user_id uuid)
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
  v_change numeric(5, 2);
  v_insert_count integer;
begin
  select role into v_actor_role from public.profiles where id = auth.uid();
  if auth.uid() is null or coalesce(v_actor_role, '') not in ('leader', 'staff', 'teacher') then
    raise exception 'Attendance management access required';
  end if;
  if not exists (select 1 from public.schedule where id::text = p_session_id) then
    raise exception 'Session not found';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role in ('member', 'leader')) then
    raise exception 'Member or leader not found';
  end if;
  if exists (
    select 1 from public.bookings
    where session_id::text = p_session_id and user_id::text = p_user_id::text
  ) then
    raise exception 'This member already has a booking for the session';
  end if;
  if exists (
    select 1 from public.attendance
    where session_id::text = p_session_id and user_id::text = p_user_id::text
  ) then
    raise exception 'This member is already on the attendance list';
  end if;

  insert into public.attendance_manual_roster (session_id, user_id, added_by)
  values (p_session_id, p_user_id, auth.uid())
  on conflict (session_id, user_id) do nothing;
  get diagnostics v_insert_count = row_count;

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

  if v_insert_count = 0 then
    return jsonb_build_object(
      'session_id', p_session_id,
      'user_id', p_user_id,
      'created_at', (
        select created_at from public.attendance_manual_roster
        where session_id = p_session_id and user_id = p_user_id
      ),
      'added', false,
      'change_percent', 0,
      'risk_percent', v_risk,
      'month_start', v_month
    );
  end if;

  v_change := round((10 + random() * 10)::numeric, 2);
  v_change := least(100, greatest(0, v_risk + v_change)) - v_risk;
  v_risk := least(100, greatest(0, v_risk + v_change));

  insert into public.attendance_booking_risk_events (
    attendance_id, user_id, status, change_percent, month_start, updated_at
  )
  values (
    'forgot-signup:' || p_session_id || ':' || p_user_id::text,
    p_user_id,
    'forgot_signup',
    v_change,
    v_month,
    now()
  );

  update public.attendance_booking_risk
  set risk_percent = v_risk, month_start = v_month, updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'session_id', p_session_id,
    'user_id', p_user_id,
    'created_at', (
      select created_at from public.attendance_manual_roster
      where session_id = p_session_id and user_id = p_user_id
    ),
    'added', true,
    'change_percent', v_change,
    'risk_percent', v_risk,
    'month_start', v_month
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
  if auth.uid() is null or coalesce(v_actor_role, '') not in ('leader', 'staff') then
    raise exception 'Staff or leader access required';
  end if;
  if p_risk_percent is null or p_risk_percent < 0 or p_risk_percent > 100 then
    raise exception 'Risk percentage must be between 0 and 100';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role in ('member', 'leader')) then
    raise exception 'Member or leader not found';
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

create or replace function public.snapshot_attendance_booking_risk_for_session(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_session_event boolean;
  v_publish_at timestamptz;
  v_month date := date_trunc('month', timezone('utc', now()))::date;
  v_member record;
  v_risk numeric(5, 2);
  v_current_month date;
  v_allowed boolean;
  v_inserted integer;
  v_snapshot_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    select role into v_actor_role from public.profiles where id = auth.uid();
    if auth.uid() is null or coalesce(v_actor_role, '') not in ('leader', 'staff', 'teacher', 'admin') then
      raise exception 'Schedule management access required';
    end if;
  end if;

  select is_event, publish_at
    into v_session_event, v_publish_at
  from public.schedule
  where id::text = p_session_id;
  if not found or v_session_event then
    raise exception 'Bookable session not found';
  end if;
  if v_publish_at is not null and v_publish_at > now() then
    raise exception 'Session publication time has not arrived';
  end if;

  for v_member in
    select id from public.profiles where role in ('member', 'leader')
  loop
    insert into public.attendance_booking_risk (user_id, risk_percent, month_start)
    values (v_member.id, 0, v_month)
    on conflict (user_id) do nothing;

    select risk_percent, month_start
      into v_risk, v_current_month
    from public.attendance_booking_risk
    where user_id = v_member.id
    for update;

    if v_current_month <> v_month then
      v_risk := 0;
      update public.attendance_booking_risk
      set risk_percent = 0, month_start = v_month, updated_at = now()
      where user_id = v_member.id;
    end if;

    v_allowed := random() * 100 >= v_risk;
    insert into public.attendance_booking_risk_checks
      (user_id, session_id, allowed, risk_percent, month_start)
    values (v_member.id, p_session_id, v_allowed, v_risk, v_month)
    on conflict (user_id, session_id) do nothing;
    get diagnostics v_inserted = row_count;
    v_snapshot_count := v_snapshot_count + v_inserted;
  end loop;

  return jsonb_build_object('session_id', p_session_id, 'snapshots', v_snapshot_count);
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
  v_is_event boolean;
  v_publish_at timestamptz;
  v_published_at timestamptz;
  v_month date := date_trunc('month', timezone('utc', now()))::date;
  v_current_month date;
  v_risk numeric(5, 2);
  v_allowed boolean;
  v_snapshot_risk numeric(5, 2);
  v_snapshot_month date;
begin
  select role into v_role from public.profiles where id = v_user_id;
  if v_user_id is null or coalesce(v_role, '') not in ('member', 'leader') then
    raise exception 'Member or leader booking access required';
  end if;

  select is_event, publish_at, published_at
    into v_is_event, v_publish_at, v_published_at
  from public.schedule
  where id::text = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_is_event then
    raise exception 'Optional events cannot be booked';
  end if;
  if v_published_at is null then
    raise exception 'Session is not published';
  end if;
  if v_publish_at is not null and v_publish_at > now() then
    raise exception 'Session publication time has not arrived';
  end if;

  select allowed, risk_percent, month_start
    into v_allowed, v_snapshot_risk, v_snapshot_month
  from public.attendance_booking_risk_checks
  where user_id = v_user_id and session_id = p_session_id;

  if found then
    return jsonb_build_object(
      'user_id', v_user_id,
      'risk_percent', v_snapshot_risk,
      'month_start', v_snapshot_month,
      'session_id', p_session_id,
      'allowed', v_allowed
    );
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

  v_allowed := random() * 100 >= v_risk;
  insert into public.attendance_booking_risk_checks
    (user_id, session_id, allowed, risk_percent, month_start)
  values
    (v_user_id, p_session_id, v_allowed, v_risk, v_month)
  on conflict (user_id, session_id) do nothing;

  select allowed, risk_percent, month_start
    into v_allowed, v_snapshot_risk, v_snapshot_month
  from public.attendance_booking_risk_checks
  where user_id = v_user_id and session_id = p_session_id;

  return jsonb_build_object(
    'user_id', v_user_id,
    'risk_percent', v_snapshot_risk,
    'month_start', v_snapshot_month,
    'session_id', p_session_id,
    'allowed', v_allowed
  );
end;
$$;

insert into public.attendance_booking_risk_checks (user_id, session_id, allowed, risk_percent, month_start)
select
  leader_profile.id,
  session.id::text,
  random() * 100 >= coalesce(
    case when risk.month_start = date_trunc('month', timezone('utc', now()))::date then risk.risk_percent else 0 end,
    0
  ),
  coalesce(
    case when risk.month_start = date_trunc('month', timezone('utc', now()))::date then risk.risk_percent else 0 end,
    0
  ),
  date_trunc('month', timezone('utc', now()))::date
from public.profiles leader_profile
cross join public.schedule session
left join public.attendance_booking_risk risk on risk.user_id = leader_profile.id
where leader_profile.role = 'leader'
  and session.is_event = false
  and session.published_at is not null
on conflict (user_id, session_id) do nothing;
