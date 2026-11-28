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
  v_forgot_signup_floor numeric(5, 2);
  v_manually_added boolean;
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

  select exists (
    select 1 from public.attendance_manual_roster
    where session_id = p_session_id and user_id = p_user_id
  ) into v_manually_added;

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

  v_change := case
    when p_status = 'absent' then round((15 + random() * 15)::numeric, 2)
    when p_status = 'late' then round((10 + random() * 10)::numeric, 2)
    when v_manually_added then 0
    else -round((15 + random() * 15)::numeric, 2)
  end;

  select coalesce(sum(change_percent), 0)
    into v_forgot_signup_floor
  from public.attendance_booking_risk_events
  where user_id = p_user_id
    and status = 'forgot_signup'
    and month_start = v_month;

  v_risk := least(100, greatest(0, v_risk + v_change));
  v_risk := greatest(v_forgot_signup_floor, v_risk);
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
