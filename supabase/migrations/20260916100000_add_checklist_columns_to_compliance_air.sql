begin;

-- ─────────────────────────────────────────────────────────────────────────
-- compliance_air gains two checklist columns. The printed Air Monitoring
-- form's compliance checklist (Table 7) has five groups; the table was
-- created with columns for three of them. The two it lacked:
--
--   checklist_appendix_f          "Appendix F (Quality Assurance
--                                 Procedures)" — the thirteen CEMS
--                                 questions citing 40 CFR 60 Appendix F
--                                 Sections 6–8 (template rows 45–57)
--   checklist_consent_agreement   "For Facilities Engaged with Consent
--                                 Agreement" — DAO 2000-81 Part 7 Rule 25
--                                 Section 9 (a)/(b) (template rows 59–60)
--
-- Both hold the same keyed entry shape as the other checklist_* columns:
--   [{ key, legal_ref, requirement, compliant: 'Y'|'N'|'NA', remarks }]
-- See src/features/inspections/air/airChecklistData.ts for the questions.
--
-- Additive per docs/sync-contract.md's Backward Compatibility Rules: both
-- columns are nullable, and a client that has not yet shipped the fields
-- simply omits them from its push payload, and the insert/upsert below
-- coalesce(…, '[]'::jsonb), so such a client writes '[]', not NULL. This
-- isn't specific to these two columns — a whole-record upsert from any
-- client is authoritative for every column on the row it writes, old or
-- new, since the row it sends has no way to say "leave this column alone".
--
-- pull_changes needs no change: it emits to_jsonb(ca) for whole
-- compliance_air rows, so the new columns reach the client as soon as
-- they exist.
--
-- Full body re-issued, based on
-- 20260915130000_add_sampling_conducted_to_compliance_water.sql (the last
-- migration to redefine push_changes) — because Postgres has no way to
-- alter one column of a function body, the whole thing must be redefined;
-- the only changes are the compliance_air insert column lists, their
-- values, and the update loop's on-conflict set.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.compliance_air
  add column if not exists checklist_appendix_f jsonb,
  add column if not exists checklist_consent_agreement jsonb;

create or replace function public.push_changes(changes jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  establishment_record jsonb;
  purpose_record jsonb;
  inspection_report_record jsonb;
  survey_record jsonb;
  compliance_air_record jsonb;
  compliance_water_record jsonb;
  compliance_hazwaste_record jsonb;
  compliance_eia_record jsonb;
  attachment_record jsonb;
  v_row_count integer;
  v_conflicts jsonb;
  v_conflicts_establishments text[] := '{}';
  v_conflicts_purpose text[] := '{}';
  v_conflicts_reports text[] := '{}';
  v_conflicts_survey text[] := '{}';
  v_conflicts_air text[] := '{}';
  v_conflicts_water text[] := '{}';
  v_conflicts_hazwaste text[] := '{}';
  v_conflicts_eia text[] := '{}';
  v_conflicts_attachments text[] := '{}';
begin
  -- Handle created establishments
  for establishment_record in
    select value
    from jsonb_array_elements(coalesce(changes->'establishments'->'created', '[]'::jsonb))
  loop
    begin
      insert into public.establishments (
        estab_id, inspector_uid, name, former_name, address_line, barangay, city, province,
        geo_lat, geo_lng, nature_of_business, psic_code, product, year_established,
        operating_status, operating_hours_day, operating_days_week, operating_days_year,
        operating_status_since,
        product_lines, owner_name, managing_head_name, pco_name, pco_accreditation_no,
        pco_effectivity, phone_fax, email, contact_person_name, contact_person_position,
        denr_permits, device_id, created_at, updated_at, sync_status, is_archived
      )
      values (
        establishment_record->>'estab_id',
        establishment_record->>'inspector_uid',
        establishment_record->>'name',
        establishment_record->>'former_name',
        establishment_record->>'address_line',
        establishment_record->>'barangay',
        establishment_record->>'city',
        establishment_record->>'province',
        nullif(establishment_record->>'geo_lat', '')::double precision,
        nullif(establishment_record->>'geo_lng', '')::double precision,
        establishment_record->>'nature_of_business',
        establishment_record->>'psic_code',
        establishment_record->>'product',
        nullif(establishment_record->>'year_established', '')::integer,
        establishment_record->>'operating_status',
        nullif(establishment_record->>'operating_hours_day', '')::integer,
        nullif(establishment_record->>'operating_days_week', '')::integer,
        nullif(establishment_record->>'operating_days_year', '')::integer,
        establishment_record->>'operating_status_since',
        establishment_record->'product_lines',
        establishment_record->>'owner_name',
        establishment_record->>'managing_head_name',
        establishment_record->>'pco_name',
        establishment_record->>'pco_accreditation_no',
        nullif(establishment_record->>'pco_effectivity', '')::date,
        establishment_record->>'phone_fax',
        establishment_record->>'email',
        establishment_record->>'contact_person_name',
        establishment_record->>'contact_person_position',
        establishment_record->'denr_permits',
        establishment_record->>'device_id',
        coalesce((establishment_record->>'created_at')::timestamptz, now()),
        coalesce((establishment_record->>'updated_at')::timestamptz, now()),
        coalesce((establishment_record->>'sync_status')::public.sync_status_enum, 'pending'),
        coalesce((establishment_record->>'is_archived')::boolean, false)
      )
      on conflict (estab_id) do nothing;
    exception when others then
      raise exception 'push_changes: establishments insert failed (estab_id=%): %',
        establishment_record->>'estab_id', sqlerrm;
    end;
  end loop;

  -- Handle updated establishments (upsert, tracks conflicts — see migration header)
  for establishment_record in
    select value
    from jsonb_array_elements(coalesce(changes->'establishments'->'updated', '[]'::jsonb))
  loop
    begin
      insert into public.establishments (
        estab_id, inspector_uid, name, former_name, address_line, barangay, city, province,
        geo_lat, geo_lng, nature_of_business, psic_code, product, year_established,
        operating_status, operating_hours_day, operating_days_week, operating_days_year,
        operating_status_since,
        product_lines, owner_name, managing_head_name, pco_name, pco_accreditation_no,
        pco_effectivity, phone_fax, email, contact_person_name, contact_person_position,
        denr_permits, device_id, created_at, updated_at, sync_status, is_archived
      )
      values (
        establishment_record->>'estab_id',
        establishment_record->>'inspector_uid',
        establishment_record->>'name',
        establishment_record->>'former_name',
        establishment_record->>'address_line',
        establishment_record->>'barangay',
        establishment_record->>'city',
        establishment_record->>'province',
        nullif(establishment_record->>'geo_lat', '')::double precision,
        nullif(establishment_record->>'geo_lng', '')::double precision,
        establishment_record->>'nature_of_business',
        establishment_record->>'psic_code',
        establishment_record->>'product',
        nullif(establishment_record->>'year_established', '')::integer,
        establishment_record->>'operating_status',
        nullif(establishment_record->>'operating_hours_day', '')::integer,
        nullif(establishment_record->>'operating_days_week', '')::integer,
        nullif(establishment_record->>'operating_days_year', '')::integer,
        establishment_record->>'operating_status_since',
        establishment_record->'product_lines',
        establishment_record->>'owner_name',
        establishment_record->>'managing_head_name',
        establishment_record->>'pco_name',
        establishment_record->>'pco_accreditation_no',
        nullif(establishment_record->>'pco_effectivity', '')::date,
        establishment_record->>'phone_fax',
        establishment_record->>'email',
        establishment_record->>'contact_person_name',
        establishment_record->>'contact_person_position',
        establishment_record->'denr_permits',
        establishment_record->>'device_id',
        coalesce((establishment_record->>'created_at')::timestamptz, now()),
        coalesce((establishment_record->>'updated_at')::timestamptz, now()),
        coalesce((establishment_record->>'sync_status')::public.sync_status_enum, 'pending'),
        coalesce((establishment_record->>'is_archived')::boolean, false)
      )
      on conflict (estab_id) do update set
        inspector_uid = excluded.inspector_uid,
        name = excluded.name,
        former_name = excluded.former_name,
        address_line = excluded.address_line,
        barangay = excluded.barangay,
        city = excluded.city,
        province = excluded.province,
        geo_lat = excluded.geo_lat,
        geo_lng = excluded.geo_lng,
        nature_of_business = excluded.nature_of_business,
        psic_code = excluded.psic_code,
        product = excluded.product,
        year_established = excluded.year_established,
        operating_status = excluded.operating_status,
        operating_hours_day = excluded.operating_hours_day,
        operating_days_week = excluded.operating_days_week,
        operating_days_year = excluded.operating_days_year,
        operating_status_since = excluded.operating_status_since,
        product_lines = excluded.product_lines,
        owner_name = excluded.owner_name,
        managing_head_name = excluded.managing_head_name,
        pco_name = excluded.pco_name,
        pco_accreditation_no = excluded.pco_accreditation_no,
        pco_effectivity = excluded.pco_effectivity,
        phone_fax = excluded.phone_fax,
        email = excluded.email,
        contact_person_name = excluded.contact_person_name,
        contact_person_position = excluded.contact_person_position,
        denr_permits = excluded.denr_permits,
        device_id = excluded.device_id,
        updated_at = excluded.updated_at,
        sync_status = excluded.sync_status,
        is_archived = excluded.is_archived
      where excluded.updated_at >= establishments.updated_at;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts_establishments := array_append(v_conflicts_establishments, establishment_record->>'estab_id');
      end if;
    exception when others then
      raise exception 'push_changes: establishments upsert (updated) failed (estab_id=%): %',
        establishment_record->>'estab_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted establishments
  for establishment_record in
    select value
    from jsonb_array_elements(coalesce(changes->'establishments'->'deleted', '[]'::jsonb))
  loop
    delete from public.establishments
    where estab_id = trim(both '"' from establishment_record::text);
  end loop;

  -- Handle created purpose_of_inspection (must precede inspection_reports —
  -- inspection_reports.purpose_id now references this table)
  for purpose_record in
    select value
    from jsonb_array_elements(coalesce(changes->'purpose_of_inspection'->'created', '[]'::jsonb))
  loop
    begin
      insert into public.purpose_of_inspection (
        purpose_id, estab_id, inspector_uid, inspection_date,
        verify_info, verify_info_list, determine_compliance, investigate_complaints,
        check_commitments, check_commitments_list, others,
        device_id, created_at, updated_at, sync_status
      )
      values (
        purpose_record->>'purpose_id',
        purpose_record->>'estab_id',
        purpose_record->>'inspector_uid',
        (purpose_record->>'inspection_date')::date,
        coalesce((purpose_record->>'verify_info')::boolean, false),
        purpose_record->'verify_info_list',
        coalesce((purpose_record->>'determine_compliance')::boolean, false),
        coalesce((purpose_record->>'investigate_complaints')::boolean, false),
        coalesce((purpose_record->>'check_commitments')::boolean, false),
        purpose_record->'check_commitments_list',
        purpose_record->>'others',
        purpose_record->>'device_id',
        coalesce((purpose_record->>'created_at')::timestamptz, now()),
        coalesce((purpose_record->>'updated_at')::timestamptz, now()),
        coalesce((purpose_record->>'sync_status')::public.sync_status_enum, 'pending')
      )
      on conflict (purpose_id) do nothing;
    exception when others then
      raise exception 'push_changes: purpose_of_inspection insert failed (purpose_id=%, estab_id=%): %',
        purpose_record->>'purpose_id', purpose_record->>'estab_id', sqlerrm;
    end;
  end loop;

  -- Handle updated purpose_of_inspection (upsert, tracks conflicts)
  for purpose_record in
    select value
    from jsonb_array_elements(coalesce(changes->'purpose_of_inspection'->'updated', '[]'::jsonb))
  loop
    begin
      insert into public.purpose_of_inspection (
        purpose_id, estab_id, inspector_uid, inspection_date,
        verify_info, verify_info_list, determine_compliance, investigate_complaints,
        check_commitments, check_commitments_list, others,
        device_id, created_at, updated_at, sync_status
      )
      values (
        purpose_record->>'purpose_id',
        purpose_record->>'estab_id',
        purpose_record->>'inspector_uid',
        (purpose_record->>'inspection_date')::date,
        coalesce((purpose_record->>'verify_info')::boolean, false),
        purpose_record->'verify_info_list',
        coalesce((purpose_record->>'determine_compliance')::boolean, false),
        coalesce((purpose_record->>'investigate_complaints')::boolean, false),
        coalesce((purpose_record->>'check_commitments')::boolean, false),
        purpose_record->'check_commitments_list',
        purpose_record->>'others',
        purpose_record->>'device_id',
        coalesce((purpose_record->>'created_at')::timestamptz, now()),
        coalesce((purpose_record->>'updated_at')::timestamptz, now()),
        coalesce((purpose_record->>'sync_status')::public.sync_status_enum, 'pending')
      )
      on conflict (purpose_id) do update set
        estab_id = excluded.estab_id,
        inspector_uid = excluded.inspector_uid,
        inspection_date = excluded.inspection_date,
        verify_info = excluded.verify_info,
        verify_info_list = excluded.verify_info_list,
        determine_compliance = excluded.determine_compliance,
        investigate_complaints = excluded.investigate_complaints,
        check_commitments = excluded.check_commitments,
        check_commitments_list = excluded.check_commitments_list,
        others = excluded.others,
        device_id = excluded.device_id,
        updated_at = excluded.updated_at,
        sync_status = excluded.sync_status
      where excluded.updated_at >= purpose_of_inspection.updated_at;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts_purpose := array_append(v_conflicts_purpose, purpose_record->>'purpose_id');
      end if;
    exception when others then
      raise exception 'push_changes: purpose_of_inspection upsert (updated) failed (purpose_id=%, estab_id=%): %',
        purpose_record->>'purpose_id', purpose_record->>'estab_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted purpose_of_inspection (hard delete)
  for purpose_record in
    select value
    from jsonb_array_elements(coalesce(changes->'purpose_of_inspection'->'deleted', '[]'::jsonb))
  loop
    delete from public.purpose_of_inspection
    where purpose_id = trim(both '"' from purpose_record::text);
  end loop;

  -- Handle created inspection_reports
  for inspection_report_record in
    select value
    from jsonb_array_elements(coalesce(changes->'inspection_reports'->'created', '[]'::jsonb))
  loop
    begin
      insert into public.inspection_reports (
        report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
        inspection_date, establishment_snapshot, permits_snapshot, is_archived,
        device_id, created_at, updated_at, sync_status, report_status
      )
      values (
        inspection_report_record->>'report_id',
        inspection_report_record->>'estab_id',
        inspection_report_record->>'inspector_uid',
        inspection_report_record->>'purpose_id',
        inspection_report_record->>'report_type',
        inspection_report_record->>'report_control_no',
        (inspection_report_record->>'inspection_date')::date,
        coalesce(inspection_report_record->'establishment_snapshot', '{}'::jsonb),
        coalesce(inspection_report_record->'permits_snapshot', '[]'::jsonb),
        coalesce((inspection_report_record->>'is_archived')::boolean, false),
        inspection_report_record->>'device_id',
        coalesce((inspection_report_record->>'created_at')::timestamptz, now()),
        coalesce((inspection_report_record->>'updated_at')::timestamptz, now()),
        coalesce((inspection_report_record->>'sync_status')::public.sync_status_enum, 'pending'),
        coalesce(inspection_report_record->>'report_status', 'draft')
      )
      on conflict (report_id) do nothing;
    exception when others then
      raise exception 'push_changes: inspection_reports insert failed (report_id=%, estab_id=%, purpose_id=%): %',
        inspection_report_record->>'report_id', inspection_report_record->>'estab_id',
        inspection_report_record->>'purpose_id', sqlerrm;
    end;
  end loop;

  -- Handle updated inspection_reports (upsert, tracks conflicts)
  for inspection_report_record in
    select value
    from jsonb_array_elements(coalesce(changes->'inspection_reports'->'updated', '[]'::jsonb))
  loop
    begin
      insert into public.inspection_reports (
        report_id, estab_id, inspector_uid, purpose_id, report_type, report_control_no,
        inspection_date, establishment_snapshot, permits_snapshot, is_archived,
        device_id, created_at, updated_at, sync_status, report_status
      )
      values (
        inspection_report_record->>'report_id',
        inspection_report_record->>'estab_id',
        inspection_report_record->>'inspector_uid',
        inspection_report_record->>'purpose_id',
        inspection_report_record->>'report_type',
        inspection_report_record->>'report_control_no',
        (inspection_report_record->>'inspection_date')::date,
        coalesce(inspection_report_record->'establishment_snapshot', '{}'::jsonb),
        coalesce(inspection_report_record->'permits_snapshot', '[]'::jsonb),
        coalesce((inspection_report_record->>'is_archived')::boolean, false),
        inspection_report_record->>'device_id',
        coalesce((inspection_report_record->>'created_at')::timestamptz, now()),
        coalesce((inspection_report_record->>'updated_at')::timestamptz, now()),
        coalesce((inspection_report_record->>'sync_status')::public.sync_status_enum, 'pending'),
        coalesce(inspection_report_record->>'report_status', 'draft')
      )
      on conflict (report_id) do update set
        estab_id = excluded.estab_id,
        inspector_uid = excluded.inspector_uid,
        purpose_id = excluded.purpose_id,
        report_type = excluded.report_type,
        report_control_no = excluded.report_control_no,
        inspection_date = excluded.inspection_date,
        establishment_snapshot = excluded.establishment_snapshot,
        permits_snapshot = excluded.permits_snapshot,
        updated_at = excluded.updated_at,
        is_archived = excluded.is_archived,
        sync_status = excluded.sync_status,
        device_id = excluded.device_id,
        report_status = excluded.report_status
      where excluded.updated_at >= inspection_reports.updated_at;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts_reports := array_append(v_conflicts_reports, inspection_report_record->>'report_id');
      end if;
    exception when others then
      raise exception 'push_changes: inspection_reports upsert (updated) failed (report_id=%, estab_id=%, purpose_id=%): %',
        inspection_report_record->>'report_id', inspection_report_record->>'estab_id',
        inspection_report_record->>'purpose_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted inspection_reports (soft delete)
  for inspection_report_record in
    select value
    from jsonb_array_elements(coalesce(changes->'inspection_reports'->'deleted', '[]'::jsonb))
  loop
    update public.inspection_reports
    set
      deleted_at = now(),
      updated_at = now()
    where report_id = trim(both '"' from inspection_report_record::text);
  end loop;

  -- Handle created survey_reports
  for survey_record in
    select value
    from jsonb_array_elements(coalesce(changes->'survey_reports'->'created', '[]'::jsonb))
  loop
    begin
      insert into public.survey_reports (
        survey_id, estab_id, inspector_uid, report_control_number,
        inspection_date, project_name, reference_code, proponent_name,
        contact_person, contact_position, contact_number, email,
        project_location, geo_lat, geo_lng, area_size, purpose,
        document_type, project_status, physical_parameters,
        biological_parameters, socioeconomic_parameters, other_findings,
        remarks_recommendations, created_at, updated_at, is_archived,
        sync_status, device_id
      )
      values (
        survey_record->>'survey_id',
        survey_record->>'estab_id',
        survey_record->>'inspector_uid',
        survey_record->>'report_control_number',
        (survey_record->>'inspection_date')::date,
        survey_record->>'project_name',
        survey_record->>'reference_code',
        survey_record->>'proponent_name',
        survey_record->>'contact_person',
        survey_record->>'contact_position',
        survey_record->>'contact_number',
        survey_record->>'email',
        survey_record->>'project_location',
        nullif(survey_record->>'geo_lat', '')::double precision,
        nullif(survey_record->>'geo_lng', '')::double precision,
        nullif(survey_record->>'area_size', '')::double precision,
        survey_record->>'purpose',
        survey_record->>'document_type',
        survey_record->>'project_status',
        coalesce(survey_record->'physical_parameters', '{}'::jsonb),
        coalesce(survey_record->'biological_parameters', '{}'::jsonb),
        coalesce(survey_record->'socioeconomic_parameters', '{}'::jsonb),
        survey_record->>'other_findings',
        survey_record->>'remarks_recommendations',
        coalesce((survey_record->>'created_at')::timestamptz, now()),
        coalesce((survey_record->>'updated_at')::timestamptz, now()),
        coalesce((survey_record->>'is_archived')::boolean, false),
        coalesce((survey_record->>'sync_status')::public.sync_status_enum, 'pending'),
        survey_record->>'device_id'
      )
      on conflict (survey_id) do nothing;
    exception when others then
      raise exception 'push_changes: survey_reports insert failed (survey_id=%, estab_id=%): %',
        survey_record->>'survey_id', survey_record->>'estab_id', sqlerrm;
    end;
  end loop;

  -- Handle updated survey_reports (upsert, tracks conflicts)
  for survey_record in
    select value
    from jsonb_array_elements(coalesce(changes->'survey_reports'->'updated', '[]'::jsonb))
  loop
    begin
      insert into public.survey_reports (
        survey_id, estab_id, inspector_uid, report_control_number,
        inspection_date, project_name, reference_code, proponent_name,
        contact_person, contact_position, contact_number, email,
        project_location, geo_lat, geo_lng, area_size, purpose,
        document_type, project_status, physical_parameters,
        biological_parameters, socioeconomic_parameters, other_findings,
        remarks_recommendations, created_at, updated_at, is_archived,
        sync_status, device_id
      )
      values (
        survey_record->>'survey_id',
        survey_record->>'estab_id',
        survey_record->>'inspector_uid',
        survey_record->>'report_control_number',
        (survey_record->>'inspection_date')::date,
        survey_record->>'project_name',
        survey_record->>'reference_code',
        survey_record->>'proponent_name',
        survey_record->>'contact_person',
        survey_record->>'contact_position',
        survey_record->>'contact_number',
        survey_record->>'email',
        survey_record->>'project_location',
        nullif(survey_record->>'geo_lat', '')::double precision,
        nullif(survey_record->>'geo_lng', '')::double precision,
        nullif(survey_record->>'area_size', '')::double precision,
        survey_record->>'purpose',
        survey_record->>'document_type',
        survey_record->>'project_status',
        coalesce(survey_record->'physical_parameters', '{}'::jsonb),
        coalesce(survey_record->'biological_parameters', '{}'::jsonb),
        coalesce(survey_record->'socioeconomic_parameters', '{}'::jsonb),
        survey_record->>'other_findings',
        survey_record->>'remarks_recommendations',
        coalesce((survey_record->>'created_at')::timestamptz, now()),
        coalesce((survey_record->>'updated_at')::timestamptz, now()),
        coalesce((survey_record->>'is_archived')::boolean, false),
        coalesce((survey_record->>'sync_status')::public.sync_status_enum, 'pending'),
        survey_record->>'device_id'
      )
      on conflict (survey_id) do update set
        estab_id = excluded.estab_id,
        inspector_uid = excluded.inspector_uid,
        report_control_number = excluded.report_control_number,
        inspection_date = excluded.inspection_date,
        project_name = excluded.project_name,
        reference_code = excluded.reference_code,
        proponent_name = excluded.proponent_name,
        contact_person = excluded.contact_person,
        contact_position = excluded.contact_position,
        contact_number = excluded.contact_number,
        email = excluded.email,
        project_location = excluded.project_location,
        geo_lat = excluded.geo_lat,
        geo_lng = excluded.geo_lng,
        area_size = excluded.area_size,
        purpose = excluded.purpose,
        document_type = excluded.document_type,
        project_status = excluded.project_status,
        physical_parameters = excluded.physical_parameters,
        biological_parameters = excluded.biological_parameters,
        socioeconomic_parameters = excluded.socioeconomic_parameters,
        other_findings = excluded.other_findings,
        remarks_recommendations = excluded.remarks_recommendations,
        updated_at = excluded.updated_at,
        is_archived = excluded.is_archived,
        sync_status = excluded.sync_status,
        device_id = excluded.device_id
      where excluded.updated_at >= survey_reports.updated_at;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts_survey := array_append(v_conflicts_survey, survey_record->>'survey_id');
      end if;
    exception when others then
      raise exception 'push_changes: survey_reports upsert (updated) failed (survey_id=%, estab_id=%): %',
        survey_record->>'survey_id', survey_record->>'estab_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted survey_reports (soft delete)
  for survey_record in
    select value
    from jsonb_array_elements(coalesce(changes->'survey_reports'->'deleted', '[]'::jsonb))
  loop
    update public.survey_reports
    set
      deleted_at = now(),
      updated_at = now()
    where survey_id = trim(both '"' from survey_record::text);
  end loop;

  -- Handle created compliance_air
  for compliance_air_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_air'->'created', '[]'::jsonb))
  loop
    begin
      insert into public.compliance_air (
        compliance_id, report_id, emission_sources, checklist_dao_2004_26,
        checklist_dao_2000_81, checklist_emb_mc, checklist_appendix_f,
        checklist_consent_agreement, pto_conditions,
        other_observations, remarks_recommendations, documents_reviewed
      )
      values (
        compliance_air_record->>'compliance_id',
        compliance_air_record->>'report_id',
        coalesce(compliance_air_record->'emission_sources', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_dao_2004_26', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_dao_2000_81', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_emb_mc', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_appendix_f', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_consent_agreement', '[]'::jsonb),
        coalesce(compliance_air_record->'pto_conditions', '[]'::jsonb),
        compliance_air_record->>'other_observations',
        compliance_air_record->>'remarks_recommendations',
        coalesce(compliance_air_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do nothing;
    exception when others then
      raise exception 'push_changes: compliance_air insert failed (compliance_id=%, report_id=%): %',
        compliance_air_record->>'compliance_id', compliance_air_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle updated compliance_air (upsert, tracks conflicts)
  for compliance_air_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_air'->'updated', '[]'::jsonb))
  loop
    begin
      insert into public.compliance_air (
        compliance_id, report_id, emission_sources, checklist_dao_2004_26,
        checklist_dao_2000_81, checklist_emb_mc, checklist_appendix_f,
        checklist_consent_agreement, pto_conditions,
        other_observations, remarks_recommendations, documents_reviewed
      )
      values (
        compliance_air_record->>'compliance_id',
        compliance_air_record->>'report_id',
        coalesce(compliance_air_record->'emission_sources', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_dao_2004_26', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_dao_2000_81', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_emb_mc', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_appendix_f', '[]'::jsonb),
        coalesce(compliance_air_record->'checklist_consent_agreement', '[]'::jsonb),
        coalesce(compliance_air_record->'pto_conditions', '[]'::jsonb),
        compliance_air_record->>'other_observations',
        compliance_air_record->>'remarks_recommendations',
        coalesce(compliance_air_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do update set
        report_id = excluded.report_id,
        emission_sources = excluded.emission_sources,
        checklist_dao_2004_26 = excluded.checklist_dao_2004_26,
        checklist_dao_2000_81 = excluded.checklist_dao_2000_81,
        checklist_emb_mc = excluded.checklist_emb_mc,
        checklist_appendix_f = excluded.checklist_appendix_f,
        checklist_consent_agreement = excluded.checklist_consent_agreement,
        pto_conditions = excluded.pto_conditions,
        other_observations = excluded.other_observations,
        remarks_recommendations = excluded.remarks_recommendations,
        documents_reviewed = excluded.documents_reviewed;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts_air := array_append(v_conflicts_air, compliance_air_record->>'compliance_id');
      end if;
    exception when others then
      raise exception 'push_changes: compliance_air upsert (updated) failed (compliance_id=%, report_id=%): %',
        compliance_air_record->>'compliance_id', compliance_air_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted compliance_air
  for compliance_air_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_air'->'deleted', '[]'::jsonb))
  loop
    delete from public.compliance_air
    where compliance_id = trim(both '"' from compliance_air_record::text);
  end loop;

  -- Handle created compliance_water
  for compliance_water_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_water'->'created', '[]'::jsonb))
  loop
    begin
      insert into public.compliance_water (
        compliance_id, report_id, water_sources, wastewater_sources,
        abstracted_water_quality, has_wwtp, non_wwtp_treatment, wwtp_type, wwtp_type_other,
        wwtp_details, wwtp_components, wwtp_condition, wwtp_condition_other,
        wwtp_under_construction, wwtp_construction_reported,
        wwtp_construction_units, wwtp_construction_completion_date,
        wwtp_treatment_units_utilized,
        sampling_conducted, sampling_classification,
        sampling_points, previous_inspection_summary, checklist_dao_2005_10,
        dp_conditions, other_observations, remarks_recommendations,
        documents_reviewed
      )
      values (
        compliance_water_record->>'compliance_id',
        compliance_water_record->>'report_id',
        coalesce(compliance_water_record->'water_sources', '[]'::jsonb),
        coalesce(compliance_water_record->'wastewater_sources', '[]'::jsonb),
        coalesce(compliance_water_record->'abstracted_water_quality', '[]'::jsonb),
        coalesce((compliance_water_record->>'has_wwtp')::boolean, false),
        coalesce(compliance_water_record->'non_wwtp_treatment', '{}'::jsonb),
        compliance_water_record->>'wwtp_type',
        compliance_water_record->>'wwtp_type_other',
        coalesce(compliance_water_record->'wwtp_details', '[]'::jsonb),
        coalesce(compliance_water_record->'wwtp_components', '[]'::jsonb),
        compliance_water_record->>'wwtp_condition',
        compliance_water_record->>'wwtp_condition_other',
        coalesce((compliance_water_record->>'wwtp_under_construction')::boolean, false),
        (compliance_water_record->>'wwtp_construction_reported')::boolean,
        compliance_water_record->>'wwtp_construction_units',
        nullif(compliance_water_record->>'wwtp_construction_completion_date', '')::date,
        compliance_water_record->>'wwtp_treatment_units_utilized',
        (compliance_water_record->>'sampling_conducted')::boolean,
        compliance_water_record->>'sampling_classification',
        coalesce(compliance_water_record->'sampling_points', '[]'::jsonb),
        coalesce(compliance_water_record->'previous_inspection_summary', '{}'::jsonb),
        coalesce(compliance_water_record->'checklist_dao_2005_10', '[]'::jsonb),
        coalesce(compliance_water_record->'dp_conditions', '[]'::jsonb),
        compliance_water_record->>'other_observations',
        compliance_water_record->>'remarks_recommendations',
        coalesce(compliance_water_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do nothing;
    exception when others then
      raise exception 'push_changes: compliance_water insert failed (compliance_id=%, report_id=%): %',
        compliance_water_record->>'compliance_id', compliance_water_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle updated compliance_water (upsert, tracks conflicts)
  for compliance_water_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_water'->'updated', '[]'::jsonb))
  loop
    begin
      insert into public.compliance_water (
        compliance_id, report_id, water_sources, wastewater_sources,
        abstracted_water_quality, has_wwtp, non_wwtp_treatment, wwtp_type, wwtp_type_other,
        wwtp_details, wwtp_components, wwtp_condition, wwtp_condition_other,
        wwtp_under_construction, wwtp_construction_reported,
        wwtp_construction_units, wwtp_construction_completion_date,
        wwtp_treatment_units_utilized,
        sampling_conducted, sampling_classification,
        sampling_points, previous_inspection_summary, checklist_dao_2005_10,
        dp_conditions, other_observations, remarks_recommendations,
        documents_reviewed
      )
      values (
        compliance_water_record->>'compliance_id',
        compliance_water_record->>'report_id',
        coalesce(compliance_water_record->'water_sources', '[]'::jsonb),
        coalesce(compliance_water_record->'wastewater_sources', '[]'::jsonb),
        coalesce(compliance_water_record->'abstracted_water_quality', '[]'::jsonb),
        coalesce((compliance_water_record->>'has_wwtp')::boolean, false),
        coalesce(compliance_water_record->'non_wwtp_treatment', '{}'::jsonb),
        compliance_water_record->>'wwtp_type',
        compliance_water_record->>'wwtp_type_other',
        coalesce(compliance_water_record->'wwtp_details', '[]'::jsonb),
        coalesce(compliance_water_record->'wwtp_components', '[]'::jsonb),
        compliance_water_record->>'wwtp_condition',
        compliance_water_record->>'wwtp_condition_other',
        coalesce((compliance_water_record->>'wwtp_under_construction')::boolean, false),
        (compliance_water_record->>'wwtp_construction_reported')::boolean,
        compliance_water_record->>'wwtp_construction_units',
        nullif(compliance_water_record->>'wwtp_construction_completion_date', '')::date,
        compliance_water_record->>'wwtp_treatment_units_utilized',
        (compliance_water_record->>'sampling_conducted')::boolean,
        compliance_water_record->>'sampling_classification',
        coalesce(compliance_water_record->'sampling_points', '[]'::jsonb),
        coalesce(compliance_water_record->'previous_inspection_summary', '{}'::jsonb),
        coalesce(compliance_water_record->'checklist_dao_2005_10', '[]'::jsonb),
        coalesce(compliance_water_record->'dp_conditions', '[]'::jsonb),
        compliance_water_record->>'other_observations',
        compliance_water_record->>'remarks_recommendations',
        coalesce(compliance_water_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do update set
        report_id = excluded.report_id,
        water_sources = excluded.water_sources,
        wastewater_sources = excluded.wastewater_sources,
        abstracted_water_quality = excluded.abstracted_water_quality,
        has_wwtp = excluded.has_wwtp,
        non_wwtp_treatment = excluded.non_wwtp_treatment,
        wwtp_type = excluded.wwtp_type,
        wwtp_type_other = excluded.wwtp_type_other,
        wwtp_details = excluded.wwtp_details,
        wwtp_components = excluded.wwtp_components,
        wwtp_condition = excluded.wwtp_condition,
        wwtp_condition_other = excluded.wwtp_condition_other,
        wwtp_under_construction = excluded.wwtp_under_construction,
        wwtp_construction_reported = excluded.wwtp_construction_reported,
        wwtp_construction_units = excluded.wwtp_construction_units,
        wwtp_construction_completion_date = excluded.wwtp_construction_completion_date,
        wwtp_treatment_units_utilized = excluded.wwtp_treatment_units_utilized,
        sampling_conducted = excluded.sampling_conducted,
        sampling_classification = excluded.sampling_classification,
        sampling_points = excluded.sampling_points,
        previous_inspection_summary = excluded.previous_inspection_summary,
        checklist_dao_2005_10 = excluded.checklist_dao_2005_10,
        dp_conditions = excluded.dp_conditions,
        other_observations = excluded.other_observations,
        remarks_recommendations = excluded.remarks_recommendations,
        documents_reviewed = excluded.documents_reviewed;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts_water := array_append(v_conflicts_water, compliance_water_record->>'compliance_id');
      end if;
    exception when others then
      raise exception 'push_changes: compliance_water upsert (updated) failed (compliance_id=%, report_id=%): %',
        compliance_water_record->>'compliance_id', compliance_water_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted compliance_water
  for compliance_water_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_water'->'deleted', '[]'::jsonb))
  loop
    delete from public.compliance_water
    where compliance_id = trim(both '"' from compliance_water_record::text);
  end loop;

  -- Handle created compliance_hazwaste
  for compliance_hazwaste_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_hazwaste'->'created', '[]'::jsonb))
  loop
    begin
      insert into public.compliance_hazwaste (
        compliance_id, report_id, hazwaste_generator_id, hazwaste_id_date_issued,
        waste_types_generated, checklist_registration, checklist_storage,
        checklist_packaging, checklist_labeling, checklist_transport,
        checklist_emergency, checklist_personnel_training, checklist_manifest_system,
        hwid_conditions, other_observations, remarks_recommendations, documents_reviewed
      )
      values (
        compliance_hazwaste_record->>'compliance_id',
        compliance_hazwaste_record->>'report_id',
        compliance_hazwaste_record->>'hazwaste_generator_id',
        nullif(compliance_hazwaste_record->>'hazwaste_id_date_issued', '')::date,
        coalesce(compliance_hazwaste_record->'waste_types_generated', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_registration', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_storage', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_packaging', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_labeling', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_transport', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_emergency', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_personnel_training', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_manifest_system', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'hwid_conditions', '[]'::jsonb),
        compliance_hazwaste_record->>'other_observations',
        compliance_hazwaste_record->>'remarks_recommendations',
        coalesce(compliance_hazwaste_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do nothing;
    exception when others then
      raise exception 'push_changes: compliance_hazwaste insert failed (compliance_id=%, report_id=%): %',
        compliance_hazwaste_record->>'compliance_id', compliance_hazwaste_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle updated compliance_hazwaste (upsert, tracks conflicts)
  for compliance_hazwaste_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_hazwaste'->'updated', '[]'::jsonb))
  loop
    begin
      insert into public.compliance_hazwaste (
        compliance_id, report_id, hazwaste_generator_id, hazwaste_id_date_issued,
        waste_types_generated, checklist_registration, checklist_storage,
        checklist_packaging, checklist_labeling, checklist_transport,
        checklist_emergency, checklist_personnel_training, checklist_manifest_system,
        hwid_conditions, other_observations, remarks_recommendations, documents_reviewed
      )
      values (
        compliance_hazwaste_record->>'compliance_id',
        compliance_hazwaste_record->>'report_id',
        compliance_hazwaste_record->>'hazwaste_generator_id',
        nullif(compliance_hazwaste_record->>'hazwaste_id_date_issued', '')::date,
        coalesce(compliance_hazwaste_record->'waste_types_generated', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_registration', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_storage', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_packaging', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_labeling', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_transport', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_emergency', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_personnel_training', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'checklist_manifest_system', '[]'::jsonb),
        coalesce(compliance_hazwaste_record->'hwid_conditions', '[]'::jsonb),
        compliance_hazwaste_record->>'other_observations',
        compliance_hazwaste_record->>'remarks_recommendations',
        coalesce(compliance_hazwaste_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do update set
        report_id = excluded.report_id,
        hazwaste_generator_id = excluded.hazwaste_generator_id,
        hazwaste_id_date_issued = excluded.hazwaste_id_date_issued,
        waste_types_generated = excluded.waste_types_generated,
        checklist_registration = excluded.checklist_registration,
        checklist_storage = excluded.checklist_storage,
        checklist_packaging = excluded.checklist_packaging,
        checklist_labeling = excluded.checklist_labeling,
        checklist_transport = excluded.checklist_transport,
        checklist_emergency = excluded.checklist_emergency,
        checklist_personnel_training = excluded.checklist_personnel_training,
        checklist_manifest_system = excluded.checklist_manifest_system,
        hwid_conditions = excluded.hwid_conditions,
        other_observations = excluded.other_observations,
        remarks_recommendations = excluded.remarks_recommendations,
        documents_reviewed = excluded.documents_reviewed;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts_hazwaste := array_append(v_conflicts_hazwaste, compliance_hazwaste_record->>'compliance_id');
      end if;
    exception when others then
      raise exception 'push_changes: compliance_hazwaste upsert (updated) failed (compliance_id=%, report_id=%): %',
        compliance_hazwaste_record->>'compliance_id', compliance_hazwaste_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted compliance_hazwaste
  for compliance_hazwaste_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_hazwaste'->'deleted', '[]'::jsonb))
  loop
    delete from public.compliance_hazwaste
    where compliance_id = trim(both '"' from compliance_hazwaste_record::text);
  end loop;

  -- Handle created compliance_eia
  for compliance_eia_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_eia'->'created', '[]'::jsonb))
  loop
    begin
      insert into public.compliance_eia (
        compliance_id, report_id, checklist_dao_2003_30, ecc_emp_conditions,
        other_observations, remarks_recommendations, documents_reviewed
      )
      values (
        compliance_eia_record->>'compliance_id',
        compliance_eia_record->>'report_id',
        coalesce(compliance_eia_record->'checklist_dao_2003_30', '[]'::jsonb),
        coalesce(compliance_eia_record->'ecc_emp_conditions', '[]'::jsonb),
        compliance_eia_record->>'other_observations',
        compliance_eia_record->>'remarks_recommendations',
        coalesce(compliance_eia_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do nothing;
    exception when others then
      raise exception 'push_changes: compliance_eia insert failed (compliance_id=%, report_id=%): %',
        compliance_eia_record->>'compliance_id', compliance_eia_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle updated compliance_eia (upsert, tracks conflicts)
  for compliance_eia_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_eia'->'updated', '[]'::jsonb))
  loop
    begin
      insert into public.compliance_eia (
        compliance_id, report_id, checklist_dao_2003_30, ecc_emp_conditions,
        other_observations, remarks_recommendations, documents_reviewed
      )
      values (
        compliance_eia_record->>'compliance_id',
        compliance_eia_record->>'report_id',
        coalesce(compliance_eia_record->'checklist_dao_2003_30', '[]'::jsonb),
        coalesce(compliance_eia_record->'ecc_emp_conditions', '[]'::jsonb),
        compliance_eia_record->>'other_observations',
        compliance_eia_record->>'remarks_recommendations',
        coalesce(compliance_eia_record->'documents_reviewed', '[]'::jsonb)
      )
      on conflict (compliance_id) do update set
        report_id = excluded.report_id,
        checklist_dao_2003_30 = excluded.checklist_dao_2003_30,
        ecc_emp_conditions = excluded.ecc_emp_conditions,
        other_observations = excluded.other_observations,
        remarks_recommendations = excluded.remarks_recommendations,
        documents_reviewed = excluded.documents_reviewed;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts_eia := array_append(v_conflicts_eia, compliance_eia_record->>'compliance_id');
      end if;
    exception when others then
      raise exception 'push_changes: compliance_eia upsert (updated) failed (compliance_id=%, report_id=%): %',
        compliance_eia_record->>'compliance_id', compliance_eia_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted compliance_eia
  for compliance_eia_record in
    select value
    from jsonb_array_elements(coalesce(changes->'compliance_eia'->'deleted', '[]'::jsonb))
  loop
    delete from public.compliance_eia
    where compliance_id = trim(both '"' from compliance_eia_record::text);
  end loop;

  -- Handle created attachments
  for attachment_record in
    select value
    from jsonb_array_elements(coalesce(changes->'attachments'->'created', '[]'::jsonb))
  loop
    begin
      insert into public.attachments (
        attachment_id, inspection_report_id, survey_report_id, inspector_uid,
        storage_path, file_name, mime_type, file_size, geo_lat, geo_lng,
        captured_at, caption, device_id, created_at, updated_at, sync_status
      )
      values (
        attachment_record->>'attachment_id',
        attachment_record->>'inspection_report_id',
        attachment_record->>'survey_report_id',
        attachment_record->>'inspector_uid',
        attachment_record->>'storage_path',
        attachment_record->>'file_name',
        attachment_record->>'mime_type',
        nullif(attachment_record->>'file_size', '')::bigint,
        nullif(attachment_record->>'geo_lat', '')::double precision,
        nullif(attachment_record->>'geo_lng', '')::double precision,
        (attachment_record->>'captured_at')::timestamptz,
        attachment_record->>'caption',
        attachment_record->>'device_id',
        coalesce((attachment_record->>'created_at')::timestamptz, now()),
        coalesce((attachment_record->>'updated_at')::timestamptz, now()),
        coalesce((attachment_record->>'sync_status')::public.sync_status_enum, 'pending')
      )
      on conflict (attachment_id) do nothing;
    exception when others then
      raise exception 'push_changes: attachments insert failed (attachment_id=%, inspection_report_id=%, survey_report_id=%): %',
        attachment_record->>'attachment_id', attachment_record->>'inspection_report_id',
        attachment_record->>'survey_report_id', sqlerrm;
    end;
  end loop;

  -- Handle updated attachments (upsert, tracks conflicts)
  for attachment_record in
    select value
    from jsonb_array_elements(coalesce(changes->'attachments'->'updated', '[]'::jsonb))
  loop
    begin
      insert into public.attachments (
        attachment_id, inspection_report_id, survey_report_id, inspector_uid,
        storage_path, file_name, mime_type, file_size, geo_lat, geo_lng,
        captured_at, caption, device_id, created_at, updated_at, sync_status
      )
      values (
        attachment_record->>'attachment_id',
        attachment_record->>'inspection_report_id',
        attachment_record->>'survey_report_id',
        attachment_record->>'inspector_uid',
        attachment_record->>'storage_path',
        attachment_record->>'file_name',
        attachment_record->>'mime_type',
        nullif(attachment_record->>'file_size', '')::bigint,
        nullif(attachment_record->>'geo_lat', '')::double precision,
        nullif(attachment_record->>'geo_lng', '')::double precision,
        (attachment_record->>'captured_at')::timestamptz,
        attachment_record->>'caption',
        attachment_record->>'device_id',
        coalesce((attachment_record->>'created_at')::timestamptz, now()),
        coalesce((attachment_record->>'updated_at')::timestamptz, now()),
        coalesce((attachment_record->>'sync_status')::public.sync_status_enum, 'pending')
      )
      on conflict (attachment_id) do update set
        inspection_report_id = excluded.inspection_report_id,
        survey_report_id = excluded.survey_report_id,
        inspector_uid = excluded.inspector_uid,
        storage_path = excluded.storage_path,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        file_size = excluded.file_size,
        geo_lat = excluded.geo_lat,
        geo_lng = excluded.geo_lng,
        captured_at = excluded.captured_at,
        caption = excluded.caption,
        device_id = excluded.device_id,
        updated_at = excluded.updated_at,
        sync_status = excluded.sync_status
      where excluded.updated_at >= attachments.updated_at;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        v_conflicts_attachments := array_append(v_conflicts_attachments, attachment_record->>'attachment_id');
      end if;
    exception when others then
      raise exception 'push_changes: attachments upsert (updated) failed (attachment_id=%, inspection_report_id=%, survey_report_id=%): %',
        attachment_record->>'attachment_id', attachment_record->>'inspection_report_id',
        attachment_record->>'survey_report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted attachments (soft delete)
  for attachment_record in
    select value
    from jsonb_array_elements(coalesce(changes->'attachments'->'deleted', '[]'::jsonb))
  loop
    update public.attachments
    set
      deleted_at = now(),
      updated_at = now()
    where attachment_id = trim(both '"' from attachment_record::text);
  end loop;

  v_conflicts := jsonb_strip_nulls(jsonb_build_object(
    'establishments', case when array_length(v_conflicts_establishments, 1) > 0 then to_jsonb(v_conflicts_establishments) else null end,
    'purpose_of_inspection', case when array_length(v_conflicts_purpose, 1) > 0 then to_jsonb(v_conflicts_purpose) else null end,
    'inspection_reports', case when array_length(v_conflicts_reports, 1) > 0 then to_jsonb(v_conflicts_reports) else null end,
    'survey_reports', case when array_length(v_conflicts_survey, 1) > 0 then to_jsonb(v_conflicts_survey) else null end,
    'compliance_air', case when array_length(v_conflicts_air, 1) > 0 then to_jsonb(v_conflicts_air) else null end,
    'compliance_water', case when array_length(v_conflicts_water, 1) > 0 then to_jsonb(v_conflicts_water) else null end,
    'compliance_hazwaste', case when array_length(v_conflicts_hazwaste, 1) > 0 then to_jsonb(v_conflicts_hazwaste) else null end,
    'compliance_eia', case when array_length(v_conflicts_eia, 1) > 0 then to_jsonb(v_conflicts_eia) else null end,
    'attachments', case when array_length(v_conflicts_attachments, 1) > 0 then to_jsonb(v_conflicts_attachments) else null end
  ));

  if v_conflicts = '{}'::jsonb then
    v_conflicts := null;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'status', 'ok',
    'conflicts', v_conflicts
  ));
end;
$$;

commit;
