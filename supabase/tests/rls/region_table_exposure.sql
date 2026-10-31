begin;

select plan(8);

select is(
  has_table_privilege('anon', 'public.compliance_air', 'SELECT'),
  false,
  'anon cannot SELECT compliance_air'
);

select is(
  has_table_privilege('anon', 'public.compliance_water', 'SELECT'),
  false,
  'anon cannot SELECT compliance_water'
);

select is(
  has_table_privilege('anon', 'public.compliance_hazwaste', 'SELECT'),
  false,
  'anon cannot SELECT compliance_hazwaste'
);

select is(
  has_table_privilege('anon', 'public.compliance_eia', 'SELECT'),
  false,
  'anon cannot SELECT compliance_eia'
);

select is(
  has_table_privilege('authenticated', 'public.compliance_air', 'SELECT'),
  true,
  'authenticated can directly SELECT compliance_air subject to RLS'
);

select is(
  has_table_privilege('authenticated', 'public.compliance_water', 'SELECT'),
  true,
  'authenticated can directly SELECT compliance_water subject to RLS'
);

select is(
  has_table_privilege('authenticated', 'public.compliance_hazwaste', 'SELECT'),
  true,
  'authenticated can directly SELECT compliance_hazwaste subject to RLS'
);

select is(
  has_table_privilege('authenticated', 'public.compliance_eia', 'SELECT'),
  true,
  'authenticated can directly SELECT compliance_eia subject to RLS'
);

select * from finish();

rollback;
