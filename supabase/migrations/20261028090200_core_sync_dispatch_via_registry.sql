begin;

-- push_changes / pull_changes become dispatchers over public.sync_tables
-- (20261028090000). Same signatures, same response shapes: handlers run in
-- sync_order — the order the old single body ran its table blocks in — and
-- conflicts are reported only for tables that have some.

create or replace function public.push_changes(changes jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  t record;
  v_ids text[];
  v_conflicts jsonb := '{}'::jsonb;
begin
  for t in select table_name, push_handler from public.sync_tables order by sync_order loop
    execute format('select %s($1)', t.push_handler)
      into v_ids
      using coalesce(changes->t.table_name, '{}'::jsonb);
    if coalesce(array_length(v_ids, 1), 0) > 0 then
      v_conflicts := v_conflicts || jsonb_build_object(t.table_name, to_jsonb(v_ids));
    end if;
  end loop;

  return jsonb_strip_nulls(jsonb_build_object(
    'status', 'ok',
    'conflicts', case when v_conflicts = '{}'::jsonb then null else v_conflicts end
  ));
end;
$$;

-- stable: a non-volatile function reads every table from the calling query's
-- one snapshot, like the old single-statement body (volatile would take a
-- fresh snapshot per EXECUTE, so a mid-pull push could split parent/child rows).
create or replace function public.pull_changes(last_pulled_at bigint default 0)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  t record;
  v_entity jsonb;
  v_changes jsonb := '{}'::jsonb;
begin
  for t in select table_name, pull_handler from public.sync_tables order by sync_order loop
    execute format('select %s($1)', t.pull_handler) into v_entity using last_pulled_at;
    v_changes := v_changes || jsonb_build_object(t.table_name, v_entity);
  end loop;

  return jsonb_build_object(
    'changes', v_changes,
    'timestamp', floor(extract(epoch from now()) * 1000)::bigint
  );
end;
$$;

commit;
