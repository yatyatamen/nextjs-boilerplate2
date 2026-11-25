with ranked_checks as (
  select ctid, row_number() over (
    partition by user_id, session_id
    order by created_at, month_start
  ) as row_num
  from public.attendance_booking_risk_checks
)
delete from public.attendance_booking_risk_checks checks
using ranked_checks
where checks.ctid = ranked_checks.ctid
  and ranked_checks.row_num > 1;

alter table public.attendance_booking_risk_checks
  drop constraint if exists attendance_booking_risk_checks_pkey;
alter table public.attendance_booking_risk_checks
  add constraint attendance_booking_risk_checks_pkey primary key (user_id, session_id);

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
    if auth.uid() is null or v_actor_role not in ('leader', 'staff', 'teacher', 'admin') then
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
    select id from public.profiles where role = 'member'
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
    values
      (v_member.id, p_session_id, v_allowed, v_risk, v_month)
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
  if v_user_id is null or v_role <> 'member' then
    raise exception 'Member booking access required';
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

revoke all on function public.snapshot_attendance_booking_risk_for_session(text) from public;
grant execute on function public.snapshot_attendance_booking_risk_for_session(text) to authenticated, service_role;
revoke all on function public.evaluate_attendance_booking_risk(text) from public;
grant execute on function public.evaluate_attendance_booking_risk(text) to authenticated;
