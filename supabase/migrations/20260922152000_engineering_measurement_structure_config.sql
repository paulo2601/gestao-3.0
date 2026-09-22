alter table public.engineering_measurement_origin_profiles
  add column if not exists units_per_floor integer not null default 0;

alter table public.engineering_measurement_origin_profiles
  drop constraint if exists engineering_measurement_origin_profiles_units_per_floor_check;

alter table public.engineering_measurement_origin_profiles
  add constraint engineering_measurement_origin_profiles_units_per_floor_check
  check (units_per_floor >= 0);

with scope_stats as (
  select
    s.work_id,
    s.origin_key,
    max(nullif(regexp_replace(value,'[^0-9]','','g'),'')::integer) as max_floor,
    max(s.original_quantity) as max_original_quantity
  from public.engineering_measurement_service_scopes s
  left join lateral unnest(s.scope_floors) as floors(value) on true
  group by s.work_id,s.origin_key
), structural as (
  select
    p.id,
    greatest(p.floor_count,coalesce(ss.max_floor,0)) as floor_count,
    case
      when coalesce(ss.max_floor,0) + case when p.has_ground then 1 else 0 end > 0
       and coalesce(ss.max_original_quantity,0) > 0
       and mod(ss.max_original_quantity,ss.max_floor + case when p.has_ground then 1 else 0 end) = 0
      then floor(ss.max_original_quantity / (ss.max_floor + case when p.has_ground then 1 else 0 end))::integer
      else 0
    end as units_per_floor
  from public.engineering_measurement_origin_profiles p
  left join scope_stats ss
    on ss.work_id=p.work_id and ss.origin_key=p.origin_key
  where p.origin_type='tower'
)
update public.engineering_measurement_origin_profiles p
set floor_count=s.floor_count,
    units_per_floor=s.units_per_floor,
    updated_at=now()
from structural s
where p.id=s.id;
