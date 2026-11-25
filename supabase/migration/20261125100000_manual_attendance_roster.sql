alter table public.attendance_booking_risk_events
  drop constraint if exists attendance_booking_risk_events_status_check;

alter table public.attendance_booking_risk_events
  add constraint attendance_booking_risk_events_status_check
  check (status in ('present', 'late', 'absent', 'forgot_signup'));

drop policy if exists "Management can read attendance risk events" on public.attendance_booking_risk_events;
drop policy if exists "Members and management can read attendance risk events" on public.attendance_booking_risk_events;
create policy "Members and management can read attendance risk events"
  on public.attendance_booking_risk_events for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('leader', 'staff', 'teacher')
    )
  );

create table if not exists public.attendance_manual_roster (
  session_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table public.attendance_manual_roster enable row level security;
drop policy if exists "Management can read manual attendance roster" on public.attendance_manual_roster;
create policy "Management can read manual attendance roster"
  on public.attendance_manual_roster for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('leader', 'staff', 'teacher')
    )
  );

grant select on public.attendance_manual_roster to authenticated;

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
  if auth.uid() is null or v_actor_role not in ('leader', 'staff', 'teacher') then
    raise exception 'Attendance management access required';
  end if;
  if not exists (select 1 from public.schedule where id::text = p_session_id) then
    raise exception 'Session not found';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'member') then
    raise exception 'Member not found';
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
      'risk_percent', v_risk
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
    'risk_percent', v_risk
  );
end;
$$;

revoke all on function public.add_attendance_roster_member(text, uuid) from public;
grant execute on function public.add_attendance_roster_member(text, uuid) to authenticated;
