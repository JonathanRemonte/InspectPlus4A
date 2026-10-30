begin;

select plan(9);

select is(
  (select array_agg(table_name order by sync_order) from public.sync_tables where owner = 'core'),
  array['establishments', 'purpose_of_inspection', 'inspection_reports', 'survey_reports', 'attachments'],
  'the foundation tables are registered, parents before children, attachments last'
);

select is(
  (select count(*)::int from public.sync_tables where owner = 'region' and sync_order not between 100 and 899),
  0,
  'every region table sits in the region band 100-899'
);

select is(
  (select max(sync_order) from public.sync_tables) ,
  (select sync_order from public.sync_tables where table_name = 'attachments'),
  'attachments is synced last'
);

select is(has_table_privilege('anon', 'public.sync_tables', 'SELECT'), false, 'anon cannot read sync_tables');

select is(has_table_privilege('authenticated', 'public.sync_tables', 'SELECT'), true, 'authenticated can read sync_tables');

select is(
  (select count(*)::int from public.sync_tables t
    where not has_function_privilege('authenticated', t.push_handler::oid, 'EXECUTE')
       or not has_function_privilege('authenticated', t.pull_handler::oid, 'EXECUTE')),
  0,
  'authenticated can execute every registered push and pull handler'
);

select is(
  (select count(*)::int from public.sync_tables t
    where has_function_privilege('anon', t.push_handler::oid, 'EXECUTE')
       or has_function_privilege('anon', t.pull_handler::oid, 'EXECUTE')),
  0,
  'anon cannot call any push or pull handler directly'
);

select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.pull_changes(0)->'changes') k),
  (select array_agg(table_name order by table_name) from public.sync_tables),
  'pull_changes emits exactly one key per registered table'
);

select is(
  public.push_changes('{}'::jsonb),
  '{"status": "ok"}'::jsonb,
  'an empty push still answers {"status":"ok"} with no conflicts key'
);

select * from finish();

rollback;
