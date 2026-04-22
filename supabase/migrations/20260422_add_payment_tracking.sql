alter table public.orders
add column if not exists payment_amount numeric(12,2) not null default 0 check (payment_amount >= 0);

alter table public.orders
add column if not exists balance_due numeric(12,2) not null default 0 check (balance_due >= 0);

update public.orders
set
  payment_amount = coalesce(payment_amount, 0),
  balance_due = greatest(total_amount - coalesce(payment_amount, 0), 0);
