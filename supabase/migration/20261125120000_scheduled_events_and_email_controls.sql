alter table public.schedule
  add column if not exists is_event boolean not null default false,
  add column if not exists publish_at timestamptz,
  add column if not exists published_at timestamptz;

update public.schedule
set published_at = now()
where published_at is null
  and publish_at is null;

create table if not exists public.auto_email_settings (
  id boolean primary key default true check (id),
  enabled_emails jsonb not null default
    '{"booking_confirmation":true,"booking_reminder":true,"booking_cancellation":true,"booking_admin_cancellation":true,"announcement":true,"session_alert":true,"assessment":true,"attendance_update":true,"absence":true,"shop_update":true}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);



insert into public.auto_email_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.auto_email_settings enable row level security;

drop policy if exists "Authenticated users can read auto email settings" on public.auto_email_settings;
create policy "Authenticated users can read auto email settings"
  on public.auto_email_settings for select to authenticated
  using (true);

drop policy if exists "Staff can manage auto email settings" on public.auto_email_settings;
create policy "Staff can manage auto email settings"
  on public.auto_email_settings for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'staff'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'staff'
    )
  );

grant select, insert, update on public.auto_email_settings to authenticated;

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
