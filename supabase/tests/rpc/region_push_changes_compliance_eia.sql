begin;
select plan(6);

insert into public.user_accounts (
  uid, first_name, last_name, username, password_hash, role, region, province,
  email, is_active, sync_status, device_id
) values (
  '11111111-1111-1111-1111-111111111111',
  'Inspector', 'A', 'inspector_a', 'hashed', 'Inspector',
  'Region 4-B', 'Occidental Mindoro', 'inspector_a_eia_push@test.local',
  true, 'pending', 'device-a'
);

insert into public.establishments (
  estab_id, inspector_uid, name, address_line, barangay, city, province,
  nature_of_business, operating_status, owner_name, managing_head_name,
  phone_fax, email, contact_person_name, contact_person_position,
  created_at, updated_at, sync_status, device_id
) values (
  'est-eia-push-001', '11111111-1111-1111-1111-111111111111', 'EIA Push Plant',
  'EIA Push Address', 'Barangay A', 'City A', 'Occidental Mindoro',
  'Manufacturing', 'Operational', 'Owner A', 'Head A',
  '09170000017', 'eia-push-plant@test.local', 'Contact A', 'Manager',
  now(), now(), 'pending', 'device-a'
);

insert into public.purpose_of_inspection (
  purpose_id, estab_id, inspector_uid, inspection_date, device_id
) values (
  'purpose-eia-push-001', 'est-eia-push-001', '11111111-1111-1111-1111-111111111111',
  current_date, 'device-a'
);

insert into public.inspection_reports (
  report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
  inspection_date, establishment_snapshot, permits_snapshot,
  created_at, updated_at, is_archived, sync_status, device_id
) values (
  'rep-eia-push-001', 'est-eia-push-001', '11111111-1111-1111-1111-111111111111', 'purpose-eia-push-001',
  'eia', 'CTRL-EIA-PUSH-001', current_date,
  '{"name":"EIA Push Plant"}'::jsonb, '[]'::jsonb,
  now(), now(), false, 'pending', 'device-a'
);

-- Switch to the authenticated role (the same one push_changes runs as for
-- a real client) to prove the RPC's table-level GRANT on compliance_eia is
-- actually in place — see 20260806010000_grant_authenticated_on_compliance_tables.sql.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is(
  public.push_changes(
    '{
      "compliance_eia": {
        "created": [
          {
            "compliance_id": "eia-push-001",
            "report_id": "rep-eia-push-001",
            "other_observations": "EIA observation",
            "remarks_recommendations": "EIA recommendation"
          }
        ],
        "updated": [],
        "deleted": []
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for created compliance_eia rows'
);

select is(
  (
    select count(*)::int
    from public.compliance_eia
    where compliance_id = 'eia-push-001'
  ),
  1,
  'push_changes inserts one compliance_eia row'
);

select is(
  public.push_changes(
    '{
      "compliance_eia": {
        "created": [],
        "updated": [
          {
            "compliance_id": "eia-push-001",
            "report_id": "rep-eia-push-001",
            "other_observations": "Updated eia observation",
            "remarks_recommendations": "Updated eia recommendation"
          }
        ],
        "deleted": []
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for updated compliance_eia rows'
);

select is(
  (
    select remarks_recommendations
    from public.compliance_eia
    where compliance_id = 'eia-push-001'
  ),
  'Updated eia recommendation',
  'push_changes updates an existing compliance_eia row'
);

select is(
  public.push_changes(
    '{
      "compliance_eia": {
        "created": [],
        "updated": [],
        "deleted": ["eia-push-001"]
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for deleted compliance_eia rows'
);

select is(
  (
    select count(*)::int
    from public.compliance_eia
    where compliance_id = 'eia-push-001'
  ),
  0,
  'push_changes deletes an existing compliance_eia row'
);

select * from finish();
rollback;
