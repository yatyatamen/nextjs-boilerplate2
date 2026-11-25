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

revoke all on function public.set_attendance_booking_risk(uuid, numeric) from public;
grant execute on function public.set_attendance_booking_risk(uuid, numeric) to authenticated;
