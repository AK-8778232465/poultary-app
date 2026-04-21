create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_rates (
  id uuid primary key default gen_random_uuid(),
  rate_per_kg numeric(12,2) not null check (rate_per_kg > 0),
  effective_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  order_date date not null,
  quantity_kg numeric(12,2) not null check (quantity_kg > 0),
  rate_per_kg numeric(12,2) not null check (rate_per_kg > 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists shops_is_active_idx on public.shops (is_active);
create index if not exists daily_rates_effective_date_idx on public.daily_rates (effective_date desc);
create index if not exists orders_order_date_idx on public.orders (order_date desc);
create index if not exists orders_shop_id_idx on public.orders (shop_id);
create index if not exists orders_deleted_at_idx on public.orders (deleted_at);

create or replace function public.set_order_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_orders_updated_at on public.orders;

create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_order_updated_at();
