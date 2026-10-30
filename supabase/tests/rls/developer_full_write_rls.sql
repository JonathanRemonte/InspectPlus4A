begin;
select plan(6);

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

-- ── Updates ──────────────────────────────────────────────────────────────

update public.establishments set name = 'Renamed by Developer' where estab_id = 'dev-write-est-a';
select is(
  (select name from public.establishments where estab_id = 'dev-write-est-a'),
  'Renamed by Developer',
  'developer can update an establishment they do not own'
);

update public.inspection_reports set report_control_no = 'CTRL-DEV-EDITED' where report_id = 'dev-write-rep-a';
select is(
  (select report_control_no from public.inspection_reports where report_id = 'dev-write-rep-a'),
  'CTRL-DEV-EDITED',
  'developer can update an inspection report they do not own'
);

update public.purpose_of_inspection set others = 'edited by developer' where purpose_id = 'dev-write-purpose-a';
select is(
  (select others from public.purpose_of_inspection where purpose_id = 'dev-write-purpose-a'),
  'edited by developer',
  'developer can update a purpose_of_inspection row they do not own'
);

-- ── Deletes ──────────────────────────────────────────────────────────────
-- Order matters: inspection_reports -> purpose_of_inspection -> establishments,
-- respecting the "on delete restrict" FKs from purpose_of_inspection.estab_id
-- and inspection_reports.{estab_id,purpose_id}.

delete from public.inspection_reports where report_id = 'dev-write-rep-a';
select is(
  (select count(*)::int from public.inspection_reports where report_id = 'dev-write-rep-a'),
  0,
  'developer can delete an inspection report they do not own'
);

delete from public.purpose_of_inspection where purpose_id = 'dev-write-purpose-a';
select is(
  (select count(*)::int from public.purpose_of_inspection where purpose_id = 'dev-write-purpose-a'),
  0,
  'developer can delete a purpose_of_inspection row they do not own'
);

delete from public.establishments where estab_id = 'dev-write-est-a';
select is(
  (select count(*)::int from public.establishments where estab_id = 'dev-write-est-a'),
  0,
  'developer can delete an establishment they do not own'
);

select * from finish();
rollback;
