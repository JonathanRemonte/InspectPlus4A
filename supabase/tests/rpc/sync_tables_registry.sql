begin;

select plan(6);

select is(
  (select array_agg(table_name order by sync_order) from public.sync_tables),
  array['establishments', 'purpose_of_inspection', 'inspection_reports', 'survey_reports',
        'compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia', 'attachments'],
  'sync_tables lists every synced table, parents before children'
);

select is(
  (select array_agg(table_name order by sync_order) from public.sync_tables where owner = 'region'),
  array['compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia'],
  'the compliance tables are region-owned'
);

select is(has_table_privilege('anon', 'public.sync_tables', 'SELECT'), false, 'anon cannot read sync_tables');

select is(
  has_function_privilege('anon', 'public.push_compliance_air(jsonb)', 'EXECUTE'),
  false,
  'anon cannot call a push handler directly'
);

select ok(
  (public.pull_changes(0)->'changes') ?& array['establishments', 'compliance_water', 'attachments'],
  'pull_changes emits one key per registered table'
);

select is(
  public.push_changes('{}'::jsonb),
  '{"status": "ok"}'::jsonb,
  'an empty push still answers {"status":"ok"} with no conflicts key'
);

select * from finish();

rollback;
