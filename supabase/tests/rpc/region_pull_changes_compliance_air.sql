begin;

select plan(2);

insert into public.user_accounts (
  uid, first_name, last_name, username, password_hash, role, region, province,
  email, is_active, sync_status, device_id
) values (
  '55555555-5555-5555-5555-555555555555',
  'Inspector', 'E', 'inspector_e_air', 'hashed', 'Inspector',
  'Region 4-B', 'Occidental Mindoro', 'inspector_e_air@test.local',
  true, 'pending', 'device-e'
);

insert into public.establishments (
  estab_id, inspector_uid, name, address_line, barangay, city, province,
  nature_of_business, operating_status, owner_name, managing_head_name,
  phone_fax, email, contact_person_name, contact_person_position,
  created_at, updated_at, sync_status, device_id
) values (
  'est-air-a', '55555555-5555-5555-5555-555555555555', 'Plant Air A',
  'Address A', 'Barangay A', 'City A', 'Occidental Mindoro',
  'Manufacturing', 'Operational', 'Owner A', 'Head A',
  '09170000010', 'plant-air-a@test.local', 'Contact A', 'Manager',
  now() - interval '1 minute', now() - interval '1 minute', 'pending', 'device-e'
);

insert into public.purpose_of_inspection (
  purpose_id, estab_id, inspector_uid, inspection_date, device_id
) values (
  'purpose-air-a', 'est-air-a', '55555555-5555-5555-5555-555555555555',
  current_date, 'device-e'
);

insert into public.inspection_reports (
  report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
  inspection_date, establishment_snapshot, permits_snapshot,
  created_at, updated_at, is_archived, sync_status, device_id
) values (
  'rep-air-a', 'est-air-a', '55555555-5555-5555-5555-555555555555', 'purpose-air-a',
  'air_monitoring', 'CTRL-AIR-001', current_date,
  '{"name":"Plant Air A"}'::jsonb, '[]'::jsonb,
  now() - interval '1 minute', now() - interval '1 minute', false, 'pending', 'device-e'
);

insert into public.compliance_air (
  compliance_id,
  report_id,
  other_observations,
  remarks_recommendations
) values (
  'air-a',
  'rep-air-a',
  'Initial observation',
  'Initial recommendation'
);

select is(
  jsonb_array_length(public.pull_changes(0)->'changes'->'compliance_air'->'created'),
  1,
  'pull_changes returns one compliance_air row for initial sync'
);

select is(
  jsonb_array_length(
    public.pull_changes(
      floor(extract(epoch from now()) * 1000)::bigint
    )->'changes'->'compliance_air'->'created'
  ),
  0,
  'pull_changes returns no compliance_air rows for current timestamp'
);

select * from finish();

rollback;
