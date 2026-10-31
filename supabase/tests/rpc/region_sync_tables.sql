begin;

select plan(2);

select is(
  (select count(*)::int from public.sync_tables where owner = 'region'),
  0,
  'EMB4A registers no region tables yet'
);

select is(
  (select count(*)::int from information_schema.tables where table_schema = 'public' and table_name like 'compliance\_%'),
  0,
  'EMB4B''s compliance tables are gone'
);

select * from finish();

rollback;
