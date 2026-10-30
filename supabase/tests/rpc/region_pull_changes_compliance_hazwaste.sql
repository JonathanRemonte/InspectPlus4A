begin;
select plan(2);

insert into public.user_accounts (
  uid, first_name, last_name, username, password_hash, role, region, province,
  email, is_active, sync_status, device_id
) values (
  '11111111-1111-1111-1111-111111111111',
  'Inspector', 'A', 'inspector_a', 'hashed', 'Inspector',
  'Region 4-B', 'Occidental Mindoro', 'inspector_a_hw@test.local',
  true, 'pending', 'device-a'
);

insert into public.establishments (
  estab_id, inspector_uid, name, address_line, barangay, city, province,
  nature_of_business, operating_status, owner_name, managing_head_name,
  phone_fax, email, contact_person_name, contact_person_position,
  created_at, updated_at, sync_status, device_id
) values (
  'est-hw-a', '11111111-1111-1111-1111-111111111111', 'HazWaste Plant A',
  'HazWaste Address A', 'Barangay A', 'City A', 'Occidental Mindoro',
  'Manufacturing', 'Operational', 'Owner A', 'Head A',
  '09170000014', 'hazwaste-plant-a@test.local', 'Contact A', 'Manager',
  now() - interval '1 minute', now() - interval '1 minute', 'pending', 'device-a'
);

insert into public.purpose_of_inspection (
  purpose_id, estab_id, inspector_uid, inspection_date, device_id
) values (
  'purpose-hw-a', 'est-hw-a', '11111111-1111-1111-1111-111111111111',
  current_date, 'device-a'
);

insert into public.inspection_reports (
  report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
  inspection_date, establishment_snapshot, permits_snapshot,
  created_at, updated_at, is_archived, sync_status, device_id
) values (
  'rep-hw-a', 'est-hw-a', '11111111-1111-1111-1111-111111111111', 'purpose-hw-a',
  'hazardous_waste', 'CTRL-HW-001', current_date,
  '{"name":"HazWaste Plant A"}'::jsonb, '[]'::jsonb,
  now() - interval '1 minute', now() - interval '1 minute', false, 'pending', 'device-a'
);

insert into public.compliance_hazwaste (
  compliance_id,
  report_id,
  hazwaste_generator_id,
  other_observations,
  remarks_recommendations
) values (
  'hw-a',
  'rep-hw-a',
  'HWG-001',
  'Initial hazwaste observation',
  'Initial hazwaste recommendation'
);

select is(
  jsonb_array_length(public.pull_changes(0)->'changes'->'compliance_hazwaste'->'created'),
  1,
  'pull_changes returns one compliance_hazwaste row for initial sync'
);

select is(
  jsonb_array_length(
    public.pull_changes(
      floor(extract(epoch from now()) * 1000)::bigint
    )->'changes'->'compliance_hazwaste'->'created'
  ),
  0,
  'pull_changes returns no compliance_hazwaste rows for current timestamp'
);

select * from finish();
rollback;
