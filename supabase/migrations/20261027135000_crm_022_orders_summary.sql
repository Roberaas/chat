create function crm.orders_summary(p_q text default null, p_status text default null, p_store uuid default null, p_from timestamptz default null, p_to timestamptz default null)
returns table(cnt bigint, total numeric, avg_total numeric)
language sql stable set search_path = '' as $$
  select count(*), coalesce(sum(o.total) filter (where o.status not in ('cancelled','returned')), 0),
         coalesce(round(avg(o.total) filter (where o.status not in ('cancelled','returned')), 2), 0)
    from crm.orders o
   where (p_q is null or p_q = '' or lower(coalesce(o.order_no, '')) like '%' || lower(replace(replace(p_q, '%', ''), '_', '')) || '%')
     and (p_status is null or o.status = p_status) and (p_store is null or o.store_id = p_store)
     and (p_from is null or o.ordered_at >= p_from) and (p_to is null or o.ordered_at <= p_to)
$$;
revoke all on function crm.orders_summary(text, text, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function crm.orders_summary(text, text, uuid, timestamptz, timestamptz) to authenticated;
