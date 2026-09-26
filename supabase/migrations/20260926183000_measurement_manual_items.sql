alter table public.measurement_lines
  add column if not exists manual_description text,
  add column if not exists manual_unit text;

alter table public.measurement_lines drop constraint if exists measurement_lines_exactly_one_source_check;
alter table public.measurement_lines drop constraint if exists measurement_lines_source_check;
alter table public.measurement_lines add constraint measurement_lines_source_check check (
  ((contract_service_id is not null)::int +
   (contract_addendum_line_id is not null)::int +
   (manual_description is not null)::int) = 1
);
alter table public.measurement_lines drop constraint if exists measurement_lines_manual_fields_check;
alter table public.measurement_lines add constraint measurement_lines_manual_fields_check check (
  manual_description is null or (btrim(manual_description) <> '' and nullif(btrim(manual_unit),'') is not null)
);
comment on column public.measurement_lines.manual_description is 'Descrição de item avulso lançado diretamente na medição; não afeta saldo contratual.';
comment on column public.measurement_lines.manual_unit is 'Unidade do item avulso lançado diretamente na medição.';
