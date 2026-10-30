begin;
select plan(8);

insert into public.user_accounts (
  uid, first_name, last_name, username, password_hash, role, region, province,
  email, is_active, sync_status, device_id
) values (
  '11111111-1111-1111-1111-111111111111',
  'Inspector', 'A', 'inspector_a', 'hashed', 'Inspector',
  'Region 4-B', 'Occidental Mindoro', 'inspector_a_water_push@test.local',
  true, 'pending', 'device-a'
);

insert into public.establishments (
  estab_id, inspector_uid, name, address_line, barangay, city, province,
  nature_of_business, operating_status, owner_name, managing_head_name,
  phone_fax, email, contact_person_name, contact_person_position,
  created_at, updated_at, sync_status, device_id
) values (
  'est-water-push-001', '11111111-1111-1111-1111-111111111111', 'Water Push Plant',
  'Water Push Address', 'Barangay A', 'City A', 'Occidental Mindoro',
  'Manufacturing', 'Operational', 'Owner A', 'Head A',
  '09170000013', 'water-push-plant@test.local', 'Contact A', 'Manager',
  now(), now(), 'pending', 'device-a'
);

insert into public.purpose_of_inspection (
  purpose_id, estab_id, inspector_uid, inspection_date, device_id
) values (
  'purpose-water-push-001', 'est-water-push-001', '11111111-1111-1111-1111-111111111111',
  current_date, 'device-a'
);

insert into public.inspection_reports (
  report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
  inspection_date, establishment_snapshot, permits_snapshot,
  created_at, updated_at, is_archived, sync_status, device_id
) values (
  'rep-water-push-001', 'est-water-push-001', '11111111-1111-1111-1111-111111111111', 'purpose-water-push-001',
  'water_monitoring', 'CTRL-WATER-PUSH-001', current_date,
  '{"name":"Water Push Plant"}'::jsonb, '[]'::jsonb,
  now(), now(), false, 'pending', 'device-a'
);

-- Switch to the authenticated role (the same one push_changes runs as for
-- a real client) to prove the RPC's table-level GRANT on compliance_water
-- is actually in place — see 20260806010000_grant_authenticated_on_compliance_tables.sql.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is(
  public.push_changes(
    '{
      "compliance_water": {
        "created": [
          {
            "compliance_id": "water-push-001",
            "report_id": "rep-water-push-001",
            "has_wwtp": true,
            "non_wwtp_treatment": {"systems": ["Septic Tank"], "other": ""},
            "wwtp_type": "Physical",
            "other_observations": "Water observation",
            "remarks_recommendations": "Water recommendation"
          }
        ],
        "updated": [],
        "deleted": []
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for created compliance_water rows'
);

select is(
  (
    select count(*)::int
    from public.compliance_water
    where compliance_id = 'water-push-001'
  ),
  1,
  'push_changes inserts one compliance_water row'
);

-- A populated value rather than {}, so this distinguishes the column being
-- carried from the insert's own coalesce default. push_changes stores what
-- it is handed; keeping non_wwtp_treatment consistent with has_wwtp is the
-- client's job (nonWwtpTreatmentFor in
-- src/features/inspections/water/waterTypes.ts), so the pairing used here
-- is not itself meaningful.
select is(
  (
    select non_wwtp_treatment
    from public.compliance_water
    where compliance_id = 'water-push-001'
  ),
  '{"systems": ["Septic Tank"], "other": ""}'::jsonb,
  'push_changes stores non_wwtp_treatment on a created compliance_water row'
);

select is(
  public.push_changes(
    '{
      "compliance_water": {
        "created": [],
        "updated": [
          {
            "compliance_id": "water-push-001",
            "report_id": "rep-water-push-001",
            "has_wwtp": false,
            "non_wwtp_treatment": {"systems": ["Others"], "other": "Grease trap"},
            "wwtp_type": "Biological",
            "other_observations": "Updated water observation",
            "remarks_recommendations": "Updated water recommendation"
          }
        ],
        "deleted": []
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for updated compliance_water rows'
);

select is(
  (
    select remarks_recommendations
    from public.compliance_water
    where compliance_id = 'water-push-001'
  ),
  'Updated water recommendation',
  'push_changes updates an existing compliance_water row'
);

select is(
  (
    select non_wwtp_treatment
    from public.compliance_water
    where compliance_id = 'water-push-001'
  ),
  '{"systems": ["Others"], "other": "Grease trap"}'::jsonb,
  'push_changes overwrites non_wwtp_treatment on an updated compliance_water row'
);

select is(
  public.push_changes(
    '{
      "compliance_water": {
        "created": [],
        "updated": [],
        "deleted": ["water-push-001"]
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for deleted compliance_water rows'
);

select is(
  (
    select count(*)::int
    from public.compliance_water
    where compliance_id = 'water-push-001'
  ),
  0,
  'push_changes deletes an existing compliance_water row'
);

select * from finish();
rollback;
