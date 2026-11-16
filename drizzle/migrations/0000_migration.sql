create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create type public.app_role as enum ('admin','user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.raw_user_meta_data->>'phone',''));
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.raffles (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Minha rifa',
  description text not null default '',
  image_url text,
  price numeric(10,2) not null default 10,
  total_numbers int not null default 100,
  pix_key text not null default '',
  pix_qr_url text,
  draw_date text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.raffles to anon, authenticated;
grant insert, update on public.raffles to authenticated;
grant all on public.raffles to service_role;
alter table public.raffles enable row level security;
create policy "raffle public read" on public.raffles for select to anon, authenticated using (true);
create policy "raffle admin insert" on public.raffles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "raffle admin update" on public.raffles for update to authenticated using (public.has_role(auth.uid(),'admin'));
insert into public.raffles(title, description) values ('Minha rifa', 'Descreva aqui o produto que será rifado.');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.raffles(id) on delete cascade,
  number int not null,
  user_id uuid not null,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  unique(raffle_id, number)
);
grant select, update, delete on public.tickets to authenticated;
grant all on public.tickets to service_role;
alter table public.tickets enable row level security;
create policy "tickets own or admin read" on public.tickets for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "tickets admin update" on public.tickets for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "tickets admin delete" on public.tickets for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.get_taken_numbers(_raffle_id uuid)
returns table(number int, status text) language sql stable security definer set search_path = public
as $$ select t.number, t.status from public.tickets t where t.raffle_id = _raffle_id $$;
grant execute on function public.get_taken_numbers(uuid) to anon, authenticated;

create or replace function public.reserve_numbers(_raffle_id uuid, _numbers int[])
returns void language plpgsql security definer set search_path = public
as $$
declare total int; n int;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  if array_length(_numbers,1) is null or array_length(_numbers,1) > 100 then raise exception 'Seleção inválida'; end if;
  select total_numbers into total from public.raffles where id=_raffle_id;
  if total is null then raise exception 'Rifa não encontrada'; end if;
  foreach n in array _numbers loop
    if n < 1 or n > total then raise exception 'Número inválido: %', n; end if;
  end loop;
  begin
    insert into public.tickets(raffle_id, number, user_id) select _raffle_id, x, auth.uid() from unnest(_numbers) x;
  exception when unique_violation then
    raise exception 'Algum número já foi escolhido por outra pessoa. Atualize e tente novamente.';
  end;
end $$;
revoke execute on function public.reserve_numbers(uuid,int[]) from anon, public;
grant execute on function public.reserve_numbers(uuid,int[]) to authenticated;