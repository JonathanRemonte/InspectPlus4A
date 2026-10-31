begin;
select plan(6);

insert into public.user_accounts (
  uid, first_name, last_name, username, password_hash, role, region, province,
  email, is_active, sync_status, device_id
) values (
  '11111111-1111-1111-1111-111111111111',
  'Inspector', 'A', 'inspector_a', 'hashed', 'Inspector',
  'Region 4-B', 'Occidental Mindoro', 'inspector_a_hw_push@test.local',
  true, 'pending', 'device-a'
);

insert into public.establishments (
  estab_id, inspector_uid, name, address_line, barangay, city, province,
  nature_of_business, operating_status, owner_name, managing_head_name,
  phone_fax, email, contact_person_name, contact_person_position,
  created_at, updated_at, sync_status, device_id
) values (
  'est-hw-push-001', '11111111-1111-1111-1111-111111111111', 'HazWaste Push Plant',
  'HazWaste Push Address', 'Barangay A', 'City A', 'Occidental Mindoro',
  'Manufacturing', 'Operational', 'Owner A', 'Head A',
  '09170000015', 'hazwaste-push-plant@test.local', 'Contact A', 'Manager',
  now(), now(), 'pending', 'device-a'
);

insert into public.purpose_of_inspection (
  purpose_id, estab_id, inspector_uid, inspection_date, device_id
) values (
  'purpose-hw-push-001', 'est-hw-push-001', '11111111-1111-1111-1111-111111111111',
  current_date, 'device-a'
);

insert into public.inspection_reports (
  report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
  inspection_date, establishment_snapshot, permits_snapshot,
  created_at, updated_at, is_archived, sync_status, device_id
) values (
  'rep-hw-push-001', 'est-hw-push-001', '11111111-1111-1111-1111-111111111111', 'purpose-hw-push-001',
  'hazardous_waste', 'CTRL-HW-PUSH-001', current_date,
  '{"name":"HazWaste Push Plant"}'::jsonb, '[]'::jsonb,
  now(), now(), false, 'pending', 'device-a'
);

-- Switch to the authenticated role (the same one push_changes runs as for
-- a real client) to prove the RPC's table-level GRANT on compliance_hazwaste
-- is actually in place — see 20260806010000_grant_authenticated_on_compliance_tables.sql.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is(
  public.push_changes(
    '{
      "compliance_hazwaste": {
        "created": [
          {
            "compliance_id": "hw-push-001",
            "report_id": "rep-hw-push-001",
            "hazwaste_generator_id": "HWG-PUSH-001",
            "other_observations": "HazWaste observation",
            "remarks_recommendations": "HazWaste recommendation"
          }
        ],
        "updated": [],
        "deleted": []
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for created compliance_hazwaste rows'
);

select is(
  (
    select count(*)::int
    from public.compliance_hazwaste
    where compliance_id = 'hw-push-001'
  ),
  1,
  'push_changes inserts one compliance_hazwaste row'
);

select is(
  public.push_changes(
    '{
      "compliance_hazwaste": {
        "created": [],
        "updated": [
          {
            "compliance_id": "hw-push-001",
            "report_id": "rep-hw-push-001",
            "hazwaste_generator_id": "HWG-PUSH-002",
            "other_observations": "Updated hazwaste observation",
            "remarks_recommendations": "Updated hazwaste recommendation"
          }
        ],
        "deleted": []
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for updated compliance_hazwaste rows'
);

select is(
  (
    select remarks_recommendations
    from public.compliance_hazwaste
    where compliance_id = 'hw-push-001'
  ),
  'Updated hazwaste recommendation',
  'push_changes updates an existing compliance_hazwaste row'
);

select is(
  public.push_changes(
    '{
      "compliance_hazwaste": {
        "created": [],
        "updated": [],
        "deleted": ["hw-push-001"]
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for deleted compliance_hazwaste rows'
);

select is(
  (
    select count(*)::int
    from public.compliance_hazwaste
    where compliance_id = 'hw-push-001'
  ),
  0,
  'push_changes deletes an existing compliance_hazwaste row'
);

select * from finish();
rollback;
