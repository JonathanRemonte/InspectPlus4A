begin;

select plan(9);

insert into public.user_accounts (
  uid, first_name, last_name, username, password_hash, role, region, province,
  email, is_active, sync_status, device_id
) values (
  '55555555-5555-5555-5555-555555555555',
  'Inspector', 'E', 'inspector_e_air_push', 'hashed', 'Inspector',
  'Region 4-B', 'Occidental Mindoro', 'inspector_e_air_push@test.local',
  true, 'pending', 'device-e'
);

insert into public.establishments (
  estab_id, inspector_uid, name, address_line, barangay, city, province,
  nature_of_business, operating_status, owner_name, managing_head_name,
  phone_fax, email, contact_person_name, contact_person_position,
  created_at, updated_at, sync_status, device_id
) values (
  'est-air-001', '55555555-5555-5555-5555-555555555555', 'Air Plant',
  'Air Address', 'Barangay A', 'City A', 'Occidental Mindoro',
  'Manufacturing', 'Operational', 'Owner A', 'Head A',
  '09170000011', 'air-plant@test.local', 'Contact A', 'Manager',
  now(), now(), 'pending', 'device-e'
);

insert into public.purpose_of_inspection (
  purpose_id, estab_id, inspector_uid, inspection_date, device_id
) values (
  'purpose-air-001', 'est-air-001', '55555555-5555-5555-5555-555555555555',
  current_date, 'device-e'
);

insert into public.inspection_reports (
  report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
  inspection_date, establishment_snapshot, permits_snapshot,
  created_at, updated_at, is_archived, sync_status, device_id
) values (
  'rep-air-001', 'est-air-001', '55555555-5555-5555-5555-555555555555', 'purpose-air-001',
  'air_monitoring', 'CTRL-AIR-001', current_date,
  '{"name":"Air Plant"}'::jsonb, '[]'::jsonb,
  now(), now(), false, 'pending', 'device-e'
);

-- A second report, so the "old client" create below (which reuses
-- compliance_air's own report_id unique constraint otherwise) gets its own
-- row rather than colliding with air-push-001/rep-air-001 above.
insert into public.inspection_reports (
  report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
  inspection_date, establishment_snapshot, permits_snapshot,
  created_at, updated_at, is_archived, sync_status, device_id
) values (
  'rep-air-002', 'est-air-001', '55555555-5555-5555-5555-555555555555', 'purpose-air-001',
  'air_monitoring', 'CTRL-AIR-002', current_date,
  '{"name":"Air Plant"}'::jsonb, '[]'::jsonb,
  now(), now(), false, 'pending', 'device-e'
);

-- Switch to the authenticated role (the same one push_changes runs as for
-- a real client) to prove the RPC's table-level GRANT on compliance_air is
-- actually in place — see 20260806010000_grant_authenticated_on_compliance_tables.sql.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);

-- Compliance air: create
select is(
  public.push_changes(
    '{
      "establishments": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "purpose_of_inspection": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "inspection_reports": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "survey_reports": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "compliance_air": {
        "created": [
          {
            "compliance_id": "air-push-001",
            "report_id": "rep-air-001",
            "other_observations": "Air observation",
            "remarks_recommendations": "Air recommendation",
            "checklist_appendix_f": [
              {"key": "appendix-f-s6-8-cems-installation-change-notified", "legal_ref": "Appendix F (Quality Assurance Procedures) Section 6 (8)", "requirement": "Notification has been sent to EMB for any changes made in the CEMS installation", "compliant": "Y", "remarks": ""}
            ],
            "checklist_consent_agreement": [
              {"key": "consent-dao2000-81-p7-r25-s9a-ems-18-months", "legal_ref": "For Facilities Engaged with Consent Agreement DAO 2000-81 Part 7 Rule 25 Section 9 (a)", "requirement": "EMS established within 18 months upon entering Consent Agreement with EMB", "compliant": "NA", "remarks": ""}
            ]
          }
        ],
        "updated": [],
        "deleted": []
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for created compliance_air rows'
);

select is(
  (
    select count(*)::int
    from public.compliance_air
    where compliance_id = 'air-push-001'
  ),
  1,
  'push_changes inserts one compliance_air row'
);

select is(
  (
    select checklist_appendix_f->0->>'compliant'
    from public.compliance_air
    where compliance_id = 'air-push-001'
  ),
  'Y',
  'push_changes stores checklist_appendix_f on create'
);

-- Compliance air: create from a client that predates checklist_appendix_f
-- and checklist_consent_agreement — the migration header's claim that such
-- a client's row lands as '[]', not NULL (both insert and upsert coalesce
-- to '[]'::jsonb). Own report_id (rep-air-002) since compliance_air.report_id
-- is unique. push_changes raises on failure, so a plain call here is enough
-- to prove it succeeded; the assertion below is what this case is for.
select public.push_changes(
  '{
    "establishments": {
      "created": [],
      "updated": [],
      "deleted": []
    },
    "purpose_of_inspection": {
      "created": [],
      "updated": [],
      "deleted": []
    },
    "inspection_reports": {
      "created": [],
      "updated": [],
      "deleted": []
    },
    "survey_reports": {
      "created": [],
      "updated": [],
      "deleted": []
    },
    "compliance_air": {
      "created": [
        {
          "compliance_id": "air-push-002",
          "report_id": "rep-air-002",
          "other_observations": "Old-client air observation",
          "remarks_recommendations": "Old-client air recommendation"
        }
      ],
      "updated": [],
      "deleted": []
    }
  }'::jsonb
);

select is(
  (
    select jsonb_build_array(checklist_appendix_f, checklist_consent_agreement)
    from public.compliance_air
    where compliance_id = 'air-push-002'
  ),
  '[[], []]'::jsonb,
  'push_changes defaults both omitted checklist columns to [] on create, not NULL'
);

-- Compliance air: update
select is(
  public.push_changes(
    '{
      "establishments": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "purpose_of_inspection": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "inspection_reports": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "survey_reports": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "compliance_air": {
        "created": [],
        "updated": [
          {
            "compliance_id": "air-push-001",
            "report_id": "rep-air-001",
            "other_observations": "Updated air observation",
            "remarks_recommendations": "Updated air recommendation",
            "checklist_appendix_f": [],
            "checklist_consent_agreement": [
              {"key": "consent-dao2000-81-p7-r25-s9a-ems-18-months", "legal_ref": "For Facilities Engaged with Consent Agreement DAO 2000-81 Part 7 Rule 25 Section 9 (a)", "requirement": "EMS established within 18 months upon entering Consent Agreement with EMB", "compliant": "N", "remarks": "No EMS yet"}
            ]
          }
        ],
        "deleted": []
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for updated compliance_air rows'
);

select is(
  (
    select remarks_recommendations
    from public.compliance_air
    where compliance_id = 'air-push-001'
  ),
  'Updated air recommendation',
  'push_changes updates an existing compliance_air row'
);

select is(
  (
    select checklist_consent_agreement->0->>'remarks'
    from public.compliance_air
    where compliance_id = 'air-push-001'
  ),
  'No EMS yet',
  'push_changes updates checklist_consent_agreement on upsert'
);

-- Compliance air: delete
select is(
  public.push_changes(
    '{
      "establishments": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "purpose_of_inspection": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "inspection_reports": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "survey_reports": {
        "created": [],
        "updated": [],
        "deleted": []
      },
      "compliance_air": {
        "created": [],
        "updated": [],
        "deleted": ["air-push-001"]
      }
    }'::jsonb
  )->>'status',
  'ok',
  'push_changes returns ok status for deleted compliance_air rows'
);

select is(
  (
    select count(*)::int
    from public.compliance_air
    where compliance_id = 'air-push-001'
  ),
  0,
  'push_changes deletes an existing compliance_air row'
);

select * from finish();

rollback;
