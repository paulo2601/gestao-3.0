-- Official CAEPI mirror: populate from the MTE published dataset before enabling authoritative matches.
create table if not exists public.hr_epi_ca_catalog (
 ca_number text primary key check (ca_number ~ '^[0-9]+$'),
 equipment text not null,
 manufacturer text,
 model text,
 expires_on date,
 situation text,
 source_updated_at timestamptz,
 imported_at timestamptz not null default now()
);
create index if not exists hr_epi_ca_catalog_equipment_idx on public.hr_epi_ca_catalog(equipment);
alter table public.hr_epi_ca_catalog enable row level security;
grant select on public.hr_epi_ca_catalog to authenticated;
create policy hr_epi_ca_catalog_read on public.hr_epi_ca_catalog for select to authenticated using (true);
comment on table public.hr_epi_ca_catalog is 'Read-only public CAEPI reference mirror; ingestion must validate the official MTE source and record source_updated_at.';
