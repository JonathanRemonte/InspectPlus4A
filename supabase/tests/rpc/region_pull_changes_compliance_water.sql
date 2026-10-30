begin;
select plan(2);

insert into public.user_accounts (
  uid, first_name, last_name, username, password_hash, role, region, province,
  email, is_active, sync_status, device_id
) values (
  '11111111-1111-1111-1111-111111111111',
  'Inspector', 'A', 'inspector_a', 'hashed', 'Inspector',
  'Region 4-B', 'Occidental Mindoro', 'inspector_a_water@test.local',
  true, 'pending', 'device-a'
);

insert into public.establishments (
  estab_id, inspector_uid, name, address_line, barangay, city, province,
  nature_of_business, operating_status, owner_name, managing_head_name,
  phone_fax, email, contact_person_name, contact_person_position,
  created_at, updated_at, sync_status, device_id
) values (
  'est-water-a', '11111111-1111-1111-1111-111111111111', 'Water Plant A',
  'Water Address A', 'Barangay A', 'City A', 'Occidental Mindoro',
  'Manufacturing', 'Operational', 'Owner A', 'Head A',
  '09170000012', 'water-plant-a@test.local', 'Contact A', 'Manager',
  now() - interval '1 minute', now() - interval '1 minute', 'pending', 'device-a'
);

insert into public.purpose_of_inspection (
  purpose_id, estab_id, inspector_uid, inspection_date, device_id
) values (
  'purpose-water-a', 'est-water-a', '11111111-1111-1111-1111-111111111111',
  current_date, 'device-a'
);

insert into public.inspection_reports (
  report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
  inspection_date, establishment_snapshot, permits_snapshot,
  created_at, updated_at, is_archived, sync_status, device_id
) values (
  'rep-water-a', 'est-water-a', '11111111-1111-1111-1111-111111111111', 'purpose-water-a',
  'water_monitoring', 'CTRL-WATER-001', current_date,
  '{"name":"Water Plant A"}'::jsonb, '[]'::jsonb,
  now() - interval '1 minute', now() - interval '1 minute', false, 'pending', 'device-a'
);

insert into public.compliance_water (
  compliance_id,
  report_id,
  has_wwtp,
  wwtp_type,
  other_observations,
  remarks_recommendations
) values (
  'water-a',
  'rep-water-a',
  true,
  'Physical',
  'Initial water observation',
  'Initial water recommendation'
);

-- Scoped to this test's own fixture row rather than the length of the whole
-- array: pull_changes returns everything visible to the caller, so counting
-- the entire payload silently asserted that the database is empty apart from
-- this file. That holds in CI (which resets before running) but breaks against
-- any database with real rows in it, and the failure looks like a bug in
-- pull_changes rather than in the test.
select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      public.pull_changes(0)->'changes'->'compliance_water'->'created'
    ) as pulled
    where pulled->>'compliance_id' = 'water-a'
  ),
  1,
  'pull_changes returns this compliance_water row for initial sync'
);

select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      public.pull_changes(
        floor(extract(epoch from now()) * 1000)::bigint
      )->'changes'->'compliance_water'->'created'
    ) as pulled
    where pulled->>'compliance_id' = 'water-a'
  ),
  0,
  'pull_changes does not return this compliance_water row for current timestamp'
);

select * from finish();
rollback;
