alter table public.raffles add column winner_number int, add column winner_name text, add column drawn_at timestamptz;

create or replace function public.draw_winner(_raffle_id uuid)
returns table(number int, full_name text) language plpgsql security definer set search_path = public
as $$
declare t record;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Apenas o organizador'; end if;
  select tk.number, coalesce(p.full_name,'') as full_name into t
  from public.tickets tk left join public.profiles p on p.id = tk.user_id
  where tk.raffle_id = _raffle_id and tk.status = 'paid'
  order by random() limit 1;
  if t is null then raise exception 'Nenhum número pago para sortear'; end if;
  update public.raffles set winner_number = t.number, winner_name = t.full_name, drawn_at = now() where id = _raffle_id;
  return query select t.number, t.full_name;
end $$;
revoke execute on function public.draw_winner(uuid) from anon, public;
grant execute on function public.draw_winner(uuid) to authenticated;

create or replace function public.reset_raffle(_raffle_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Apenas o organizador'; end if;
  delete from public.tickets where raffle_id = _raffle_id;
  update public.raffles set winner_number = null, winner_name = null, drawn_at = null where id = _raffle_id;
end $$;
revoke execute on function public.reset_raffle(uuid) from anon, public;
grant execute on function public.reset_raffle(uuid) to authenticated;