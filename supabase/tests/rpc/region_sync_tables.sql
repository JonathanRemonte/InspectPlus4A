begin;

select plan(1);

select is(
  (select array_agg(table_name order by sync_order) from public.sync_tables where owner = 'region'),
  array['compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia'],
  'EMB4B registers its four compliance tables, in push order'
);

select * from finish();

rollback;
