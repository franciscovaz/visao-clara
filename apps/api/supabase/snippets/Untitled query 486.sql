drop policy if exists "tasks_insert_debug" on public.tasks;

create policy "tasks_insert_debug"
on public.tasks
for insert
to authenticated
with check (true);