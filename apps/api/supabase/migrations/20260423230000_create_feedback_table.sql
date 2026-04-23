create table if not exists public.feedback (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    rating text not null,
    comment text,
    can_contact boolean not null default false,
    created_at timestamptz not null default now(),
    constraint feedback_rating_check check (rating in ('very_bad', 'bad', 'ok', 'good', 'excellent'))
);

alter table public.feedback enable row level security;

drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own" on public.feedback
    for select to authenticated
    using (user_id = auth.uid());

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
    for insert to authenticated
    with check (user_id = auth.uid());

create index if not exists idx_feedback_user_id on public.feedback(user_id);
create index if not exists idx_feedback_created_at on public.feedback(created_at desc);
