begin;
select plan(2);

-- Inspector A owns everything under test. Developer is a different account,
-- different province — proving write access comes from role, not ownership
-- or jurisdiction. Companion to admin_developer_visibility_rls.sql, which
-- covers read access and confirms Administrator does NOT get this write
-- bypass.
insert into public.user_accounts (
  uid, first_name, last_name, username, password_hash, role, region, province,
  email, is_active, sync_status, device_id
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'Inspector', 'A', 'inspector_a_dev_write_rls', 'hashed', 'Inspector',
    'Region 4-B', 'Occidental Mindoro', 'inspector_a_dev_write_rls@test.local',
    true, 'pending', 'device-a'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'Dev', 'User', 'dev_write_rls', 'hashed', 'Developer',
    'Region 4-B', 'Romblon', 'dev_write_rls@test.local',
    true, 'pending', 'device-dev'
  );

insert into public.establishments (
  estab_id, inspector_uid, name, address_line, barangay, city, province,
  nature_of_business, operating_status, owner_name, managing_head_name,
  phone_fax, email, contact_person_name, contact_person_position,
  created_at, updated_at, sync_status, device_id
) values (
  'dev-write-est-a', '11111111-1111-1111-1111-111111111111', 'Plant A',
  'Address A', 'Barangay A', 'City A', 'Occidental Mindoro',
  'Manufacturing', 'Operational', 'Owner A', 'Head A',
  '09170000001', 'dev-write-plant-a@test.local', 'Contact A', 'Manager',
  now(), now(), 'pending', 'device-a'
);

insert into public.purpose_of_inspection (
  purpose_id, estab_id, inspector_uid, inspection_date, device_id
) values (
  'dev-write-purpose-a', 'dev-write-est-a', '11111111-1111-1111-1111-111111111111',
  current_date, 'device-a'
);

insert into public.inspection_reports (
  report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
  inspection_date, establishment_snapshot, permits_snapshot,
  created_at, updated_at, is_archived, sync_status, device_id
) values (
  'dev-write-rep-a', 'dev-write-est-a', '11111111-1111-1111-1111-111111111111',
  'dev-write-purpose-a', 'air_monitoring', 'CTRL-DEV-WRITE-A', current_date,
  '{"name":"Plant A"}'::jsonb, '[]'::jsonb,
  now(), now(), false, 'pending', 'device-a'
);

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);

-- ── Compliance ───────────────────────────────────────────────────────────

-- Compliance-row ownership is derived from the parent report's
-- inspector_uid (not the developer's own), so this also exercises the
-- FOR ALL policy's INSERT clause, not just UPDATE.
insert into public.compliance_air (compliance_id, report_id, other_observations)
values ('dev-write-compliance-a', 'dev-write-rep-a', 'inserted by developer');
select is(
  (select other_observations from public.compliance_air where compliance_id = 'dev-write-compliance-a'),
  'inserted by developer',
  'developer can insert a compliance_air row for a report they do not own'
);

update public.compliance_air set other_observations = 'edited by developer' where compliance_id = 'dev-write-compliance-a';
select is(
  (select other_observations from public.compliance_air where compliance_id = 'dev-write-compliance-a'),
  'edited by developer',
  'developer can update a compliance_air row for a report they do not own'
);

select * from finish();
rollback;
