begin;

-- ─────────────────────────────────────────────────────────────────────────
-- The sync registry. push_changes / pull_changes used to name every table
-- in one ~1,100-line body, so adding a column to any table redefined both
-- functions — and a foundation change would overwrite a region's tables.
-- Each synced table now has its own push_<table> / pull_<table> handler,
-- registered here; 20261028090200 turns the two RPCs into dispatchers over
-- this table. Foundation rows live in _core_ migrations, region rows in
-- _region_ ones (docs/upstream-merge.md).
--
-- Handler bodies are the per-table blocks of
-- 20260916100000_add_checklist_columns_to_compliance_air.sql (push) and
-- 20260813011000_add_attachments_to_pull_changes.sql (pull), unchanged
-- apart from reading p_changes (the table's {created, updated, deleted})
-- and returning their conflict ids. Same order, same SQL, same errors.
-- ─────────────────────────────────────────────────────────────────────────

create table public.sync_tables (
  table_name   text primary key,
  sync_order   integer not null unique,
  push_handler regproc not null, -- (p_changes jsonb) returns text[]
  pull_handler regproc not null, -- (last_pulled_at bigint) returns jsonb
  owner        text not null check (owner in ('core', 'region'))
);

alter table public.sync_tables enable row level security;
create policy "authenticated can read the sync registry"
  on public.sync_tables for select to authenticated using (true);
-- Read-only for signed-in users (the dispatchers run as the caller); only
-- migrations write it.
revoke all on public.sync_tables from anon, authenticated;
grant select on public.sync_tables to authenticated;

create or replace function public.pull_establishments(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(e)) from public.establishments e
      where floor(extract(epoch from e.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', '[]'::jsonb);
$$;

create or replace function public.pull_purpose_of_inspection(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(p)) from public.purpose_of_inspection p
      where floor(extract(epoch from p.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', '[]'::jsonb);
$$;

create or replace function public.pull_inspection_reports(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(ir)) from public.inspection_reports ir
      where ir.deleted_at is null
        and floor(extract(epoch from ir.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', coalesce((
      select jsonb_agg(ir.report_id) from public.inspection_reports ir
      where ir.deleted_at is not null
        and floor(extract(epoch from ir.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb));
$$;

create or replace function public.pull_survey_reports(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(sr)) from public.survey_reports sr
      where sr.deleted_at is null
        and floor(extract(epoch from sr.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', coalesce((
      select jsonb_agg(sr.survey_id) from public.survey_reports sr
      where sr.deleted_at is not null
        and floor(extract(epoch from sr.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb));
$$;

create or replace function public.pull_attachments(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(a)) from public.attachments a
      where a.deleted_at is null
        and floor(extract(epoch from a.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', coalesce((
      select jsonb_agg(a.attachment_id) from public.attachments a
      where a.deleted_at is not null
        and floor(extract(epoch from a.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb));
$$;

create or replace function public.push_establishments(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  establishment_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created establishments
  for establishment_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
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
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
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
        v_conflicts := array_append(v_conflicts, establishment_record->>'estab_id');
      end if;
    exception when others then
      raise exception 'push_changes: establishments upsert (updated) failed (estab_id=%): %',
        establishment_record->>'estab_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted establishments
  for establishment_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    delete from public.establishments
    where estab_id = trim(both '"' from establishment_record::text);
  end loop;

  return v_conflicts;
end;
$$;

create or replace function public.push_purpose_of_inspection(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  purpose_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created purpose_of_inspection (must precede inspection_reports —
  -- inspection_reports.purpose_id now references this table)
  for purpose_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
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
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
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
        v_conflicts := array_append(v_conflicts, purpose_record->>'purpose_id');
      end if;
    exception when others then
      raise exception 'push_changes: purpose_of_inspection upsert (updated) failed (purpose_id=%, estab_id=%): %',
        purpose_record->>'purpose_id', purpose_record->>'estab_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted purpose_of_inspection (hard delete)
  for purpose_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    delete from public.purpose_of_inspection
    where purpose_id = trim(both '"' from purpose_record::text);
  end loop;

  return v_conflicts;
end;
$$;

create or replace function public.push_inspection_reports(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  inspection_report_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created inspection_reports
  for inspection_report_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
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
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
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
        v_conflicts := array_append(v_conflicts, inspection_report_record->>'report_id');
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
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    update public.inspection_reports
    set
      deleted_at = now(),
      updated_at = now()
    where report_id = trim(both '"' from inspection_report_record::text);
  end loop;

  return v_conflicts;
end;
$$;

create or replace function public.push_survey_reports(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  survey_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created survey_reports
  for survey_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
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
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
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
        v_conflicts := array_append(v_conflicts, survey_record->>'survey_id');
      end if;
    exception when others then
      raise exception 'push_changes: survey_reports upsert (updated) failed (survey_id=%, estab_id=%): %',
        survey_record->>'survey_id', survey_record->>'estab_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted survey_reports (soft delete)
  for survey_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    update public.survey_reports
    set
      deleted_at = now(),
      updated_at = now()
    where survey_id = trim(both '"' from survey_record::text);
  end loop;

  return v_conflicts;
end;
$$;

create or replace function public.push_attachments(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  attachment_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created attachments
  for attachment_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
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
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
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
        v_conflicts := array_append(v_conflicts, attachment_record->>'attachment_id');
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
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    update public.attachments
    set
      deleted_at = now(),
      updated_at = now()
    where attachment_id = trim(both '"' from attachment_record::text);
  end loop;

  return v_conflicts;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['establishments', 'purpose_of_inspection', 'inspection_reports', 'survey_reports', 'attachments'] loop
    execute format('revoke all on function public.push_%s(jsonb) from public, anon', t);
    execute format('grant execute on function public.push_%s(jsonb) to authenticated', t);
    execute format('revoke all on function public.pull_%s(bigint) from public, anon', t);
    execute format('grant execute on function public.pull_%s(bigint) to authenticated', t);
  end loop;
end;
$$;

insert into public.sync_tables (table_name, sync_order, push_handler, pull_handler, owner) values
  ('establishments',        10,  'public.push_establishments',        'public.pull_establishments',        'core'),
  ('purpose_of_inspection', 20,  'public.push_purpose_of_inspection', 'public.pull_purpose_of_inspection', 'core'),
  ('inspection_reports',    30,  'public.push_inspection_reports',    'public.pull_inspection_reports',    'core'),
  ('survey_reports',        40,  'public.push_survey_reports',        'public.pull_survey_reports',        'core'),
  ('attachments',           900, 'public.push_attachments',           'public.pull_attachments',           'core');

commit;
