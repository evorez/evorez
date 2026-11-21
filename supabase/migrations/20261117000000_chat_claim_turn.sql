-- Claim the daily allowance and read the thread in one database round trip.
create or replace function public.claim_chat_turn(p_session_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  used integer;
  thread jsonb;
begin
  insert into public.chat_usage as usage_row (session_id, day, messages)
  values (p_session_id, (now() at time zone 'UTC')::date, 1)
  on conflict (session_id, day) do update
    set messages = usage_row.messages + 1
    where usage_row.messages < 40
  returning messages into used;

  if used is null then
    return jsonb_build_object('allowed', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('role', recent.role, 'content', recent.content) order by recent.id), '[]'::jsonb)
  into thread
  from (
    select id, role, content
    from public.chat_messages
    where session_id = p_session_id
    order by created_at desc, id desc
    limit 12
  ) as recent;

  return jsonb_build_object('allowed', true, 'history', thread);
end;
$$;
revoke all privileges on function public.claim_chat_turn(text) from public, anon, authenticated;
grant execute on function public.claim_chat_turn(text) to service_role;
notify pgrst, 'reload schema';
