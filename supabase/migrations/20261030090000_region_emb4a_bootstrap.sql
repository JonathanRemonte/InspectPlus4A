begin;

-- EMB4A starts with no region tables. The fork inherits EMB4B's four
-- compliance tables; remove them in the order docs/upstream-merge.md §6
-- requires (registry rows, then handlers, then tables), and drop EMB4B's
-- report_type check (EMB4A's types arrive with its forms in Phase 3).

delete from public.sync_tables
  where table_name in ('compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia');

drop function public.push_compliance_air(jsonb);
drop function public.push_compliance_water(jsonb);
drop function public.push_compliance_hazwaste(jsonb);
drop function public.push_compliance_eia(jsonb);
drop function public.pull_compliance_air(bigint);
drop function public.pull_compliance_water(bigint);
drop function public.pull_compliance_hazwaste(bigint);
drop function public.pull_compliance_eia(bigint);

drop table public.compliance_air;
drop table public.compliance_water;
drop table public.compliance_hazwaste;
drop table public.compliance_eia;

alter table public.inspection_reports drop constraint inspection_reports_report_type_check;

commit;
