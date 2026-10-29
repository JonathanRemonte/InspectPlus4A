begin;

-- EMB4B's region tables in the sync registry (see 20261028090000). Bodies
-- are the compliance_* blocks of
-- 20260916100000_add_checklist_columns_to_compliance_air.sql, unchanged.
-- sync_order 100-199 is the region's band: after inspection_reports (their
-- parent), before attachments.

create or replace function public.push_compliance_air(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  compliance_air_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created compliance_air
  for compliance_air_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
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
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
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
        v_conflicts := array_append(v_conflicts, compliance_air_record->>'compliance_id');
      end if;
    exception when others then
      raise exception 'push_changes: compliance_air upsert (updated) failed (compliance_id=%, report_id=%): %',
        compliance_air_record->>'compliance_id', compliance_air_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted compliance_air
  for compliance_air_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    delete from public.compliance_air
    where compliance_id = trim(both '"' from compliance_air_record::text);
  end loop;

  return v_conflicts;
end;
$$;

create or replace function public.push_compliance_water(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  compliance_water_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created compliance_water
  for compliance_water_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
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
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
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
        v_conflicts := array_append(v_conflicts, compliance_water_record->>'compliance_id');
      end if;
    exception when others then
      raise exception 'push_changes: compliance_water upsert (updated) failed (compliance_id=%, report_id=%): %',
        compliance_water_record->>'compliance_id', compliance_water_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted compliance_water
  for compliance_water_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    delete from public.compliance_water
    where compliance_id = trim(both '"' from compliance_water_record::text);
  end loop;

  return v_conflicts;
end;
$$;

create or replace function public.push_compliance_hazwaste(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  compliance_hazwaste_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created compliance_hazwaste
  for compliance_hazwaste_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
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
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
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
        v_conflicts := array_append(v_conflicts, compliance_hazwaste_record->>'compliance_id');
      end if;
    exception when others then
      raise exception 'push_changes: compliance_hazwaste upsert (updated) failed (compliance_id=%, report_id=%): %',
        compliance_hazwaste_record->>'compliance_id', compliance_hazwaste_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted compliance_hazwaste
  for compliance_hazwaste_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    delete from public.compliance_hazwaste
    where compliance_id = trim(both '"' from compliance_hazwaste_record::text);
  end loop;

  return v_conflicts;
end;
$$;

create or replace function public.push_compliance_eia(p_changes jsonb)
returns text[] language plpgsql set search_path = public as $$
declare
  compliance_eia_record jsonb;
  v_row_count integer;
  v_conflicts text[] := '{}';
begin
  -- Handle created compliance_eia
  for compliance_eia_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'created', '[]'::jsonb))
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
    from jsonb_array_elements(coalesce(p_changes->'updated', '[]'::jsonb))
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
        v_conflicts := array_append(v_conflicts, compliance_eia_record->>'compliance_id');
      end if;
    exception when others then
      raise exception 'push_changes: compliance_eia upsert (updated) failed (compliance_id=%, report_id=%): %',
        compliance_eia_record->>'compliance_id', compliance_eia_record->>'report_id', sqlerrm;
    end;
  end loop;

  -- Handle deleted compliance_eia
  for compliance_eia_record in
    select value
    from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb))
  loop
    delete from public.compliance_eia
    where compliance_id = trim(both '"' from compliance_eia_record::text);
  end loop;

  return v_conflicts;
end;
$$;

create or replace function public.pull_compliance_air(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(ca)) from public.compliance_air ca
      join public.inspection_reports ir on ir.report_id = ca.report_id
      where floor(extract(epoch from ir.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', '[]'::jsonb);
$$;

create or replace function public.pull_compliance_water(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(cw)) from public.compliance_water cw
      join public.inspection_reports ir on ir.report_id = cw.report_id
      where floor(extract(epoch from ir.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', '[]'::jsonb);
$$;

create or replace function public.pull_compliance_hazwaste(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(ch)) from public.compliance_hazwaste ch
      join public.inspection_reports ir on ir.report_id = ch.report_id
      where floor(extract(epoch from ir.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', '[]'::jsonb);
$$;

create or replace function public.pull_compliance_eia(last_pulled_at bigint)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'created', coalesce((
      select jsonb_agg(to_jsonb(ce)) from public.compliance_eia ce
      join public.inspection_reports ir on ir.report_id = ce.report_id
      where floor(extract(epoch from ir.updated_at) * 1000)::bigint > last_pulled_at
    ), '[]'::jsonb),
    'updated', '[]'::jsonb,
    'deleted', '[]'::jsonb);
$$;

do $$
declare
  t text;
begin
  foreach t in array array['compliance_air', 'compliance_water', 'compliance_hazwaste', 'compliance_eia'] loop
    execute format('revoke all on function public.push_%s(jsonb) from public, anon', t);
    execute format('grant execute on function public.push_%s(jsonb) to authenticated', t);
    execute format('revoke all on function public.pull_%s(bigint) from public, anon', t);
    execute format('grant execute on function public.pull_%s(bigint) to authenticated', t);
  end loop;
end;
$$;

insert into public.sync_tables (table_name, sync_order, push_handler, pull_handler, owner) values
  ('compliance_air',      100, 'public.push_compliance_air',      'public.pull_compliance_air',      'region'),
  ('compliance_water',    110, 'public.push_compliance_water',    'public.pull_compliance_water',    'region'),
  ('compliance_hazwaste', 120, 'public.push_compliance_hazwaste', 'public.pull_compliance_hazwaste', 'region'),
  ('compliance_eia',      130, 'public.push_compliance_eia',      'public.pull_compliance_eia',      'region');

commit;
