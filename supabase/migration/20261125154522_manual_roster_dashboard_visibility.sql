drop policy if exists "Users can read their own manual attendance roster"
  on public.attendance_manual_roster;

create policy "Users can read their own manual attendance roster"
  on public.attendance_manual_roster for select to authenticated
  using (user_id = auth.uid());
