-- Re-run this script after upgrading an existing demo database.
create table if not exists public.drivers (
  driver_id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  mobile_number text not null check (length(trim(mobile_number)) between 3 and 32),
  emergency_contact text not null check (length(trim(emergency_contact)) between 3 and 32),
  plate_number text not null check (length(trim(plate_number)) between 1 and 32),
  raspi_unique_id text not null unique check (raspi_unique_id ~ '^[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now()
);
alter table public.drivers drop column if exists hours_of_service;
alter table public.drivers enable row level security;
grant select, insert on public.drivers to anon;
drop policy if exists "demo_read_drivers" on public.drivers;
drop policy if exists "demo_add_drivers" on public.drivers;
create policy "demo_read_drivers" on public.drivers for select to anon using (true);
create policy "demo_add_drivers" on public.drivers for insert to anon with check (true);

-- Only the server-side MQTT worker can update these tables.
create table if not exists public.driver_heartbeat_state (
  raspi_unique_id text primary key references public.drivers(raspi_unique_id) on delete cascade,
  last_seen timestamptz not null
);
create table if not exists public.driver_daily_service (
  raspi_unique_id text not null references public.drivers(raspi_unique_id) on delete cascade,
  service_date date not null,
  active_seconds numeric(12,2) not null default 0 check (active_seconds >= 0),
  primary key (raspi_unique_id, service_date)
);
alter table public.driver_heartbeat_state enable row level security;
alter table public.driver_daily_service enable row level security;
revoke all on public.driver_heartbeat_state from anon, authenticated;
revoke all on public.driver_daily_service from anon, authenticated;
grant select on public.driver_daily_service to anon;
drop policy if exists "demo_read_daily_service" on public.driver_daily_service;
create policy "demo_read_daily_service" on public.driver_daily_service for select to anon using (true);

create or replace function public.record_driver_heartbeat(
  p_raspi_unique_id text,
  p_time_zone text default 'Asia/Jakarta'
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_last timestamptz;
  v_day date;
  v_day_start timestamptz;
  v_today_seconds numeric(12,2);
  v_prior_seconds numeric(12,2);
begin
  if not exists (select 1 from public.drivers where raspi_unique_id = p_raspi_unique_id) then
    return;
  end if;
  v_day := (v_now at time zone p_time_zone)::date;
  v_day_start := v_day::timestamp at time zone p_time_zone;
  insert into public.driver_heartbeat_state (raspi_unique_id, last_seen)
    values (p_raspi_unique_id, v_now)
    on conflict (raspi_unique_id) do nothing;
  select last_seen into v_last from public.driver_heartbeat_state
    where raspi_unique_id = p_raspi_unique_id for update;

  -- Count only consecutive heartbeats. A gap over 15 seconds ends the session.
  if v_last is not null and v_now > v_last and v_now - v_last <= interval '15 seconds' then
    v_today_seconds := round(extract(epoch from v_now - greatest(v_last, v_day_start))::numeric, 2);
    if v_today_seconds > 0 then
      insert into public.driver_daily_service (raspi_unique_id, service_date, active_seconds)
        values (p_raspi_unique_id, v_day, v_today_seconds)
        on conflict (raspi_unique_id, service_date) do update
        set active_seconds = public.driver_daily_service.active_seconds + excluded.active_seconds;
    end if;
    if v_last < v_day_start then
      v_prior_seconds := round(extract(epoch from v_day_start - v_last)::numeric, 2);
      if v_prior_seconds > 0 then
        insert into public.driver_daily_service (raspi_unique_id, service_date, active_seconds)
          values (p_raspi_unique_id, (v_last at time zone p_time_zone)::date, v_prior_seconds)
          on conflict (raspi_unique_id, service_date) do update
          set active_seconds = public.driver_daily_service.active_seconds + excluded.active_seconds;
      end if;
    end if;
  end if;
  update public.driver_heartbeat_state
    set last_seen = greatest(last_seen, v_now) where raspi_unique_id = p_raspi_unique_id;
end;
$$;
revoke all on function public.record_driver_heartbeat(text,text) from public, anon, authenticated;
grant execute on function public.record_driver_heartbeat(text,text) to service_role;

-- Preserve every valid MQTT payload received while the ingest worker is running.
create table if not exists public.driver_logs (
  id bigint generated always as identity primary key,
  raspi_unique_id text not null references public.drivers(raspi_unique_id) on delete cascade,
  device_timestamp timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  drowsy boolean not null,
  payload jsonb not null,
  unique (raspi_unique_id, device_timestamp)
);
create index if not exists driver_logs_serial_id_idx
  on public.driver_logs (raspi_unique_id, id desc);
alter table public.driver_logs enable row level security;
revoke all on public.driver_logs from anon, authenticated;
grant select on public.driver_logs to anon;
drop policy if exists "demo_read_driver_logs" on public.driver_logs;
create policy "demo_read_driver_logs" on public.driver_logs
  for select to anon using (true);

-- The service-role worker inserts a log and updates driving time together.
-- Duplicate QoS 1 deliveries keep one history entry and do not count twice.
create or replace function public.record_driver_log(
  p_raspi_unique_id text,
  p_payload jsonb,
  p_time_zone text default 'Asia/Jakarta'
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.drivers where raspi_unique_id = p_raspi_unique_id) then
    return;
  end if;
  insert into public.driver_logs
    (raspi_unique_id, device_timestamp, latitude, longitude, drowsy, payload)
  values
    (p_raspi_unique_id,
     (p_payload->>'timestamp')::timestamptz,
     (p_payload->>'latitude')::double precision,
     (p_payload->>'longitude')::double precision,
     (p_payload->>'drowsy')::boolean,
     p_payload)
  on conflict (raspi_unique_id, device_timestamp) do nothing;
  if found then
    perform public.record_driver_heartbeat(p_raspi_unique_id, p_time_zone);
  end if;
end;
$$;
revoke all on function public.record_driver_log(text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.record_driver_log(text,jsonb,text)
  to service_role;

